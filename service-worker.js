// Service Worker para PWA - Caching e Offline Support

// ===== FIREBASE CLOUD MESSAGING (background push para o chat) =====
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey:            'AIzaSyAMx-ZoL4cco2NmPzEfIe5yYC1WLHPc0vk',
    projectId:         'wolfsource',
    messagingSenderId: '621443570583',
    appId:             '1:621443570583:web:1a5ad0106d2606561482d2',
  });

  const messaging = firebase.messaging();

  // Chamado quando chega um push FCM do tipo "data-only" com o app fechado/background
  messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    if (d.type !== 'chat') return;
    return self.registration.showNotification(`💬 ${d.senderName || 'Nova mensagem'}`, {
      body:     (d.text || '').substring(0, 100),
      icon:     'frontend/assets/images/icon-any-192.png',
      badge:    'frontend/assets/images/icon-any-96.png',
      tag:      'chat-incoming',
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     { type: 'chat' },
    });
  });

} catch (e) {
  // importScripts pode falhar offline — continua sem FCM
  console.warn('[SW] Firebase Messaging n\u00e3o carregado:', e);
}
// ===== FIM FIREBASE MESSAGING =====

const CACHE_NAME = 'wolfsource-v18';
const URLS_TO_CACHE = [
  './',
  './index.html',
  // Pages (HTML fragments)
  './frontend/pages/login.html',
  './frontend/pages/dashboard.html',
  './frontend/pages/transactions.html',
  './frontend/pages/debts.html',
  './frontend/pages/salaries.html',
  './frontend/pages/settings.html',
  './frontend/pages/chores.html',
  './frontend/pages/shopping.html',
  './frontend/pages/chat.html',
  // CSS — Global
  './frontend/assets/css/global/base.css',
  './frontend/assets/css/global/animations.css',
  './frontend/assets/css/global/responsive.css',
  // CSS — Components
  './frontend/assets/css/components/forms.css',
  './frontend/assets/css/components/navigation.css',
  './frontend/assets/css/components/modal.css',
  './frontend/assets/css/components/calendar.css',
  // CSS — Pages
  './frontend/assets/css/pages/login.css',
  './frontend/assets/css/pages/dashboard.css',
  './frontend/assets/css/pages/transactions.css',
  './frontend/assets/css/pages/debts.css',
  './frontend/assets/css/pages/salaries.css',
  './frontend/assets/css/pages/settings.css',
  './frontend/assets/css/pages/chores.css',
  './frontend/assets/css/pages/shopping.css',
  './frontend/assets/css/pages/chat.css',
  // JS — Core & Entry
  './frontend/assets/js/app.js',
  './frontend/assets/js/core/page-loader.js',
  // JS — Modules
  './frontend/assets/js/modules/dashboard.js',
  './frontend/assets/js/modules/debts.js',
  './frontend/assets/js/modules/salaries.js',
  './frontend/assets/js/modules/chores.js',
  './frontend/assets/js/modules/shopping.js',
  './frontend/assets/js/modules/notifications.js',
  // Services & Utils
  './frontend/services/firebase/config.js',
  './frontend/utils/state.js',
  './frontend/utils/helpers.js',
  './frontend/services/firebase/collections.js',
  './frontend/services/auth/authService.js',
  './frontend/services/transactions/transactionService.js',
  './frontend/components/navigation.js',
  './frontend/chat-app/chat.js',
  './frontend/chat-app/fcm.js',
  // Assets
  './manifest.json',
  './frontend/assets/images/icon-any-192.png',
  './frontend/assets/images/icon-maskable-192.png',
  './frontend/assets/images/apple-touch-icon.png'
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

// Push Notifications (servidor externo)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'WolfSource', {
      body:    data.body  || 'Você tem uma notificação.',
      icon:    'frontend/assets/images/icon-any-192.png',
      badge:   'frontend/assets/images/icon-any-96.png',
      tag:     data.tag  || 'push',
      data:    { tab: data.tab || 'debts' },
      actions: [
        { action: 'view',    title: '📋 Ver Dívidas' },
        { action: 'dismiss', title: 'Dispensar'      },
      ],
    })
  );
});

// Clique na Notificação — abre ou foca o app e navega até a aba correta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data    = event.notification.data || {};
  const isChat  = data.type === 'chat';
  const tab     = data.tab || 'debts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se já há uma janela aberta, foca e manda mensagem para o app
      for (const client of clientList) {
        if ('focus' in client) {
          const msgType = isChat ? 'SW_OPEN_CHAT' : 'SW_NAVIGATE';
          client.postMessage({ type: msgType, tab });
          return client.focus();
        }
      }
      // Nenhuma janela aberta — abre nova com parâmetro de navegação
      const query = isChat ? '?openChat=1' : '?tab=' + tab;
      return clients.openWindow('./' + query);
    })
  );
});

// Periodic Background Sync — verifica dívidas mesmo com app fechado
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'debt-check') {
    event.waitUntil(swBackgroundDebtCheck());
  }
});

// ===== HELPERS DO SERVICE WORKER =====

function swOpenIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wolfsource-notif-db', 1);
    req.onupgradeneeded = (e) => {
      if (!e.target.result.objectStoreNames.contains('debtSummary')) {
        e.target.result.createObjectStore('debtSummary', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

async function swBackgroundDebtCheck() {
  try {
    const db   = await swOpenIDB();
    const tx   = db.transaction('debtSummary', 'readonly');
    const data = await new Promise((res, rej) => {
      const r = tx.objectStore('debtSummary').get('current');
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
    db.close();

    if (!data || !data.debts || !data.settings?.enabled) return;

    const settings = data.settings;
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = [], dueToday = [], dueSoon = [];

    data.debts.forEach(d => {
      const due = new Date(d.dueDate + 'T12:00:00');
      due.setHours(0, 0, 0, 0);
      const days = Math.round((due - today) / 86400000);
      if      (days < 0  && settings.notifyOverdue)                    overdue.push(d);
      else if (days === 0 && settings.notifyToday)                     dueToday.push(d);
      else if (days > 0  && days <= settings.notifyDaysBefore)         dueSoon.push({ debt: d, days });
    });

    const fmt = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    const notify = (title, body, tag) =>
      self.registration.showNotification(title, {
        body, tag,
        icon:    'frontend/assets/images/icon-any-192.png',
        badge:   'frontend/assets/images/icon-any-96.png',
        renotify: true,
        data:    { tab: 'debts' },
        actions: [
          { action: 'view',    title: '📋 Ver Dívidas' },
          { action: 'dismiss', title: 'Dispensar'      },
        ],
      });

    if (overdue.length > 0) {
      const total = overdue.reduce((s, d) => s + d.amount, 0);
      await notify(
        `⚠️ ${overdue.length} dívida${overdue.length > 1 ? 's' : ''} em atraso!`,
        `${overdue.slice(0, 2).map(d => d.creditor).join(', ')}. Total: ${fmt(total)}`,
        'sw-debt-overdue',
      );
    }
    if (dueToday.length > 0) {
      const total = dueToday.reduce((s, d) => s + d.amount, 0);
      await notify(
        `📅 ${dueToday.length} dívida${dueToday.length > 1 ? 's' : ''} vence${dueToday.length > 1 ? 'm' : ''} hoje!`,
        `${dueToday.slice(0, 2).map(d => d.creditor).join(', ')}. Total: ${fmt(total)}`,
        'sw-debt-today',
      );
    }
    if (dueSoon.length > 0) {
      const total = dueSoon.reduce((s, i) => s + i.debt.amount, 0);
      await notify(
        `🔔 ${dueSoon.length} dívida${dueSoon.length > 1 ? 's' : ''} vencendo em breve`,
        `${dueSoon.slice(0, 2).map(i => `${i.debt.creditor} (${i.days}d)`).join(', ')}. Total: ${fmt(total)}`,
        'sw-debt-upcoming',
      );
    }
  } catch (err) {
    console.warn('[SW] backgroundDebtCheck falhou:', err);
  }
}
