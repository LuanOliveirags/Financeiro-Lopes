// ============================================================
// DATA.JS — Firebase, armazenamento local e sincronização
// ============================================================
/* global firebase */

import { firebaseConfig } from './config.js';
import { state, getFamilyId, getFamilyStorageKey } from './state.js';
import { showAlert, formatCurrency } from './utils.js';

// ===== FIREBASE GLOBALS =====
export let db = null;
export let storage = null;
export let firebaseReady = false;

let _fbSyncTimer = null;
let _fbListeners = [];

// ===== INICIALIZAÇÃO =====
export function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
      console.log('Firebase Firestore conectado!');
      try {
        storage = firebase.storage();
        console.log('Firebase Storage conectado!');
      } catch (e) {
        console.warn('Firebase Storage indisponível:', e);
      }
    } else {
      console.warn('Firebase não configurado. Usando localStorage apenas.');
    }
  } catch (error) {
    console.warn('Erro ao iniciar Firebase:', error);
  }
}

// ===== CRUD FIREBASE =====
export async function saveToFirebase(collection, item) {
  if (!firebaseReady) return;
  try {
    const familyId = getFamilyId();
    if (!familyId) { console.warn(`Sem familyId — item ${item.id} não será salvo no Firebase.`); return; }
    await db.collection(collection).doc(item.id).set({ ...item, familyId });
  } catch (error) {
    console.error(`Erro ao salvar no Firebase (${collection}):`, error);
  }
}

export async function deleteFromFirebase(collection, id) {
  if (!firebaseReady) return;
  try {
    await db.collection(collection).doc(id).delete();
  } catch (error) {
    console.error(`Erro ao deletar do Firebase (${collection}):`, error);
  }
}

export async function updateInFirebase(collection, id, data) {
  if (!firebaseReady) return;
  try {
    await db.collection(collection).doc(id).update(data);
  } catch (error) {
    console.error(`Erro ao atualizar no Firebase (${collection}):`, error);
  }
}

// ===== ARMAZENAMENTO LOCAL =====
export function saveDataToStorage() {
  const key = getFamilyStorageKey();
  if (!key) { console.warn('Sem familyId — dados não serão salvos no localStorage.'); return; }
  const data = {
    transactions: state.transactions,
    debts: state.debts,
    salaries: state.salaries,
    lastSaved: new Date().toISOString()
  };
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadDataFromStorage() {
  state.transactions = [];
  state.debts = [];
  state.salaries = [];

  const key = getFamilyStorageKey();
  if (!key) {
    console.warn('Sem familyId — dados não serão carregados.');
    _notifyRefresh();
    return;
  }

  const data = localStorage.getItem(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      state.transactions = parsed.transactions || [];
      state.debts = parsed.debts || [];
      state.salaries = parsed.salaries || [];
    } catch (e) {
      console.error('Erro ao carregar dados locais:', e);
    }
  }
  if (firebaseReady) {
    loadDataFromFirebase().then(() => {
      listenFirebaseChanges();
    });
  } else {
    _notifyRefresh();
  }
}

// ===== CARREGAR DO FIREBASE =====
export async function loadDataFromFirebase() {
  if (!firebaseReady) return;
  const familyId = getFamilyId();
  if (!familyId) { console.warn('Sem familyId — dados do Firebase não serão carregados.'); return; }
  try {
    const transSnap = await db.collection('transactions').where('familyId', '==', familyId).get();
    state.transactions = transSnap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const debtsSnap = await db.collection('debts').where('familyId', '==', familyId).get();
    state.debts = debtsSnap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const salSnap = await db.collection('salaries').where('familyId', '==', familyId).get();
    state.salaries = salSnap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    saveDataToStorage();
    _notifyRefresh();
    console.log('Dados carregados do Firebase com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar do Firebase:', error);
    showAlert('Erro ao carregar dados do servidor. Usando dados locais.', 'warning');
  }
}

// ===== LISTENERS REALTIME =====
export function listenFirebaseChanges() {
  if (!firebaseReady) return;
  _fbListeners.forEach(unsub => unsub());
  _fbListeners = [];

  const familyId = getFamilyId();
  if (!familyId) return;

  const debouncedLoad = () => {
    clearTimeout(_fbSyncTimer);
    _fbSyncTimer = setTimeout(() => loadDataFromFirebase(), 500);
  };

  ['transactions', 'debts', 'salaries'].forEach(col => {
    const unsub = db.collection(col)
      .where('familyId', '==', familyId)
      .onSnapshot(debouncedLoad, err => console.error(`Erro no listener de ${col}:`, err));
    _fbListeners.push(unsub);
  });
}

export function cleanupFirebaseListeners() {
  _fbListeners.forEach(unsub => unsub());
  _fbListeners = [];
}

// ===== SYNC COMPLETO =====
export async function syncAllToFirebase() {
  if (!firebaseReady) return;
  const familyId = getFamilyId();
  if (!familyId) { console.warn('Sem familyId — sincronização cancelada.'); return; }
  try {
    for (const t of state.transactions) await db.collection('transactions').doc(t.id).set({ ...t, familyId });
    for (const d of state.debts) await db.collection('debts').doc(d.id).set({ ...d, familyId });
    for (const s of state.salaries) await db.collection('salaries').doc(s.id).set({ ...s, familyId });
    console.log('Todos os dados sincronizados com Firebase!');
  } catch (error) {
    console.error('Erro na sincronização completa:', error);
  }
}

// ===== EXPORTAR =====
export function exportData() {
  const data = {
    transactions: state.transactions,
    debts: state.debts,
    salaries: state.salaries,
    exportedAt: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeiro-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showAlert('Dados exportados com sucesso!', 'success');
}

// ===== IMPORTAR =====
export function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (confirm('Substituir todos os dados pelos do arquivo?')) {
        const familyId = getFamilyId();
        if (!familyId) { showAlert('Erro: família não identificada. Faça login novamente.', 'danger'); return; }
        state.transactions = (data.transactions || []).map(t => ({ ...t, familyId }));
        state.debts = (data.debts || []).map(d => ({ ...d, familyId }));
        state.salaries = (data.salaries || []).map(s => ({ ...s, familyId }));
        saveDataToStorage();
        syncAllToFirebase();
        _notifyRefresh();
        showAlert('Dados importados com sucesso!', 'success');
      }
    } catch (err) {
      showAlert('Erro ao importar arquivo!', 'danger');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ===== SINCRONIZAR =====
export function syncData() {
  if (state.syncStatus === 'offline') {
    showAlert('Sem conexão! Sincronização será feita quando voltar online.', 'warning');
    return;
  }
  if (!firebaseReady) {
    showAlert('Firebase não configurado.', 'warning');
    return;
  }
  showAlert('Sincronizando dados...', 'info');
  syncAllToFirebase().then(() => showAlert('Dados sincronizados com Firebase!', 'success')).catch(() => showAlert('Erro ao sincronizar.', 'danger'));
}

// ===== LIMPAR CACHE =====
export function clearCache() {
  if (confirm('Deseja limpar o cache da aplicação?')) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
    localStorage.clear();
    sessionStorage.clear();
    showAlert('Cache limpo! Atualizando página...', 'success');
    setTimeout(() => location.reload(), 1500);
  }
}

// ===== CALLBACK UI REFRESH =====
let _refreshCallback = null;

export function setRefreshCallback(fn) {
  _refreshCallback = fn;
}

function _notifyRefresh() {
  if (_refreshCallback) _refreshCallback();
}
