'use client'

import TemplateLayoutRenderer from '@/components/store-builder/TemplateLayoutRenderer'
import StoreTracking from '@/components/store-builder/StoreTracking'

interface PublicPageRendererProps {
  data: any
  products: any[]
  storeId: string
  pixelId?: string | null
}

export default function PublicPageRenderer({ data, products, storeId, pixelId }: PublicPageRendererProps) {
  const template: any[] = [
    ...(data?.header ?? []),
    ...(data?.template ?? []),
    ...(data?.footer ?? []),
  ]
  const themeSettings = data?.themeSettings ?? {}
  const selectedProductId = data?.selectedProductId ?? null
  const product = products.find(p => p.id === selectedProductId) ?? products[0] ?? null

  if (!template.length) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-400 text-sm">Aucun contenu configuré.</p>
      </main>
    )
  }

  return (
    <div className="overflow-x-hidden w-full">
      {/* Pixel Meta navigateur — PageView automatique */}
      <StoreTracking pixelId={pixelId} />
      <TemplateLayoutRenderer
        template={template}
        themeSettings={themeSettings}
        product={product}
        storeId={storeId}
        enableReveal={true}
        allProducts={products}
      />
    </div>
  )
}
