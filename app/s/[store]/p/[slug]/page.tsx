import { notFound } from 'next/navigation'
import { formatMoney } from '@/lib/utils'
import { getStorefront } from '../../data'
import { OrderForm } from './OrderForm'
import { ProductSections } from './ProductSections'
import MetaPixelTracker from './MetaPixelTracker'
import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_cache } from 'next/cache'

type Product = {
  id: string
  title: string
  description: string
  images: string[]
  variants: { id: string; title: string; stock: number | null; variant_prices: { market_id: string; price: number; compare_at_price: number | null }[] }[]
}

// Cache Pixel ID 60s côté serveur
const getPixelId = unstable_cache(
  async (storeId: string) => {
    try {
      const admin = createAdminClient()
      const { data: integration } = await admin
        .from('store_meta_integrations')
        .select('pixel_id')
        .eq('store_id', storeId)
        .maybeSingle()
      return integration?.pixel_id || ''
    } catch (error) {
      console.error('[storefront/meta] Pixel settings unavailable:', error instanceof Error ? error.message : 'unknown error')
      return ''
    }
  },
  ['meta-pixel-id'],
  { revalidate: 60, tags: ['meta-pixel'] }
)

/** Page produit minimale. L'éditeur de sections et le formulaire de commande arrivent aux étapes 2 et 3. */
export default async function ProductPage({ params, searchParams }: { params: Promise<{ store: string; slug: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ store: storeSlug, slug }, { m }] = await Promise.all([params, searchParams])
  const data = await getStorefront(storeSlug, m)
  if (!data?.market) notFound()
  const { supabase, store, market } = data

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'
  const apiBase = `${rootDomain.startsWith('localhost') ? 'http' : 'https'}://${rootDomain}`

  // ── Produit + config formulaire + pixel en parallèle ───────────────────
  const [{ data: row }, { data: form }, metaPixelId] = await Promise.all([
    supabase
      .from('products')
      .select('id, title, description, images, variants(id, title, stock, variant_prices(market_id, price, compare_at_price))')
      .eq('store_id', store.id)
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('form_configs')
      .select('mode, fields, bundle, styles, upsells, quantity_offers')
      .eq('store_id', store.id)
      .eq('name', 'Formulaire principal')
      .maybeSingle(),
    getPixelId(store.id),
  ])

  if (!row) notFound()
  const product = row as unknown as Product

  // ── Page produit (nécessite product.id) ────────────────────────────────
  const { data: page } = await supabase
    .from('product_pages')
    .select('sections')
    .eq('product_id', product.id)
    .eq('store_id', store.id)
    .is('market_id', null)
    .maybeSingle()

  const formConfig = form
    ? {
        ...form,
        bundle: (form as any).quantity_offers?.length
          ? {
              enabled: true,
              offers: (form as any).quantity_offers.map((offer: any) => ({
                label: offer.title || `${offer.quantity} unités`,
                price: String(offer.discountType === 'fixed' ? offer.discount : ''),
              })),
            }
          : (form as any).bundle,
      }
    : null

  const price = product.variants
    .flatMap((v) => v.variant_prices)
    .filter((p) => p.market_id === market.id)
    .sort((a, b) => Number(a.price) - Number(b.price))[0]
  if (!price) notFound()

  return (
    <>
    {metaPixelId && (
      <MetaPixelTracker
        pixelId={metaPixelId}
        productId={product.id}
        productName={product.title}
        value={Number(price.price)}
        currency={market.currency}
      />
    )}
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-2xl bg-zinc-100">
          {product.images[0] && (/\.(mp4|webm|mov)(\?|$)/i.test(product.images[0])
            ? <video src={product.images[0]} controls className="size-full object-cover" />
            : <img src={product.images[0]} alt={product.title} className="size-full object-cover" loading="eager" fetchPriority="high" />)}
        </div>
        {product.images.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {product.images.slice(1, 6).map((src) => (
              /\.(mp4|webm|mov)(\?|$)/i.test(src)
                ? <video key={src} src={src} controls className="aspect-square rounded-xl object-cover" />
                : <img key={src} src={src} alt="" className="aspect-square rounded-xl object-cover" loading="lazy" />
            ))}
          </div>
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>
        <p className="mt-3 text-2xl">
          <span className="font-bold" style={{ color: store.primary_color }}>
            {formatMoney(price.price, market.currency)}
          </span>
          {price.compare_at_price && <span className="ml-3 text-lg text-zinc-400 line-through">{formatMoney(price.compare_at_price, market.currency)}</span>}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Livraison {Number(market.shipping_fee) === 0 ? 'gratuite' : formatMoney(market.shipping_fee, market.currency)} · {market.name} · Paiement à la livraison
        </p>
        {product.description && <div className="prose prose-zinc mt-6 max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />}
        <OrderForm storeId={store.id} marketId={market.id} currency={market.currency} shipping={Number(market.shipping_fee)} price={Number(price.price)} stock={product.variants[0].stock} variantId={product.variants[0].id} productId={product.id} apiBase={apiBase} accent={store.primary_color} productName={product.title} config={formConfig as any} />
      </div>
      <div className="md:col-span-2"><ProductSections sections={(page?.sections ?? []) as any[]} product={product} accent={store.primary_color} /></div>
    </main>
    </>
  )
}
