/* global self */
self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : 'Hay una página nueva para ti.' }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Lectura de libros', {
      body: payload.body || 'Hay una página nueva para ti.',
      icon: 'pwa-192x192.png',
      badge: 'pwa-192x192.png',
      tag: payload.tag || 'lectura-nueva-pagina',
      renotify: true,
      data: { url: payload.url || self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = event.notification.data?.url || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if ('navigate' in client) await client.navigate(destination)
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow ? self.clients.openWindow(destination) : undefined
    }),
  )
})
