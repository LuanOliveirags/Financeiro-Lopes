const CACHE_NAME = 'financas-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Notificações push (simples)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'NOTIFY') {
    self.registration.showNotification('Lembrete de Dívida', {
      body: event.data.message,
      icon: './img/icon-192.png',
      badge: './img/icon-192.png'
    });
  }
});