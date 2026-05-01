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

  messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    if (d.type !== 'chat') return;
    return self.registration.showNotification(`💬 ${d.senderName || 'Nova mensagem'}`, {
      body:     (d.text || '').substring(0, 100),
      icon:     'assets/images/icon-any-192.png',
      badge:    'assets/images/icon-any-96.png',
      tag:      'chat-incoming',
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     { type: 'chat' },
    });
  });

} catch (e) {
  console.warn('[SW] Firebase Messaging não carregado:', e);
}
// ===== FIM FIREBASE MESSAGING =====

const CACHE_NAME = 'wolfsource-v23';
const URLS_TO_CACHE = [
  './',
  './index.html',
  // Pages (HTML fragments) — features
  './apps/web/src/features/auth/login.html',
  './apps/web/src/features/dashboard/dashboard.html',
  './apps/web/src/features/transactions/transactions.html',
  './apps/web/src/features/debts/debts.html',
  './apps/web/src/features/salaries/salaries.html',
  './apps/web/src/features/settings/settings.html',
  './apps/web/src/features/chores/chores.html',
  './apps/web/src/features/shopping/shopping.html',
  './apps/web/src/features/chat/chat.html',
  // CSS — Global (styles)
  './apps/web/src/styles/base.css',
  './apps/web/src/styles/animations.css',
  './apps/web/src/styles/responsive.css',
  // CSS — UI packages
  './packages/ui/forms/forms.css',
  './packages/ui/navigation/navigation.css',
  './packages/ui/modal/modal.css',
  './packages/ui/calendar/calendar.css',
  // CSS — Features
  './apps/web/src/features/auth/login.css',
  './apps/web/src/features/dashboard/dashboard.css',
  './apps/web/src/features/transactions/transactions.css',
  './apps/web/src/features/debts/debts.css',
  './apps/web/src/features/salaries/salaries.css',
  './apps/web/src/features/settings/settings.css',
  './apps/web/src/features/chores/chores.css',
  './apps/web/src/features/shopping/shopping.css',
  './apps/web/src/features/chat/chat.css',
  // JS — App Core & Entry
  './apps/web/src/app/bootstrap.js',
  './apps/web/src/app/router.js',
  './packages/core/state/store.js',
  './packages/core/state/session.js',
  './packages/services/firebase/firebase.config.js',
  './packages/services/firebase/firebase.init.js',
  './packages/services/firebase/firebase.crud.js',
  './packages/services/firebase/firebase.service.js',
  './packages/services/auth/auth.service.js',
  './packages/services/shopping/shopping.service.js',
  './packages/services/chores/chores.service.js',
  './packages/services/salaries/salaries.service.js',
  // JS — Features
  './apps/web/src/features/dashboard/dashboard.js',
  './apps/web/src/features/transactions/transactions.js',
  './packages/services/transactions/transactions.service.js',
  './apps/web/src/features/debts/debts.js',
  './packages/services/debts/debts.service.js',
  './apps/web/src/features/salaries/salaries.js',
  './apps/web/src/features/chores/chores.js',
  './apps/web/src/features/shopping/shopping.js',
  './apps/web/src/features/chat/chat.js',
  // JS — Packages shared
  './packages/utils/helpers.js',
  './packages/ui/navigation/navigation.js',
  './packages/services/notifications/notification.service.js',
  './packages/services/firebase/fcm.service.js',
  // Assets
  './manifest.json',
  './assets/images/icon-any-192.png',
  './assets/images/icon-maskable-192.png',
  './assets/images/apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          URLS_TO_CACHE.map(url => cache.add(url).catch(() => {}))
        );
      })
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Cache First (stale-while-revalidate) para recursos locais
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) return cachedResponse;

      return networkFetch.then((networkResponse) => {
        if (networkResponse) return networkResponse;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Sem conexão. Tente novamente mais tarde.', {
          status: 503,
          statusText: 'Serviço Indisponível',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'WolfSource', {
      body:    data.body  || 'Você tem uma notificação.',
      icon:    'assets/images/icon-any-192.png',
      badge:   'assets/images/icon-any-96.png',
      tag:     data.tag  || 'push',
      data:    { tab: data.tab || 'debts' },
      actions: [
        { action: 'view',    title: '📋 Ver Dívidas' },
        { action: 'dismiss', title: 'Dispensar'      },
      ],
    })
  );
});

// Clique na Notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data    = event.notification.data || {};
  const isChat  = data.type === 'chat';
  const tab     = data.tab || 'debts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          const msgType = isChat ? 'SW_OPEN_CHAT' : 'SW_NAVIGATE';
          client.postMessage({ type: msgType, tab });
          return client.focus();
        }
      }
      const query = isChat ? '?openChat=1' : '?tab=' + tab;
      return clients.openWindow('./' + query);
    })
  );
});

// Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'debt-check') event.waitUntil(swBackgroundDebtCheck());
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
      if      (days < 0  && settings.notifyOverdue)            overdue.push(d);
      else if (days === 0 && settings.notifyToday)             dueToday.push(d);
      else if (days > 0  && days <= settings.notifyDaysBefore) dueSoon.push({ debt: d, days });
    });

    const fmt = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    const notify = (title, body, tag) =>
      self.registration.showNotification(title, {
        body, tag,
        icon:    'assets/images/icon-any-192.png',
        badge:   'assets/images/icon-any-96.png',
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
