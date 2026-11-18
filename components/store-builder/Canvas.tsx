'use client'

import React from 'react'
import type { EditorData, EditorBlock } from './Editor'
import { renderBlock } from '@/lib/store-builder/renderBlock'
import { getLandingPageStyles } from '@/lib/store-builder/landing-theme'
import ThemeLogoBar from '@/components/store-builder/sections/ThemeLogoBar'
import TemplateLayoutRenderer from '@/components/store-builder/TemplateLayoutRenderer'
import { resolveLayout } from '@/lib/store-builder/layout-engine'

interface CanvasProps {
  data: EditorData
  selectedBlockId: string | null
  previewMode: 'desktop' | 'mobile'
  onSelectBlock: (id: string) => void
  products?: any[]
  selectedProductId?: string | null
  onProductChange?: (id: string) => void
  themeSettings?: Record<string, any>
}

export default function Canvas({
  data,
  selectedBlockId,
  previewMode,
  onSelectBlock,
  products,
  selectedProductId,
  onProductChange,
  themeSettings,
}: CanvasProps) {
  const product = selectedProductId
    ? products?.find((p) => p.id === selectedProductId) || products?.[0]
    : products?.[0] || null

  const ts = themeSettings || {}
  const styles = getLandingPageStyles(ts)
  const cardBg = ts.surface || '#ffffff'
  const layout = resolveLayout(ts)
  const mainMaxWidth = layout === 'single-column' ? (ts.cardMaxWidth ?? 720) : '100%'
  const singleColumn = layout === 'single-column'
  const rendererTemplate = singleColumn
    ? [...(data.header || []), ...(data.template || []), ...(data.footer || [])]
    : data.template

  const previewProductToolbar = (
    <div className="sticky top-0 z-20 flex w-full justify-center border-b border-gray-200/80 bg-[#e9ebef]/95 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
      {products && products.length > 0 && onProductChange && (
        <div
          className="flex w-full max-w-[720px] min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm sm:gap-3 sm:px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="shrink-0 text-[11px] font-semibold text-gray-500 sm:text-xs">Produit</span>
          <div className="relative min-w-0 flex-1">
            <select
              value={selectedProductId || products[0]?.id || ''}
              onChange={(e) => onProductChange(e.target.value)}
              className="w-full min-w-0 appearance-none truncate rounded-lg border border-gray-200 bg-gray-50 py-2 pl-3 pr-8 text-xs font-semibold text-gray-800 outline-none transition-all hover:bg-gray-100 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:text-sm"
              aria-label="Produit affiché dans l’aperçu"
            >
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.title || p.name || 'Produit sans titre'}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )

  const BlockWrapper = ({ block, children }: { block: EditorBlock; children: React.ReactNode }) => {
    if (block.hidden) return null
    const isSelected = selectedBlockId === block.id
    return (
      <div
        className={`relative group cursor-pointer transition-all ${
          isSelected
            ? 'outline outline-2 outline-indigo-500 outline-offset-[-2px] z-10'
            : 'hover:outline hover:outline-1 hover:outline-indigo-300 hover:outline-offset-[-1px]'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onSelectBlock(block.id)
        }}
      >
        <div
          className={`absolute top-0 left-0 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-md z-50 transition-opacity pointer-events-none ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {block.title}
        </div>
        {children}
      </div>
    )
  }

  const renderWrapped = (block: EditorBlock) => (
    <BlockWrapper key={block.id} block={block}>
      {renderBlock(block, product, undefined, ts)}
    </BlockWrapper>
  )

  if (!product) {
    return (
      <div className="flex-1 min-h-0 min-w-0 bg-[#eceef1] flex items-center justify-center p-8" onClick={() => onSelectBlock('')}>
        <div className="bg-white p-10 rounded-3xl shadow-sm text-center max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Aucun produit trouvé</h2>
          <p className="text-gray-500 text-sm mb-6">Créez d&apos;abord un produit pour prévisualiser votre boutique.</p>
          <a href="/produits/ajouter" className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition">
            + Créer un produit
          </a>
        </div>
      </div>
    )
  }

  const landingPreview = (
    <div style={{ ...styles.outer, ...styles.cssVars, minHeight: '100%' }}>
      <div style={singleColumn ? { width: '100%', minHeight: '100%', background: 'transparent' } : styles.card}>
        {!singleColumn && !data.header.some(b => b.type === 'Header' || b.type === 'header') && ts.logo_url?.trim() && (
          <ThemeLogoBar logoUrl={ts.logo_url} logoHeight={ts.logo_height} bgColor={ts.surface} />
        )}
        {!singleColumn && data.header.map((block) => renderWrapped(block))}
        <main style={{ maxWidth: singleColumn ? '100%' : mainMaxWidth, width: '100%', margin: '0 auto', background: singleColumn ? 'transparent' : cardBg }}>
          <TemplateLayoutRenderer
            template={rendererTemplate}
            themeSettings={ts}
            product={product}
            forceMobile={previewMode === 'mobile'}
            allProducts={products}
            wrapBlock={(block, node) => (
              <BlockWrapper key={block.id} block={block}>{node}</BlockWrapper>
            )}
          />
        </main>
        {!singleColumn && data.footer.map((block) => renderWrapped(block))}
      </div>
    </div>
  )

  return (
    <div
      className="flex-1 min-h-0 min-w-0 bg-[#e9ebef] overflow-y-auto overflow-x-hidden"
      onClick={() => onSelectBlock('')}
    >
      {previewProductToolbar}

      <div className="flex min-h-0 items-start justify-center px-2 py-4 sm:px-4 sm:py-6" onClick={(e) => e.stopPropagation()}>
        {previewMode === 'mobile' ? (
          <div
            className="relative mx-auto flex-shrink-0 overflow-hidden rounded-[20px] border-[3px] border-[#1a1a1a] shadow-xl @container"
            style={{
              width: 'min(393px, calc(100% - 8px))',
              height: 'min(852px, calc(100dvh - 120px))',
              background: styles.outer.background,
            }}
          >
            <div className="h-full overflow-y-auto overflow-x-hidden">{landingPreview}</div>
          </div>
        ) : (
          <div className="w-full max-w-[1100px] @container">{landingPreview}</div>
        )}
      </div>
    </div>
  )
}
