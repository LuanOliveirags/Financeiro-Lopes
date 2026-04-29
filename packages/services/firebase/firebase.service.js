// ============================================================
// DATA.JS — Firebase, armazenamento local e sincronização
// ============================================================
/* global firebase */

import { firebaseConfig } from './firebase.config.js';
import { state, getFamilyId, getFamilyStorageKey } from '../../core/state/store.js';
import { showAlert, formatCurrency } from '../../utils/helpers.js';

// ===== FIREBASE GLOBALS =====
export let db = null;
export let storage = null;
export let firebaseReady = false;

let _fbSyncTimer = null;
let _fbListeners = [];
let _loadingData = false;
let _listenersActive = false;
let _allowRefresh = false;
let _lastFetchTime = 0;

// ===== INICIALIZAÇÃO =====
export function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
      console.log('🔥 Inicializando Firebase...');
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
      console.log('✅ Firebase Firestore conectado!');
      console.log(`📊 Projeto: ${firebaseConfig.projectId}`);
      
      try {
        storage = firebase.storage();
        console.log('✅ Firebase Storage conectado!');
      } catch (e) {
        console.warn('⚠️ Firebase Storage indisponível:', e);
      }
      
      // Testa conexão ao Firestore
      testFirebaseConnection();
    } else {
      console.warn('⚠️ Firebase não configurado. Usando localStorage apenas.');
    }
  } catch (error) {
    console.error('❌ Erro ao iniciar Firebase:', error);
  }
}

// ===== TESTE DE CONEXÃO =====
async function testFirebaseConnection() {
  try {
    console.log('🧪 Testando conexão com Firestore...');
    
    // Tenta listar usuários
    const snap = await db.collection('users').limit(1).get();
    console.log(`✅ Conexão com Firestore OK! (${snap.size} documentos encontrados)`);
    
    // Verifica se admin existe
    const adminSnap = await db.collection('users').where('login', '==', 'luangs').get();
    if (adminSnap.empty) {
      console.warn('⚠️ Usuário "luangs" não encontrado no Firestore');
      console.log('💡 Tentando criar admin padrão...');
    } else {
      console.log('✅ Usuário "luangs" encontrado no Firestore');
    }
  } catch (error) {
    console.error('❌ Erro ao testar conexão com Firestore:', error);
    if (error.code === 'permission-denied') {
      console.error('🔴 ERRO CRÍTICO: Sem permissão para acessar Firestore!');
      console.error('   → Verifique as regras de segurança do Firebase Console');
      console.error('   → As regras devem permitir leitura/escrita publicamente OU usar autenticação');
    }
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
  console.log('📥 Carregando dados do armazenamento local...');
  state.transactions = [];
  state.debts = [];
  state.salaries = [];

  const key = getFamilyStorageKey();
  if (!key) {
    console.warn('⚠️ Sem familyId — dados não serão carregados.');
    _notifyRefresh();
    return Promise.resolve();
  }

  const data = localStorage.getItem(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      state.transactions = parsed.transactions || [];
      state.debts = parsed.debts || [];
      state.salaries = parsed.salaries || [];
      console.log(`✅ Dados carregados: ${state.transactions.length} transações, ${state.debts.length} dívidas, ${state.salaries.length} salários`);
    } catch (e) {
      console.error('❌ Erro ao carregar dados locais:', e);
    }
  } else {
    console.log('ℹ️ Nenhum dado local encontrado');
  }
  
  console.log('🔔 Notificando atualização de UI...');
  _notifyRefresh();
  
  // Retorna promise para poder aguardar
  return new Promise((resolve) => {
    if (firebaseReady && !_loadingData && !_listenersActive) {
      console.log('🔄 Iniciando sincronização com Firebase...');
      _loadingData = true;
      loadDataFromFirebase().then(() => {
        _loadingData = false;
        console.log('🎧 Ativando listeners de Firebase...');
        _listenersActive = true;
        listenFirebaseChanges();
        resolve();
      }).catch(err => {
        _loadingData = false;
        console.error('❌ Erro ao carregar do Firebase:', err);
        resolve(); // Resolve mesmo com erro para não bloquear
      });
    } else {
      if (!firebaseReady) {
        console.warn('⚠️ Firebase não disponível. Usando apenas dados locais.');
      } else if (_loadingData) {
        console.log('⏳ Carregamento do Firebase já em andamento...');
      } else if (_listenersActive) {
        console.log('🎧 Listeners já estão ativos');
      }
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
    state.transactions = transSnap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const debtsSnap = await db.collection('debts').where('familyId', '==', familyId).get();
    state.debts = debtsSnap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const salSnap = await db.collection('salaries').where('familyId', '==', familyId).get();
    state.salaries = salSnap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    saveDataToStorage();
    _lastFetchTime = Date.now();
    _notifyRefresh();
    console.log('Dados carregados do Firebase com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar do Firebase:', error);
    if (error.code !== 'permission-denied') {
      showAlert('Erro ao carregar dados do servidor. Usando dados locais.', 'warning');
    }
  }
}

// ===== LISTENERS REALTIME =====
export function listenFirebaseChanges() {
  if (!firebaseReady) {
    console.warn('⚠️ Firebase não está pronto para listeners');
    return;
  }
  
  if (_listenersActive) {
    console.log('🎧 Listeners já estão ativos, ignorando nova solicitação');
    return;
  }
  
  console.log('🎧 Ativando listeners de Firebase...');
  _fbListeners.forEach(unsub => unsub());
  _fbListeners = [];

  const familyId = getFamilyId();
  if (!familyId) {
    console.warn('⚠️ Sem familyId — listeners não serão ativados');
    return;
  }

  const debouncedLoad = () => {
    if (_loadingData) {
      console.log('⏳ Carregamento já em andamento, ignorando disparo');
      return;
    }
    _loadingData = true;
    clearTimeout(_fbSyncTimer);
    _fbSyncTimer = setTimeout(() => {
      console.log('🔄 Sincronizando dados do Firebase...');
      loadDataFromFirebase().finally(() => {
        _loadingData = false;
      });
    }, 500);
  };

  ['transactions', 'debts', 'salaries'].forEach(col => {
    const unsub = db.collection(col)
      .where('familyId', '==', familyId)
      .onSnapshot(debouncedLoad, err => console.error(`❌ Erro no listener de ${col}:`, err));
    _fbListeners.push(unsub);
  });
  
  console.log('✅ Listeners de Firebase ativados');
}

export function cleanupFirebaseListeners() {
  _fbListeners.forEach(unsub => unsub());
  _fbListeners = [];
  _listenersActive = false;
  _loadingData = false;
  clearTimeout(_fbSyncTimer);
}

// Busca dados frescos do Firebase se passaram mais de maxAgeMs desde a última busca.
// Padrão: 30s — evita spam mas garante dados atuais ao voltar ao app.
export function refreshIfStale(maxAgeMs = 30_000) {
  if (!firebaseReady || !state.isLoggedIn || !_allowRefresh) return;
  if (_loadingData) return;
  if (Date.now() - _lastFetchTime < maxAgeMs) return;
  console.log('🔄 Dados potencialmente desatualizados — buscando do Firebase...');
  loadDataFromFirebase();
}

// Dispara refresh ao voltar ao foreground (app minimizado, aba trocada no browser)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshIfStale();
});
window.addEventListener('focus', () => refreshIfStale());

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
  a.download = `wolfsource-backup-${new Date().toISOString().split('T')[0]}.json`;
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

export function allowRefresh(allow = true) {
  _allowRefresh = allow;
  console.log(`🔄 Refresh ${allow ? 'habilitado' : 'desabilitado'}`);
}

export function notifyRefresh() {
  _notifyRefresh();
}

function _notifyRefresh() {
  // Só notifica refresh se está permitido e o usuário está realmente logado
  if (_refreshCallback && state.isLoggedIn && _allowRefresh) {
    console.log('📢 Chamando callback de atualização...');
    try {
      _refreshCallback();
    } catch (error) {
      console.error('❌ Erro no callback de refresh:', error);
    }
  } else if (!state.isLoggedIn) {
    console.log('ℹ️ Usuário não está logado, refresh não será chamado');
  } else if (!_allowRefresh) {
    console.log('ℹ️ Refresh está desabilitado temporariamente');
  }
}
