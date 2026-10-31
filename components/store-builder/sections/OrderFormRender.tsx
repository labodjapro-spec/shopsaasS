'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { ensureOrderFormSettings, calcBundleTotal } from '@/lib/store-builder/form-presets'
import BundleOffers from '@/components/store-builder/sections/BundleOffers'
import VariantSelector from './VariantSelector'
import { getMetaBrowserContext, hasMetaTrackingConsent, trackMetaBrowserEvent } from '@/lib/meta/browser'

const BTN_ANIMATIONS = [
  { id: 'shake', label: 'Secousse' },
  { id: 'pulse', label: 'Pulsation' },
  { id: 'bounce', label: 'Rebond' },
  { id: 'glow', label: 'Lueur' },
  { id: 'none', label: 'Aucune' },
] as const

type BtnAnimation = typeof BTN_ANIMATIONS[number]['id']

interface OrderFormRenderProps {
  settings: any
  product?: any
  storeId?: string | null
  themeSettings?: any
}

export default function OrderFormRender({ settings, product, storeId, themeSettings }: OrderFormRenderProps) {
  const s = settings || {}
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({})

  const unitPrice = product?.price ? Number(product.price) : 0
  // Devise : priorité → themeSettings.currency (depuis le marché) → product.currency → XOF
  const currency = themeSettings?.currency || product?.currency || 'XOF'

  const formSettings = useMemo(
    () => ensureOrderFormSettings(s, unitPrice || 15000, currency),
    [s, unitPrice, currency],
  )

  const bundlesEnabled = formSettings.bundles_enabled !== false && unitPrice > 0
  const bundles = formSettings.bundles || []
  const visibleBundles = bundles.filter((b: any) => !b.hidden)
  const defaultBundle = visibleBundles.find((b: any) => b.popular) || visibleBundles[0]
  const [selectedBundleId, setSelectedBundleId] = useState(defaultBundle?.id || 'b1')

  useEffect(() => {
    if (defaultBundle?.id) setSelectedBundleId(defaultBundle.id)
  }, [defaultBundle?.id])

  const selectedBundle = visibleBundles.find((b: any) => b.id === selectedBundleId) || visibleBundles[0]
  const [manualQty, setManualQty] = useState(1)
  const finalQty = bundlesEnabled ? (selectedBundle?.qty || 1) : manualQty
  const total = bundlesEnabled && selectedBundle
    ? calcBundleTotal(unitPrice, finalQty, selectedBundle)
    : unitPrice * finalQty

const btnAnimation: BtnAnimation = formSettings.btn_animation || 'pulse'
  const borderR = formSettings.card_border_radius ?? formSettings.border_radius ?? 20

  const variantOptions: { name: string; values: string[] }[] = formSettings.variant_options || []

  const colors = useMemo(() => ({
    bg: formSettings.bg_color || '#ffffff',
    border: formSettings.custom_border_color || formSettings.border_color || '#fce7f3',
    title: formSettings.title_color || '#1f2937',
    subtitle: formSettings.subtitle_color || '#6b7280',
    label: formSettings.label_color || '#374151',
    btn: formSettings.btn_color || '#E8527A',
    btnText: formSettings.btn_text_color || '#ffffff',
    inputBg: formSettings.input_bg || '#fafafa',
    inputBorder: formSettings.input_border || '#e5e7eb',
    inputFocus: formSettings.input_focus_border || formSettings.btn_color || '#E8527A',
    bundleSelectedBg: formSettings.bundle_selected_bg || '#FFF0F5',
    bundleSelectedBorder: formSettings.bundle_selected_border || formSettings.btn_color || '#E8527A',
    bundleBg: formSettings.bundle_bg || '#ffffff',
    bundleBorder: formSettings.bundle_border || '#f3f4f6',
    bundleBadgeBg: formSettings.bundle_badge_bg || formSettings.btn_color || '#E8527A',
    bundleBadgeText: formSettings.bundle_badge_text || '#ffffff',
    accent: formSettings.accent_color || formSettings.btn_color || '#E8527A',
    // Premium
    cardShadow: formSettings.card_shadow || '0 20px 50px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
    cardShadowHover: formSettings.card_shadow_hover || '0 28px 60px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)',
    cardBorderWidth: formSettings.card_border_width ?? 2,
    cardBorderStyle: formSettings.card_border_style || 'solid',
    cardBorderColor: formSettings.custom_border_color || formSettings.border_color || '#fce7f3',
    headerGradient: formSettings.header_gradient || `linear-gradient(135deg, ${formSettings.btn_color || '#E8527A'} 0%, ${formSettings.accent_color || '#C23A5E'} 100%)`,
    bgGradient: formSettings.bg_gradient || `linear-gradient(180deg, ${formSettings.bg_color || '#ffffff'} 0%, ${formSettings.bg_color || '#ffffff'} 100%)`,
    btnShadow: formSettings.btn_shadow || `0 4px 20px ${formSettings.btn_color || '#E8527A'}45`,
    btnShadowHover: formSettings.btn_shadow_hover || `0 8px 30px ${formSettings.btn_color || '#E8527A'}55`,
    btnBorderRadius: formSettings.btn_border_radius ?? 14,
    inputBorderRadius: formSettings.input_border_radius ?? 10,
    inputFocusShadow: formSettings.input_focus_shadow || `0 0 0 3px ${formSettings.btn_color || '#E8527A'}33`,
    bundleCardShadow: formSettings.bundle_card_shadow || '0 8px 24px rgba(0,0,0,0.06)',
    bundleCardShadowHover: formSettings.bundle_card_shadow_hover || '0 16px 40px rgba(0,0,0,0.1)',
    bundleCardBorderRadius: formSettings.bundle_card_border_radius ?? 14,
    bundleCardBorderWidth: formSettings.bundle_card_border_width ?? 2,
    bundleCardBorderStyle: formSettings.bundle_card_border_style || 'solid',
    bundleCardBorderColor: formSettings.bundle_border || '#f3f4f6',
    paddingTop: formSettings.padding_top ?? 24,
    paddingBottom: formSettings.padding_bottom ?? 24,
    paddingLeft: formSettings.padding_left ?? 24,
    paddingRight: formSettings.padding_right ?? 24,
  }), [formSettings])

  const btnLabel = loading
    ? '⏳ Envoi en cours...'
    : unitPrice > 0
      ? `${formSettings.btn_text || '🛒 COMMANDER'} — ${total.toLocaleString('fr-FR')} ${currency}`
      : (formSettings.btn_text || '🛒 COMMANDER MAINTENANT')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone || !city) return

    // Redirection WhatsApp si activé
    if (s.enable_whatsapp_order) {
      const waNumber = s.whatsapp_order_number || themeSettings?.whatsapp_number || ''
      if (!waNumber) {
        toast.error('Numéro WhatsApp non configuré.')
        return
      }
      const defaultMsg = `Bonjour, je souhaite commander ${product?.title} (${finalQty}x).\nNom: ${name}\nTél: ${phone}\nVille: ${city}`
      const waText = encodeURIComponent(s.whatsapp_order_msg || defaultMsg)
      const waLink = `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${waText}`
      window.open(waLink, '_blank')
      return
    }

    setLoading(true)
    try {
      const apiBase = themeSettings?.api_base || ''
      const trackingConsent = storeId ? hasMetaTrackingConsent(storeId) : false
      const metaBrowserContext = trackingConsent ? getMetaBrowserContext() : {}

      const res = await fetch(`${apiBase}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          phone,
          city,
          email: email || null,
          product: product?.title || null,
          product_id: product?.id ? String(product.id) : null,
          price: unitPrice,
          total,
          shipping_fee: Number(themeSettings?.shipping_fee) || 0,
          quantity: finalQty,
          currency,
          store_id: storeId || s.store_id || themeSettings?.store_id || null,
          market_id: themeSettings?.market_id || null,
          marketing_consent: trackingConsent,
          ...metaBrowserContext,
          variant_id: product?.variants?.[0]?.id ?? null,
          variant: Object.keys(variantSelections).length ? variantSelections : null,
        }),
      })

      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("Erreur serveur inattendue (la réponse n'est pas au format JSON).")
      }

      const data = await res.json()

      if (!res.ok) {
        const msg = data.detail ? `${data.error} — ${data.detail}` : (data.error || "Impossible d'enregistrer votre commande.")
        throw new Error(msg)
      }

      setSent(true)
      if (trackingConsent) {
        trackMetaBrowserEvent('Purchase', {
          value: total,
          currency,
          content_type: 'product',
          content_ids: product?.id ? [String(product.id)] : [],
          contents: product?.id ? [{ id: String(product.id), quantity: finalQty }] : [],
          num_items: finalQty,
          order_id: String(data.order_id || data.number || ''),
        }, typeof data.event_id === 'string' ? data.event_id : undefined)
      }
    } catch (err: any) {
      console.error('[Order Submit Error]:', err)
      toast.error(`Désolé, une erreur est survenue : ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const btnAnimClass: Record<BtnAnimation, string> = {
    shake: 'anim-shake', pulse: 'anim-pulse', bounce: 'anim-bounce', glow: 'anim-glow', none: '',
  }

  // Audio playback removed from client order confirmation

  if (sent) {
    const productImage = product?.image_url || product?.images?.[0] || ''
    const waNumber = themeSettings?.whatsapp_number || s.whatsapp_order_number || ''
    const defaultWaMsg = `Bonjour, je viens de passer une commande pour ${product?.title || 'un produit'} (${finalQty}x).\nNom : ${name}\nTél : ${phone}\nVille : ${city}`
    const waText = encodeURIComponent(s.popup_whatsapp_msg || defaultWaMsg)
    const waLink = waNumber ? `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${waText}` : ''
    const displayTotal = total > 0 ? `${total.toLocaleString('fr-FR')} ${currency}` : ''

    return typeof document !== 'undefined' ? createPortal(
      <div
        className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        style={{ background: 'rgba(10, 15, 40, 0.65)', backdropFilter: 'blur(10px)' }}
      >
        <div className="bg-white w-full sm:max-w-[480px] sm:rounded-[28px] rounded-t-[28px] shadow-2xl relative overflow-hidden anim-pop border border-white/20">

          {/* ── Bande de succès gradient ── */}
          <div className="relative bg-gradient-to-br from-[#6d28d9] via-[#7c3aed] to-[#4f46e5] px-6 pt-8 pb-10 text-center overflow-hidden">
            {/* Cercles décoratifs */}
            <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />

            {/* Bouton fermer */}
            <button
              onClick={() => { setSent(false); setName(''); setPhone(''); setCity(''); setEmail('') }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors z-20 text-sm font-bold"
            >
              ✕
            </button>

            {/* Icône check animée */}
            <div className="relative z-10 w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-xl shadow-violet-900/30">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 className="relative z-10 text-2xl font-black text-white tracking-tight">
              Commande reçue ! 🎉
            </h3>
            <p className="relative z-10 text-sm text-white/80 mt-1.5 font-medium">
              Merci {name.split(' ')[0]}, tu seras appelé(e) très bientôt.
            </p>
          </div>

          {/* ── Contenu principal ── */}
          <div className="px-5 py-5 space-y-3">

            {/* Carte info client */}
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 space-y-2.5">
              <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wider mb-3">Informations de livraison</p>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white border border-violet-100 flex items-center justify-center shrink-0 shadow-sm">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-medium">Nom complet</p>
                  <p className="text-sm font-bold text-zinc-800">{name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white border border-violet-100 flex items-center justify-center shrink-0 shadow-sm">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.58 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-medium">Téléphone</p>
                  <p className="text-sm font-bold text-zinc-800">{phone}</p>
                </div>
              </div>

              {city && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-violet-100 flex items-center justify-center shrink-0 shadow-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-medium">Ville</p>
                    <p className="text-sm font-bold text-zinc-800">{city}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Récap produit */}
            <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                {productImage && (
                  <img src={productImage} alt={product?.title || ''} className="w-14 h-14 rounded-xl object-cover border border-zinc-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-800 text-sm leading-tight line-clamp-2">
                    {product?.title || 'Votre produit'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">Quantité : {finalQty}</p>
                </div>
                {displayTotal && (
                  <p className="font-black text-violet-700 text-sm shrink-0">{displayTotal}</p>
                )}
              </div>
              <div className="bg-violet-50 border-t border-violet-100 px-4 py-2.5 flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-500">Paiement</span>
                <span className="text-xs font-black text-emerald-600">💵 À la livraison</span>
              </div>
            </div>

            {/* Bannière "on t'appelle" */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 flex items-center gap-3 shadow-md shadow-emerald-200/50">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.58 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div>
                <p className="font-black text-white text-sm">Un agent va vous appeler</p>
                <p className="text-white/85 text-xs mt-0.5 leading-snug">
                  Restez disponible sur le <span className="font-bold">{phone}</span> pour confirmer votre commande.
                </p>
              </div>
            </div>

            {/* WhatsApp */}
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-3.5 text-sm transition-all shadow-md shadow-green-200/50 active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Discuter sur WhatsApp
              </a>
            )}

            {/* Fermer */}
            <button
              onClick={() => { setSent(false); setName(''); setPhone(''); setCity(''); setEmail('') }}
              className="w-full text-xs text-zinc-400 hover:text-zinc-600 py-1 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    , document.body) : null
  }

  return (
    <div className="w-full px-2 py-4" id="order-form">
      <div
        className="w-full overflow-hidden order-form-card"
        style={{
          maxWidth: formSettings.form_max_width ? `${formSettings.form_max_width}px` : '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
          background: colors.bgGradient,
          '--color-primary': themeSettings?.primaryColor || '#7c3aed',
          '--color-accent-deep': themeSettings?.accentDeep || themeSettings?.primaryColor || '#6d28d9',
          '--color-bg': themeSettings?.backgroundColor || '#ffffff',
          '--color-surface': themeSettings?.surface || '#ffffff',
          borderRadius: borderR,
          border: `${colors.cardBorderWidth}px ${colors.cardBorderStyle} ${colors.cardBorderColor}`,
          boxShadow: colors.cardShadow,
          transition: 'box-shadow 0.3s ease, transform 0.2s ease',
        } as React.CSSProperties}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = colors.cardShadowHover }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = colors.cardShadow }}
      >
        {/* Bandeau coloré en-tête — toujours visible */}
        <div
          className="px-5"
          style={{
            background: colors.headerGradient,
            paddingTop: formSettings.header_padding_y ?? 16,
            paddingBottom: formSettings.header_padding_y ?? 16,
            minHeight: formSettings.header_min_height ? `${formSettings.header_min_height}px` : undefined,
          }}
        >
          <h3 className="font-black text-white leading-tight" style={{ fontSize: formSettings.title_font_size ? `${formSettings.title_font_size}px` : '1.1rem' }}>
            {formSettings.title || '📦 Finaliser ma commande'}
          </h3>
          {formSettings.subtitle && (
            <p className="text-white/85 text-xs mt-1">{formSettings.subtitle}</p>
          )}
        </div>

        <div className="p-5">
          {bundlesEnabled && visibleBundles.length > 0 && (
            <BundleOffers
              bundles={visibleBundles}
              selectedId={selectedBundleId}
              onSelect={setSelectedBundleId}
              unitPrice={unitPrice}
              currency={currency}
              productImage={product?.image_url || product?.images?.[0]}
              colors={{
                selectedBg: colors.bundleSelectedBg,
                selectedBorder: colors.bundleSelectedBorder,
                bg: colors.bundleBg,
                border: colors.bundleBorder,
                badgeBg: colors.bundleBadgeBg,
                badgeText: colors.bundleBadgeText,
                title: colors.title,
                subtitle: colors.subtitle,
                price: colors.btn,
                savings: colors.bundleSelectedBorder,
                accent: colors.accent,
              }}
              borderWidth={formSettings.bundle_border_width ?? 2}
              borderRadius={formSettings.bundle_border_radius ?? 14}
              borderStyle={formSettings.bundle_border_style || 'solid'}
              selectedBorderWidth={formSettings.bundle_selected_border_width ?? 3}
              layout={formSettings.bundle_layout || 'deals'}
            />
          )}

          {variantOptions.length > 0 && (
            <div className="mb-4">
              <VariantSelector options={variantOptions} onChange={setVariantSelections} themeSettings={themeSettings} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {[
              { key: 'name', show: formSettings.show_name !== false, label: 'Nom complet *', val: name, set: setName, type: 'text', ph: 'Ex: Amadou Diallo', req: true },
              { key: 'phone', show: formSettings.show_phone !== false, label: 'Téléphone *', val: phone, set: setPhone, type: 'tel', ph: 'Ex: 620 00 00 00', req: true },
              { key: 'city', show: formSettings.show_city !== false, label: 'Ville / Quartier *', val: city, set: setCity, type: 'text', ph: 'Ex: Conakry, Matam', req: true },
              { key: 'email', show: !!formSettings.show_email, label: 'Email', val: email, set: setEmail, type: 'email', ph: 'email@exemple.com', req: false },
            ].filter(f => f.show).map(f => (
              <div key={f.key} className="order-field">
                <label className="block text-xs font-black mb-1.5 uppercase tracking-wide" style={{ color: colors.label }}>{f.label}</label>
<input
                  type={f.type}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  required={f.req}
                  placeholder={f.ph}
                  className="w-full px-4 py-3.5 text-sm font-medium outline-none transition-all order-input"
                  style={{
                    backgroundColor: colors.inputBg,
                    border: `2px solid ${colors.inputBorder}`,
                    borderRadius: formSettings.input_border_radius ?? 10,
                    color: colors.title,
                  }}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = colors.inputFocusShadow }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            ))}

            {!bundlesEnabled && unitPrice > 0 && formSettings.show_qty_picker !== false && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-black uppercase" style={{ color: colors.label }}>Quantité</span>
                <div className="flex items-center rounded-xl overflow-hidden border-2" style={{ borderColor: colors.inputBorder }}>
                  <button type="button" onClick={() => setManualQty(q => Math.max(1, q - 1))} className="w-11 h-11 font-black text-lg hover:bg-black/5">−</button>
                  <span className="w-10 text-center font-black">{manualQty}</span>
                  <button type="button" onClick={() => setManualQty(q => q + 1)} className="w-11 h-11 font-black text-lg hover:bg-black/5">+</button>
                </div>
              </div>
            )}

<button
              type="submit"
              disabled={loading}
              className={`w-full py-4 font-black text-[15px] shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 mt-1 ${btnAnimClass[btnAnimation]}`}
              style={{
                background: `linear-gradient(135deg, ${colors.btn} 0%, ${colors.accent} 100%)`,
                color: colors.btnText,
                borderRadius: formSettings.btn_border_radius ?? 14,
                boxShadow: colors.btnShadow,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = colors.btnShadowHover }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = colors.btnShadow }}
            >
              {btnLabel}
            </button>

            {formSettings.show_footer_text !== false && (
              <div className="flex items-center justify-center gap-4 pt-1 flex-wrap">
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: colors.subtitle }}>
                  <ShieldCheck size={12} /> Paiement à la livraison
                </span>
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: colors.subtitle }}>
                  <Truck size={12} /> Livraison rapide
                </span>
              </div>
            )}
            {formSettings.footer_text && (
              <p className="text-[10px] text-center" style={{ color: colors.subtitle }}>{formSettings.footer_text}</p>
            )}
          </form>
        </div>
      </div>

      <style>{`
        .order-input:focus { border-color: ${colors.inputFocus} !important; box-shadow: 0 0 0 3px ${colors.inputFocus}22; }
        @keyframes animShake { 0%,88%,100%{transform:translateX(0)} 89%,93%{transform:translateX(-4px)} 90%,94%{transform:translateX(4px)} }
        @keyframes animPulse { 0%,100%{transform:scale(1);box-shadow:0 8px 24px ${colors.btn}45} 50%{transform:scale(1.02);box-shadow:0 12px 32px ${colors.btn}55} }
        @keyframes animBounce { 0%,80%,100%{transform:translateY(0)} 85%{transform:translateY(-5px)} }
        @keyframes animGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.12)} }
        @keyframes animPop { 0%{transform:scale(.85);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes animDelivery { 0% { left: 10%; } 100% { left: 70%; } }
        .anim-shake{animation:animShake 4s ease-in-out infinite}
        .anim-pulse{animation:animPulse 2.2s ease-in-out infinite}
        .anim-bounce{animation:animBounce 2s ease-in-out infinite}
        .anim-glow{animation:animGlow 2s ease-in-out infinite}
        .anim-pop{animation:animPop .35s cubic-bezier(.2,.8,.2,1) both}
        .anim-delivery { animation: animDelivery 4s ease-out forwards; }
        .order-form-card { animation: animPop .5s ease both; }
      `}</style>
    </div>
  )
}

export { BTN_ANIMATIONS }
export type { BtnAnimation }



