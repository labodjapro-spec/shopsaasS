import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'
import { buildStorePage } from '@/lib/store-builder/boutique-themes'

function getAdminClient() {
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Crée une nouvelle store_page rattachée à la boutique parente (store_id).
 * Les commandes iront dans le dashboard de cette boutique.
 * Le marché et les produits sont partagés avec la boutique parente.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { store_id, name, slug, theme_id = 'nature-vert', product_id = null } = body

    if (!store_id) return NextResponse.json({ error: 'store_id requis.' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 })
    if (!slug?.trim()) return NextResponse.json({ error: 'Le slug est requis.' }, { status: 400 })

    const admin = getAdminClient()

    const { data: store } = await admin
      .from('stores').select('id, name, owner_id').eq('id', store_id).maybeSingle()
    if (!store) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 })
    let canWritePages = store.owner_id === user.id
    if (!canWritePages) {
      const { data: membership } = await supabase
        .from('store_members')
        .select('roles(permissions)')
        .eq('store_id', store_id)
        .eq('user_id', user.id)
        .maybeSingle()
      const role = Array.isArray((membership as any)?.roles) ? (membership as any).roles[0] : (membership as any)?.roles
      const permissions = Array.isArray(role?.permissions) ? role.permissions : []
      canWritePages = permissions.includes('*') || permissions.includes('pages.write')
    }
    if (!canWritePages) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }
    if (product_id) {
      const { data: product } = await admin.from('products')
        .select('id')
        .eq('id', product_id)
        .eq('store_id', store_id)
        .maybeSingle()
      if (!product) return NextResponse.json({ error: 'Le produit ne correspond pas à cette boutique.' }, { status: 400 })
    }

    // Vérifier unicité du slug GLOBALEMENT (la route /s/[slug] est globale)
    const { data: existingPage } = await admin
      .from('store_pages').select('id').eq('slug', slug.trim()).maybeSingle()
    if (existingPage) {
      const variant = `${slug.trim()}-${Math.floor(10 + Math.random() * 90)}`
      return NextResponse.json({ error: `Cette adresse est déjà utilisée. Essaie : ${variant}` }, { status: 400 })
    }
    // Vérifier aussi unicité dans les stores (stores.slug)
    const { data: existingStore } = await admin
      .from('stores').select('id').eq('slug', slug.trim()).maybeSingle()
    if (existingStore) {
      const variant = `${slug.trim()}-${Math.floor(10 + Math.random() * 90)}`
      return NextResponse.json({ error: `Cette adresse est déjà utilisée. Essaie : ${variant}` }, { status: 400 })
    }

    // Construire le builder_json avec le thème choisi
    const builderJson = buildStorePage(theme_id, name.trim(), product_id)

    // Créer la page rattachée à la boutique parente
    const { data: page, error: pageError } = await admin
      .from('store_pages')
      .insert({
        store_id,
        title: name.trim(),
        slug: slug.trim(),
        is_published: false,
        builder_json: builderJson,
      })
      .select('id, store_id, slug, title')
      .single()

    if (pageError || !page) {
      console.error('[pages/create]', pageError?.message)
      return NextResponse.json({ error: 'Impossible de créer la page.' }, { status: 500 })
    }

    return NextResponse.json({ data: { id: page.id, store_id, slug: page.slug, title: page.title } })

  } catch (err: any) {
    console.error('[pages/create] crash:', err.message)
    return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
  }
}
