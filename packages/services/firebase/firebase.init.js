// ============================================================
// FIREBASE.INIT.JS — Inicialização e estado compartilhado do Firebase
// Responsabilidade única: criar as instâncias db/storage e expô-las
// como live-bindings para os demais módulos firebase.
// ============================================================
/* global firebase */

import { firebaseConfig } from './firebase.config.js';

// Live-bindings: qualquer módulo que importar estas variáveis
// verá o valor atualizado após initFirebase() ser chamado.
export let db            = null;
export let storage       = null;
export let auth          = null;
export let firebaseReady = false;

export function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      firebaseReady = true;
      try {
        storage = firebase.storage();
      } catch (e) {
        console.warn('Firebase Storage indisponível:', e);
      }
    } else {
      console.warn('Firebase não configurado. Usando localStorage apenas.');
    }
  } catch (error) {
    console.error('Erro ao iniciar Firebase:', error);
  }
}
