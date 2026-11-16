import { NextResponse } from 'next/server'

// Timeout helper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

// Extract all image URLs from HTML content
function extractImages(html: string, baseUrl: string): string[] {
  const images: string[] = []
  const seen = new Set<string>()

  // Match img src attributes
  const imgRegex = /<img[^>]+(?:src|data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["'][^>]*/gi
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1]
    if (src && !src.startsWith('data:')) {
      try {
        const abs = new URL(src, baseUrl).href
        if (!seen.has(abs) && isProductImage(abs)) {
          seen.add(abs)
          images.push(abs)
        }
      } catch {}
    }
  }

  // Also look for srcset
  const srcsetRegex = /srcset\s*=\s*["']([^"']+)["']/gi
  while ((m = srcsetRegex.exec(html)) !== null) {
    const srcset = m[1]
    const parts = srcset.split(',').map(s => s.trim().split(/\s+/)[0])
    for (const src of parts) {
      if (src && !src.startsWith('data:')) {
        try {
          const abs = new URL(src, baseUrl).href
          if (!seen.has(abs) && isProductImage(abs)) {
            seen.add(abs)
            images.push(abs)
          }
        } catch {}
      }
    }
  }

  // Look for background-image in style attributes
  const bgRegex = /background(?:-image)?\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/gi
  while ((m = bgRegex.exec(html)) !== null) {
    const src = m[1]
    if (src && !src.startsWith('data:')) {
      try {
        const abs = new URL(src, baseUrl).href
        if (!seen.has(abs) && isProductImage(abs)) {
          seen.add(abs)
          images.push(abs)
        }
      } catch {}
    }
  }

  // Look for JSON-LD images
  const jsonLdRegex = /"image"\s*:\s*(?:"([^"]+)"|(\[[^\]]+\]))/gi
  while ((m = jsonLdRegex.exec(html)) !== null) {
    if (m[1]) {
      try {
        const abs = new URL(m[1], baseUrl).href
        if (!seen.has(abs)) { seen.add(abs); images.push(abs) }
      } catch {}
    } else if (m[2]) {
      try {
        const arr = JSON.parse(m[2])
        for (const img of arr) {
          if (typeof img === 'string') {
            const abs = new URL(img, baseUrl).href
            if (!seen.has(abs)) { seen.add(abs); images.push(abs) }
          } else if (img?.url) {
            const abs = new URL(img.url, baseUrl).href
            if (!seen.has(abs)) { seen.add(abs); images.push(abs) }
          }
        }
      } catch {}
    }
  }

  return images
}

function isProductImage(url: string): boolean {
  const lower = url.toLowerCase()
  // Skip icons, logos, sprites, etc.
  const skip = ['favicon', 'icon-', 'sprite', 'logo', 'badge', 'star', 'rating', 'avatar', 'payment', 'flag', 'trustpilot']
  if (skip.some(s => lower.includes(s))) return false
  // Only include image files
  return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(lower) || lower.includes('/image') || lower.includes('cdn')
}

// Extract GIF URLs specifically
function extractGifs(html: string, baseUrl: string): string[] {
  const gifs: string[] = []
  const seen = new Set<string>()
  const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+\.gif[^"']*)["'][^>]*/gi
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], baseUrl).href
      if (!seen.has(abs)) { seen.add(abs); gifs.push(abs) }
    } catch {}
  }
  return gifs
}

// Extract structured description from HTML
function extractDescription(html: string): string {
  // Remove scripts & styles
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Try to extract product description section
  const descPatterns = [
    /class="[^"]*(?:product[-_]description|description[-_]content|product[-_]details|rte|product-desc)[^"]*"[^>]*>([\s\S]*?)(?=<\/(?:div|section|article))/i,
    /id="[^"]*(?:product[-_]description|description)[^"]*"[^>]*>([\s\S]*?)(?=<\/(?:div|section))/i,
    /<div[^>]*(?:itemprop="description")[^>]*>([\s\S]*?)<\/div>/i,
  ]

  for (const pattern of descPatterns) {
    const m = pattern.exec(cleaned)
    if (m && m[1]?.length > 100) {
      return cleanHtml(m[1])
    }
  }

  // Fallback: extract all paragraphs and headings
  const contentRegex = /<(p|h[1-6]|ul|ol|li|strong|em|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi
  const parts: string[] = []
  let m2
  while ((m2 = contentRegex.exec(cleaned)) !== null) {
    const text = m2[2].replace(/<[^>]+>/g, '').trim()
    if (text.length > 20) {
      parts.push(`<${m2[1]}>${text}</${m2[1]}>`)
    }
  }
  return parts.slice(0, 20).join('\n')
}

function cleanHtml(html: string): string {
  // Keep only useful tags
  return html
    .replace(/<(?!\/?(?:p|h[1-6]|ul|ol|li|strong|em|b|i|br|img|a)[^>]*>)[^>]+>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract product title
function extractTitle(html: string): string {
  // JSON-LD
  const jsonLdMatch = html.match(/"name"\s*:\s*"([^"]+)"/)
  if (jsonLdMatch) return jsonLdMatch[1]

  // OG title
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) return ogMatch[1]

  // h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return h1Match[1].trim()

  // Title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return titleMatch[1].replace(/\s*[-|].*$/, '').trim()

  return ''
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl

    // Fetch the page
    let html = ''
    try {
      const res = await withTimeout(
        fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
          },
          redirect: 'follow',
        }),
        12000
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (e: any) {
      return NextResponse.json({ error: `Impossible d'accéder à la page : ${e.message}` }, { status: 422 })
    }

    const base = new URL(targetUrl).origin
    const title = extractTitle(html)
    const description = extractDescription(html)
    const images = extractImages(html, targetUrl)
    const gifs = extractGifs(html, targetUrl)

    // Deduplicate and prioritize: product images first, then other images
    const allMedia = [...new Set([...images, ...gifs])].slice(0, 20)

    // Build rich description HTML that embeds inline images
    let richDescription = description || `<p>${title || 'Produit importé'}</p>`

    // Append GIFs as embedded images if not already in description
    if (gifs.length > 0) {
      const gifHtml = gifs.map(g => `<img src="${g}" alt="animation" style="max-width:100%;display:block;margin:8px 0;" />`).join('\n')
      if (!richDescription.includes(gifs[0])) {
        richDescription += '\n' + gifHtml
      }
    }

    return NextResponse.json({
      title,
      description: richDescription,
      images: allMedia.filter(u => !u.toLowerCase().endsWith('.gif')),
      gifs,
      allMedia,
      success: true,
    })
  } catch (err: any) {
    console.error('[scrape-product]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
