// Service Worker para PWA - Caching e Offline Support
const CACHE_NAME = 'financeiro-lopes-v5';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './css/app-style.css',
  './css/sections.css',
  './css/calendar-style.css',
  './css/animations.css',
  './css/base/responsive.css',
  './js/app.js',
  './js/config.js',
  './js/state.js',
  './js/utils.js',
  './js/data.js',
  './js/auth.js',
  './js/transactions.js',
  './js/debts.js',
  './js/salaries.js',
  './js/dashboard.js',
  './js/navigation.js',
  './js/chores.js',
  './js/shopping.js',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return Promise.all(
          URLS_TO_CACHE.map(url =>
            cache.add(url).catch(() => console.log('Falha ao cachear:', url))
          )
        );
      })
      .catch((error) => console.log('Erro ao cachear:', error))
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network First, falling back to Cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // Try network first
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone();

        // Cache the new response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a generic offline page if available
            return new Response('Sem conexão. Tente novamente mais tarde.', {
              status: 503,
              statusText: 'Serviço Indisponível',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Background Sync para sincronização de dados
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  console.log('Iniciando sincronização de transações...');
  // Implementar sincronização com backend
}

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Notificação',
    icon: '/img/icon-192.png',
    badge: '/img/icon-96.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Financeiro Lopes', options)
  );
});
