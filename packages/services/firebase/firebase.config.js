// ============================================================
// firebase-config.js — Configurações da aplicação
//
// Credenciais Firebase (apiKey, appId…) são públicas por design
// — o Firebase SDK as expõe ao browser intencionalmente.
// A segurança real fica nas Firestore Security Rules.
//
// ⚠️  FCM_SERVER_KEY e EMAILJS_CONFIG contêm chaves privadas.
//     Preencha os valores abaixo localmente mas NÃO faça commit
//     com chaves reais — mantenha os placeholders no repositório.
// ============================================================

export const firebaseConfig = {
  apiKey:            'AIzaSyAMx-ZoL4cco2NmPzEfIe5yYC1WLHPc0vk',
  authDomain:        'financeiro-lopes.firebaseapp.com',
  projectId:         'financeiro-lopes',
  storageBucket:     'financeiro-lopes.firebasestorage.app',
  messagingSenderId: '621443570583',
  appId:             '1:621443570583:web:1a5ad0106d2606561482d2',
  measurementId:     'G-7FHPEHP5G5'
};

// FCM_VAPID_KEY → Firebase Console → Cloud Messaging → Web Push certificates
export const FCM_VAPID_KEY = 'BCATQlnCYJRdAoQhksO2gXpzYMgS2HU-zQJY5V50XO62eiHPzePARxOpWBhUvYDFZQ5puKAAC3Qke_yXBq_yZa8';

// FCM_SERVER_KEY → Firebase Console → Cloud Messaging → Chave do servidor (Legacy)
// ⚠️ Chave privada — não commitar com valor real
export const FCM_SERVER_KEY = 'YOUR_SERVER_KEY_HERE';

// EmailJS → https://www.emailjs.com → Account → API Keys
// ⚠️ Chaves privadas — não commitar com valores reais
export const EMAILJS_CONFIG = {
  serviceId:  'YOUR_SERVICE_ID',
  templateId: 'YOUR_TEMPLATE_ID',
  publicKey:  'YOUR_PUBLIC_KEY'
};

// URL do backend Flask onde está o endpoint /api/fcm/send
// Ex.: https://financeiro-lopes.up.railway.app
// ⚠️ Não deixar vazio em produção
export const BACKEND_URL = 'https://aware-delight-production-2e59.up.railway.app';

// URL pública do APK para download direto.
// Gere no Firebase Storage ou qualquer hospedagem e cole aqui.
// Ex.: 'https://storage.googleapis.com/financeiro-lopes.appspot.com/app-release.apk'
export const APK_URL = 'https://files.catbox.moe/bpkvh2.apk';

export const CATEGORY_MAP = {
  alimentacao:    { icon: '🍽️', label: 'Alimentação',    css: 'cat-alimentacao'    },
  transporte:     { icon: '🚗', label: 'Transporte',     css: 'cat-transporte'     },
  saude:          { icon: '💊', label: 'Saúde',          css: 'cat-saude'          },
  educacao:       { icon: '📚', label: 'Educação',       css: 'cat-educacao'       },
  moradia:        { icon: '🏠', label: 'Moradia',        css: 'cat-moradia'        },
  lazer:          { icon: '🎮', label: 'Lazer',          css: 'cat-lazer'          },
  utilidades:     { icon: '⚡', label: 'Utilidades',     css: 'cat-utilidades'     },
  beleza:         { icon: '💅', label: 'Beleza',         css: 'cat-beleza'         },
  pets:           { icon: '🐾', label: 'Pets',           css: 'cat-pets'           },
  assinaturas:    { icon: '📺', label: 'Assinaturas',    css: 'cat-assinaturas'    },
  investimentos:  { icon: '📈', label: 'Investimentos',  css: 'cat-investimentos'  },
  academia:       { icon: '🏋️', label: 'Academia',       css: 'cat-academia'       },
  outros:         { icon: '📁', label: 'Outros',         css: 'cat-outros'         }
};

export const BANK_IMG = {
  'Nubank':          'assets/images/1.png',
  'Itaú':            'assets/images/2.avif',
  'Porto Seguro':    'assets/images/3.png',
  'Caixa':           'assets/images/4.png',
  'Mercado Pago':    'assets/images/5.jpg',
  'Banco do Brasil': 'assets/images/6.png',
  'Santander':       'assets/images/7.png'
};

export const CREDITOR_IMG = {
  'Recrearte':     'assets/images/recrearte.jpeg',
  'Enel':          'assets/images/enel.png',
  'Perua Escolar': 'assets/images/escolar.png',
  'Condomínio':    'assets/images/condominio.png'
};
