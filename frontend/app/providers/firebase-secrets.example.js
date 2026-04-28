// ============================================================
// firebase-secrets.example.js — Template de segredos
//
// SETUP: copie este arquivo como firebase-secrets.local.js
// e preencha com suas chaves reais. O arquivo .local.js é
// ignorado pelo git e nunca deve ser commitado.
//
//   cp firebase-secrets.example.js firebase-secrets.local.js
// ============================================================

// FCM_VAPID_KEY → Firebase Console → Configurações →
//   Cloud Messaging → Web Push certificates → Chave pública
export const FCM_VAPID_KEY = 'YOUR_VAPID_KEY_HERE'; // começa com "BK..." ou "BA..."

// FCM_SERVER_KEY → Firebase Console → Configurações →
//   Cloud Messaging → APIs de mensagens Cloud → Chave do servidor
export const FCM_SERVER_KEY = 'YOUR_SERVER_KEY_HERE'; // começa com "AAAA..."

// EmailJS → https://www.emailjs.com → Account → API Keys
export const EMAILJS_CONFIG = {
  serviceId:  'YOUR_SERVICE_ID',
  templateId: 'YOUR_TEMPLATE_ID',
  publicKey:  'YOUR_PUBLIC_KEY'
};
