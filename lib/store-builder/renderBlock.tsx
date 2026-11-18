import React from 'react'
import AnnouncementBarRender from '@/components/store-builder/sections/AnnouncementBarRender'
import HeaderRender from '@/components/store-builder/sections/HeaderRender'
import MediasRender from '@/components/store-builder/sections/MediasRender'
import CountdownRender from '@/components/store-builder/sections/CountdownRender'
import TestimonialsRender from '@/components/store-builder/sections/TestimonialsRender'
import TestimonialsFloatingRender from '@/components/store-builder/sections/TestimonialsFloatingRender'
import BenefitsRender from '@/components/store-builder/sections/BenefitsRender'
import BeforeAfterRender from '@/components/store-builder/sections/BeforeAfterRender'
import ComparisonRender from '@/components/store-builder/sections/ComparisonRender'
import StatsRender from '@/components/store-builder/sections/StatsRender'
import FaqRender from '@/components/store-builder/sections/FaqRender'
import GuaranteesRender from '@/components/store-builder/sections/GuaranteesRender'
import TrustBarRender from '@/components/store-builder/sections/TrustBarRender'
import StockUrgencyRender from '@/components/store-builder/sections/StockUrgencyRender'
import MarqueeRender from '@/components/store-builder/sections/MarqueeRender'
import ImageTextRender from '@/components/store-builder/sections/ImageTextRender'
import VideoRender from '@/components/store-builder/sections/VideoRender'
import FooterRender from '@/components/store-builder/sections/FooterRender'
import TextBlockRender from '@/components/store-builder/sections/TextBlockRender'
import TitreRender from '@/components/store-builder/sections/TitreRender'
import NoteProduitRender from '@/components/store-builder/sections/NoteProduitRender'
import PrixRender from '@/components/store-builder/sections/PrixRender'
import DescriptionRender from '@/components/store-builder/sections/DescriptionRender'
import OrderFormRender from '@/components/store-builder/sections/OrderFormRender'
import CountdownTopBarRender from '@/components/store-builder/sections/CountdownTopBarRender'
import CircularIngredientsRender from '@/components/store-builder/sections/CircularIngredientsRender'
import ExpertEncartRender from '@/components/store-builder/sections/ExpertEncartRender'
import UpsellCarouselRender from '@/components/store-builder/sections/UpsellCarouselRender'
import SpacerRender from '@/components/store-builder/sections/SpacerRender'
import NewsletterRender from '@/components/store-builder/sections/NewsletterRender'
import PopupRender from '@/components/store-builder/sections/PopupSection'
import SlideshowRender from '@/components/store-builder/sections/SlideshowRender'
import HotspotsRender from '@/components/store-builder/sections/HotspotsRender'
import ParallaxRender from '@/components/store-builder/sections/ParallaxRender'
import ReelMediaRender from '@/components/store-builder/sections/ReelMediaRender'
// Sections supplémentaires du catalogue (ajoutées au besoin)
import HeroSection from '@/components/store-builder/sections/HeroSection'
import TestimonialsSection from '@/components/store-builder/sections/TestimonialsSection'
import PricingTableSection from '@/components/store-builder/sections/PricingTableSection'
import { mergeHeaderTheme } from '@/lib/store-builder/landing-theme'

// Les blocks de type "produit" — affichent des données du produit sélectionné.
// Traités comme des sections normales dans le flux vertical (linéaire).
export const PRODUCT_BLOCK_TYPES = ['Titre', 'Note de produit', 'Prix', 'Description']

/**
 * Moteur de rendu partagé entre l'éditeur (Canvas) et la page publique (LandingRenderer).
 * Une seule source de vérité → le WYSIWYG est garanti : ce que tu vois = ce qui est publié.
 *
 * @param block  Le block { type, settings, ... }
 * @param product Le produit sélectionné pour la landing (ou null)
 * @param storeId L'id de la boutique (passé au formulaire de commande, page publique)
 */
export function renderBlock(block: any, product: any, storeId?: string | null, themeSettings?: Record<string, any>, allProducts?: any[]): React.ReactNode {
  if (block.hidden) return null
  const s = block.settings || {}
  const settings = { ...s }
  let content: React.ReactNode = null

  switch (block.type) {
    // ── En-tête / structure ──
    case 'AnnouncementBar':
    case 'announcement_bar':
      content = <AnnouncementBarRender settings={settings} />
      break
    case 'Header':
    case 'header':
      content = <HeaderRender settings={mergeHeaderTheme(settings, themeSettings)} />
      break
    case 'Footer':
    case 'footer':
      content = <FooterRender settings={settings} />
      break
    case 'spacer':
      content = <SpacerRender settings={settings} />
      break

    // ── Galerie (déplaçable) ──
    case 'Galerie':
    case 'medias':
    case 'gallery': {
      const rawImages = product?.images
      const parsedImages: string[] = Array.isArray(rawImages) ? rawImages
        : typeof rawImages === 'string'
        ? (() => { try { const p = JSON.parse(rawImages); return Array.isArray(p) ? p : [] } catch { return rawImages ? [rawImages] : [] } })()
        : []
      const images: string[] = parsedImages.length
        ? parsedImages
        : product?.image_url
        ? [product.image_url]
        : []
      content = <MediasRender settings={{ images }} enableTilt={!!themeSettings?.__enableTilt} />
      break
    }

    // ── Marketing / urgence ──
    case 'countdown_top_bar':
      content = <CountdownTopBarRender settings={settings} />
      break
    case 'countdown':
      content = <CountdownRender settings={settings} />
      break
    case 'stock_urgency':
      content = <StockUrgencyRender settings={settings} />
      break
    case 'marquee':
      content = <MarqueeRender settings={settings} />
      break
    case 'stats':
      content = <StatsRender settings={settings} />
      break

    // ── Preuve sociale / confiance ──
    case 'testimonials':
      content = <TestimonialsRender settings={settings} />
      break
    case 'testimonials_floating':
      content = <TestimonialsFloatingRender settings={settings} />
      break
    case 'reel_media':
      content = <ReelMediaRender settings={settings} />
      break
    case 'before_after':
      content = <BeforeAfterRender settings={settings} />
      break
    case 'comparison':
    case 'comparison_table':
      content = <ComparisonRender settings={settings} />
      break
    case 'benefits':
    case 'icon_grid':
      content = <BenefitsRender settings={settings} />
      break
    case 'guarantees':
      content = <GuaranteesRender settings={settings} />
      break
    case 'trust_bar':
      content = <TrustBarRender settings={settings} />
      break
    case 'faq':
      content = <FaqRender settings={settings} />
      break
    case 'circular_ingredients':
      content = <CircularIngredientsRender settings={settings} />
      break
    case 'expert_encart':
      content = <ExpertEncartRender settings={settings} />
      break
    case 'upsell_carousel':
      content = <UpsellCarouselRender settings={settings} products={allProducts} />
      break
    case 'newsletter':
      content = <NewsletterRender settings={settings} />
      break
    case 'popup':
    case 'Popup':
      content = <PopupRender settings={settings} />
      break
    case 'slideshow':
      content = <SlideshowRender settings={settings} />
      break
    case 'hotspots':
      content = <HotspotsRender settings={settings} />
      break
    case 'parallax':
      content = <ParallaxRender settings={settings} />
      break

    // ── Contenu ──
    case 'image_text':
    case 'image_with_text':
      content = <ImageTextRender settings={settings} />
      break
    case 'video':
      content = <VideoRender settings={settings} />
      break
    case 'text_block':
      content = <TextBlockRender settings={settings} />
      break

    // ── Infos produit (linéaires) ──
    case 'Titre':
      content = <TitreRender settings={settings} product={product} />
      break
    case 'Note de produit':
      content = <NoteProduitRender settings={settings} />
      break
    case 'Prix':
      content = <PrixRender settings={settings} product={product} themeSettings={themeSettings} />
      break
    case 'Description':
      content = <DescriptionRender settings={settings} product={product} themeSettings={themeSettings} />
      break
    case 'OrderForm':
    case 'order_form':
      content = <OrderFormRender settings={settings} product={product} storeId={storeId} themeSettings={themeSettings} />
      break

    // ── Sections aliasées (catalogue étendu → réutilise les renderers existants) ──
    case 'hero':
    case 'Hero':
      content = <HeroSection settings={settings} />
      break
    case 'Countdown':
      content = <CountdownRender settings={settings} />
      break
    case 'Benefits':
      content = <BenefitsRender settings={settings} />
      break
    case 'Video':
      content = <VideoRender settings={settings} />
      break
    case 'Faq':
      content = <FaqRender settings={settings} />
      break
    case 'ImageWithText':
      content = <ImageTextRender settings={settings} />
      break
    case 'Testimonials':
      content = <TestimonialsSection settings={settings} />
      break
    case 'PricingTable':
      content = <PricingTableSection settings={settings} />
      break
    case 'hero_editorial':
      content = <TextBlockRender settings={{ ...settings, content: settings.content || '', text_align: settings.text_align || 'center' }} />
      break
    case 'feature_grid':
      content = <BenefitsRender settings={{ ...settings, layout: 'grid', items: settings.items || [] }} />
      break
    case 'comparison_vs':
      content = <ComparisonRender settings={{ ...settings, our_label: settings.our_label || 'NOUS', competitor_label: settings.competitor_label || 'EUX' }} />
      break
    case 'whats_in_box':
      content = <ImageTextRender settings={{ ...settings, cta_text: settings.cta_text || 'Commander', cta_link: settings.cta_link || '#order-form' }} />
      break
    case 'faq_2col':
      content = <FaqRender settings={{ ...settings }} />
      break
    case 'product_grid':
      content = <BenefitsRender settings={{ ...settings, layout: 'grid', items: settings.items || [] }} />
      break
    default:
      break
  }

  if (!content) return null

  // Structural blocks that should not have dynamic padding wrapper
  const noPaddingWrapper = ['AnnouncementBar', 'announcement_bar', 'Header', 'header', 'Footer', 'footer', 'popup', 'Popup', 'spacer', 'countdown_top_bar']

  if (noPaddingWrapper.includes(block.type)) {
    return content
  }

  // Determine dynamic padding
  const pt = settings.padding_top !== undefined ? `${settings.padding_top}px` : undefined
  const pb = settings.padding_bottom !== undefined ? `${settings.padding_bottom}px` : undefined

  if (pt === undefined && pb === undefined) {
    return content
  }

  // Inherit block background color to avoid white-trace artifact when resizing
  const wrapperBg = settings.bg_color || settings.background_color || undefined

  return (
    <div style={{ paddingTop: pt, paddingBottom: pb, width: '100%', background: wrapperBg }}>
      {content}
    </div>
  )
}

