import { NextResponse } from 'next/server'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

/**
 * Fetch avec retry automatique pour gérer les 429 (Too Many Requests)
 * Shopify et d'autres plateformes rate-limitent les requêtes rapides
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  initialDelayMs = 1500
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500
      console.log(`[RETRY] Tentative ${attempt + 1}/${maxRetries + 1} après ${Math.round(backoff)}ms...`)
      await delay(backoff)
    }
    try {
      const res = await withTimeout(
        fetch(url, { ...options, headers: { ...BROWSER_HEADERS, ...(options.headers || {}) }, redirect: 'follow' }),
        15000
      )
      if (res.status === 429 && attempt < maxRetries) {
        console.log(`[RETRY] 429 reçu pour ${url}, retry...`)
        continue
      }
      return res
    } catch (err: any) {
      lastError = err
      if (attempt < maxRetries) continue
    }
  }
  throw lastError || new Error('Fetch failed after retries')
}

/* ─────────────────────────────────────────────────────────────
   SHOPIFY — endpoint .json (100% fiable, pas de JS requis)
   Shopify expose TOUJOURS /products/{handle}.json en public
───────────────────────────────────────────────────────────── */
async function scrapeShopify(url: string): Promise<ScrapedProduct | null> {
  try {
    // Nettoyer l'URL : supprimer les query params, les ancres, etc.
    const cleanUrl = url.replace(/#.*$/, '').replace(/\?.*$/, '').replace(/\/$/, '')

    // Essai 1 : ajouter .json directement
    const jsonUrl = cleanUrl + '.json'

    const res = await fetchWithRetry(jsonUrl, {
      headers: { 'Accept': 'application/json' },
    }, 2, 2000)

    if (!res.ok) return null

    const data = await res.json()
    const product = data.product
    if (!product?.title) return null

    // Toutes les images du produit
    const images: string[] = (product.images || [])
      .map((img: any) => img.src as string)
      .filter((src: string) => src && !src.toLowerCase().includes('.gif'))

    const gifs: string[] = (product.images || [])
      .map((img: any) => img.src as string)
      .filter((src: string) => src?.toLowerCase().includes('.gif'))

    // Prix depuis les variantes
    const price = product.variants?.[0]?.price || product.variants?.[0]?.compare_at_price || ''

    // Description HTML complète (body_html de Shopify = HTML riche avec images/GIFs intégrés)
    const description = product.body_html || ''

    console.log(`[SHOPIFY JSON] ✅ ${product.title} | ${images.length} images | prix: ${price}`)

    return {
      source: 'shopify',
      title: product.title,
      description,
      images,
      gifs,
      videos: [],
      price: String(price),
    }
  } catch (err) {
    console.log('[SHOPIFY JSON] ❌ Échec:', err)
    return null
  }
}

/* ─────────────────────────────────────────────────────────────
   SCHEMA.ORG JSON-LD — fonctionne pour WooCommerce et la
   plupart des sites e-commerce (toujours présent en HTML)
───────────────────────────────────────────────────────────── */
function extractFromJsonLd(html: string): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {}

  // Trouver tous les blocs <script type="application/ld+json">
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      let parsed = JSON.parse(match[1])

      // Gérer le cas @graph (tableau d'entités)
      const items: any[] = parsed['@graph']
        ? parsed['@graph']
        : Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        const type = item['@type']
        if (type !== 'Product' && type !== 'product') continue

        // Titre
        if (item.name && !result.title) result.title = item.name

        // Prix
        if (!result.price) {
          const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers
          if (offers?.price) result.price = String(offers.price)
        }

        // Description (peut être HTML ou texte brut)
        if (item.description && !result.description) {
          result.description = item.description
        }

        // Images
        if (item.image && !result.images?.length) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image]
          const imageUrls: string[] = []
          for (const img of imgs) {
            if (typeof img === 'string') imageUrls.push(img)
            else if (img?.url) imageUrls.push(img.url)
            else if (img?.contentUrl) imageUrls.push(img.contentUrl)
          }
          result.images = imageUrls.filter(u => !u.toLowerCase().includes('.gif'))
          result.gifs = imageUrls.filter(u => u.toLowerCase().includes('.gif'))
        }

        if (result.title) {
          console.log(`[JSON-LD] ✅ ${result.title} | ${result.images?.length || 0} images`)
          return result
        }
      }
    } catch {}
  }

  return result
}

/* ─────────────────────────────────────────────────────────────
   WOOCOMMERCE — sélecteurs CSS spécifiques + lazy images
───────────────────────────────────────────────────────────── */
function extractWooCommerceContent(html: string, baseUrl: string): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {}

  // Description WooCommerce — plusieurs emplacements possibles
  const descPatterns = [
    // Onglet description complet
    /id="tab-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    // Div de description standard WooCommerce
    /class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*woocommerce-Tabs-panel--description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]

  for (const pattern of descPatterns) {
    const m = pattern.exec(html)
    if (m && m[1]?.trim().length > 50) {
      result.description = m[1].trim()
      break
    }
  }

  // Images WooCommerce — souvent en data-src (lazy loading)
  const images: string[] = []
  const seen = new Set<string>()

  // Galerie WooCommerce : figure.woocommerce-product-gallery__image
  const galleryRegex = /class="[^"]*woocommerce-product-gallery__image[^"]*"[^>]*>[\s\S]*?<img[^>]+>/gi
  let m
  while ((m = galleryRegex.exec(html)) !== null) {
    const imgBlock = m[0]
    // data-large_image est l'image HD dans WooCommerce
    const largeSrc = /data-large_image=["']([^"']+)["']/.exec(imgBlock)?.[1]
    const normalSrc = /(?:src|data-src|data-lazy-src)=["']([^"']+)["']/.exec(imgBlock)?.[1]
    const src = largeSrc || normalSrc
    if (src && !src.startsWith('data:') && !seen.has(src)) {
      try {
        const abs = new URL(src, baseUrl).href
        seen.add(abs)
        if (!abs.toLowerCase().includes('.gif')) images.push(abs)
      } catch {}
    }
  }

  if (images.length > 0) result.images = images

  return result
}

/* ─────────────────────────────────────────────────────────────
   EXTRACTEUR GÉNÉRIQUE HTML
   Fallback pour les autres sites (non-Shopify, non-WooCommerce)
───────────────────────────────────────────────────────────── */
function extractGeneric(html: string, baseUrl: string): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {}

  // Titre
  const jsonLdName = html.match(/"name"\s*:\s*"([^"]{3,120})"/)
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  const h1 = html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  result.title = (jsonLdName?.[1] || ogTitle?.[1] || h1?.[1]?.trim() || titleTag?.[1]?.replace(/\s*[-|].*$/, '').trim() || '').substring(0, 150)

  // Prix
  const jsonPrice = html.match(/"price"\s*:\s*"?([0-9][0-9.,\s]*)(?:"|,)/)
  const ogPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i)
  result.price = jsonPrice?.[1]?.trim() || ogPrice?.[1] || ''

  // Images — chercher TOUTES les variantes d'attributs lazy
  const images: string[] = []
  const gifs: string[] = []
  const seen = new Set<string>()
  const skip = ['favicon', 'icon-', 'sprite', 'logo', 'badge', 'star', 'rating', 'avatar', 'payment', 'trustpilot', 'captcha', 'blank.gif', 'placeholder']

  const imgRegex = /<img[^>]+>/gi
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    const tag = m[0]
    // Chercher toutes les sources possibles (lazy loading inclus)
    const srcMatch = tag.match(/(?:data-large_image|data-zoom-image|data-src|data-lazy-src|data-original|data-full-src|src)\s*=\s*["']([^"']+)["']/i)
    const src = srcMatch?.[1]
    if (!src || src.startsWith('data:') || src.length < 10) continue
    if (skip.some(s => src.toLowerCase().includes(s))) continue

    try {
      const abs = new URL(src, baseUrl).href
      if (seen.has(abs)) continue
      seen.add(abs)

      if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs) || abs.includes('/image') || abs.includes('cdn')) {
        images.push(abs)
      } else if (/\.gif(\?|$)/i.test(abs)) {
        gifs.push(abs)
      }
    } catch {}
  }

  result.images = images
  result.gifs = gifs

  // Description générique
  const descPatterns = [
    /class="[^"]*(?:product[-_]description|description[-_]content|product[-_]details|rte|product-desc|product__description|product-body|tab-pane--description)[^"]*"[^>]*>([\s\S]{100,}?)(?=<\/div>\s*(?:<\/div>|<div))/i,
    /itemprop="description"[^>]*>([\s\S]{50,}?)<\/(?:div|section|article)>/i,
  ]
  for (const pat of descPatterns) {
    const dm = pat.exec(html)
    if (dm && dm[1]?.trim().length > 80) {
      result.description = dm[1].trim()
      break
    }
  }

  // Videos
  const videos: string[] = []
  const videoRegex = /["'](https?:\/\/[^"'<>\s]+\.(?:mp4|webm|mov)[^"'<>\s]*)["']/gi
  while ((m = videoRegex.exec(html)) !== null) {
    videos.push(m[1])
  }
  result.videos = [...new Set(videos)]

  return result
}

/* ─────────────────────────────────────────────────────────────
   TYPE
───────────────────────────────────────────────────────────── */
interface ScrapedProduct {
  source: string
  title: string
  description: string
  images: string[]
  gifs: string[]
  videos: string[]
  price: string
}

/* ─────────────────────────────────────────────────────────────
   HANDLER PRINCIPAL
───────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl

    const urlObj = new URL(targetUrl)
    const hostname = urlObj.hostname

    /* ── 1. SHOPIFY DETECTION & JSON ENDPOINT ───────────── */
    // Détecter une URL Shopify : /products/ dans le chemin
    const isShopifyProductUrl = urlObj.pathname.includes('/products/')

    if (isShopifyProductUrl) {
      console.log(`[SCRAPER] Tentative Shopify JSON pour: ${targetUrl}`)
      const shopifyData = await scrapeShopify(targetUrl)
      if (shopifyData) {
        const allMedia = [...shopifyData.images, ...shopifyData.gifs].slice(0, 20)

        // Enrichir la description avec les GIFs si pas déjà dedans
        let richDescription = shopifyData.description || `<p>${shopifyData.title}</p>`
        if (shopifyData.gifs.length > 0 && !richDescription.includes(shopifyData.gifs[0])) {
          const gifHtml = shopifyData.gifs
            .map(g => `<img src="${g}" alt="animation" style="max-width:100%;display:block;margin:8px 0;" />`)
            .join('\n')
          richDescription += '\n' + gifHtml
        }

        return NextResponse.json({
          source: 'shopify',
          title: shopifyData.title,
          description: richDescription,
          images: shopifyData.images.slice(0, 20),
          gifs: shopifyData.gifs,
          videos: [],
          price: shopifyData.price,
          allMedia,
          success: true,
        })
      }
      console.log('[SCRAPER] Shopify JSON a échoué, fallback HTML...')
    }

    /* ── 2. FETCH HTML BRUT ─────────────────────────────── */
    let html = ''
    try {
      const res = await fetchWithRetry(targetUrl, {}, 2, 1500)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (e: any) {
      return NextResponse.json(
        { error: `Impossible d'accéder à la page : ${e.message}` },
        { status: 422 }
      )
    }

    /* ── 3. DÉTECTER LE TYPE DE SITE ────────────────────── */
    const isShopify = html.includes('cdn.shopify.com') || html.includes('Shopify.theme') || html.includes('shopify-section')
    const isWooCommerce = html.includes('woocommerce') || html.includes('WooCommerce') || html.includes('wc-block')

    console.log(`[SCRAPER] Détection: Shopify=${isShopify}, WooCommerce=${isWooCommerce} | ${hostname}`)

    /* ── 4. EXTRACTION SELON LE TYPE ────────────────────── */
    let scraped: Partial<ScrapedProduct> = {}

    // Essai Shopify via HTML (si l'endpoint JSON a échoué)
    if (isShopify) {
      // Shopify inclut souvent le JSON produit dans window.ShopifyAnalytics ou __st
      const shopifyJson = html.match(/var\s+meta\s*=\s*(\{[\s\S]+?"product"[\s\S]+?\});/)?.[1]
        || html.match(/analytics\.productData\s*=\s*(\{[\s\S]+?\});/)?.[1]

      if (shopifyJson) {
        try {
          const parsed = JSON.parse(shopifyJson)
          if (parsed.product) {
            scraped.title = parsed.product.title || parsed.product.name
            scraped.price = String(parsed.product.price_min || parsed.product.price || '')
          }
        } catch {}
      }

      // Shopify embeds toujours du JSON-LD complet
      const ldData = extractFromJsonLd(html)
      scraped = { ...ldData, ...scraped }
    }

    // WooCommerce
    if (isWooCommerce) {
      const wooData = extractWooCommerceContent(html, targetUrl)
      const ldData = extractFromJsonLd(html)
      // JSON-LD d'abord pour le titre/prix, WooCommerce pour images/desc
      scraped = {
        ...wooData,
        title: ldData.title || wooData.title,
        price: ldData.price || wooData.price,
        images: wooData.images?.length ? wooData.images : ldData.images || [],
        gifs: wooData.gifs || ldData.gifs || [],
      }
    }

    // Fallback générique + JSON-LD pour les autres sites
    if (!scraped.title || !scraped.images?.length) {
      const ldData = extractFromJsonLd(html)
      const genericData = extractGeneric(html, targetUrl)
      scraped = {
        title: ldData.title || genericData.title || scraped.title || '',
        price: ldData.price || genericData.price || scraped.price || '',
        description: scraped.description || ldData.description || genericData.description || '',
        images: (ldData.images?.length ? ldData.images : genericData.images) || scraped.images || [],
        gifs: ldData.gifs || genericData.gifs || scraped.gifs || [],
        videos: genericData.videos || [],
      }
    }

    /* ── 5. ENRICHISSEMENT DE LA DESCRIPTION ───────────── */
    // Si la description est du texte brut, la convertir en HTML
    let richDescription = scraped.description || `<p>${scraped.title || 'Produit importé'}</p>`

    // Si c'est du texte brut (pas de balises HTML), le convertir
    if (!richDescription.includes('<') && richDescription.length > 20) {
      richDescription = richDescription
        .split('\n\n')
        .filter(p => p.trim())
        .map(p => `<p>${p.trim()}</p>`)
        .join('\n')
    }

    // Ajouter les GIFs à la fin de la description si absents
    const gifs = scraped.gifs || []
    if (gifs.length > 0 && !richDescription.includes(gifs[0])) {
      const gifHtml = gifs
        .map(g => `<img src="${g}" alt="animation" style="max-width:100%;display:block;margin:8px 0;" />`)
        .join('\n')
      richDescription += '\n' + gifHtml
    }

    /* ── 6. DÉDUPLICATION & RÉPONSE ────────────────────── */
    const images = [...new Set(scraped.images || [])].filter(Boolean).slice(0, 20)
    const videos = [...new Set(scraped.videos || [])].filter(Boolean).slice(0, 5)
    const allMedia = [...new Set([...images, ...gifs])].slice(0, 20)

    console.log(`[SCRAPER] ✅ Résultat: "${scraped.title}" | ${images.length} images | ${gifs.length} GIFs | prix: ${scraped.price}`)

    return NextResponse.json({
      source: isShopify ? 'shopify-html' : isWooCommerce ? 'woocommerce' : 'generic',
      title: scraped.title || '',
      description: richDescription,
      images,
      gifs,
      videos,
      price: scraped.price || '',
      allMedia,
      success: true,
    })

  } catch (err: any) {
    console.error('[scrape-product] Erreur serveur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
