self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(self.registration.showNotification(data.title || 'Khobra Cleaning', { body: data.body || 'Your booking has an update.', icon: '/android-chrome-192x192.png', data: { url: data.url || '/bookings' } }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/bookings'))
})
