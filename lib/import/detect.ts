export function detectPlatform(u: URL, html: string): 'shopify' | 'youcan' | 'generic' {
  if (
    /\.youcan\.(store|shop)$/.test(u.hostname) ||
    html.includes('cdn.youcan.shop')
  )
    return 'youcan'
  if (
    u.hostname.endsWith('.myshopify.com') ||
    html.includes('cdn.shopify.com') ||
    html.includes('Shopify.shop') ||
    html.includes('shopify-section')
  )
    return 'shopify'
  return 'generic'
}
