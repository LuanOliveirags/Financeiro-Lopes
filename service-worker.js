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

const CACHE_NAME = 'wolfsource-v21';
const URLS_TO_CACHE = [
  './',
  './index.html',
  // Pages (HTML fragments) — modules
  './frontend/modules/login/login.html',
  './frontend/modules/dashboard/dashboard.html',
  './frontend/modules/transactions/transactions.html',
  './frontend/modules/debts/debts.html',
  './frontend/modules/salaries/salaries.html',
  './frontend/modules/settings/settings.html',
  './frontend/modules/chores/chores.html',
  './frontend/modules/shopping/shopping.html',
  './frontend/modules/chat/chat.html',
  // CSS — Global (shared/styles)
  './frontend/shared/styles/global/base.css',
  './frontend/shared/styles/global/animations.css',
  './frontend/shared/styles/global/responsive.css',
  // CSS — Shared Components
  './frontend/shared/components/forms/forms.css',
  './frontend/shared/components/navigation/navigation.css',
  './frontend/shared/components/modal/modal.css',
  './frontend/shared/components/calendar/calendar.css',
  // CSS — Modules
  './frontend/modules/login/login.css',
  './frontend/modules/dashboard/dashboard.css',
  './frontend/modules/transactions/transactions.css',
  './frontend/modules/debts/debts.css',
  './frontend/modules/salaries/salaries.css',
  './frontend/modules/settings/settings.css',
  './frontend/modules/chores/chores.css',
  './frontend/modules/shopping/shopping.css',
  './frontend/modules/chat/chat.css',
  // JS — App Core & Entry
  './frontend/app/bootstrap.js',
  './frontend/app/router.js',
  './frontend/app/state/store.js',
  './frontend/app/state/session.js',
  './frontend/app/providers/firebase-config.js',
  './frontend/app/providers/firebase-provider.js',
  './frontend/app/providers/auth-provider.js',
  // JS — Modules
  './frontend/modules/dashboard/dashboard.js',
  './frontend/modules/transactions/transactions.service.js',
  './frontend/modules/debts/debts.js',
  './frontend/modules/salaries/salaries.js',
  './frontend/modules/chores/chores.js',
  './frontend/modules/shopping/shopping.js',
  './frontend/modules/chat/chat.js',
  './frontend/modules/chat/fcm.js',
  // JS — Shared
  './frontend/shared/utils/helpers.js',
  './frontend/shared/components/navigation/navigation.js',
  './frontend/shared/services/notifications.js',
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

// Fetch Event - Cache First (stale-while-revalidate) para recursos locais
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Cross-origin (Firebase, CDNs, APIs): deixa o browser resolver normalmente
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Atualiza o cache em background (stale-while-revalidate)
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      // Cache first: retorna imediatamente se disponível
      if (cachedResponse) {
        return cachedResponse;
      }

      // Sem cache: aguarda a rede
      return networkFetch.then((networkResponse) => {
        if (networkResponse) {
          return networkResponse;
        }
        // Fallback para navegação: retorna o shell principal
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Sem conexão. Tente novamente mais tarde.', {
          status: 503,
          statusText: 'Serviço Indisponível',
          headers: new Headers({ 'Content-Type': 'text/plain' })
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
