// ============================================================
// FCM.JS — Firebase Cloud Messaging para o chat
// Cobertura:
//   • App aberto + chat fechado  → reg.showNotification() via onMessage
//   • App em background/fechado  → SW onBackgroundMessage (FCM push)
// Pré-requisitos (Firebase Console):
//   1. FCM_VAPID_KEY  → Configurações → Cloud Messaging → Web Push certificates
//   2. FCM_SERVER_KEY → Configurações → Cloud Messaging → Chaves do servidor
// ============================================================

import { state }              from '../../app/state/store.js';
import { db, firebaseReady } from '../../app/providers/firebase-provider.js';
import { FCM_VAPID_KEY, FCM_SERVER_KEY } from '../../app/providers/firebase-config.js';

let _messaging = null;
let _fcmToken  = null;

// ================================================================
// PÚBLICO
// ================================================================

/**
 * Pede permissão, registra o token FCM e configura o handler de mensagens
 * em foreground. Deve ser chamado após login.
 */
export async function initFCM() {
  if (!_fcmSdkLoaded())   return;
  if (!_keysConfigured()) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    // Pede permissão se ainda não decidida
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('[FCM] Permissão de notificação não concedida.');
      return;
    }

    _messaging = firebase.messaging();

    // Registra token usando o service worker já ativo
    const sw = await navigator.serviceWorker.ready;
    _fcmToken = await _messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (_fcmToken && firebaseReady && state.currentUser) {
      // Salva o token no Firestore para que o outro usuário possa usá-lo
      await db.collection('users').doc(state.currentUser.id)
        .set({ fcmToken: _fcmToken }, { merge: true });
      console.log('[FCM] Token registrado no Firestore.');
    }

    // Handler de mensagens com app em foreground
    _messaging.onMessage((payload) => {
      const d = payload.data || {};
      if (d.type !== 'chat') return;

      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(`💬 ${d.senderName || 'Nova mensagem'}`, {
          body:     (d.text || '').substring(0, 100),
          icon:     'frontend/assets/images/icon-any-192.png',
          badge:    'frontend/assets/images/icon-any-96.png',
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
 * Envia push notification para o destinatário via FCM Legacy HTTP API.
 * Chamado pelo remetente ao enviar uma mensagem.
 */
export async function sendFCMPush(recipientToken, senderName, text) {
  if (!recipientToken) return;
  if (!FCM_SERVER_KEY || FCM_SERVER_KEY.startsWith('YOUR_')) return;

  try {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to:       recipientToken,
        priority: 'high',
        // Usar "data" para acionar onBackgroundMessage no SW (sem notification nativa)
        data: {
          type:       'chat',
          senderName: senderName,
          text:       text.substring(0, 200),
        },
      }),
    });
  } catch (err) {
    console.warn('[FCM] Falha ao enviar push:', err);
  }
}

/**
 * Obtém o token FCM do destinatário.
 * Aceita { id } ou { login } do membro para buscar no Firestore.
 */
export async function getRecipientFCMToken(recipientIdOrMember) {
  if (!firebaseReady) return null;
  try {
    // Se for um objeto de membro (com id ou login)
    if (recipientIdOrMember && typeof recipientIdOrMember === 'object') {
      const member = recipientIdOrMember;
      if (member.id) {
        const doc = await db.collection('users').doc(member.id).get();
        if (doc.exists && doc.data().fcmToken) return doc.data().fcmToken;
      }
      // Fallback: busca por login
      if (member.login) {
        const snap = await db.collection('users').where('login', '==', member.login).limit(1).get();
        if (!snap.empty) return snap.docs[0].data().fcmToken || null;
      }
      // Fallback: busca por fullName
      if (member.fullName) {
        const snap = await db.collection('users').where('fullName', '==', member.fullName).limit(1).get();
        if (!snap.empty) return snap.docs[0].data().fcmToken || null;
      }
      return null;
    }
    // Se for uma string (id direto)
    if (typeof recipientIdOrMember === 'string') {
      const doc = await db.collection('users').doc(recipientIdOrMember).get();
      return doc.exists ? (doc.data().fcmToken || null) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Retorna o token FCM do usuário atual. */
export function getCurrentFCMToken() {
  return _fcmToken;
}

// ================================================================
// PRIVADO
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
    console.warn('[FCM] FCM_VAPID_KEY não configurada. Adicione em js/config.js');
    return false;
  }
  return true;
}
