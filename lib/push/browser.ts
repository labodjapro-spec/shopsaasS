const DEVICE_KEY = 'shopsaas-device-id'
const PUSH_FLAG = 'shopsaas-push-enabled'

export function getDeviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function isPushFlagEnabled() {
  return window.localStorage.getItem(PUSH_FLAG) === 'true'
}

export function setPushFlag(enabled: boolean) {
  window.localStorage.setItem(PUSH_FLAG, String(enabled))
}

function urlBase64ToUint8Array(base64String: string) {
  const cleaned = base64String.trim()
  const padding = '='.repeat((4 - cleaned.length % 4) % 4)
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

function bufferToBase64Url(buffer: ArrayBuffer | null | undefined) {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Key used when this browser subscribed (base64url), or '' if unknown. */
export function subscriptionKey(subscription: PushSubscription | null) {
  return bufferToBase64Url(subscription?.options?.applicationServerKey)
}

/**
 * Returns a subscription signed with the CURRENT VAPID key. A subscription made
 * with an old key is silently rejected (403) by Google/Apple, so we replace it.
 */
async function getFreshSubscription(registration: ServiceWorkerRegistration, applicationServerKey: string) {
  const cleanKey = applicationServerKey.trim()
  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    const key = subscriptionKey(existing)
    if (!key || key === cleanKey) return existing
    await existing.unsubscribe().catch(() => undefined)
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(cleanKey) as BufferSource,
  })
}

export async function savePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Ce navigateur ne prend pas en charge les notifications Push.')
  }
  const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (!applicationServerKey) {
    throw new Error('La clé VAPID publique n’est pas configurée.')
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Autorise les notifications dans les réglages du navigateur.')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await getFreshSubscription(registration, applicationServerKey)

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      userAgent: navigator.userAgent,
      subscription: subscription.toJSON(),
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Impossible d’enregistrer cet appareil.')
  setPushFlag(true)
  return subscription
}

export async function removePushSubscription() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, deviceId: getDeviceId() }),
    })
    if (!response.ok) throw new Error('Impossible de retirer cet appareil.')
    await subscription.unsubscribe().catch(() => undefined)
  }
  setPushFlag(false)
}

export type PushCheck = { id: string; label: string; ok: boolean; detail?: string; fix?: string }

/** Runs the full server-side diagnostic and sends a test notification. */
export async function runPushDiagnostic(): Promise<{ ok: boolean; checks: PushCheck[] }> {
  const local: PushCheck[] = []
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  local.push({
    id: 'support',
    label: 'Navigateur compatible',
    ok: supported,
    detail: supported ? 'Oui' : 'Ce navigateur ne gère pas le push',
    fix: 'Ouvre ShopSaaS dans Chrome (Android) ou installe l’app.',
  })
  if (!supported) return { ok: false, checks: local }

  const permission = Notification.permission
  local.push({
    id: 'permission',
    label: 'Permission notifications',
    ok: permission === 'granted',
    detail: permission === 'granted' ? 'Autorisée' : permission === 'denied' ? 'Bloquée' : 'Pas encore demandée',
    fix: permission === 'denied'
      ? 'Réglages du téléphone → Applications → ShopSaaS (ou Chrome) → Notifications → Autoriser.'
      : 'Appuie sur « Activer les alertes ».',
  })

  const registration = await navigator.serviceWorker.getRegistration('/')
  local.push({
    id: 'sw',
    label: 'Service worker actif',
    ok: Boolean(registration?.active),
    detail: registration?.active ? 'Oui' : 'Non enregistré',
    fix: 'Recharge la page une fois.',
  })

  // If permission is already granted, ensure the subscription is fresh and saved before testing
  let subscription = registration ? await registration.pushManager.getSubscription() : null
  if (permission === 'granted' && registration?.active) {
    try {
      subscription = await savePushSubscription()
    } catch {
      // Diagnostic will report the exact issue below
    }
  }

  const response = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription?.endpoint ?? '',
      applicationServerKey: subscriptionKey(subscription),
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok && !Array.isArray(result.checks)) {
    local.push({ id: 'api', label: 'Diagnostic serveur', ok: false, detail: result.error || `Erreur ${response.status}` })
    return { ok: false, checks: local }
  }
  const checks = [...local, ...(result.checks ?? [])]
  return { ok: checks.every((c: PushCheck) => c.ok), checks }
}
