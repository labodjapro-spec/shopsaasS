import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { buildStorePage, getBoutiqueTheme, buildThemeSettings } from '@/lib/store-builder/boutique-themes'
import EditorClient from '../../[id]/EditorClient'

export default async function PageEditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params
  const supabase = await createClient()

  // Charger la page avec son store parent
  const { data: storePage } = await supabase
    .from('store_pages')
    .select('*, stores(id, name, slug, status, owner_id, store_settings(*))')
    .eq('id', pageId)
    .maybeSingle()

  if (!storePage || !storePage.stores) notFound()

  const store = storePage.stores as any
  const storeId = store.id

  // Vérifier l'accès — propriétaire ou membre avec pages.write
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (store.owner_id !== user.id) {
    const { data: member } = await supabase
      .from('store_members').select('roles(permissions)')
      .eq('store_id', storeId).eq('user_id', user.id).maybeSingle()
    const role = Array.isArray((member as any)?.roles) ? (member as any).roles[0] : (member as any)?.roles
    const permissions = Array.isArray(role?.permissions) ? role.permissions : []
    if (!permissions.includes('*') && !permissions.includes('pages.write')) redirect('/dashboard?refus=1')
  }

  // Marché de la boutique parente
  const { data: defaultMarket } = await supabase
    .from('markets').select('id, currency').eq('store_id', storeId).eq('is_default', true).maybeSingle()
  const { data: anyMarket } = !defaultMarket
    ? await supabase.from('markets').select('id, currency').eq('store_id', storeId).limit(1).maybeSingle()
    : { data: null }
  const market = defaultMarket ?? anyMarket

  // Produits de la boutique parente
  const { data: products } = await supabase
    .from('products')
    .select('id, title, images, description, status, variants(id, variant_prices(market_id, price, compare_at_price))')
    .eq('store_id', storeId).eq('status', 'active')
    .order('created_at', { ascending: false })

  const productsWithPrice = (products ?? []).map((p: any) => {
    const allPrices = (p.variants ?? []).flatMap((v: any) => v.variant_prices ?? [])
    const marketPrice = market
      ? allPrices.find((vp: any) => vp.market_id === market.id) ?? allPrices[0]
      : allPrices[0]
    return {
      ...p,
      price: marketPrice?.price ?? null,
      compare_at_price: marketPrice?.compare_at_price ?? null,
      currency: market?.currency ?? 'XOF',
    }
  })

  let builderJson = storePage.builder_json

  // Générer si vide
  if (!builderJson || (!builderJson.template?.length && !builderJson.header?.length)) {
    const storeSettings = Array.isArray(store.store_settings) ? store.store_settings[0] : store.store_settings
    const themeId = storeSettings?.theme_id || 'nature-vert'
    builderJson = buildStorePage(themeId, storePage.title || store.name, null)
    await supabase.from('store_pages').update({ builder_json: builderJson }).eq('id', pageId)
  }

  // Migration layout si absent
  if (builderJson?.themeSettings && !builderJson.themeSettings.layout) {
    const storeSettings = Array.isArray(store.store_settings) ? store.store_settings[0] : store.store_settings
    const themeId = storeSettings?.theme_id || 'nature-vert'
    const theme = getBoutiqueTheme(themeId)
    const canonical = buildThemeSettings(theme)
    builderJson = {
      ...builderJson,
      themeSettings: {
        ...canonical,
        ...builderJson.themeSettings,
        layout: builderJson.themeSettings.layout || canonical.layout,
      },
    }
    await supabase.from('store_pages').update({ builder_json: builderJson }).eq('id', pageId)
  }

  // ── api_base : vide en production, localhost en dev ────────────────────
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'
  const isLocal = rootDomain.startsWith('localhost')
  const apiBase = isLocal ? `http://${rootDomain}` : ''

  builderJson = {
    ...builderJson,
    themeSettings: {
      ...(builderJson?.themeSettings ?? {}),
      market_id: market?.id ?? null,
      currency: market?.currency ?? 'XOF',
      store_id: storeId,       // commandes → dashboard de la boutique parente
      api_base: apiBase,
    },
  }

  return (
    <EditorClient
      storeId={pageId}       // storeId = pageId pour sauvegarder cette page
      storeName={storePage.title || store.name}
      storeSlug={storePage.slug}
      returnHref={`/boutiques?parent=${storeId}`}
      storeStatus={storePage.is_published ? 'published' : 'draft'}
      initialData={builderJson}
      products={productsWithPrice || []}
      apiBase={apiBase}
    />
  )
}
