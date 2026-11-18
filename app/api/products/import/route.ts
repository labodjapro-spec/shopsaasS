import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cleanSourceUrl, fetchText } from '@/lib/import/ssrf'
import { detectPlatform } from '@/lib/import/detect'
import { extractShopify } from '@/lib/import/shopify'
import { extractYouCan } from '@/lib/import/youcan'
import { extractGeneric } from '@/lib/import/generic'
import { cleanDescription, applyPricingRules } from '@/lib/import/clean-description'
import { slugify } from '@/lib/utils'
import type { ImportedProduct } from '@/lib/import/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { url: rawUrl, storeId } = body as { url: string; storeId: string }

    if (!rawUrl || !storeId) {
      return NextResponse.json(
        { error: 'url et storeId sont requis' },
        { status: 400 },
      )
    }

    // 1. Nettoyer l'URL
    let cleanedUrl: string
    try {
      cleanedUrl = cleanSourceUrl(rawUrl.trim())
    } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }

    // 2. Vérifier que l'utilisateur est authentifié et membre du magasin
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Vérifier l'appartenance au magasin (même pattern que context.ts)
    const { data: rawMembership } = await supabase
      .from('store_members')
      .select('store_id, roles(id, permissions)')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .limit(1)

    if (!rawMembership || rawMembership.length === 0)
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const membership = rawMembership[0] as unknown as {
      store_id: string
      roles: { id: string; permissions: string[] }
    }

    const perms: string[] = membership.roles?.permissions ?? []
    if (!perms.includes('*') && !perms.includes('products.write')) {
      return NextResponse.json(
        { error: 'Permission insuffisante' },
        { status: 403 },
      )
    }

    // 3. Télécharger le HTML
    let html: string
    let u: URL
    try {
      u = new URL(cleanedUrl)
      html = await fetchText(cleanedUrl)
    } catch (e: any) {
      return NextResponse.json(
        { error: `Impossible d'accéder à la page : ${e.message}` },
        { status: 422 },
      )
    }

    // 4. Détecter la plateforme et extraire
    const platform = detectPlatform(u, html)
    let product: ImportedProduct

    try {
      if (platform === 'shopify') {
        product = await extractShopify(u, html)
      } else if (platform === 'youcan') {
        product = await extractYouCan(u, html)
      } else {
        product = extractGeneric(u, html)
      }
    } catch (e: any) {
      // Si l'extracteur dédié échoue, essayer le générique
      try {
        product = extractGeneric(u, html)
      } catch {
        return NextResponse.json(
          { error: `Extraction impossible : ${e.message}` },
          { status: 422 },
        )
      }
    }

    // 5. Valider
    if (!product.title || product.title.length < 2) {
      return NextResponse.json(
        {
          error: 'NOT_A_PRODUCT_PAGE : titre manquant',
          code: 'NOT_A_PRODUCT_PAGE',
        },
        { status: 422 },
      )
    }
    if (product.images.length === 0) {
      return NextResponse.json(
        {
          error: 'NOT_A_PRODUCT_PAGE : aucune image trouvée',
          code: 'NOT_A_PRODUCT_PAGE',
        },
        { status: 422 },
      )
    }

    // 6. Nettoyer la description
    const description = cleanDescription(product.descriptionHtml, u.origin)

    // 7. Appliquer les règles de prix
    const pricing = applyPricingRules(product.price, product.currency)

    // 8. Générer un slug unique
    const baseSlug =
      slugify(product.title) || `produit-${Date.now().toString(36)}`
    let slug = baseSlug
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
    }

    // 9. Créer le produit en brouillon
    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        store_id: storeId,
        title: product.title.substring(0, 200),
        slug,
        description,
        images: product.images.slice(0, 20),
        status: 'draft',
      })
      .select('id')
      .single()

    if (productError || !newProduct) {
      console.error('[import] Erreur insertion produit:', productError)
      return NextResponse.json(
        {
          error:
            'Impossible de créer le produit : ' + productError?.message,
        },
        { status: 500 },
      )
    }

    // 10. Créer la variante avec stock 1000
    const { data: variant, error: variantError } = await supabase
      .from('variants')
      .insert({
        product_id: newProduct.id,
        store_id: storeId,
        title: 'Défaut',
        position: 0,
        stock: pricing.stock,
      })
      .select('id')
      .single()

    if (variantError) {
      console.error('[import] Erreur insertion variante:', variantError)
    }

    // 11. Si marché par défaut existe, créer le prix
    if (variant && pricing.price > 0) {
      const { data: market } = await supabase
        .from('markets')
        .select('id')
        .eq('store_id', storeId)
        .eq('is_default', true)
        .eq('active', true)
        .maybeSingle()

      if (market) {
        await supabase.from('variant_prices').upsert(
          {
            variant_id: variant.id,
            market_id: market.id,
            store_id: storeId,
            price: pricing.price,
            compare_at_price: pricing.compareAtPrice,
          },
          { onConflict: 'variant_id,market_id' },
        )
      }
    }

    return NextResponse.json({
      productId: newProduct.id,
      platform,
      title: product.title,
      images: product.images.length,
      needsPriceCheck: pricing.needsPriceCheck,
    })
  } catch (err: any) {
    console.error('[import] Erreur inattendue:', err)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
