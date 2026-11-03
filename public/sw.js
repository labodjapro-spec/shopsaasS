/* ShopSaaS merchant app — v3. Do not cache private dashboard data. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(fetch(request))
})

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event))
})

async function handlePush(event) {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() || 'Une nouvelle commande est arrivée.' }
  }

  const title = payload.title || 'Nouvelle commande'
  const tag = payload.tag || 'shopsaas-new-order'
  const url = payload.url || '/dashboard/orders'
  const message = {
    type: 'ORDER_PUSH',
    title,
    body: payload.body || 'Ouvre ShopSaaS pour consulter la commande.',
    url,
    tag,
    orderId: payload.orderId || null,
  }

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const focused = windows.find((client) => client.focused)
  if (focused) {
    focused.postMessage(message)
    return
  }

  windows.forEach((client) => client.postMessage(message))

  await self.registration.showNotification(title, {
    body: message.body,
    icon: '/icons/app-192.png',
    badge: '/icons/app-192.png',
    data: { url, orderId: message.orderId },
    tag,
    renotify: false,
    requireInteraction: true,
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/dashboard/orders', self.location.origin).href
  event.waitUntil(openOrFocus(target))
})

async function openOrFocus(target) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => client.url.startsWith(self.location.origin))
  if (existing) {
    await existing.navigate(target)
    return existing.focus()
  }
  return self.clients.openWindow(target)
}
