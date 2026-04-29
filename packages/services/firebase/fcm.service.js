// ============================================================
// FCM.JS — Firebase Cloud Messaging para o chat
// Cobertura:
//   • Web: foreground → onMessage; background → SW onBackgroundMessage
//   • APK: foreground → plugin notificationReceived; background → FCM nativo automático
// Pré-requisitos:
//   FCM_VAPID_KEY  → Firebase Console → Cloud Messaging → Web Push certificates
//   FCM_SERVER_KEY → Firebase Console → Cloud Messaging → Chave do servidor
// ============================================================

import { state }              from '../../core/state/store.js';
import { db, firebaseReady } from './firebase.service.js';
import { FCM_VAPID_KEY, BACKEND_URL } from './firebase.config.js';
import { isNative, getPlugin } from '../../utils/capacitor.bridge.js';

let _messaging = null;
let _fcmToken  = null;

// ================================================================
// PÚBLICO
// ================================================================

export async function initFCM() {
  if (isNative()) {
    await _initNativeFCM();
    return;
  }

  if (!_fcmSdkLoaded())   return;
  if (!_keysConfigured()) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('[FCM] Permissão de notificação não concedida.');
      return;
    }

    _messaging = firebase.messaging();

    const sw = await navigator.serviceWorker.ready;
    _fcmToken = await _messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (_fcmToken && firebaseReady && state.currentUser) {
      await db.collection('users').doc(state.currentUser.id)
        .set({ fcmToken: _fcmToken }, { merge: true });
      console.log('[FCM] Token registrado no Firestore.');
    }

    _messaging.onMessage((payload) => {
      const d = payload.data || {};
      if (d.type !== 'chat') return;

      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(`💬 ${d.senderName || 'Nova mensagem'}`, {
          body:     (d.text || '').substring(0, 100),
          icon:     'assets/images/icon-any-192.png',
          badge:    'assets/images/icon-any-96.png',
          tag:      'chat-incoming',
          renotify: true,
          vibrate:  [200, 100, 200],
          data:     { type: 'chat' },
        });
      });
    });

  } catch (err) {
    console.warn('[FCM] Falha ao inicializar:', err);
  }
}

/**
 * Envia push para o destinatário via backend Flask (FCM V1 API).
 * O backend usa firebase-admin com service account para autenticar.
 */
export async function sendFCMPush(recipientToken, senderName, text) {
  if (!recipientToken) return;
  if (!BACKEND_URL || BACKEND_URL.startsWith('YOUR_')) return;

  const title = `💬 ${senderName || 'Nova mensagem'}`;
  const body  = (text || '').substring(0, 100);

  try {
    await fetch(`${BACKEND_URL}/api/fcm/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: recipientToken,
        title,
        body,
        data: {
          type:       'chat',
          senderName: senderName || '',
          text:       (text || '').substring(0, 200),
        },
      }),
    });
  } catch (err) {
    console.warn('[FCM] Falha ao enviar push:', err);
  }
}

export async function getRecipientFCMToken(recipientIdOrMember) {
  if (!firebaseReady) return null;
  try {
    if (recipientIdOrMember && typeof recipientIdOrMember === 'object') {
      const member = recipientIdOrMember;
      if (member.id) {
        const doc = await db.collection('users').doc(member.id).get();
        if (doc.exists && doc.data().fcmToken) return doc.data().fcmToken;
      }
      if (member.login) {
        const snap = await db.collection('users').where('login', '==', member.login).limit(1).get();
        if (!snap.empty) return snap.docs[0].data().fcmToken || null;
      }
      if (member.fullName) {
        const snap = await db.collection('users').where('fullName', '==', member.fullName).limit(1).get();
        if (!snap.empty) return snap.docs[0].data().fcmToken || null;
      }
      return null;
    }
    if (typeof recipientIdOrMember === 'string') {
      const doc = await db.collection('users').doc(recipientIdOrMember).get();
      return doc.exists ? (doc.data().fcmToken || null) : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getCurrentFCMToken() {
  return _fcmToken;
}

// ================================================================
// NATIVO (Capacitor APK)
// ================================================================

async function _initNativeFCM() {
  const FCM = getPlugin('FirebaseMessaging');
  if (!FCM) { console.warn('[FCM Native] Plugin FirebaseMessaging não encontrado.'); return; }

  try {
    const { receive } = await FCM.requestPermissions();
    if (receive !== 'granted') { console.warn('[FCM Native] Permissão negada.'); return; }

    // Android nativo não usa VAPID key — isso é exclusivo do Web Push Protocol
    const { token } = await FCM.getToken();
    _fcmToken = token;

    if (_fcmToken && firebaseReady && state.currentUser) {
      await db.collection('users').doc(state.currentUser.id)
        .set({ fcmToken: _fcmToken }, { merge: true });
      console.log('[FCM Native] Token salvo no Firestore:', _fcmToken.substring(0, 20) + '...');
    }

    // Foreground: app aberto → exibe notificação via Service Worker
    FCM.addListener('notificationReceived', (ev) => {
      const d = ev.notification?.data || {};
      if (d.type !== 'chat') return;
      const title = ev.notification?.title || `💬 ${d.senderName || 'Nova mensagem'}`;
      const body  = ev.notification?.body  || (d.text || '').substring(0, 100);

      navigator.serviceWorker?.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon:     'assets/images/icon-any-192.png',
          badge:    'assets/images/icon-any-96.png',
          tag:      'chat-incoming',
          renotify: true,
          vibrate:  [200, 100, 200],
        });
      });
    });

    // Background/fechado: o FCM SDK nativo exibe automaticamente
    // quando o payload contém o objeto "notification" (tratado em sendFCMPush)
    FCM.addListener('notificationActionPerformed', () => {
      // Usuário tocou na notificação → garante que o app abre na tab de chat
      if (typeof switchTab === 'function') switchTab('chat');
    });

  } catch (err) {
    console.warn('[FCM Native] Falha:', err);
  }
}

// ================================================================
// PRIVADO (Web)
// ================================================================

function _fcmSdkLoaded() {
  if (typeof firebase === 'undefined') return false;
  if (!firebase.messaging) {
    console.warn('[FCM] firebase-messaging-compat.js não carregado.');
    return false;
  }
  return true;
}

function _keysConfigured() {
  if (!FCM_VAPID_KEY || FCM_VAPID_KEY.startsWith('YOUR_')) {
    console.warn('[FCM] FCM_VAPID_KEY não configurada.');
    return false;
  }
  return true;
}
