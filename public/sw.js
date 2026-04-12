// Minimal service worker for PWA install + future push notifications

const CACHE_NAME = 'atrium-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through — no offline caching for now
  return;
});

// Placeholder for push notification handler — we'll fill this in next session
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Atrium', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'atrium-message',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data || '/')
  );
});
