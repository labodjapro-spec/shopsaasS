'use client'

import Script from 'next/script'

/** Meta (Facebook) Pixel — PageView + événements e-commerce sur la boutique publique.
 *  Note : ce composant est utilisé sur les pages builder (PublicPageRenderer).
 *  Les pages /s/[store]/p/[slug] utilisent MetaPixelTracker à la place. */
export default function StoreTracking({ pixelId }: { pixelId?: string | null }) {
  const id = pixelId?.trim()
  if (!id) return null

  return (
    <>
      <Script id="fb-pixel" strategy="afterInteractive">{`
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

export function trackFbEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', event, params)
  }
}
