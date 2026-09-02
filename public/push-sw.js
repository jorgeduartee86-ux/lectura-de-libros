/* global self, URL, Response */
const DIAGNOSTICS_CACHE = 'lectura-push-diagnostics-v2'
async function saveDiagnostic(value) {
  const cache = await self.caches.open(DIAGNOSTICS_CACHE)
  await cache.put(
    new URL('push-status', self.registration.scope),
    new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }),
  )
}
async function badge(count) {
  if ('setAppBadge' in self.navigator) {
    try {
      if (count > 0) await self.navigator.setAppBadge(count)
      else await self.navigator.clearAppBadge()
    } catch {
      /* Optional OS capability. */
    }
  }
}
function safeDestination(value) {
  const scope = new URL(self.registration.scope)
  try {
    const destination = new URL(value, scope)
    return destination.origin === scope.origin && destination.pathname.startsWith(scope.pathname)
      ? destination.href
      : scope.href
  } catch {
    return scope.href
  }
}
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* Never display untrusted arbitrary payload text. */
  }
  const declaration = payload.notification || {}
  const destination = safeDestination(payload.url || declaration.navigate || self.registration.scope)
  const timestamp = Number(payload.timestamp || declaration.timestamp) || Date.now()
  const count = Math.max(0, Number(payload.count ?? declaration.app_badge) || 0)
  const options = {
    body: payload.body || declaration.body || 'Tienes una nueva página',
    icon: new URL('pwa-192x192.png', self.registration.scope).href,
    badge: new URL('pwa-192x192.png', self.registration.scope).href,
    tag: payload.tag || declaration.tag || `lectura-${timestamp}`,
    renotify: false,
    timestamp,
    silent: payload.silent !== false,
    data: { url: destination, messageId: new URL(destination).searchParams.get('message') },
  }
  if (self.Notification && 'requireInteraction' in self.Notification.prototype)
    options.requireInteraction = true
  if (payload.vibration && options.silent === false) options.vibrate = [80, 50, 80]
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(
        payload.title || declaration.title || 'Lectura de libros',
        options,
      )
      await badge(count)
      await saveDiagnostic({
        lastReceivedAt: new Date().toISOString(),
        status: 'displayed',
        workerVersion: 2,
      })
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      windows.forEach((client) => client.postMessage({ type: 'PUSH_RECEIVED' }))
    })(),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = safeDestination(event.notification.data?.url)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (!client.url.startsWith(self.registration.scope)) continue
        if ('navigate' in client) await client.navigate(destination)
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow ? self.clients.openWindow(destination) : undefined
    })(),
  )
  // Clicking or dismissing a notification NEVER creates a read receipt.
})
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'UNREAD_COUNT') return
  const count = Math.max(0, Number(event.data.count) || 0)
  event.waitUntil(
    (async () => {
      await badge(count)
      if (count === 0)
        (await self.registration.getNotifications()).forEach((notification) => notification.close())
    })(),
  )
})
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      await saveDiagnostic({ status: 'subscription_changed', workerVersion: 2 })
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      windows.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }))
    })(),
  )
})
