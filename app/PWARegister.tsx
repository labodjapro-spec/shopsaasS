'use client'

import { useEffect } from 'react'
import { listenForInstallPrompt } from '@/lib/pwa/install'

export default function PWARegister() {
  useEffect(() => {
    listenForInstallPrompt()
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error) => {
      console.error('[pwa] Service worker registration failed:', error)
    })
  }, [])

  return null
}
