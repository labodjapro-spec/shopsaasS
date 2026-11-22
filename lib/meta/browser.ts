// Kept under its existing name so the order forms stay small. Storefront
// tracking is initialized automatically from the store's Pixel settings.
export function hasMetaTrackingConsent(_storeId: string) {
  return true
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const value = document.cookie.split('; ').find(item => item.startsWith(prefix))?.slice(prefix.length)
  return value ? decodeURIComponent(value) : null
}

export function getMetaBrowserContext() {
  return {
    fbp: getCookie('_fbp'),
    fbc: getCookie('_fbc'),
  }
}

export function trackMetaBrowserEvent(
  eventName: string,
  data: Record<string, unknown>,
  eventId?: string,
) {
  if (typeof window === 'undefined') return

  // Si shopSaaSMetaTrack est disponible, l'utiliser directement
  if (window.shopSaaSMetaTrack) {
    window.shopSaaSMetaTrack(eventName, data, eventId)
    return
  }

  // Fallback : fbq global si disponible (cas où le pixel est chargé mais pas shopSaaSMetaTrack)
  const fbq = (window as any).fbq
  if (fbq) {
    if (eventId) fbq('track', eventName, data, { eventID: eventId })
    else fbq('track', eventName, data)
    return
  }

  // Dernier recours : attendre que fbq soit chargé (max 5s)
  let attempts = 0
  const interval = window.setInterval(() => {
    attempts++
    const fbqDelayed = (window as any).fbq
    if (fbqDelayed) {
      window.clearInterval(interval)
      if (eventId) fbqDelayed('track', eventName, data, { eventID: eventId })
      else fbqDelayed('track', eventName, data)
    }
    if (attempts >= 50) window.clearInterval(interval) // abandon après 5s
  }, 100)
}

declare global {
  interface Window {
    shopSaaSMetaTrack?: (eventName: string, data?: Record<string, any>, eventId?: string) => void
  }
}
