// ============================================================
// CONFIG.JS — Constantes e configurações da aplicação
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAMx-ZoL4cco2NmPzEfIe5yYC1WLHPc0vk",
  authDomain: "wolfsource.firebaseapp.com",
  projectId: "wolfsource",
  storageBucket: "wolfsource.firebasestorage.app",
  messagingSenderId: "621443570583",
  appId: "1:621443570583:web:1a5ad0106d2606561482d2",
  measurementId: "G-7FHPEHP5G5"
};

// ===== FIREBASE CLOUD MESSAGING (notificações push do chat no celular) =====
// Como obter:
//   FCM_VAPID_KEY  → Firebase Console → Configurações → Cloud Messaging
//                    → Web Push certificates → Gerar par de chaves → copiar a "Chave pública"
//   FCM_SERVER_KEY → Firebase Console → Configurações → Cloud Messaging
//                    → APIs de mensagens Cloud → Chave do servidor (Legacy)
export const FCM_VAPID_KEY  = 'YOUR_VAPID_KEY_HERE';  // começa com "BK..." ou "BA..."
export const FCM_SERVER_KEY = 'YOUR_SERVER_KEY_HERE'; // começa com "AAAA..."

export const EMAILJS_CONFIG = {
  serviceId: 'YOUR_SERVICE_ID',
  templateId: 'YOUR_TEMPLATE_ID',
  publicKey: 'YOUR_PUBLIC_KEY'
};

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
  'Nubank':          'img/1.png',
  'Itaú':            'img/2.avif',
  'Porto Seguro':    'img/3.png',
  'Caixa':           'img/4.png',
  'Mercado Pago':    'img/5.jpg',
  'Banco do Brasil': 'img/6.png',
  'Santander':       'img/7.png'
};

export const CREDITOR_IMG = {
  'Recrearte':       'img/recrearte.jpeg',
  'Enel':            'img/enel.png',
  'Perua Escolar':   'img/escolar.png',
  'Condomínio':      'img/condominio.png'
};
