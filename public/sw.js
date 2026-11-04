/* ShopSaaS merchant app — v9 */
const scheduledTimers = new Map()

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Keep a fetch listener so Chrome treats ShopSaaS as an installable PWA,
  // while letting the browser handle network requests natively.
})

function isMerchantClient(client) {
  try {
    const path = new URL(client.url).pathname
    return path.startsWith('/dashboard') || path.startsWith('/boutiques') || path.startsWith('/onboarding')
  } catch {
    return false
  }
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (data?.type !== 'SCHEDULE_REMINDER' || !data.orderId || !data.fireAt) return

  const prev = scheduledTimers.get(data.orderId)
  if (prev) clearTimeout(prev)

  const delayMs = Math.max(0, Number(data.fireAt) - Date.now())
  if (delayMs > 2147483647) return

  const promise = new Promise((resolve) => {
    const timer = setTimeout(async () => {
      scheduledTimers.delete(data.orderId)
      try {
        // Trigger server-side reminders endpoint so all devices receive the Web Push
        await fetch('/api/orders/reminders', { method: 'POST', credentials: 'include' }).catch(() => undefined)

        const title = '🚚 Livraison programmée maintenant !'
        const bodyLines = [
          `${data.customer || 'Client'} · ${data.orderNumber || ''} (${data.amount || ''})`.trim(),
          data.location ? `📍 ${data.location}` : '',
          data.note ? `📝 ${data.note}` : '',
        ].filter(Boolean)

        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        windows.filter(isMerchantClient).forEach((client) =>
          client.postMessage({
            type: 'ORDER_PUSH',
            reminder: true,
            orderId: data.orderId,
            orderNumber: data.orderNumber || '',
            customer: data.customer || '',
            amount: data.amount || '',
            note: data.note || '',
          }),
        )

        await self.registration.showNotification(title, {
          body: bodyLines.join('\n') || 'Une commande programmée doit être livrée maintenant.',
          icon: '/icons/app-192.png',
          badge: '/icons/app-badge.png',
          data: { url: data.url || `/dashboard/orders/${data.orderId}`, orderId: data.orderId },
          tag: `delivery-reminder-${data.orderId}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [220, 80, 220, 80, 220],
          timestamp: Date.now(),
        })
      } finally {
        resolve()
      }
    }, delayMs)
    scheduledTimers.set(data.orderId, timer)
  })

  if (event.waitUntil) event.waitUntil(promise)
})

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event))
})

async function handlePush(event) {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() || 'Une nouvelle commande est arrivee.' }
  }

  const title = payload.title || 'Nouvelle commande'
  const tag = payload.tag || `shopsaas-order-${Date.now()}`
  const url = payload.url || '/dashboard/orders'
  const body = payload.body || 'Ouvre ShopSaaS pour consulter la commande.'
  const message = {
    type: 'ORDER_PUSH',
    title,
    body,
    url,
    tag,
    orderId: payload.orderId || null,
    customer: payload.customer || '',
    orderNumber: payload.orderNumber || '',
    amount: payload.amount || '',
    currency: payload.currency || '',
    storeName: payload.storeName || '',
    total: payload.total || 0,
    reminder: Boolean(payload.reminder),
    note: payload.note || '',
  }

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (!payload.test) {
    windows.filter(isMerchantClient).forEach((client) => client.postMessage(message))
  }

  // Ne pas afficher la notification système si l'app TWA est au premier plan
  // (évite la double notification : TWA reçoit le postMessage, Chrome affiche la notif)
  const twaActive = windows.some((client) => isMerchantClient(client) && client.focused)
  if (twaActive && !payload.test) return

  // Always display the system notification: on Android/Windows, a tab can still
  // report focused=true when the phone screen just locked or another window is
  // in front. Skipping showNotification() caused missed alerts.
  await self.registration.showNotification(title, {
    body,
    icon: '/icons/app-192.png',
    badge: '/icons/app-badge.png',
    data: { url, orderId: message.orderId },
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: payload.reminder ? [220, 80, 220, 80, 220] : [180, 70, 180],
    timestamp: Date.now(),
  })
}

// The browser can rotate the push subscription at any time (often while the
// app is closed). Re-subscribe with the same key and tell the server, otherwise
// pushes silently stop arriving.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const options = event.oldSubscription?.options
    const subscription = event.newSubscription ||
      (options ? await self.registration.pushManager.subscribe(options) : null)
    if (!subscription) return
    await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: self.navigator.userAgent }),
    }).catch(() => undefined)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/dashboard/orders', self.location.origin).href
  event.waitUntil(openOrFocus(target))
})

async function openOrFocus(target) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find(isMerchantClient)
  if (existing) {
    await existing.navigate(target)
    return existing.focus()
  }
  return self.clients.openWindow(target)
}
