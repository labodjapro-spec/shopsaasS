import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PublicPageRenderer from './PublicPageRenderer'
import MetaPixelTracker from './p/[slug]/MetaPixelTracker'
import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_cache } from 'next/cache'

// ── Charge le Pixel ID depuis le cache (60s) ───────────────────────────────
const loadMetaPixelId = unstable_cache(
  async (storeId: string) => {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from('store_meta_integrations')
        .select('pixel_id')
        .eq('store_id', storeId)
        .maybeSingle()
      return data?.pixel_id || ''
    } catch (error) {
      console.error('[storefront/meta] Pixel settings unavailable:', error instanceof Error ? error.message : 'unknown error')
      return ''
    }
  },
  ['meta-pixel-id'],
  { revalidate: 60, tags: ['meta-pixel'] }
)

export default async function StorePublicPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const supabase = await createClient()

  // ── Boutique ────────────────────────────────────────────────────────────
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  // ── Cas page produit : le slug correspond à une store_page directement ──
  if (!store) {
    const { data: directPage } = await supabase
      .from('store_pages')
      .select('id, store_id, slug, builder_json, is_published, stores(id, name, slug, owner_id)')
      .eq('slug', slug)
      .maybeSingle()

    if (!directPage?.stores) notFound()

    const parentStore = directPage.stores as any

    // ── Marché + produits en parallèle ────────────────────────────────────
    const [{ data: mkt }, { data: rawProds }] = await Promise.all([
      supabase
        .from('markets').select('id, currency, name, shipping_fee')
        .eq('store_id', parentStore.id).eq('is_default', true).maybeSingle(),
      supabase
        .from('products')
        .select('id, title, images, description, status, variants(id, variant_prices(market_id, price, compare_at_price))')
        .eq('store_id', parentStore.id).eq('status', 'active').order('created_at', { ascending: false }),
    ])

    // Fallback marché si pas de default
    let market: any = mkt
    if (!market) {
      const { data: anyMkt } = await supabase
        .from('markets').select('id, currency, name, shipping_fee')
        .eq('store_id', parentStore.id).limit(1).maybeSingle()
      market = anyMkt
    }

    const marketId = market?.id ?? null
    const currency = market?.currency ?? 'XOF'

    const products = (rawProds ?? []).map((p: any) => {
      const allPrices = (p.variants ?? []).flatMap((v: any) => v.variant_prices ?? [])
      const mp = marketId ? (allPrices.find((vp: any) => vp.market_id === marketId) ?? allPrices[0]) : allPrices[0]
      return { ...p, price: mp?.price ?? null, compare_at_price: mp?.compare_at_price ?? null, currency }
    })

    const rootDomain2 = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').trim()
    const isLocal2 = rootDomain2.startsWith('localhost')
    const apiBase2 = isLocal2 ? `http://${rootDomain2}` : ''
    const builderJson = {
      ...directPage.builder_json,
      themeSettings: {
        ...(directPage.builder_json?.themeSettings ?? {}),
        currency, market_id: marketId,
        store_id: parentStore.id,
        api_base: apiBase2,
        shipping_fee: market?.shipping_fee ?? 0,
      },
    }
    const selectedProduct = products.find((item: any) => item.id === builderJson?.selectedProductId) ?? products[0]
    const pixelId = await loadMetaPixelId(parentStore.id)

    return (
      <>
        {pixelId && (
          <MetaPixelTracker
            pixelId={pixelId}
            productId={selectedProduct?.id}
            productName={selectedProduct?.title}
            value={Number(selectedProduct?.price) || undefined}
            currency={selectedProduct?.currency || currency}
          />
        )}
        <PublicPageRenderer data={builderJson} products={products} storeId={parentStore.id} />
      </>
    )
  }

  if (!store) notFound()

  // ── Page builder + marché + produits + pixel en parallèle ───────────────
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').trim()
  const isLocal = rootDomain.startsWith('localhost')
  const apiBase = isLocal ? `http://${rootDomain}` : ''

  const [
    { data: storePage },
    { data: defaultMarket },
    { data: rawProducts },
    pixelId,
  ] = await Promise.all([
    supabase
      .from('store_pages')
      .select('builder_json, is_published')
      .eq('store_id', store.id)
      .eq('slug', 'home')
      .maybeSingle(),
    supabase
      .from('markets')
      .select('id, currency, name, shipping_fee')
      .eq('store_id', store.id)
      .eq('is_default', true)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, title, images, description, status, variants(id, variant_prices(market_id, price, compare_at_price))')
      .eq('store_id', store.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    loadMetaPixelId(store.id),
  ])

  if (!storePage?.builder_json) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Cette page n&apos;a pas encore de contenu.</p>
      </main>
    )
  }

  // ── Fallback marché si pas de default ────────────────────────────────────
  let market: any = defaultMarket
  if (!market) {
    const { data: anyMarket } = await supabase
      .from('markets')
      .select('id, currency, name, shipping_fee')
      .eq('store_id', store.id)
      .limit(1)
      .maybeSingle()
    market = anyMarket
  }

  const marketId = market?.id ?? null
  const currency = market?.currency ?? 'XOF'

  const products = (rawProducts ?? []).map((p: any) => {
    const allPrices = (p.variants ?? []).flatMap((v: any) => v.variant_prices ?? [])
    const marketPrice = marketId
      ? (allPrices.find((vp: any) => vp.market_id === marketId) ?? allPrices[0])
      : allPrices[0]
    return {
      ...p,
      price: marketPrice?.price ?? null,
      compare_at_price: marketPrice?.compare_at_price ?? null,
      currency,
    }
  })

  const builderJson = {
    ...storePage.builder_json,
    themeSettings: {
      ...(storePage.builder_json?.themeSettings ?? {}),
      currency,
      market_id: marketId,
      shipping_fee: market?.shipping_fee ?? 0,
      store_id: store.id,
      api_base: apiBase,
    },
  }
  const selectedProduct = products.find((item: any) => item.id === builderJson?.selectedProductId) ?? products[0]

  return (
    <>
      {pixelId && (
        <MetaPixelTracker
          pixelId={pixelId}
          productId={selectedProduct?.id}
          productName={selectedProduct?.title}
          value={Number(selectedProduct?.price) || undefined}
          currency={selectedProduct?.currency || currency}
        />
      )}
      <PublicPageRenderer
        data={builderJson}
        products={products}
        storeId={store.id}
      />
    </>
  )
}
