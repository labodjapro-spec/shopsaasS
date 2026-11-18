import { safeFetch } from './ssrf'
import type { ImportedProduct } from './types'

/* ─────────────────────────────────────────────────────────────
   HELPER — lire un <meta> par property ou name
───────────────────────────────────────────────────────────── */
function metaAttr(html: string, name: string): string | undefined {
  const m =
    html.match(new RegExp(`property=['"]${name}['"][^>]+content=['"]([^'"]+)['"]`, 'i')) ??
    html.match(new RegExp(`content=['"]([^'"]+)['"][^>]+property=['"]${name}['"]`, 'i')) ??
    html.match(new RegExp(`name=['"]${name}['"][^>]+content=['"]([^'"]+)['"]`, 'i')) ??
    html.match(new RegExp(`content=['"]([^'"]+)['"][^>]+name=['"]${name}['"]`, 'i'))
  return m?.[1]
}

/* ─────────────────────────────────────────────────────────────
   EXTRACTEUR PRINCIPAL — attribut :product="..." du composant Vue
   <product-show :product="{&quot;id&quot;:...,&quot;description&quot;:...}">
   Toutes les " intérieures sont encodées &quot;, donc
   :product="([^"]+)" capture l'intégralité du JSON encodé.
───────────────────────────────────────────────────────────── */
function extractProductShowAttr(html: string): {
  description: string
  images: string[]
  name: string
} | null {
  // Capturer tout l'attribut :product="..." (les guillemets intérieurs sont &quot;)
  const m = html.match(/:product="([^"]+)"/)
  if (!m) return null

  // 1. Décoder les HTML entities de premier niveau
  const decoded = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")

  // 2. Parser le JSON — les valeurs intérieures ont déjà \" et \/ qui sont valides JSON
  let obj: any
  try {
    obj = JSON.parse(decoded)
  } catch {
    // Fallback : extraire la description par regex si JSON.parse échoue
    const descMatch = decoded.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (!descMatch) return null
    // Décoder les séquences d'échappement JSON manuellement
    let desc = ''
    try {
      desc = JSON.parse(`"${descMatch[1]}"`)
    } catch {
      desc = descMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\\//g, '/')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, '\t')
    }
    return { description: desc, images: [], name: '' }
  }

  // 3. Extraire la description
  const rawDesc: string = obj.description ?? ''
  // Les \/ dans les URLs JSON sont valides — JSON.parse les a déjà dépliés
  const description = rawDesc

  // 4. Extraire les images depuis le tableau obj.images[] si présent
  const images: string[] = []
  if (Array.isArray(obj.images)) {
    for (const img of obj.images) {
      const src: string | undefined =
        typeof img === 'string' ? img : img?.path ?? img?.url ?? img?.src
      if (src) {
        const full = src.startsWith('http') ? src : `https://cdn.youcan.shop/${src}`
        images.push(full)
      }
    }
  }

  return {
    description,
    images,
    name: obj.name ?? obj.title ?? '',
  }
}

/* ─────────────────────────────────────────────────────────────
   FALLBACK — API catalogue YouCan (essais multiples endpoints)
   Résultat vide si tous échouent (description sera vide)
───────────────────────────────────────────────────────────── */
async function tryYouCanApi(u: URL, slug: string): Promise<string> {
  const endpoints = [
    `${u.origin}/api/library?page=1&per_page=50&include=variants`,
    `${u.origin}/products.json?limit=250`,
    `${u.origin}/api/products?slug=${encodeURIComponent(slug)}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await safeFetch(url)
      if (!res.ok) continue
      const data = await res.json()
      const products: any[] =
        data?.data ?? data?.products ?? (Array.isArray(data) ? data : [])
      const p = products.find((x: any) => x.slug === slug || x.handle === slug)
      if (p?.description) return p.description
    } catch {
      // continuer
    }
  }
  return ''
}

/* ─────────────────────────────────────────────────────────────
   EXTRACTEUR PUBLIC YouCan
───────────────────────────────────────────────────────────── */
export async function extractYouCan(u: URL, html: string): Promise<ImportedProduct> {
  const slug = u.pathname.replace(/^\/products\//, '').split('?')[0].split('#')[0]

  /* ── Titre : meta OG en priorité ── */
  const title = metaAttr(html, 'og:title') ?? ''

  /* ── Images : OG + twitter:imageN ── */
  const images: string[] = []
  const og = metaAttr(html, 'og:image')
  if (og) images.push(og)
  for (let i = 0; i <= 12; i++) {
    const img = metaAttr(html, `twitter:image${i}`)
    if (img && !images.includes(img)) images.push(img)
  }

  /* ── Prix : sale_price (prix actuel) > price (prix affiché) ── */
  const salePriceStr = metaAttr(html, 'product:sale_price:amount')
  const priceStr = metaAttr(html, 'product:price:amount')
  const sale = salePriceStr ? Number(salePriceStr) : 0
  const before = priceStr ? Number(priceStr) : 0
  const price = sale > 0 ? sale : before

  const currency = metaAttr(html, 'product:price:currency') ?? 'XOF'

  /* ── Description : composant <product-show :product="..."> ── */
  let descriptionHtml = ''
  const productShow = extractProductShowAttr(html)

  if (productShow) {
    descriptionHtml = productShow.description

    // Compléter le titre si meta OG était vide
    if (!title && productShow.name) {
      // on retournera productShow.name en tant que titre ci-dessous
    }

    // Ajouter les images du JSON (galerie complète) si absentes
    for (const imgUrl of productShow.images) {
      if (!images.includes(imgUrl)) images.push(imgUrl)
    }
  }

  // Fallback API si la description est toujours vide
  if (!descriptionHtml) {
    descriptionHtml = await tryYouCanApi(u, slug)
  }

  return {
    sourceUrl: u.href,
    platform: 'youcan',
    title: title || (productShow?.name ?? ''),
    descriptionHtml,
    images: [...new Set(images)].filter(Boolean),
    price,
    currency,
  }
}
