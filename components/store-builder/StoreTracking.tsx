'use client'

import Script from 'next/script'
import { useEffect } from 'react'

/** Meta Pixel — PageView + window.shopSaaSMetaTrack pour les événements e-commerce.
 *  Utilisé sur les pages builder (PublicPageRenderer).
 *  Utilise trackSingle() pour supporter plusieurs pixels simultanément. */
export default function StoreTracking({ pixelId }: { pixelId?: string | null }) {
  const id = pixelId?.trim()

  // Expose window.shopSaaSMetaTrack dès que le pixel est prêt
  // Cela permet à OrderFormRender d'envoyer Purchase avec le bon pixelId
  useEffect(() => {
    if (!id) return
    window.shopSaaSMetaTrack = (eventName: string, data: Record<string, any> = {}, eventId?: string) => {
      const fbq = (window as any).fbq
      if (!fbq) return
      if (eventId) fbq('trackSingle', id, eventName, data, { eventID: eventId })
      else fbq('trackSingle', id, eventName, data)
    }
    return () => { window.shopSaaSMetaTrack = undefined }
  }, [id])

  if (!id) return null

  return (
    <>
      <Script id={`fb-pixel-${id}`} strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${id}');
        fbq('trackSingle', '${id}', 'PageView');
      `}</Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}

declare global {
  interface Window {
    shopSaaSMetaTrack?: (eventName: string, data?: Record<string, any>, eventId?: string) => void
  }
}

/** Envoie un événement Meta avec trackSingle (multi-pixel safe). */
export function trackFbEvent(pixelId: string, event: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('trackSingle', pixelId, event, params)
  }
}
