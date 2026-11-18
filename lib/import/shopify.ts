import { safeFetch } from './ssrf'
import type { ImportedProduct } from './types'

function extractMetaCurrency(html: string): string | null {
  const m =
    html.match(
      /property=['"](og:price:currency|product:price:currency)['"]\s+content=['"]([^'"]+)['"]/i,
    ) ??
    html.match(
      /content=['"]([^'"]+)['"]\s+property=['"](og:price:currency|product:price:currency)['"]/i,
    )
  return m?.[2] ?? m?.[1] ?? null
}

export async function extractShopify(u: URL, html: string): Promise<ImportedProduct> {
  const m = u.pathname.match(/\/products\/([^/?#]+)/)
  if (!m) throw new Error('NOT_A_PRODUCT_PAGE')
  const handle = m[1]

  // Essai 1 : /products/{handle}.json
  let product: any = null
  try {
    const res = await safeFetch(`${u.origin}/products/${handle}.json`)
    if (res.ok) {
      const data = await res.json()
      product = data?.product
    }
  } catch {}

  // Essai 2 : /products.json?limit=250 filtré par handle
  if (!product?.title) {
    try {
      const res = await safeFetch(`${u.origin}/products.json?limit=250`)
      if (res.ok) {
        const data = await res.json()
        product = (data?.products ?? []).find(
          (p: any) => p.handle === handle,
        )
      }
    } catch {}
  }

  if (!product?.title) throw new Error('SHOPIFY_JSON_UNAVAILABLE')

  // Prix : première variante disponible
  const variant =
    product.variants?.find((v: any) => v.available) ?? product.variants?.[0]
  const price = Number(variant?.price ?? 0)

  // Devise depuis les meta tags HTML
  const currency = extractMetaCurrency(html)

  // Images (résoudre URLs sans protocole)
  const images: string[] = (product.images ?? [])
    .map((img: any) => {
      let src = img.src as string
      if (src?.startsWith('//')) src = 'https:' + src
      return src
    })
    .filter(Boolean)

  return {
    sourceUrl: u.href,
    platform: 'shopify',
    title: product.title,
    descriptionHtml: product.body_html ?? '',
    images,
    price,
    currency,
  }
}
