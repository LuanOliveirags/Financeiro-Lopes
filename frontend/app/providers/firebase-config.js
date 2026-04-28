// ============================================================
// firebase-config.js — Configurações públicas da aplicação
// Credenciais Firebase client-side são públicas por design.
// Segredos (FCM keys, EmailJS) ficam em firebase-secrets.local.js
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

// Segredos — carregados do arquivo local (gitignored).
// Se o arquivo não existir, as features de push e email ficam desativadas.
export { FCM_VAPID_KEY, FCM_SERVER_KEY, EMAILJS_CONFIG } from './firebase-secrets.local.js';

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
  'Nubank':          'frontend/assets/images/1.png',
  'Itaú':            'frontend/assets/images/2.avif',
  'Porto Seguro':    'frontend/assets/images/3.png',
  'Caixa':           'frontend/assets/images/4.png',
  'Mercado Pago':    'frontend/assets/images/5.jpg',
  'Banco do Brasil': 'frontend/assets/images/6.png',
  'Santander':       'frontend/assets/images/7.png'
};

export const CREDITOR_IMG = {
  'Recrearte':     'frontend/assets/images/recrearte.jpeg',
  'Enel':          'frontend/assets/images/enel.png',
  'Perua Escolar': 'frontend/assets/images/escolar.png',
  'Condomínio':    'frontend/assets/images/condominio.png'
};
