export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type Listener = (event: InstallPromptEvent | null) => void

let deferredPrompt: InstallPromptEvent | null = null
const listeners = new Set<Listener>()
let listening = false

export function listenForInstallPrompt() {
  if (typeof window === 'undefined' || listening) return
  listening = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    listeners.forEach((listener) => listener(deferredPrompt))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener(null))
  })
}

export function getInstallPrompt() {
  return deferredPrompt
}

export function subscribeInstallPrompt(listener: Listener) {
  listeners.add(listener)
  listener(deferredPrompt)
  return () => { listeners.delete(listener) }
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const ios = /iPhone|iPad|iPod/i.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  return ios && !('MSStream' in window)
}
