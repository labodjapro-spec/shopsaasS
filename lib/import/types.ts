export type ImportedProduct = {
  sourceUrl: string
  platform: 'shopify' | 'youcan' | 'generic'
  title: string
  descriptionHtml: string
  images: string[]
  price: number
  currency: string | null
}

export type ImportResult = {
  productId: string
  platform: string
  title: string
  images: number
  needsPriceCheck: boolean
}
