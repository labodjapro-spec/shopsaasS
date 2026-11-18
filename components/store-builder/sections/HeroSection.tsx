import React from 'react'

/**
 * HeroSection — compatible avec DEFAULT_HERO_PROPS et PropertiesPanel
 * Clés : headline, subheadline, badge_text, show_badge, badge_color,
 *        cta_text, cta_text_2, cta_link, image_url, image_position,
 *        overlay_opacity, text_align, bg_color, text_color, animation
 */
export default function HeroSection({ settings }: { settings: any }) {
  const s = settings || {}

  const headline = s.headline || 'Titre accrocheur de votre produit'
  const subheadline = s.subheadline || 'Décrivez en une phrase le bénéfice principal de votre offre. Soyez précis et percutant.'
  const showBadge = s.show_badge ?? true
  const badgeText = s.badge_text || 'NOUVEAU'
  const badgeColor = s.badge_color || '#f59e0b'
  const ctaText = s.cta_text || 'Commander maintenant'
  const ctaText2 = s.cta_text_2 || ''
  const ctaLink = s.cta_link || '#order-form'
  const imageUrl = s.image_url || ''
  const imagePosition = s.image_position || 'right' // 'left' | 'right' | 'background'
  const overlayOpacity = s.overlay_opacity ?? 0.4
  const textAlign = s.text_align || 'left' // 'left' | 'center' | 'right'
  const bgColor = s.bg_color || '#ffffff'
  const textColor = s.text_color || '#111827'
  const animation = s.animation || 'fadeIn'

  const isBackground = imagePosition === 'background'

  const textAlignClass =
    textAlign === 'center' ? 'text-center items-center' :
    textAlign === 'right' ? 'text-right items-end' :
    'text-left items-start'

  const animClass = animation === 'slideUp'
    ? 'animate-in slide-in-from-bottom-8 duration-700'
    : 'animate-in fade-in duration-700'

  /* ── Mode background image ── */
  if (isBackground) {
    return (
      <section
        className="relative w-full overflow-hidden flex items-center justify-center min-h-[480px]"
        style={{ backgroundColor: bgColor }}
      >
        {imageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        )}
        <div
          className="absolute inset-0 z-10"
          style={{ backgroundColor: '#000', opacity: overlayOpacity }}
        />
        <div className={`relative z-20 w-full max-w-4xl mx-auto px-6 py-20 flex flex-col gap-6 ${textAlignClass} ${animClass}`}>
          {showBadge && badgeText && (
            <span
              className="inline-block self-start px-4 py-1 text-xs font-bold tracking-widest uppercase text-white rounded-full shadow"
              style={{ backgroundColor: badgeColor }}
            >
              {badgeText}
            </span>
          )}
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-lg">
            {headline}
          </h1>
          {subheadline && (
            <p className="text-lg text-white/90 max-w-2xl font-medium drop-shadow">
              {subheadline}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-2">
            {ctaText && (
              <a
                href={ctaLink}
                className="px-8 py-4 bg-white font-bold text-sm uppercase tracking-wider rounded-xl hover:scale-105 transition-transform shadow-xl"
                style={{ color: bgColor || '#111827' }}
              >
                {ctaText}
              </a>
            )}
            {ctaText2 && (
              <a
                href="#"
                className="px-8 py-4 border-2 border-white text-white font-bold text-sm uppercase tracking-wider rounded-xl hover:bg-white/10 transition-colors"
              >
                {ctaText2}
              </a>
            )}
          </div>
        </div>
      </section>
    )
  }

  /* ── Mode split (image left/right) ── */
  const imageOnRight = imagePosition !== 'left'

  return (
    <section
      className="w-full"
      style={{ backgroundColor: bgColor }}
    >
      <div className={`max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center gap-10 ${imageOnRight ? '' : 'md:flex-row-reverse'}`}>
        {/* Text side */}
        <div className={`flex-1 flex flex-col gap-5 ${textAlignClass} ${animClass}`}>
          {showBadge && badgeText && (
            <span
              className="inline-block self-start px-4 py-1 text-xs font-bold tracking-widest uppercase text-white rounded-full shadow"
              style={{ backgroundColor: badgeColor }}
            >
              {badgeText}
            </span>
          )}
          <h1
            className="text-3xl md:text-5xl font-black leading-tight"
            style={{ color: textColor }}
          >
            {headline}
          </h1>
          {subheadline && (
            <p className="text-base md:text-lg font-medium opacity-80" style={{ color: textColor }}>
              {subheadline}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            {ctaText && (
              <a
                href={ctaLink}
                className="px-7 py-3 font-bold text-sm uppercase tracking-wider rounded-xl hover:scale-105 transition-transform shadow-lg text-white"
                style={{ backgroundColor: '#6366f1' }}
              >
                {ctaText}
              </a>
            )}
            {ctaText2 && (
              <a
                href="#"
                className="px-7 py-3 font-bold text-sm uppercase tracking-wider rounded-xl border-2 hover:bg-gray-50 transition-colors"
                style={{ borderColor: textColor, color: textColor }}
              >
                {ctaText2}
              </a>
            )}
          </div>
        </div>

        {/* Image side */}
        {imageUrl ? (
          <div className="flex-1 w-full">
            <img
              src={imageUrl}
              alt={headline}
              className="w-full max-h-[480px] object-cover rounded-2xl shadow-xl"
            />
          </div>
        ) : (
          <div className="flex-1 w-full min-h-[300px] rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200">
            Ajoutez une image dans le panneau →
          </div>
        )}
      </div>
    </section>
  )
}
