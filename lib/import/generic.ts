import type { ImportedProduct } from './types'

function metaContent(html: string, prop: string): string | undefined {
  const m =
    html.match(
      new RegExp(`property=['"]${prop}['"][^>]+content=['"]([^'"]+)['"]`, 'i'),
    ) ??
    html.match(
      new RegExp(`content=['"]([^'"]+)['"][^>]+property=['"]${prop}['"]`, 'i'),
    ) ??
    html.match(
      new RegExp(`name=['"]${prop}['"][^>]+content=['"]([^'"]+)['"]`, 'i'),
    ) ??
    html.match(
      new RegExp(`content=['"]([^'"]+)['"][^>]+name=['"]${prop}['"]`, 'i'),
    )
  return m?.[1]
}

function extractJsonLd(html: string): {
  title?: string
  price?: number
  description?: string
  images?: string[]
} {
  const result: {
    title?: string
    price?: number
    description?: string
    images?: string[]
  } = {}
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1])
      const items: any[] = parsed['@graph']
        ? parsed['@graph']
        : Array.isArray(parsed)
          ? parsed
          : [parsed]
      for (const item of items) {
        if (item['@type'] !== 'Product') continue
        if (item.name && !result.title) result.title = item.name
        if (!result.price) {
          const offers = Array.isArray(item.offers)
            ? item.offers[0]
            : item.offers
          if (offers?.price) result.price = Number(offers.price)
        }
        if (item.description && !result.description)
          result.description = item.description
        if (item.image && !result.images?.length) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image]
          result.images = imgs
            .map((i: any) =>
              typeof i === 'string' ? i : (i?.url ?? ''),
            )
            .filter(Boolean)
        }
        if (result.title) break
      }
    } catch {}
  }
  return result
}

export function extractGeneric(u: URL, html: string): ImportedProduct {
  const ld = extractJsonLd(html)

  const title =
    ld.title ??
    metaContent(html, 'og:title') ??
    html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)?.[1]?.trim() ??
    ''

  const priceStr =
    metaContent(html, 'product:price:amount') ??
    metaContent(html, 'og:price:amount')
  const price = ld.price ?? (priceStr ? Number(priceStr) : 0)

  const currency =
    metaContent(html, 'product:price:currency') ??
    metaContent(html, 'og:price:currency') ??
    null

  // Images OG
  const ogImg = metaContent(html, 'og:image')
  const images: string[] = []
  if (ogImg) images.push(ogImg)
  if (ld.images?.length) {
    for (const img of ld.images) {
      try {
        images.push(new URL(img, u.origin).href)
      } catch {}
    }
  }

  // Description : JSON-LD ou meta description
  const descriptionHtml =
    ld.description ?? metaContent(html, 'description') ?? ''

  return {
    sourceUrl: u.href,
    platform: 'generic',
    title,
    descriptionHtml,
    images: [...new Set(images)].filter(Boolean),
    price,
    currency,
  }
}
