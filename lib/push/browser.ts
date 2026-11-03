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
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export async function savePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Ce navigateur ne prend pas en charge les notifications Push.')
  }
  const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!applicationServerKey) {
    throw new Error('La clé VAPID publique n’est pas configurée.')
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Autorise les notifications dans les réglages du navigateur.')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription() ??
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey) as BufferSource,
    })

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
