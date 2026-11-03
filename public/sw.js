/* ShopSaaS merchant app — v6 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return
  event.respondWith(fetch(request))
})

function isMerchantClient(client) {
  try {
    const path = new URL(client.url).pathname
    return path.startsWith('/dashboard') || path.startsWith('/boutiques') || path.startsWith('/onboarding')
  } catch {
    return false
  }
}

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
  const tag = payload.tag || 'shopsaas-new-order'
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
  }

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const focusedMerchant = windows.find((client) => client.focused && isMerchantClient(client))
  // A test push must always show a real system notification.
  if (focusedMerchant && !payload.test) {
    focusedMerchant.postMessage(message)
    return
  }

  if (!payload.test) windows.filter(isMerchantClient).forEach((client) => client.postMessage(message))

  await self.registration.showNotification(title, {
    body,
    icon: '/icons/app-192.png',
    badge: '/icons/app-badge.png',
    data: { url, orderId: message.orderId },
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [180, 70, 180],
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
