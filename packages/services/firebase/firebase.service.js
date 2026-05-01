// ============================================================
// FIREBASE.SERVICE.JS — Orquestração: sync, storage, listeners
//
// Responsabilidade: sincronização Firebase ↔ localStorage,
// listeners realtime, refresh callback e ações de UI (export/import).
//
// Módulos filhos (use-os diretamente em código novo):
//   firebase.init.js  → db, storage, firebaseReady, initFirebase
//   firebase.crud.js  → saveToFirebase, deleteFromFirebase, updateInFirebase
//
// Re-exporta tudo dos módulos filhos para manter compatibilidade
// com os 15+ arquivos que já importam daqui.
// ============================================================

import { db, firebaseReady } from './firebase.init.js';
import { state, getFamilyId, getFamilyStorageKey } from '../../core/state/store.js';
import { showAlert, formatCurrency } from '../../utils/helpers.js';
import { saveToFirebase as _saveToFirebase } from './firebase.crud.js';

// ===== RE-EXPORTS (backward compat — não remover) =====
export { db, storage, firebaseReady, initFirebase } from './firebase.init.js';
export { saveToFirebase, deleteFromFirebase, updateInFirebase } from './firebase.crud.js';

// ===== ESTADO INTERNO =====
let _fbSyncTimer    = null;
let _fbListeners    = [];
let _loadingData    = false;
let _listenersActive = false;
let _allowRefresh   = false;
let _lastFetchTime  = 0;

// ===== ARMAZENAMENTO LOCAL =====
export function saveDataToStorage() {
  const key = getFamilyStorageKey();
  if (!key) { console.warn('Sem familyId — dados não serão salvos no localStorage.'); return; }
  localStorage.setItem(key, JSON.stringify({
    transactions: state.transactions,
    debts:        state.debts,
    salaries:     state.salaries,
    lastSaved:    new Date().toISOString()
  }));
}

export function loadDataFromStorage() {
  state.transactions = [];
  state.debts        = [];
  state.salaries     = [];

  const key = getFamilyStorageKey();
  if (!key) { _notifyRefresh(); return Promise.resolve(); }

  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state.transactions = parsed.transactions || [];
      state.debts        = parsed.debts        || [];
      state.salaries     = parsed.salaries     || [];
    } catch (e) {
      console.error('Erro ao carregar dados locais:', e);
    }
  }

  _notifyRefresh();

  return new Promise(resolve => {
    if (firebaseReady && !_loadingData && !_listenersActive) {
      _loadingData = true;
      loadDataFromFirebase()
        .then(() => { _loadingData = false; _listenersActive = true; listenFirebaseChanges(); resolve(); })
        .catch(err => { _loadingData = false; console.error('Erro ao carregar do Firebase:', err); resolve(); });
    } else {
      resolve();
    }
  });
}

// ===== CARREGAR DO FIREBASE =====
export async function loadDataFromFirebase() {
  if (!firebaseReady) return;
  const familyId = getFamilyId();
  if (!familyId) { console.warn('Sem familyId — dados do Firebase não serão carregados.'); return; }
  try {
    const transSnap = await db.collection('transactions').where('familyId', '==', familyId).get();
    state.transactions = transSnap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const debtsSnap = await db.collection('debts').where('familyId', '==', familyId).get();
    state.debts = debtsSnap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const salSnap = await db.collection('salaries').where('familyId', '==', familyId).get();
    state.salaries = salSnap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    saveDataToStorage();
    _lastFetchTime = Date.now();
    _notifyRefresh();
  } catch (error) {
    console.error('Erro ao carregar do Firebase:', error);
    if (error.code !== 'permission-denied') {
      showAlert('Erro ao carregar dados do servidor. Usando dados locais.', 'warning');
    }
  }
}

// ===== LISTENERS REALTIME =====
export function listenFirebaseChanges() {
  if (!firebaseReady)      { console.warn('⚠️ Firebase não está pronto para listeners'); return; }
  if (_listenersActive)    { return; }

  _fbListeners.forEach(unsub => unsub());
  _fbListeners = [];

  const familyId = getFamilyId();
  if (!familyId) { console.warn('⚠️ Sem familyId — listeners não serão ativados'); return; }

  const debouncedLoad = () => {
    if (_loadingData) return;
    _loadingData = true;
    clearTimeout(_fbSyncTimer);
    _fbSyncTimer = setTimeout(() => {
      loadDataFromFirebase().finally(() => { _loadingData = false; });
    }, 500);
  };

  ['transactions', 'debts', 'salaries'].forEach(col => {
    const unsub = db.collection(col)
      .where('familyId', '==', familyId)
      .onSnapshot(debouncedLoad, err => console.error(`❌ Erro no listener de ${col}:`, err));
    _fbListeners.push(unsub);
  });
}

export function cleanupFirebaseListeners() {
  _fbListeners.forEach(unsub => unsub());
  _fbListeners    = [];
  _listenersActive = false;
  _loadingData    = false;
  clearTimeout(_fbSyncTimer);
}

export function refreshIfStale(maxAgeMs = 30_000) {
  if (!firebaseReady || !state.isLoggedIn || !_allowRefresh) return;
  if (_loadingData) return;
  if (Date.now() - _lastFetchTime < maxAgeMs) return;
  loadDataFromFirebase();
}

// Dispara refresh ao voltar ao foreground
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfStale(); });
window.addEventListener('focus', () => refreshIfStale());

// ===== SYNC COMPLETO =====
export async function syncAllToFirebase() {
  if (!firebaseReady) return;
  const familyId = getFamilyId();
  if (!familyId) { console.warn('Sem familyId — sincronização cancelada.'); return; }
  try {
    for (const t of state.transactions) await _saveToFirebase('transactions', t);
    for (const d of state.debts)        await _saveToFirebase('debts', d);
    for (const s of state.salaries)     await _saveToFirebase('salaries', s);
  } catch (error) {
    console.error('Erro na sincronização completa:', error);
  }
}

// ===== EXPORTAR / IMPORTAR =====
export function exportData() {
  const json = JSON.stringify({
    transactions: state.transactions,
    debts:        state.debts,
    salaries:     state.salaries,
    exportedAt:   new Date().toISOString()
  }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `wolfsource-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showAlert('Dados exportados com sucesso!', 'success');
}

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
        state.debts        = (data.debts        || []).map(d => ({ ...d, familyId }));
        state.salaries     = (data.salaries     || []).map(s => ({ ...s, familyId }));
        saveDataToStorage();
        syncAllToFirebase();
        _notifyRefresh();
        showAlert('Dados importados com sucesso!', 'success');
      }
    } catch {
      showAlert('Erro ao importar arquivo!', 'danger');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ===== AÇÕES DE UI =====
export function syncData() {
  if (state.syncStatus === 'offline') { showAlert('Sem conexão! Sincronização será feita quando voltar online.', 'warning'); return; }
  if (!firebaseReady)                 { showAlert('Firebase não configurado.', 'warning'); return; }
  showAlert('Sincronizando dados...', 'info');
  syncAllToFirebase()
    .then(() => showAlert('Dados sincronizados com Firebase!', 'success'))
    .catch(() => showAlert('Erro ao sincronizar.', 'danger'));
}

export function clearCache() {
  if (!confirm('Deseja limpar o cache da aplicação?')) return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
  localStorage.clear();
  sessionStorage.clear();
  showAlert('Cache limpo! Atualizando página...', 'success');
  setTimeout(() => location.reload(), 1500);
}

// ===== REFRESH CALLBACK =====
let _refreshCallback = null;

export function setRefreshCallback(fn) { _refreshCallback = fn; }
export function allowRefresh(allow = true) { _allowRefresh = allow; }
export function notifyRefresh() { _notifyRefresh(); }

function _notifyRefresh() {
  if (_refreshCallback && state.isLoggedIn && _allowRefresh) {
    try { _refreshCallback(); } catch (error) { console.error('❌ Erro no callback de refresh:', error); }
  }
}
