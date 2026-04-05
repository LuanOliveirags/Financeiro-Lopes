// ========================================
// SCRIPT.JS - LÓGICA PRINCIPAL DA APLICAÇÃO
// ========================================

// ===== CONFIGURAÇÕES GLOBAIS =====
const CONFIG = {};

// ===== FIREBASE — INICIALIZAÇÃO =====
// Substitua as credenciais abaixo pelas do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAMx-ZoL4cco2NmPzEfIe5yYC1WLHPc0vk",
  authDomain: "financeiro-lopes.firebaseapp.com",
  projectId: "financeiro-lopes",
  storageBucket: "financeiro-lopes.firebasestorage.app",
  messagingSenderId: "621443570583",
  appId: "1:621443570583:web:1a5ad0106d2606561482d2",
  measurementId: "G-7FHPEHP5G5"
};

let db = null;
let storage = null;
let firebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
      console.log('Firebase Firestore conectado!');
      // Storage é opcional — não bloqueia o app se falhar
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

// ===== ESTADO GLOBAL =====
const state = {
  isLoggedIn: false,
  user: null,
  currentUser: null,
  currentFamily: null,
  familyMembers: [],
  currentMonth: new Date(),
  transactions: [],
  debts: [],
  salaries: [],
  syncStatus: 'online',
  charts: {},
  selectedDay: null
};

// ===== TENANT / FAMÍLIA =====
function isSuperAdmin() {
  return state.currentUser && state.currentUser.role === 'superadmin';
}

function isAdmin() {
  return state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin');
}

function getFamilyId() {
  return state.currentUser && state.currentUser.familyId ? state.currentUser.familyId : null;
}

function getFamilyStorageKey() {
  const fid = getFamilyId();
  if (!fid) return null;
  return `financeiro_data_${fid}`;
}

async function loadFamily() {
  if (!firebaseReady || !state.currentUser || !state.currentUser.familyId) {
    state.currentFamily = null;
    state.familyMembers = [];
    return;
  }
  try {
    const doc = await db.collection('families').doc(state.currentUser.familyId).get();
    if (doc.exists) {
      state.currentFamily = doc.data();
    }
    // Carregar membros da família
    await loadFamilyMembers();
  } catch (e) {
    console.error('Erro ao carregar família:', e);
  }
}

// Carrega os membros da família atual do Firestore e popula selects/cards
async function loadFamilyMembers() {
  state.familyMembers = [];
  const familyId = getFamilyId();
  if (!familyId || !firebaseReady) return;
  try {
    const snap = await db.collection('users').where('familyId', '==', familyId).get();
    state.familyMembers = snap.docs.map(doc => {
      const d = doc.data();
      return { id: d.id, name: d.fullName || d.login, login: d.login };
    });
  } catch (e) {
    console.error('Erro ao carregar membros da família:', e);
  }
  populateMemberSelects();
  renderPersonIncomeCards();
  renderCardDebtCards();
}

// Popula todos os selects de responsável/pessoa com os membros da família
function populateMemberSelects() {
  const members = state.familyMembers || [];
  const selects = [
    { el: document.getElementById('tranResponsible'), placeholder: 'Selecione...', addAmbos: true },
    { el: document.getElementById('debtResponsible'), placeholder: null, addAmbos: true },
    { el: document.getElementById('salaryPerson'), placeholder: null, addAmbos: false, prefix: 'Salário ' }
  ];
  selects.forEach(({ el, placeholder, addAmbos, prefix }) => {
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    if (placeholder) el.innerHTML += `<option value="">${placeholder}</option>`;
    members.forEach(m => {
      el.innerHTML += `<option value="${m.name}">${prefix || ''}${m.name}</option>`;
    });
    if (addAmbos) el.innerHTML += `<option value="Ambos">Ambos</option>`;
    // Restaurar seleção anterior se ainda existir
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
  });
}

// Renderiza cards dinâmicos de salário por pessoa
function renderPersonIncomeCards() {
  const container = document.querySelector('.person-cards-grid');
  if (!container) return;
  const members = state.familyMembers || [];
  const colors = ['#4361EE', '#F72585', '#06D6A0', '#FF6B35', '#8B5CF6', '#14B8A6'];
  const icons = ['fa-user-tie', 'fa-user', 'fa-user-astronaut', 'fa-user-ninja', 'fa-user-secret', 'fa-user-graduate'];

  let html = '';
  members.forEach((m, i) => {
    const slug = m.name.replace(/\s+/g, '_');
    const color = colors[i % colors.length];
    html += `
      <div class="person-income-card" style="border-image: linear-gradient(135deg, ${color}, ${color}88) 1;">
        <div class="pic-header">
          <div class="pic-avatar" style="background:${color}22;color:${color}"><i class="fa-solid ${icons[i % icons.length]}"></i></div>
          <span class="pic-name">${m.name}</span>
        </div>
        <p class="salary-current" id="salary_${slug}">R$ 0,00</p>
        <p class="salary-annual" id="annual_${slug}">Anual: R$ 0,00</p>
      </div>`;
  });
  // Card combinado
  html += `
    <div class="person-income-card combined-card">
      <div class="pic-header">
        <div class="pic-avatar combined-avatar"><i class="fa-solid fa-users"></i></div>
        <span class="pic-name">Combinado</span>
      </div>
      <p class="salary-current" id="combinedSalary">R$ 0,00</p>
      <p class="salary-annual" id="combinedAnnual">Anual: R$ 0,00</p>
    </div>`;
  container.innerHTML = html;
}

// Renderiza cards dinâmicos de cartão por pessoa na aba de dívidas
function renderCardDebtCards() {
  const container = document.getElementById('cardDebtCardsContainer');
  if (!container) return;
  const members = state.familyMembers || [];
  let html = '';
  members.forEach(m => {
    const slug = m.name.replace(/\s+/g, '_');
    html += `
      <div class="debt-overview-card debt-ov-cartao" data-filter="cartao-${slug}" role="button" tabindex="0">
        <div class="debt-ov-header">
          <div class="debt-ov-icon" style="background:rgba(139,92,246,0.15)"><i class="fa-solid fa-credit-card" style="color:#8B5CF6"></i></div>
          <div>
            <p class="debt-ov-title">Cartão ${m.name}</p>
            <p class="debt-ov-subtitle" id="cardCount_${slug}">0 dívidas</p>
          </div>
        </div>
        <p class="debt-ov-amount" id="cardTotal_${slug}">R$ 0,00</p>
      </div>`;
  });
  container.innerHTML = html;
  // Re-aplicar listeners de filtro nos novos cards dinâmicos
  setupDebtFilterListeners();
}

async function createFamily(name) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const id = `family-${Date.now()}`;
  const family = { id, name, createdAt: new Date().toISOString() };
  await db.collection('families').doc(id).set(family);
  return family;
}

async function loadFamiliesList() {
  if (!firebaseReady) return [];
  try {
    const snap = await db.collection('families').get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('Erro ao carregar famílias:', e);
    return [];
  }
}

async function deleteFamily(familyId) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  // Impedir deletar se há usuários associados
  const usersSnap = await db.collection('users').where('familyId', '==', familyId).get();
  if (!usersSnap.empty) throw new Error('Não é possível excluir uma família que ainda possui usuários.');
  await db.collection('families').doc(familyId).delete();
}

async function populateFamilySelects() {
  const families = await loadFamiliesList();
  const selects = [document.getElementById('newUserFamily'), document.getElementById('editUserFamily')];
  selects.forEach(sel => {
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Selecione uma família...</option>';
    families.forEach(f => {
      sel.innerHTML += `<option value="${esc(f.id)}">${esc(f.name)}</option>`;
    });
    if (currentVal) sel.value = currentVal;
  });
}

async function loadFamiliesListUI() {
  const container = document.getElementById('familiesListContainer');
  if (!container) return;
  container.innerHTML = '<div class="users-list-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando famílias...</div>';
  try {
    const families = await loadFamiliesList();
    if (families.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma família cadastrada.</p>';
      return;
    }

    // Contar membros por família
    const usersSnap = await db.collection('users').get();
    const memberCount = {};
    usersSnap.forEach(doc => {
      const fid = doc.data().familyId;
      if (fid) memberCount[fid] = (memberCount[fid] || 0) + 1;
    });

    let html = '<div class="users-list">';
    families.forEach(f => {
      const count = memberCount[f.id] || 0;
      html += `
        <div class="user-card">
          <div class="user-card-info">
            <div class="user-card-name"><i class="fa-solid fa-people-roof" style="margin-right:6px;"></i>${esc(f.name)}</div>
            <div class="user-card-detail">${count} membro${count !== 1 ? 's' : ''}</div>
          </div>
          <div class="user-card-actions">
            <button class="user-action-btn delete-family-btn danger" data-id="${esc(f.id)}" data-name="${esc(f.name)}" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.delete-family-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fid = btn.dataset.id;
        const fname = btn.dataset.name;
        if (!confirm(`Excluir a família "${fname}"? (só é possível se não houver membros)`)) return;
        try {
          await deleteFamily(fid);
          showAlert(`Família "${fname}" excluída.`, 'success');
          loadFamiliesListUI();
        } catch (err) {
          showAlert(err.message, 'danger');
        }
      });
    });
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Erro ao carregar famílias.</p>';
    console.error('loadFamiliesListUI:', err);
  }
}

// ===== MAPEAMENTO DE CATEGORIAS =====
const CATEGORY_MAP = {
  alimentacao:  { icon: '🍽️', label: 'Alimentação',  css: 'cat-alimentacao'  },
  transporte:   { icon: '🚗', label: 'Transporte',   css: 'cat-transporte'   },
  saude:        { icon: '💊', label: 'Saúde',        css: 'cat-saude'        },
  educacao:     { icon: '📚', label: 'Educação',     css: 'cat-educacao'     },
  moradia:      { icon: '🏠', label: 'Moradia',      css: 'cat-moradia'      },
  lazer:        { icon: '🎮', label: 'Lazer',        css: 'cat-lazer'        },
  utilidades:   { icon: '⚡', label: 'Utilidades',   css: 'cat-utilidades'   },
  beleza:       { icon: '💅', label: 'Beleza',       css: 'cat-beleza'       },
  pets:         { icon: '🐾', label: 'Pets',         css: 'cat-pets'         },
  assinaturas:  { icon: '📺', label: 'Assinaturas',  css: 'cat-assinaturas'  },
  investimentos:{ icon: '📈', label: 'Investimentos', css: 'cat-investimentos'},
  academia:     { icon: '🏋️', label: 'Academia',      css: 'cat-academia'     },
  outros:       { icon: '📁', label: 'Outros',       css: 'cat-outros'       }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  // Limpa chave global legada (pré-tenant) para evitar vazamento entre famílias
  localStorage.removeItem('financeiro_data');

  initFirebase();
  createDefaultAdmin();
  initializeApp();
  setupEventListeners();
  checkLoginStatus();
  if (typeof setupOnlineOfflineListeners === 'function') setupOnlineOfflineListeners();
  if (typeof initMonthScroller === 'function') initMonthScroller();
  if (typeof initWeekScroller === 'function') initWeekScroller();

  // Set today's date as default in forms
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('tranDate').value = todayStr;
  document.getElementById('debtDueDate').value = todayStr;
  document.getElementById('salaryDate').value = todayStr;
  document.getElementById('monthFilter').value = monthStr;

  document.getElementById('historyMonth').value = monthStr;

  // Garante que a aba Status esteja ativa ao iniciar
  switchTab('dashboard');
});

// ===== MONTH SCROLLER =====
function initMonthScroller() {
  const scroller = document.getElementById('monthScroller');
  if (!scroller) return;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  scroller.innerHTML = months.map((m, i) => {
    const isActive = i === currentMonth;
    return `<button class="month-btn ${isActive ? 'active' : ''}" data-month="${i}" onclick="selectMonth(${i}, ${currentYear})">${m}</button>`;
  }).join('');

  // Scroll to current (sem scrollIntoView para não propagar scroll horizontal ao pai)
  requestAnimationFrame(() => {
    const active = scroller.querySelector('.month-btn.active');
    if (active) {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const offset = activeRect.left - scrollerRect.left - (scrollerRect.width / 2) + (activeRect.width / 2);
      scroller.scrollLeft += offset;
    }
  });
}

function selectMonth(monthIndex, year) {
  const y = year || new Date().getFullYear();
  const monthStr = `${y}-${String(monthIndex + 1).padStart(2, '0')}`;
  document.getElementById('monthFilter').value = monthStr;
  document.querySelectorAll('.month-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === monthIndex);
  });
  updateDashboard();
  updateSalaryDisplay();
}

// ===== WEEK SCROLLER =====
function initWeekScroller() {
  const scroller = document.getElementById('weekScroller');
  if (!scroller) return;
  const today = new Date();
  const todayStr = toDateStr(today);
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const html = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dStr = toDateStr(d);
    const isToday = dStr === todayStr;
    html.push(`
      <button class="week-day-btn ${isToday ? 'active' : ''}" data-date="${dStr}" onclick="selectWeekDay('${dStr}')">
        <span class="wday-name">${days[d.getDay()]}</span>
        <span class="wday-num">${d.getDate()}</span>
      </button>
    `);
  }
  scroller.innerHTML = html.join('');
  // Default selected day = today
  state.selectedDay = todayStr;
  // Scroll to today (sem scrollIntoView para não propagar scroll horizontal ao pai)
  requestAnimationFrame(() => {
    const active = scroller.querySelector('.week-day-btn.active');
    if (active) {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const offset = activeRect.left - scrollerRect.left - (scrollerRect.width / 2) + (activeRect.width / 2);
      scroller.scrollLeft += offset;
    }
  });
}

function selectWeekDay(dateStr) {
  state.selectedDay = dateStr;
  document.querySelectorAll('.week-day-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.date === dateStr);
  });
  updateTransactionHistory();
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ===== INICIALIZAÇÃO DO APP =====
function initializeApp() {
  console.log('Inicializando Financeiro Lopes...');
  
  // Check PWA Status
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        const el = document.getElementById('pwaStatus');
        if (el) el.textContent = registrations.length > 0 ? 'Sim' : 'Não';
      });
  }

  // Atualizar status do Firebase na tela
  const syncEl = document.getElementById('syncStatus');
  if (syncEl) {
    if (firebaseReady) {
      syncEl.textContent = 'Conectado';
      syncEl.className = 'status-pill connected';
    } else {
      syncEl.textContent = 'Local';
      syncEl.className = 'status-pill disconnected';
    }
  }
}

// ===== GESTÃO DE USUÁRIOS =====
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createDefaultAdmin() {
  if (!firebaseReady) return;
  try {
    // Criar família padrão "Lopes" se não existir
    const familySnap = await db.collection('families').doc('family-lopes').get();
    if (!familySnap.exists) {
      await db.collection('families').doc('family-lopes').set({
        id: 'family-lopes',
        name: 'Lopes',
        createdAt: new Date().toISOString()
      });
      console.log('Família padrão "Lopes" criada com sucesso!');
    }

    const snap = await db.collection('users').where('login', '==', 'luangs').get();
    if (snap.empty) {
      const hash = await hashPassword('Space@10');
      await db.collection('users').doc('admin-luangs').set({
        id: 'admin-luangs',
        fullName: 'Luan Gs',
        email: 'luanoliveirags@gmail.com',
        login: 'luangs',
        passwordHash: hash,
        role: 'superadmin',
        familyId: 'family-lopes',
        createdAt: new Date().toISOString()
      });
      console.log('Usuário admin padrão criado com sucesso!');
    } else {
      // Atualizar admin existente com familyId e role superadmin se necessário
      const adminDoc = snap.docs[0];
      const adminData = adminDoc.data();
      const updates = {};
      if (!adminData.familyId) updates.familyId = 'family-lopes';
      if (adminData.role !== 'superadmin') updates.role = 'superadmin';
      if (Object.keys(updates).length > 0) {
        await db.collection('users').doc(adminDoc.id).update(updates);
        console.log('Admin atualizado:', updates);
      }
    }
  } catch (error) {
    console.error('Erro ao criar admin padrão:', error);
  }
}

async function loginUser(login, password) {
  const hash = await hashPassword(password);
  if (firebaseReady) {
    try {
      const snap = await db.collection('users').where('login', '==', login).get();
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        if (userData.passwordHash === hash) return userData;
      }
      return null;
    } catch (error) {
      if (error.code === 'permission-denied') {
        throw new Error('Sem permissão no Firestore. Configure as regras no Firebase Console.');
      }
      throw new Error('Erro ao conectar com o servidor.');
    }
  }
  throw new Error('Firebase não disponível. Verifique sua conexão.');
}

async function registerUser(fullName, email, login, password, familyId) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  if (!familyId) throw new Error('É necessário selecionar uma família.');
  const existing = await db.collection('users').where('login', '==', login).get();
  if (!existing.empty) throw new Error('Esse login já está em uso.');
  const emailCheck = await db.collection('users').where('email', '==', email).get();
  if (!emailCheck.empty) throw new Error('Esse e-mail já está cadastrado.');

  const hash = await hashPassword(password);
  const id = `user-${Date.now()}`;
  const user = {
    id,
    fullName,
    email,
    login,
    passwordHash: hash,
    role: 'user',
    familyId,
    createdAt: new Date().toISOString()
  };
  await db.collection('users').doc(id).set(user);
  return user;
}

async function changeUserPassword(userId, oldPassword, newPassword) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) throw new Error('Usuário não encontrado.');
  const userData = doc.data();
  const oldHash = await hashPassword(oldPassword);
  if (userData.passwordHash !== oldHash) throw new Error('Senha atual incorreta.');

  const newHash = await hashPassword(newPassword);
  await db.collection('users').doc(userId).update({ passwordHash: newHash });

  // Atualiza sessão local
  if (state.currentUser && state.currentUser.id === userId) {
    state.currentUser.passwordHash = newHash;
    localStorage.setItem('user', JSON.stringify(state.currentUser));
  }
  return true;
}

// ===== ADMIN: GERENCIAMENTO DE USUÁRIOS =====
async function loadUsersList() {
  if (!firebaseReady) { showAlert('Firebase não disponível.', 'danger'); return; }
  if (!isAdmin()) return;

  const container = document.getElementById('usersListContainer');
  container.innerHTML = '<div class="users-list-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando usuários...</div>';

  try {
    const familyId = getFamilyId();
    let snapshot;
    if (isSuperAdmin()) {
      // Superadmin vê todos os usuários
      snapshot = await db.collection('users').get();
    } else if (familyId) {
      snapshot = await db.collection('users').where('familyId', '==', familyId).get();
    } else {
      // Sem família definida e não é superadmin: não mostra nada
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma família associada.</p>';
      return;
    }
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum usuário encontrado.</p>';
      return;
    }

    let html = '<div class="users-list">';
    // Carregar nomes das famílias para exibir
    const familiesMap = {};
    if (isSuperAdmin()) {
      const famSnap = await db.collection('families').get();
      famSnap.forEach(d => { familiesMap[d.data().id] = d.data().name; });
    }

    snapshot.forEach(doc => {
      const u = doc.data();
      const isCurrentUser = u.id === state.currentUser.id;
      const roleLabel = u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Usuário';
      const roleClass = (u.role === 'admin' || u.role === 'superadmin') ? 'connected' : '';
      const familyName = isSuperAdmin() && u.familyId && familiesMap[u.familyId] ? ` · ${esc(familiesMap[u.familyId])}` : '';
      html += `
        <div class="user-card" data-user-id="${esc(u.id)}">
          <div class="user-card-info">
            <div class="user-card-name">${esc(u.fullName)}</div>
            <div class="user-card-detail">${esc(u.login)} · ${esc(u.email)}${familyName}</div>
            <span class="status-pill ${roleClass}">${esc(roleLabel)}</span>
          </div>
          <div class="user-card-actions">
            <button class="user-action-btn edit-user-btn" data-id="${esc(u.id)}" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>
            ${isCurrentUser ? '' : `<button class="user-action-btn delete-user-btn danger" data-id="${esc(u.id)}" data-name="${esc(u.fullName)}" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>`}
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    // Vincular eventos dos botões
    container.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditUser(btn.dataset.id));
    });
    container.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Erro ao carregar usuários.</p>';
    console.error('loadUsersList:', err);
  }
}

async function openEditUser(userId) {
  if (!firebaseReady) return;
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) { showAlert('Usuário não encontrado.', 'danger'); return; }
    const u = doc.data();

    // Family admin não pode editar superadmins
    if (!isSuperAdmin() && u.role === 'superadmin') {
      showAlert('Você não tem permissão para editar este usuário.', 'danger');
      return;
    }

    // Family admin só pode editar usuários da própria família
    if (!isSuperAdmin() && u.familyId !== getFamilyId()) {
      showAlert('Você não tem permissão para editar usuários de outra família.', 'danger');
      return;
    }

    document.getElementById('editUserId').value = u.id;
    document.getElementById('editUserFullName').value = u.fullName || '';
    document.getElementById('editUserEmail').value = u.email || '';
    document.getElementById('editUserLogin').value = u.login || '';
    document.getElementById('editUserRole').value = u.role || 'user';
    document.getElementById('editUserNewPassword').value = '';

    // Superadmin: mostra todos os campos
    // Family admin: mostra seletor de função (admin/user) mas esconde família
    const roleGroup = document.getElementById('editUserRoleGroup');
    const familyGroup = document.getElementById('editUserFamilyGroup');
    const roleSelect = document.getElementById('editUserRole');
    const superadminOpt = roleSelect ? roleSelect.querySelector('option[value="superadmin"]') : null;

    if (isSuperAdmin()) {
      if (roleGroup) roleGroup.style.display = '';
      if (familyGroup) familyGroup.style.display = '';
      if (superadminOpt) superadminOpt.style.display = '';
      await populateFamilySelects();
      const editFamilySel = document.getElementById('editUserFamily');
      if (editFamilySel) editFamilySel.value = u.familyId || '';
    } else {
      // Family admin: pode alterar role (admin/user) mas não superadmin, não pode trocar família
      if (roleGroup) roleGroup.style.display = '';
      if (superadminOpt) superadminOpt.style.display = 'none';
      if (familyGroup) familyGroup.style.display = 'none';
    }

    document.getElementById('editUserModal').classList.add('active');
  } catch (err) {
    showAlert('Erro ao carregar dados do usuário.', 'danger');
    console.error('openEditUser:', err);
  }
}

async function saveUserEdit(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const userId = document.getElementById('editUserId').value;
  const fullName = document.getElementById('editUserFullName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const login = document.getElementById('editUserLogin').value.trim().toLowerCase();
  const newPassword = document.getElementById('editUserNewPassword').value;

  if (!fullName || !email || !login) {
    showAlert('Preencha todos os campos obrigatórios.', 'danger');
    return;
  }
  if (newPassword && newPassword.length < 6) {
    showAlert('A senha deve ter pelo menos 6 caracteres.', 'danger');
    return;
  }

  const btn = document.querySelector('#editUserForm button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try {
    // Family admin: validar que o usuário pertence à mesma família
    if (!isSuperAdmin()) {
      const targetDoc = await db.collection('users').doc(userId).get();
      if (targetDoc.exists) {
        const targetData = targetDoc.data();
        if (targetData.familyId !== getFamilyId()) {
          showAlert('Você não tem permissão para editar usuários de outra família.', 'danger');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar Alterações';
          return;
        }
        if (targetData.role === 'superadmin') {
          showAlert('Você não tem permissão para editar este usuário.', 'danger');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar Alterações';
          return;
        }
      }
    }
    // Verificar duplicata de login (exceto o próprio)
    const loginCheck = await db.collection('users').where('login', '==', login).get();
    const duplicate = loginCheck.docs.find(d => d.data().id !== userId);
    if (duplicate) { showAlert('Esse login já está em uso por outro usuário.', 'danger'); return; }

    // Verificar duplicata de email (exceto o próprio)
    const emailCheck = await db.collection('users').where('email', '==', email).get();
    const dupEmail = emailCheck.docs.find(d => d.data().id !== userId);
    if (dupEmail) { showAlert('Esse e-mail já está cadastrado por outro usuário.', 'danger'); return; }

    const updates = { fullName, email, login };
    if (isSuperAdmin()) {
      updates.role = document.getElementById('editUserRole').value;
      const familyId = document.getElementById('editUserFamily') ? document.getElementById('editUserFamily').value : '';
      if (!familyId) { showAlert('Selecione uma família para o usuário.', 'danger'); return; }
      updates.familyId = familyId;
    } else {
      // Family admin pode trocar entre admin e user (nunca superadmin)
      const selectedRole = document.getElementById('editUserRole').value;
      if (selectedRole === 'admin' || selectedRole === 'user') {
        updates.role = selectedRole;
      }
    }
    if (newPassword) {
      updates.passwordHash = await hashPassword(newPassword);
    }

    await db.collection('users').doc(userId).update(updates);
    showAlert('Usuário atualizado com sucesso!', 'success');
    document.getElementById('editUserModal').classList.remove('active');

    // Atualizar sessão local se editou a si mesmo
    if (state.currentUser.id === userId) {
      Object.assign(state.currentUser, updates);
      localStorage.setItem('user', JSON.stringify(state.currentUser));
      await loadFamily();
      applyUserToUI();
      // Recarregar dados da nova família
      loadDataFromStorage();
    }

    // Recarregar lista
    loadUsersList();
  } catch (err) {
    showAlert(err.message || 'Erro ao atualizar usuário.', 'danger');
    console.error('saveUserEdit:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar Alterações';
  }
}

async function confirmDeleteUser(userId, userName) {
  if (!isAdmin()) return;
  if (userId === state.currentUser.id) {
    showAlert('Você não pode excluir sua própria conta.', 'danger');
    return;
  }

  // Family admin não pode excluir superadmins nem usuários de outra família
  if (!isSuperAdmin()) {
    try {
      const targetDoc = await db.collection('users').doc(userId).get();
      if (targetDoc.exists) {
        const targetData = targetDoc.data();
        if (targetData.role === 'superadmin') {
          showAlert('Você não tem permissão para excluir este usuário.', 'danger');
          return;
        }
        if (targetData.familyId !== getFamilyId()) {
          showAlert('Você não tem permissão para excluir usuários de outra família.', 'danger');
          return;
        }
      }
    } catch (e) { /* continua */ }
  }

  if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\nEssa ação não pode ser desfeita.`)) return;

  try {
    await db.collection('users').doc(userId).delete();
    showAlert(`Usuário "${userName}" excluído com sucesso.`, 'success');
    loadUsersList();
  } catch (err) {
    showAlert('Erro ao excluir usuário.', 'danger');
    console.error('confirmDeleteUser:', err);
  }
}

function applyUserToUI() {
  const user = state.currentUser;
  if (!user) return;

  const headerTitle = document.getElementById('headerUserName');
  if (headerTitle) headerTitle.textContent = user.fullName;

  const profileName = document.getElementById('settingsUserName');
  if (profileName) profileName.textContent = user.fullName;
  const profileEmail = document.getElementById('settingsUserEmail');
  if (profileEmail) profileEmail.textContent = user.email;
  const profileRole = document.getElementById('settingsUserRole');
  if (profileRole) {
    const roleText = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Usuário';
    profileRole.textContent = roleText;
    profileRole.className = (user.role === 'admin' || user.role === 'superadmin') ? 'status-pill connected' : 'status-pill';
  }

  // Mostrar nome da família
  const familyLabel = document.getElementById('settingsFamilyName');
  if (familyLabel) {
    familyLabel.textContent = state.currentFamily ? state.currentFamily.name : 'Sem família';
  }

  // Aplicar foto de perfil
  applyAvatar(user.photoURL);

  // Mostrar seção admin para admin e superadmin
  const adminSection = document.getElementById('adminSection');
  if (adminSection) adminSection.style.display = isAdmin() ? 'block' : 'none';

  // Gerenciar famílias é exclusivo do superadmin
  const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
  if (manageFamiliesBtn) manageFamiliesBtn.style.display = isSuperAdmin() ? '' : 'none';
}

function applyAvatar(photoURL) {
  const headerImg = document.getElementById('headerAvatar');
  const settingsImg = document.getElementById('settingsAvatar');
  if (photoURL) {
    if (headerImg) { headerImg.src = photoURL; headerImg.style.display = 'block'; }
    if (settingsImg) { settingsImg.src = photoURL; settingsImg.style.display = 'block'; }
  } else {
    if (headerImg) headerImg.style.display = 'none';
    if (settingsImg) settingsImg.style.display = 'none';
  }
}

function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadAvatar(file) {
  const dataURL = await resizeImage(file, 256);
  let photoURL = dataURL;

  // Upload para Firebase Storage
  if (firebaseReady && storage && state.currentUser) {
    try {
      const ref = storage.ref(`avatars/${state.currentUser.id}.jpg`);
      // Converter dataURL em blob para upload
      const res = await fetch(dataURL);
      const blob = await res.blob();
      await ref.put(blob, { contentType: 'image/jpeg' });
      photoURL = await ref.getDownloadURL();
      // Salvar URL no Firestore
      await db.collection('users').doc(state.currentUser.id).update({ photoURL });
    } catch (error) {
      console.error('Erro no upload da foto:', error);
      // Fallback: salva base64 no Firestore
      await db.collection('users').doc(state.currentUser.id).update({ photoURL: dataURL });
    }
  }

  // Atualizar estado local
  state.currentUser.photoURL = photoURL;
  localStorage.setItem('user', JSON.stringify(state.currentUser));
  applyAvatar(photoURL);
  showAlert('Foto atualizada com sucesso!', 'success');
}

// ===== AUTENTICAÇÃO =====
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const login = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  const submitBtn = this.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

  try {
    const user = await loginUser(login, password);
    if (user) {
      errorDiv.classList.remove('show');
      state.isLoggedIn = true;
      state.user = user.login;
      state.currentUser = user;
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('loginTime', new Date().toISOString());

      // Carregar dados da família
      await loadFamily();

      document.getElementById('loginContainer').classList.remove('active');
      document.getElementById('appContainer').classList.add('active');

      applyUserToUI();
      loadDataFromStorage();
      updateDashboard();
      this.reset();
    } else {
      errorDiv.textContent = 'Usuário ou senha incorretos!';
      errorDiv.classList.add('show');
    }
  } catch (err) {
    errorDiv.textContent = err.message || 'Erro ao fazer login.';
    errorDiv.classList.add('show');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Entrar</span><i class="fa-solid fa-arrow-right"></i>';
  }
});

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('Tem certeza que deseja sair?')) {
    // Limpar listeners do Firebase
    _fbListeners.forEach(unsub => unsub());
    _fbListeners = [];

    state.isLoggedIn = false;
    state.user = null;
    state.currentUser = null;
    state.currentFamily = null;
    state.transactions = [];
    state.debts = [];
    state.salaries = [];
    localStorage.removeItem('user');

    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('loginContainer').classList.add('active');
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').classList.remove('show');
  }
});

// ===== VERIFICAR LOGIN STATUS =====
function checkLoginStatus() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user && user.login) {
        state.isLoggedIn = true;
        state.user = user.login;
        state.currentUser = user;
        document.getElementById('loginContainer').classList.remove('active');
        document.getElementById('appContainer').classList.add('active');
        applyUserToUI();

        // Revalidar dados do usuário no Firestore (familyId pode ter mudado)
        const refreshUser = firebaseReady
          ? db.collection('users').doc(user.id).get().then(doc => {
              if (doc.exists) {
                const freshData = doc.data();
                state.currentUser = freshData;
                state.user = freshData.login;
                localStorage.setItem('user', JSON.stringify(freshData));
              } else {
                // Usuário deletado do Firestore — deslogar
                console.warn('Usuário não encontrado no Firestore. Deslogando.');
                localStorage.removeItem('user');
                state.isLoggedIn = false;
                state.currentUser = null;
                document.getElementById('appContainer').classList.remove('active');
                document.getElementById('loginContainer').classList.add('active');
              }
            }).catch(err => {
              console.warn('Erro ao revalidar usuário:', err);
            })
          : Promise.resolve();

        refreshUser.then(() => loadFamily()).then(() => {
          loadDataFromStorage();
          updateDashboard();
          applyUserToUI();
        });
        return;
      }
    } catch (e) {
      // Formato antigo ou corrompido
    }
    localStorage.removeItem('user');
  }
}

// ===== NAVEGAÇÃO ENTRE ABAS =====
function setupEventListeners() {
  // Avatar upload
  const avatarBtn = document.getElementById('avatarUploadBtn');
  const avatarInput = document.getElementById('avatarFileInput');
  if (avatarBtn && avatarInput) {
    avatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showAlert('Selecione um arquivo de imagem.', 'danger');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showAlert('A imagem deve ter no máximo 5 MB.', 'danger');
        return;
      }
      try {
        await uploadAvatar(file);
      } catch (err) {
        showAlert('Erro ao salvar foto.', 'danger');
      }
      e.target.value = '';
    });
  }

  // Bottom Navigation
  document.querySelectorAll('.bottom-nav-item').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // FAB Button
  const fabBtn = document.getElementById('fabBtn');
  const quickActionsMenu = document.getElementById('quickActionsMenu');
  
  fabBtn.addEventListener('click', () => {
    fabBtn.classList.toggle('active');
    quickActionsMenu.classList.toggle('active');
  });
  
  // Quick Actions
  document.querySelectorAll('.quick-action-item').forEach(item => {
    item.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      handleQuickAction(action);
      fabBtn.classList.remove('active');
      quickActionsMenu.classList.remove('active');
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fab-container')) {
      fabBtn.classList.remove('active');
      quickActionsMenu.classList.remove('active');
    }
  });

  // Type toggle buttons (expense/income)
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('transType').value = this.dataset.value;
    });
  });

  // Collapsible transaction panel
  const togglePanelBtn = document.getElementById('togglePanelBtn');
  const panelBody = document.getElementById('transactionPanelBody');
  if (togglePanelBtn && panelBody) {
    togglePanelBtn.addEventListener('click', () => {
      const isOpen = panelBody.classList.toggle('open');
      const chevron = togglePanelBtn.querySelector('.apt-chevron');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
    });
  }

  // Transaction Form
  document.getElementById('transactionForm').addEventListener('submit', addTransaction);
  
  // Debt Modal
  document.getElementById('addDebtBtn').addEventListener('click', () => {
    resetDebtModal();
    document.getElementById('debtModal').classList.add('active');
  });
  document.getElementById('debtForm').addEventListener('submit', addDebt);
  
  // Salary Modal
  document.getElementById('addSalaryBtn').addEventListener('click', () => {
    document.getElementById('salaryModal').classList.add('active');
  });
  document.getElementById('salaryForm').addEventListener('submit', addSalary);
  
  // Modal Close Buttons
  document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      modal.classList.remove('active');
      if (modal.id === 'debtModal') resetDebtModal();
    });
  });
  
  // Close modal on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
        if (this.id === 'debtModal') resetDebtModal();
      }
    });
  });
  
  // Settings
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('syncBtn').addEventListener('click', syncData);
  document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
  
  // Install PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const installBtn = document.getElementById('installBtn');
    installBtn.style.display = 'block';
    installBtn.addEventListener('click', () => {
      e.prompt();
    });
  });
  
  // Filters
  document.getElementById('monthFilter').addEventListener('change', updateDashboard);
  document.getElementById('historyMonth').addEventListener('change', () => {
    state.selectedDay = null;
    document.querySelectorAll('.week-day-btn').forEach(b => b.classList.remove('active'));
    updateTransactionHistory();
  });
  document.getElementById('historyFilter').addEventListener('change', updateTransactionHistory);
  
  // Theme Toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // ===== GESTÃO DE USUÁRIOS — EVENT LISTENERS =====
  const changePassBtn = document.getElementById('changePasswordBtn');
  if (changePassBtn) {
    changePassBtn.addEventListener('click', () => {
      document.getElementById('changePasswordModal').classList.add('active');
    });
  }

  const manageUsersBtn = document.getElementById('manageUsersBtn');
  if (manageUsersBtn) {
    manageUsersBtn.addEventListener('click', () => {
      document.getElementById('manageUsersModal').classList.add('active');
      loadUsersList();
    });
  }

  // Gerenciar Famílias
  const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
  if (manageFamiliesBtn) {
    manageFamiliesBtn.addEventListener('click', () => {
      document.getElementById('manageFamiliesModal').classList.add('active');
      loadFamiliesListUI();
    });
  }

  const addFamilyBtn = document.getElementById('addFamilyBtn');
  if (addFamilyBtn) {
    addFamilyBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('newFamilyName');
      const name = nameInput.value.trim();
      if (!name) { showAlert('Digite o nome da família.', 'danger'); return; }
      try {
        addFamilyBtn.disabled = true;
        await createFamily(name);
        nameInput.value = '';
        showAlert(`Família "${name}" criada com sucesso!`, 'success');
        loadFamiliesListUI();
      } catch (err) {
        showAlert(err.message || 'Erro ao criar família.', 'danger');
      } finally {
        addFamilyBtn.disabled = false;
      }
    });
  }

  // Carregar famílias no select ao abrir modal de criar usuário
  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', async () => {
      document.getElementById('createUserModal').classList.add('active');
      const familyGroup = document.getElementById('newUserFamilyGroup');
      if (isSuperAdmin()) {
        // Superadmin pode escolher qualquer família
        if (familyGroup) familyGroup.style.display = '';
        await populateFamilySelects();
      } else {
        // Family admin: esconde seletor, usa família atual
        if (familyGroup) familyGroup.style.display = 'none';
      }
    });
  }

  const editUserForm = document.getElementById('editUserForm');
  if (editUserForm) {
    editUserForm.addEventListener('submit', saveUserEdit);
  }

  const changePassForm = document.getElementById('changePasswordForm');
  if (changePassForm) {
    changePassForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const currentPass = document.getElementById('currentPassword').value;
      const newPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmPassword').value;

      if (newPass !== confirmPass) {
        showAlert('As senhas não coincidem!', 'danger');
        return;
      }
      if (newPass.length < 6) {
        showAlert('A nova senha deve ter pelo menos 6 caracteres.', 'danger');
        return;
      }

      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alterando...';

      try {
        await changeUserPassword(state.currentUser.id, currentPass, newPass);
        showAlert('Senha alterada com sucesso!', 'success');
        this.reset();
        document.getElementById('changePasswordModal').classList.remove('active');
      } catch (err) {
        showAlert(err.message || 'Erro ao alterar senha.', 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterar Senha';
      }
    });
  }

  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) {
    createUserForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fullName = document.getElementById('newUserFullName').value.trim();
      const email = document.getElementById('newUserEmail').value.trim();
      const login = document.getElementById('newUserLogin').value.trim().toLowerCase();
      const password = document.getElementById('newUserPassword').value;
      const familyId = isSuperAdmin()
        ? (document.getElementById('newUserFamily') ? document.getElementById('newUserFamily').value : getFamilyId())
        : getFamilyId();

      if (password.length < 6) {
        showAlert('A senha deve ter pelo menos 6 caracteres.', 'danger');
        return;
      }
      if (!familyId) {
        showAlert('Selecione uma família para o usuário.', 'danger');
        return;
      }

      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';

      try {
        await registerUser(fullName, email, login, password, familyId);
        showAlert(`Usuário "${login}" cadastrado com sucesso!`, 'success');
        this.reset();
        document.getElementById('createUserModal').classList.remove('active');
      } catch (err) {
        showAlert(err.message || 'Erro ao cadastrar usuário.', 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Cadastrar';
      }
    });
  }

  // Initialize theme on load
  initializeTheme();

  // Setup deduction listeners for salary modal
  setupDeductionListeners();

  // Setup debt type toggle & installment field listeners
  setupDebtTypeListeners();

  // Setup debt filter click on overview cards
  setupDebtFilterListeners();

  // Salary month filter
  const salaryMonthFilter = document.getElementById('salaryMonthFilter');
  if (salaryMonthFilter) {
    salaryMonthFilter.addEventListener('change', () => updateSalaryHistory());
  }
}

// ===== TROCA DE ABAS =====
function switchTab(tabName) {
  // Remove active de todas as abas e botões
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));

  // Reset horizontal scroll para evitar deslocamento no mobile
  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.scrollLeft = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  // Adiciona active na aba e botão corretos, se existirem
  const tabSection = document.getElementById(tabName);
  const tabBtn = document.querySelector(`.bottom-nav-item[data-tab="${tabName}"]`);
  if (tabSection) tabSection.classList.add('active');
  if (tabBtn) tabBtn.classList.add('active');

  // Atualiza conteúdo se necessário
  if (tabName === 'dashboard') {
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof initMonthScroller === 'function') initMonthScroller();
  } else if (tabName === 'transactions') {
    if (typeof initWeekScroller === 'function') initWeekScroller();
    if (typeof updateTransactionHistory === 'function') updateTransactionHistory();
  } else if (tabName === 'debts') {
    if (typeof updateDebtsList === 'function') updateDebtsList();
  } else if (tabName === 'salaries') {
    if (typeof updateSalaryDisplay === 'function') updateSalaryDisplay();
  }
}

// ===== QUICK ACTIONS HANDLER =====
function handleQuickAction(action) {
  // Quick actions open panel
  if (action === 'transaction') {
    switchTab('transactions');
    setTimeout(() => {
      const panelBody = document.getElementById('transactionPanelBody');
      const chevron = document.querySelector('.apt-chevron');
      if (panelBody && !panelBody.classList.contains('open')) {
        panelBody.classList.add('open');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
      document.getElementById('addTransactionPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  } else if (action === 'debt') {
    // Open debt modal
    switchTab('debts');
    setTimeout(() => {
      document.getElementById('debtModal').classList.add('active');
    }, 300);
  } else if (action === 'salary') {
    // Open salary modal
    switchTab('salaries');
    setTimeout(() => {
      document.getElementById('salaryModal').classList.add('active');
    }, 300);
  }
}

// ===== ADICIONAR TRANSAÇÃO =====
function addTransaction(e) {
  e.preventDefault();
  
  const familyId = getFamilyId();
  if (!familyId) {
    showAlert('Erro: família não identificada. Faça login novamente.', 'danger');
    return;
  }

  const transaction = {
    id: generateId(),
    type: document.getElementById('transType').value,
    amount: parseFloat(document.getElementById('tranAmount').value),
    category: document.getElementById('tranCategory').value,
    responsible: document.getElementById('tranResponsible').value,
    date: document.getElementById('tranDate').value,
    description: document.getElementById('tranDescription').value,
    familyId: familyId,
    createdAt: new Date().toISOString()
  };
  
  if (!transaction.type || !transaction.amount || !transaction.category || !transaction.responsible) {
    alert('Por favor, preencha todos os campos obrigatórios!');
    return;
  }
  
  state.transactions.push(transaction);
  saveDataToStorage();
  saveToFirebase('transactions', transaction);
  
  // Show success message
  showAlert('Transação registrada com sucesso!', 'success');
  
  // Reset form
  e.target.reset();
  const now = new Date();
  document.getElementById('tranDate').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  // Reset toggle visual para Despesa
  document.getElementById('transType').value = 'saida';
  document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btnSaida').classList.add('active');
  
  // Update displays
  updateDashboard();
  updateTransactionHistory();
}

// ===== ADICIONAR DÍVIDA =====
function addDebt(e) {
  e.preventDefault();

  const familyId = getFamilyId();
  if (!familyId) {
    showAlert('Erro: família não identificada. Faça login novamente.', 'danger');
    return;
  }
  
  const editId = document.getElementById('editDebtId').value;
  const debtType = document.getElementById('debtType').value;
  const totalAmount = parseFloat(document.getElementById('debtAmount').value);
  const installments = parseInt(document.getElementById('debtInstallments').value) || 1;
  const paidInstallments = parseInt(document.getElementById('debtPaidInstallments').value) || 0;
  const manualInstValue = parseFloat(document.getElementById('debtInstallmentValue').value) || (totalAmount / installments);

  const isFinanciamento = debtType === 'financiamento';
  const isEmprestimo = debtType === 'emprestimo';
  const isCartao = debtType === 'cartao';
  const cartaoMode = document.getElementById('cartaoMode').value;
  const usesInstallments = isFinanciamento || isEmprestimo || (isCartao && cartaoMode === 'parcelado');

  const creditor = debtType === 'cartao'
    ? document.getElementById('debtCardIssuer').value
    : (debtType === 'emprestimo' || debtType === 'financiamento')
      ? document.getElementById('debtBankIssuer').value
      : document.getElementById('debtCreditor').value;
  const dueDate = document.getElementById('debtDueDate').value;
  const responsible = document.getElementById('debtResponsible').value;
  const category = document.getElementById('debtCategory').value || '';
  const description = document.getElementById('debtDescription').value;

  if (!creditor || !totalAmount || !dueDate) {
    alert('Por favor, preencha todos os campos obrigatórios!');
    return;
  }

  if (editId) {
    // Modo edição
    const debt = state.debts.find(d => d.id === editId);
    if (!debt) return;

    debt.creditor = creditor;
    debt.amount = totalAmount;
    debt.dueDate = dueDate;
    debt.responsible = responsible;
    debt.category = category;
    debt.description = description;
    debt.debtType = debtType;
    debt.cartaoMode = cartaoMode;
    debt.installments = usesInstallments ? installments : 1;
    debt.paidInstallments = usesInstallments ? paidInstallments : 0;
    debt.installmentValue = usesInstallments ? manualInstValue : totalAmount;

    saveDataToStorage();
    updateInFirebase('debts', editId, {
      creditor: debt.creditor,
      amount: debt.amount,
      dueDate: debt.dueDate,
      responsible: debt.responsible,
      category: debt.category,
      description: debt.description,
      debtType: debt.debtType,
      cartaoMode: debt.cartaoMode,
      installments: debt.installments,
      paidInstallments: debt.paidInstallments,
      installmentValue: debt.installmentValue
    });

    showAlert('Dívida atualizada com sucesso!', 'success');
  } else {
    // Modo criação
    const debt = {
      id: generateId(),
      creditor,
      amount: totalAmount,
      dueDate,
      responsible,
      category,
      description,
      debtType: debtType,
      cartaoMode: cartaoMode,
      installments: usesInstallments ? installments : 1,
      paidInstallments: usesInstallments ? paidInstallments : 0,
      installmentValue: usesInstallments ? manualInstValue : totalAmount,
      status: 'active',
      paidAt: null,
      familyId: familyId,
      createdAt: new Date().toISOString()
    };
    
    state.debts.push(debt);
    saveDataToStorage();
    saveToFirebase('debts', debt);
    
    showAlert('Dívida registrada com sucesso!', 'success');
  }
  
  // Reset and close modal
  resetDebtModal();
  document.getElementById('debtModal').classList.remove('active');
  
  // Update displays
  updateDebtsList();
  updateDashboard();
}

// ===== RESETAR MODAL DE DÍVIDA =====
function resetDebtModal() {
  document.getElementById('debtForm').reset();
  document.getElementById('editDebtId').value = '';
  document.getElementById('debtType').value = 'unica';
  document.getElementById('installmentFields').style.display = 'none';
  document.getElementById('cartaoOptions').style.display = 'none';
  document.getElementById('cartaoMode').value = 'unica';
  document.getElementById('creditorTextGroup').style.display = 'block';
  document.getElementById('creditorCardGroup').style.display = 'none';
  document.getElementById('creditorBankGroup').style.display = 'none';
  document.getElementById('debtCreditor').setAttribute('required', '');
  document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
  document.querySelector('.debt-type-toggle[data-value="unica"]').classList.add('active');
  document.querySelectorAll('.cartao-mode-toggle').forEach(b => b.classList.remove('active'));
  document.querySelector('.cartao-mode-toggle[data-value="unica"]').classList.add('active');
  document.getElementById('debtAmountLabel').textContent = 'Valor (R$)';
  document.getElementById('debtModalTitle').innerHTML = '<i class="fa-solid fa-credit-card"></i> Nova dívida';
  document.getElementById('debtSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Registrar';
}

// ===== EDITAR DÍVIDA =====
function editDebt(id) {
  const debt = state.debts.find(d => d.id === id);
  if (!debt) return;

  // Preencher modal com dados da dívida
  document.getElementById('editDebtId').value = debt.id;
  document.getElementById('debtAmount').value = debt.amount;
  document.getElementById('debtDueDate').value = debt.dueDate;
  document.getElementById('debtResponsible').value = debt.responsible;
  document.getElementById('debtCategory').value = debt.category || '';
  document.getElementById('debtDescription').value = debt.description || '';

  // Setar tipo
  const debtType = (debt.debtType === 'parcelada') ? 'financiamento' : (debt.debtType || 'unica');
  document.getElementById('debtType').value = debtType;
  document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.debt-type-toggle[data-value="${debtType}"]`);

  // Credor: cartão usa select de cartão, empréstimo/financiamento usa select de banco, outros usam text input
  if (debtType === 'cartao') {
    document.getElementById('creditorTextGroup').style.display = 'none';
    document.getElementById('creditorCardGroup').style.display = 'block';
    document.getElementById('creditorBankGroup').style.display = 'none';
    document.getElementById('debtCreditor').removeAttribute('required');
    document.getElementById('debtCardIssuer').value = debt.creditor;
  } else if (debtType === 'emprestimo' || debtType === 'financiamento') {
    document.getElementById('creditorTextGroup').style.display = 'none';
    document.getElementById('creditorCardGroup').style.display = 'none';
    document.getElementById('creditorBankGroup').style.display = 'block';
    document.getElementById('debtCreditor').removeAttribute('required');
    document.getElementById('debtBankIssuer').value = debt.creditor;
  } else {
    document.getElementById('creditorTextGroup').style.display = 'block';
    document.getElementById('creditorCardGroup').style.display = 'none';
    document.getElementById('creditorBankGroup').style.display = 'none';
    document.getElementById('debtCreditor').setAttribute('required', '');
    document.getElementById('debtCreditor').value = debt.creditor;
  }
  if (activeBtn) activeBtn.classList.add('active');

  // Mostrar/esconder campos de parcelas e sub-opções do cartão
  const isFinanciamento = debtType === 'financiamento';
  const isEmprestimo = debtType === 'emprestimo';
  const isCartao = debtType === 'cartao';
  const cartaoMode = debt.cartaoMode || 'unica';
  const usesInstallments = isFinanciamento || isEmprestimo || (isCartao && cartaoMode === 'parcelado');

  document.getElementById('cartaoOptions').style.display = isCartao ? 'block' : 'none';
  if (isCartao) {
    document.getElementById('cartaoMode').value = cartaoMode;
    document.querySelectorAll('.cartao-mode-toggle').forEach(b => b.classList.remove('active'));
    const modeBtn = document.querySelector(`.cartao-mode-toggle[data-value="${cartaoMode}"]`);
    if (modeBtn) modeBtn.classList.add('active');
  }

  document.getElementById('installmentFields').style.display = usesInstallments ? 'block' : 'none';
  if (usesInstallments) {
    document.getElementById('debtInstallments').value = debt.installments || '';
    document.getElementById('debtInstallmentValue').value = debt.installmentValue || '';
    document.getElementById('debtPaidInstallments').value = debt.paidInstallments || 0;
    const remaining = debt.amount - ((debt.installmentValue || 0) * (debt.paidInstallments || 0));
    document.getElementById('debtRemainingValue').value = remaining.toFixed(2);
    document.getElementById('debtAmountLabel').textContent = 'Valor Total (R$)';
  } else if (debtType === 'fixa' || (isCartao && cartaoMode === 'recorrente')) {
    document.getElementById('debtAmountLabel').textContent = 'Valor Mensal (R$)';
  } else {
    document.getElementById('debtAmountLabel').textContent = 'Valor (R$)';
  }

  // Atualizar título e botão do modal
  document.getElementById('debtModalTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Editar dívida';
  document.getElementById('debtSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Salvar';

  // Abrir modal
  document.getElementById('debtModal').classList.add('active');
}

// ===== SETUP DEBT TYPE TOGGLE & INSTALLMENT FIELDS =====
function setupDebtTypeListeners() {
  document.querySelectorAll('.debt-type-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const val = this.dataset.value;
      document.getElementById('debtType').value = val;
      // Cartão: mostrar sub-opções; Financiamento/Empréstimo: mostrar parcelas + banco
      const cartaoOpts = document.getElementById('cartaoOptions');
      const installFields = document.getElementById('installmentFields');
      const bankGroup = document.getElementById('creditorBankGroup');
      if (val === 'cartao') {
        cartaoOpts.style.display = 'block';
        document.getElementById('creditorTextGroup').style.display = 'none';
        document.getElementById('creditorCardGroup').style.display = 'block';
        bankGroup.style.display = 'none';
        document.getElementById('debtCreditor').removeAttribute('required');
        const mode = document.getElementById('cartaoMode').value;
        installFields.style.display = mode === 'parcelado' ? 'block' : 'none';
      } else if (val === 'emprestimo' || val === 'financiamento') {
        cartaoOpts.style.display = 'none';
        document.getElementById('creditorTextGroup').style.display = 'none';
        document.getElementById('creditorCardGroup').style.display = 'none';
        bankGroup.style.display = 'block';
        document.getElementById('debtCreditor').removeAttribute('required');
        installFields.style.display = 'block';
      } else {
        cartaoOpts.style.display = 'none';
        document.getElementById('creditorTextGroup').style.display = 'block';
        document.getElementById('creditorCardGroup').style.display = 'none';
        bankGroup.style.display = 'none';
        document.getElementById('debtCreditor').setAttribute('required', '');
        installFields.style.display = 'none';
      }
      // Atualizar label do valor conforme tipo
      const amountLabel = document.getElementById('debtAmountLabel');
      if (val === 'financiamento' || val === 'emprestimo' || (val === 'cartao' && document.getElementById('cartaoMode').value === 'parcelado')) amountLabel.textContent = 'Valor Total (R$)';
      else if (val === 'fixa' || (val === 'cartao' && document.getElementById('cartaoMode').value === 'recorrente')) amountLabel.textContent = 'Valor Mensal (R$)';
      else amountLabel.textContent = 'Valor (R$)';
    });
  });

  // Sub-toggle do cartão
  document.querySelectorAll('.cartao-mode-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.cartao-mode-toggle').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const mode = this.dataset.value;
      document.getElementById('cartaoMode').value = mode;
      document.getElementById('installmentFields').style.display = mode === 'parcelado' ? 'block' : 'none';
      const amountLabel = document.getElementById('debtAmountLabel');
      if (mode === 'parcelado') amountLabel.textContent = 'Valor Total (R$)';
      else if (mode === 'recorrente') amountLabel.textContent = 'Valor Mensal (R$)';
      else amountLabel.textContent = 'Valor (R$)';
    });
  });

  // Calcular valor da parcela automaticamente
  const amountInput = document.getElementById('debtAmount');
  const installmentsInput = document.getElementById('debtInstallments');
  const paidInput = document.getElementById('debtPaidInstallments');
  const instValueInput = document.getElementById('debtInstallmentValue');

  // Quando valor total ou nº parcelas mudam, sugere o valor da parcela
  function updateInstallmentCalc() {
    const total = parseFloat(amountInput.value) || 0;
    const inst = parseInt(installmentsInput.value) || 1;
    const instValue = total / inst;
    instValueInput.value = instValue.toFixed(2);
    updateRemainingCalc();
  }

  // Recalcula o restante com base no valor da parcela (editável)
  function updateRemainingCalc() {
    const paid = parseInt(paidInput.value) || 0;
    const instValue = parseFloat(instValueInput.value) || 0;
    const total = parseFloat(amountInput.value) || 0;
    const remaining = total - (instValue * paid);
    document.getElementById('debtRemainingValue').value = remaining.toFixed(2);
  }

  if (amountInput) amountInput.addEventListener('input', updateInstallmentCalc);
  if (installmentsInput) installmentsInput.addEventListener('input', updateInstallmentCalc);
  if (instValueInput) instValueInput.addEventListener('input', updateRemainingCalc);
  if (paidInput) paidInput.addEventListener('input', updateRemainingCalc);
}

// ===== ADICIONAR SALÁRIO =====
// Variáveis temporárias para descontos e acréscimos do modal
let tempDeductions = [];
let tempAdditions = [];

function addSalary(e) {
  e.preventDefault();
  
  const grossAmount = parseFloat(document.getElementById('salaryAmount').value);
  const totalAdditionsVal = tempAdditions.reduce((sum, a) => sum + a.value, 0);
  const totalDeductionsVal = tempDeductions.reduce((sum, d) => sum + d.value, 0);
  const netAmount = grossAmount + totalAdditionsVal - totalDeductionsVal;

  const familyId = getFamilyId();
  if (!familyId) {
    showAlert('Erro: família não identificada. Faça login novamente.', 'danger');
    return;
  }

  const salary = {
    id: generateId(),
    person: document.getElementById('salaryPerson').value,
    amount: netAmount,
    grossAmount: grossAmount,
    additions: tempAdditions.length > 0 ? [...tempAdditions] : [],
    totalAdditions: totalAdditionsVal,
    deductions: tempDeductions.length > 0 ? [...tempDeductions] : [],
    totalDeductions: totalDeductionsVal,
    date: document.getElementById('salaryDate').value,
    description: document.getElementById('salaryDescription').value,
    familyId: familyId,
    createdAt: new Date().toISOString()
  };
  
  if (!salary.person || !grossAmount || !salary.date) {
    alert('Por favor, preencha todos os campos obrigatórios!');
    return;
  }
  
  state.salaries.push(salary);
  saveDataToStorage();
  saveToFirebase('salaries', salary);
  
  showAlert('Entrada registrada com sucesso!', 'success');
  
  // Reset and close modal
  e.target.reset();
  tempDeductions = [];
  tempAdditions = [];
  updateDeductionsUI();
  updateAdditionsUI();
  document.getElementById('salaryModal').classList.remove('active');
  
  // Update displays
  updateSalaryDisplay();
  updateDashboard();
}

// ===== ACRÉSCIMOS E DESCONTOS DO SALÁRIO =====
function setupDeductionListeners() {
  // Toggle Acréscimos
  const toggleAddBtn = document.getElementById('toggleAdditionsBtn');
  const addBody = document.getElementById('additionsBody');
  if (toggleAddBtn && addBody) {
    toggleAddBtn.addEventListener('click', () => {
      const isOpen = addBody.classList.toggle('open');
      const chevron = toggleAddBtn.querySelector('.deductions-chevron');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
    });
  }

  const addAddBtn = document.getElementById('addAdditionBtn');
  if (addAddBtn) {
    addAddBtn.addEventListener('click', addAddition);
  }

  // Toggle Descontos
  const toggleBtn = document.getElementById('toggleDeductionsBtn');
  const body = document.getElementById('deductionsBody');
  if (toggleBtn && body) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = body.classList.toggle('open');
      const chevron = toggleBtn.querySelector('.deductions-chevron');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
    });
  }

  const addDeductBtn = document.getElementById('addDeductionBtn');
  if (addDeductBtn) {
    addDeductBtn.addEventListener('click', addDeduction);
  }

  // Atualizar preview do salário líquido quando bruto mudar
  const salaryAmountInput = document.getElementById('salaryAmount');
  if (salaryAmountInput) {
    salaryAmountInput.addEventListener('input', updateNetSalaryPreview);
  }
}

// --- Acréscimos ---
function addAddition() {
  const nameInput = document.getElementById('additionName');
  const valueInput = document.getElementById('additionValue');
  const name = nameInput.value.trim();
  const value = parseFloat(valueInput.value);

  if (!name || !value || value <= 0) {
    showAlert('Preencha nome e valor do acréscimo.', 'warning');
    return;
  }

  tempAdditions.push({ id: generateId(), name, value });
  nameInput.value = '';
  valueInput.value = '';
  updateAdditionsUI();
}

function removeAddition(id) {
  tempAdditions = tempAdditions.filter(a => a.id !== id);
  updateAdditionsUI();
}

function updateAdditionsUI() {
  const container = document.getElementById('additionsList');
  if (!container) return;

  container.innerHTML = tempAdditions.map(a => `
    <div class="deduction-item addition-item">
      <span class="deduction-name">${esc(a.name)}</span>
      <span class="addition-value-tag">+ ${formatCurrency(a.value)}</span>
      <button type="button" class="btn-remove-deduction" onclick="removeAddition('${a.id}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join('');

  const total = tempAdditions.reduce((sum, a) => sum + a.value, 0);
  const totalEl = document.getElementById('totalAdditions');
  if (totalEl) totalEl.textContent = formatCurrency(total);

  updateNetSalaryPreview();
}

// --- Descontos ---
function addDeduction() {
  const nameInput = document.getElementById('deductionName');
  const valueInput = document.getElementById('deductionValue');
  const name = nameInput.value.trim();
  const value = parseFloat(valueInput.value);

  if (!name || !value || value <= 0) {
    showAlert('Preencha nome e valor do desconto.', 'warning');
    return;
  }

  tempDeductions.push({ id: generateId(), name, value });
  nameInput.value = '';
  valueInput.value = '';
  updateDeductionsUI();
}

function removeDeduction(id) {
  tempDeductions = tempDeductions.filter(d => d.id !== id);
  updateDeductionsUI();
}

function updateDeductionsUI() {
  const container = document.getElementById('deductionsList');
  if (!container) return;

  container.innerHTML = tempDeductions.map(d => `
    <div class="deduction-item">
      <span class="deduction-name">${esc(d.name)}</span>
      <span class="deduction-value">- ${formatCurrency(d.value)}</span>
      <button type="button" class="btn-remove-deduction" onclick="removeDeduction('${d.id}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join('');

  const total = tempDeductions.reduce((sum, d) => sum + d.value, 0);
  const totalEl = document.getElementById('totalDeductions');
  if (totalEl) totalEl.textContent = formatCurrency(total);

  updateNetSalaryPreview();
}

// --- Preview líquido ---
function updateNetSalaryPreview() {
  const gross = parseFloat(document.getElementById('salaryAmount').value) || 0;
  const totalAdd = tempAdditions.reduce((sum, a) => sum + a.value, 0);
  const totalDed = tempDeductions.reduce((sum, d) => sum + d.value, 0);
  const net = gross + totalAdd - totalDed;
  const netEl = document.getElementById('netSalaryPreview');
  if (netEl) netEl.textContent = formatCurrency(net);
}

// ===== ATUALIZAR DASHBOARD =====
function updateDashboard() {
  const monthVal = document.getElementById('monthFilter').value;
  let month, year;
  if (monthVal) {
    const parts = monthVal.split('-');
    year = parseInt(parts[0]);
    month = parseInt(parts[1]) - 1;
  } else {
    const now = new Date();
    month = now.getMonth();
    year = now.getFullYear();
  }
  
  // Filter data for current month (usando T12:00:00 para evitar bug de fuso horário)
  const monthTransactions = state.transactions.filter(t => {
    const tDate = new Date(t.date + 'T12:00:00');
    return tDate.getMonth() === month && tDate.getFullYear() === year;
  });
  
  // Salários do mês
  const monthSalaries = state.salaries.filter(s => {
    const sDate = new Date(s.date + 'T12:00:00');
    return sDate.getMonth() === month && sDate.getFullYear() === year;
  });
  
  const monthDebts = state.debts.filter(d => d.status === 'active');
  
  // Calculate KPIs
  const totalExpenses = monthTransactions
    .filter(t => t.type === 'saida')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalTransactionIncome = monthTransactions
    .filter(t => t.type === 'entrada')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalSalaryIncome = monthSalaries
    .reduce((sum, s) => sum + s.amount, 0);
  
  const totalIncome = totalTransactionIncome + totalSalaryIncome;
  const totalBalance = totalIncome - totalExpenses;
  const totalDebt = monthDebts.reduce((sum, d) => sum + d.amount, 0);
  const responsibleCount = new Set(monthTransactions.map(t => t.responsible)).size;

  // Separar dívidas ativas: mensais vs financiamentos
  const isInstallmentType = d => (d.debtType === 'financiamento' || d.debtType === 'parcelada') || (d.debtType === 'cartao' && d.cartaoMode === 'parcelado');
  const monthlyDebtsActive = monthDebts.filter(d => !isInstallmentType(d));
  const financingDebtsActive = monthDebts.filter(d => isInstallmentType(d));
  const totalMonthlyDebts = monthlyDebtsActive.reduce((sum, d) => sum + d.amount, 0);
  const totalFinancingInstallment = financingDebtsActive.reduce((sum, d) => sum + (d.installmentValue || d.amount), 0);
  const totalFinancingRemaining = financingDebtsActive.reduce((sum, d) => {
    const instVal = d.installmentValue || (d.amount / (d.installments || 1));
    const paid = d.paidInstallments || 0;
    return sum + (d.amount - (instVal * paid));
  }, 0);

  // Dívidas pagas no mês (pela data do pagamento via transação)
  const paidDebtsThisMonth = state.transactions.filter(t => {
    if (!t.fromDebt) return false;
    const tDate = new Date(t.date + 'T12:00:00');
    return tDate.getMonth() === month && tDate.getFullYear() === year;
  });
  const totalPaidDebts = paidDebtsThisMonth.reduce((sum, t) => sum + t.amount, 0);

  // Descontos do mês
  const totalMonthDeductions = monthSalaries.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);
  
  // Update KPI Cards
  document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
  document.getElementById('totalSpent').textContent = formatCurrency(totalDebt);
  document.getElementById('totalResponsible').textContent = responsibleCount;
  
  // Dívidas mensais vs financiamentos no dashboard
  const dashMonthly = document.getElementById('dashMonthlyDebts');
  if (dashMonthly) dashMonthly.textContent = formatCurrency(totalMonthlyDebts);
  const dashMonthlyCount = document.getElementById('dashMonthlyCount');
  if (dashMonthlyCount) dashMonthlyCount.textContent = `${monthlyDebtsActive.length} ativa${monthlyDebtsActive.length !== 1 ? 's' : ''}`;
  const dashFinancing = document.getElementById('dashFinancingDebts');
  if (dashFinancing) dashFinancing.textContent = formatCurrency(totalFinancingInstallment);
  const dashFinancingRem = document.getElementById('dashFinancingRemaining');
  if (dashFinancingRem) dashFinancingRem.textContent = `Restante: ${formatCurrency(totalFinancingRemaining)}`;

  const paidDebtsEl = document.getElementById('totalPaidDebts');
  if (paidDebtsEl) paidDebtsEl.textContent = formatCurrency(totalPaidDebts);

  const deductionsDashEl = document.getElementById('totalDeductionsDash');
  if (deductionsDashEl) deductionsDashEl.textContent = formatCurrency(totalMonthDeductions);
  // Income card on dashboard
  const incomeEl = document.getElementById('totalIncomeDash');
  if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);
  
  // Update Charts
  updateCharts(monthTransactions, monthDebts);
  
  // Update Recent Transactions
  updateRecentTransactions(monthTransactions);
}

// ===== ATUALIZAR GRÁFICOS =====
function updateCharts(transactions, debts) {
  // Destroy previous charts
  Object.values(state.charts).forEach(chart => { if (chart) chart.destroy(); });
  state.charts = {};

  state.charts.sparkline  = createBalanceSparkline(transactions);
  state.charts.category   = createCategoryChart(transactions);
  state.charts.responsible = createResponsibleChart(transactions);
  state.charts.incomes    = createIncomesChart(state.salaries);
  state.charts.debtType   = createDebtTypeChart(debts);
}

// ===== SPARKLINE — BALANCE MENSAL =====
function createBalanceSparkline(transactions) {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return null;

  const monthVal = document.getElementById('monthFilter').value;
  let month, year;
  if (monthVal) {
    const parts = monthVal.split('-');
    year = parseInt(parts[0]);
    month = parseInt(parts[1]) - 1;
  } else {
    const now = new Date();
    month = now.getMonth();
    year = now.getFullYear();
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyNet = Array(daysInMonth).fill(0);
  transactions.forEach(t => {
    const d = new Date(t.date + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      const idx = d.getDate() - 1;
      dailyNet[idx] += t.type === 'entrada' ? t.amount : -t.amount;
    }
  });

  // Cumulative
  let cum = 0;
  const cumData = dailyNet.map(v => { cum += v; return cum; });
  const labels  = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Se não há movimentação, não renderizar sparkline
  const hasData = cumData.some(v => v !== 0);
  if (!hasData) {
    ctx.style.display = 'none';
    return null;
  }
  ctx.style.display = '';

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: cumData,
        borderColor: '#F72585',
        backgroundColor: 'rgba(247,37,133,0.10)',
        tension: 0.42,
        fill: true,
        pointRadius: 0,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: { display: false, grid: { display: false } }
      },
      animation: { duration: 800, easing: 'easeInOutQuart' }
    }
  });
}

// ===== GRÁFICO POR CATEGORIA =====
function createCategoryChart(transactions) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return null;

  const categories = {};
  transactions.filter(t => t.type === 'saida').forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + t.amount;
  });

  // Se não houver dados, não renderizar gráfico
  if (Object.keys(categories).length === 0) return null;

  const COLORS = ['#F72585','#4CC9F0','#7209B7','#4361EE','#06D6A0','#F8961E','#4895EF','#9CA3AF'];

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(categories).map(k => CATEGORY_MAP[k]?.label || k),
      datasets: [{ data: Object.values(categories), backgroundColor: COLORS, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } }
      },
      cutout: '60%',
      animation: { duration: 800 }
    }
  });
}

// ===== GRÁFICO POR RESPONSÁVEL =====
function createResponsibleChart(transactions) {
  const ctx = document.getElementById('responsibleChart');
  if (!ctx) return null;

  const responsible = {};
  transactions.forEach(t => {
    if (!responsible[t.responsible]) responsible[t.responsible] = { entrada: 0, saida: 0 };
    responsible[t.responsible][t.type] += t.amount;
  });

  // Se não houver dados, não renderizar gráfico
  if (Object.keys(responsible).length === 0) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(responsible),
      datasets: [
        { label: 'Receitas', data: Object.values(responsible).map(r => r.entrada), backgroundColor: '#4CC9F0', borderRadius: 6 },
        { label: 'Despesas', data: Object.values(responsible).map(r => r.saida),  backgroundColor: '#F72585', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      animation: { duration: 800 }
    }
  });
}

// ===== GRÁFICO DE SALÁRIOS =====
function createIncomesChart(salaries) {
  const ctx = document.getElementById('incomesChart');
  if (!ctx) return null;

  const members = state.familyMembers || [];
  const chartColors = ['#4361EE', '#F72585', '#06D6A0', '#FF6B35', '#8B5CF6', '#14B8A6'];

  const incomesData = {};
  salaries.forEach(s => {
    const date = new Date(s.date + 'T12:00:00');
    const key  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!incomesData[key]) {
      incomesData[key] = {};
      members.forEach(m => { incomesData[key][m.name] = 0; });
    }
    if (incomesData[key][s.person] !== undefined) {
      incomesData[key][s.person] += s.amount;
    }
  });

  const months = Object.keys(incomesData).sort();

  // Se não houver dados, não renderizar gráfico
  if (months.length === 0) return null;

  const datasets = members.map((m, i) => ({
    label: m.name,
    data: months.map(mo => incomesData[mo][m.name] || 0),
    backgroundColor: chartColors[i % chartColors.length],
    borderRadius: 6
  }));

  return new Chart(ctx, {
    type: 'bar',
    data: { labels: months, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      animation: { duration: 800 }
    }
  });
}

// ===== GRÁFICO POR TIPO DE DÍVIDA =====
function createDebtTypeChart(debts) {
  const ctx = document.getElementById('debtTypeChart');
  if (!ctx) return null;

  const typeMap = {
    unica: { label: 'Únicas', color: '#9CA3AF' },
    fixa: { label: 'Fixas', color: '#FF9F43' },
    cartao: { label: 'Cartão', color: '#8B5CF6' },
    emprestimo: { label: 'Empréstimo', color: '#06D6A0' },
    financiamento: { label: 'Financiamento', color: '#4361EE' },
    parcelada: { label: 'Financiamento', color: '#4361EE' }
  };

  const totals = {};
  debts.forEach(d => {
    const key = (d.debtType === 'parcelada') ? 'financiamento' : (d.debtType || 'unica');
    const val = (key === 'financiamento' || key === 'emprestimo' || (key === 'cartao' && d.cartaoMode === 'parcelado'))
      ? (d.installmentValue || d.amount)
      : d.amount;
    if (!totals[key]) totals[key] = 0;
    totals[key] += val;
  });

  const keys = Object.keys(totals);
  if (keys.length === 0) return null;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: keys.map(k => typeMap[k]?.label || k),
      datasets: [{
        data: keys.map(k => totals[k]),
        backgroundColor: keys.map(k => typeMap[k]?.color || '#9CA3AF'),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '60%',
      animation: { duration: 800 }
    }
  });
}

// ===== ATUALIZAR TRANSAÇÕES RECENTES =====
function updateRecentTransactions(transactions) {
  const container = document.getElementById('recentTransactionsList');
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = emptyState('Nenhuma transação este mês');
    return;
  }

  const recent = transactions.slice(-5).reverse();
  container.innerHTML = recent.map(t => renderTransactionItem(t)).join('');
}

// ===== HELPER — RENDER TRANSACTION ITEM =====
function renderTransactionItem(t) {
  const cat   = CATEGORY_MAP[t.category] || { icon: '📁', label: t.category, css: 'cat-outros' };
  const isIn  = t.type === 'entrada';
  const iconCss = isIn ? 'cat-entrada' : cat.css;
  const icon    = isIn ? '💰' : cat.icon;
  const sign    = isIn ? '+' : '−';
  const amtClass = isIn ? 'entrada' : 'saida';
  const catLabel = isIn ? 'Receita' : cat.label;

  return `
    <div class="transaction-item">
      <div class="trans-icon-wrap ${iconCss}">${icon}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(t.description) || catLabel}</div>
        <div class="trans-meta">
          <span>${formatDate(t.date)}</span>
          <span>·</span>
          <span class="trans-cat-badge ${iconCss}">${catLabel}</span>
          <span>·</span>
          <span>${esc(t.responsible)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="trans-amount ${amtClass}">${sign}${formatCurrency(t.amount)}</div>
        <button onclick="deleteTransaction('${t.id}')" class="btn-delete" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`;
}

// ===== ATUALIZAR HISTÓRICO DE TRANSAÇÕES =====
function updateTransactionHistory() {
  const container = document.getElementById('transactionHistoryList');
  if (!container) return;

  const monthVal = document.getElementById('historyMonth')?.value;
  const filter   = document.getElementById('historyFilter')?.value || 'all';

  let filtered = state.transactions;

  // Filter by selected day OR by month
  if (state.selectedDay) {
    filtered = filtered.filter(t => t.date === state.selectedDay);
  } else if (monthVal) {
    filtered = filtered.filter(t => t.date.startsWith(monthVal));
  }

  if (filter !== 'all') {
    filtered = filtered.filter(t => t.type === filter);
  }

  if (filtered.length === 0) {
    container.innerHTML = emptyState(state.selectedDay ? 'Nenhuma transação neste dia' : 'Nenhuma transação encontrada');
    return;
  }

  // Group by date
  const grouped = {};
  filtered.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });

  container.innerHTML = Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const dayTotal = items.reduce((s, t) => s + (t.type === 'entrada' ? t.amount : -t.amount), 0);
      const totalColor = dayTotal >= 0 ? 'var(--income-dark)' : 'var(--expense)';
      return `
        <div class="transaction-day-group">
          <div class="trans-day-header">
            <span class="trans-day-label">${formatDate(date)}</span>
            <span class="trans-day-total" style="color:${totalColor}">${dayTotal >= 0 ? '+' : ''}${formatCurrency(dayTotal)}</span>
          </div>
          ${items.map(t => renderTransactionItem(t)).join('')}
        </div>`;
    }).join('');
}

// ===== ATUALIZAR LISTA DE DÍVIDAS =====
function updateDebtsList() {
  const container = document.getElementById('debtsList');
  
  const activeDebts = state.debts.filter(d => d.status === 'active');

  // Separar: mensal (fixa + única + cartão não-parcelado) vs financiamento/parcelado/empréstimo
  const isInstType = d => (d.debtType === 'financiamento' || d.debtType === 'parcelada' || d.debtType === 'emprestimo') || (d.debtType === 'cartao' && d.cartaoMode === 'parcelado');
  const monthlyDebts = activeDebts.filter(d => !isInstType(d));
  const financingDebts = activeDebts.filter(d => isInstType(d));

  // Total mensal = soma dos amounts de únicas/fixas
  const totalMonthly = monthlyDebts.reduce((sum, d) => sum + d.amount, 0);
  // Total financiamento = soma das parcelas mensais (installmentValue)
  const totalFinancing = financingDebts.reduce((sum, d) => sum + (d.installmentValue || d.amount), 0);
  // Total restante dos financiamentos
  const totalFinancingRemaining = financingDebts.reduce((sum, d) => {
    const instVal = d.installmentValue || (d.amount / (d.installments || 1));
    const paid = d.paidInstallments || 0;
    return sum + (d.amount - (instVal * paid));
  }, 0);
  
  const activeCount = activeDebts.length;

  const totalPaid = state.debts
    .filter(d => d.status === 'paid')
    .reduce((sum, d) => sum + d.amount, 0);
  
  document.getElementById('totalDebts').textContent = formatCurrency(totalMonthly);
  const financingEl = document.getElementById('totalFinancing');
  if (financingEl) financingEl.textContent = formatCurrency(totalFinancing);
  document.getElementById('activeDebts').textContent = activeCount;
  const paidTabEl = document.getElementById('totalPaidDebtsTab');
  if (paidTabEl) paidTabEl.textContent = formatCurrency(totalPaid);

  // Contadores e restante na aba de dívidas
  const monthlyCountEl = document.getElementById('monthlyDebtCount');
  if (monthlyCountEl) monthlyCountEl.textContent = `${monthlyDebts.length} dívida${monthlyDebts.length !== 1 ? 's' : ''}`;
  const financingCountEl = document.getElementById('financingDebtCount');
  if (financingCountEl) financingCountEl.textContent = `${financingDebts.length} dívida${financingDebts.length !== 1 ? 's' : ''}`;
  const financingRemEl = document.getElementById('financingRemaining');
  if (financingRemEl) financingRemEl.textContent = `Restante: ${formatCurrency(totalFinancingRemaining)}`;

  // Cartão por pessoa (dinâmico por membros da família)
  const cardDebts = activeDebts.filter(d => d.debtType === 'cartao');
  const cardAmbosByPerson = cardDebts.filter(d => d.responsible === 'Ambos');
  const members = state.familyMembers || [];
  const memberCount = members.length || 1;

  members.forEach(m => {
    const slug = m.name.replace(/\s+/g, '_');
    const personal = cardDebts.filter(d => d.responsible === m.name);
    const total = personal.reduce((s, d) => s + (d.installmentValue || d.amount), 0)
      + cardAmbosByPerson.reduce((s, d) => s + (d.installmentValue || d.amount) / memberCount, 0);
    const count = personal.length + cardAmbosByPerson.length;

    const totalEl = document.getElementById(`cardTotal_${slug}`);
    if (totalEl) totalEl.textContent = formatCurrency(total);
    const countEl = document.getElementById(`cardCount_${slug}`);
    if (countEl) countEl.textContent = `${count} dívida${count !== 1 ? 's' : ''}`;
  });
  if (state.debts.length === 0) {
    container.innerHTML = emptyState('Nenhuma dívida registrada ✅');
    return;
  }
  
  const sorted = state.debts.sort((a, b) => {
    // Ativas primeiro, pagas por último
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return new Date(a.dueDate + 'T12:00:00') - new Date(b.dueDate + 'T12:00:00');
  });
  
  container.innerHTML = sorted.map(d => {
    const dueDate = new Date(d.dueDate + 'T12:00:00');
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    let statusBadge = 'active';
    let statusLabel = 'Ativa';
    if (d.status === 'paid') { statusBadge = 'paid'; statusLabel = 'Paga'; }
    else if (daysUntilDue < 0) { statusBadge = 'overdue'; statusLabel = 'Atrasada'; }
    else if (daysUntilDue < 7) { statusBadge = 'due-soon'; statusLabel = `${daysUntilDue}d restantes`; }

    // Informação de parcelas
    const cartaoMode = d.cartaoMode || 'unica';
    const isFinanciamento = ((d.debtType === 'financiamento' || d.debtType === 'parcelada') && d.installments > 1)
                         || (d.debtType === 'cartao' && cartaoMode === 'parcelado' && d.installments > 1);
    const isEmprestimo = d.debtType === 'emprestimo' && d.installments > 1;
    const isFixa = d.debtType === 'fixa' || (d.debtType === 'cartao' && cartaoMode === 'recorrente');
    const isCartao = d.debtType === 'cartao';
    const hasInstallments = isFinanciamento || isEmprestimo;
    const paidInst = d.paidInstallments || 0;
    const instValue = d.installmentValue || (d.amount / (d.installments || 1));
    const remaining = d.amount - (instValue * paidInst);
    const catInfo = d.category ? CATEGORY_MAP[d.category] : null;

    // Tipo badge
    let typeBadge = '';
    let typeIcon = '';
    // Mapa de bancos → imagem
    const BANK_IMG = {
      'Nubank': 'img/1.png',
      'Itaú': 'img/2.avif',
      'Porto Seguro': 'img/3.png',
      'Caixa': 'img/4.png',
      'Mercado Pago': 'img/5.jpg',
      'Banco do Brasil': 'img/6.png',
      'Santander': 'img/7.png'
    };
    const bankImg = (isCartao || isEmprestimo || isFinanciamento) && BANK_IMG[d.creditor]
      ? `<img src="${BANK_IMG[d.creditor]}" alt="${esc(d.creditor)}" class="debt-bank-logo">`
      : '';

    if (isCartao && isFinanciamento) { typeBadge = 'Cartão Parcelado'; typeIcon = bankImg || '<i class="fa-solid fa-credit-card"></i>'; }
    else if (isCartao && isFixa) { typeBadge = 'Cartão Recorrente'; typeIcon = bankImg || '<i class="fa-solid fa-credit-card"></i>'; }
    else if (isCartao) { typeBadge = 'Cartão'; typeIcon = bankImg || '<i class="fa-solid fa-credit-card"></i>'; }
    else if (isEmprestimo) { typeBadge = 'Empréstimo'; typeIcon = bankImg || '<i class="fa-solid fa-hand-holding-dollar"></i>'; }
    else if (isFinanciamento) { typeBadge = 'Financiamento'; typeIcon = bankImg || '<i class="fa-solid fa-building-columns"></i>'; }
    else if (isFixa) { typeBadge = 'Fixa'; typeIcon = '<i class="fa-solid fa-rotate"></i>'; }
    
    let installmentHtml = '';
    if (hasInstallments) {
      const progressPct = Math.round((paidInst / d.installments) * 100);
      installmentHtml = `
        <div class="debt-installment-info">
          <div class="debt-installment-bar">
            <div class="debt-installment-progress" style="width:${progressPct}%"></div>
          </div>
          <span class="debt-installment-text">${paidInst}/${d.installments} parcelas · Parcela: ${formatCurrency(instValue)}</span>
          <span class="debt-installment-remaining">Restante: ${formatCurrency(remaining)}</span>
        </div>`;
    }
    
    // Botão de ação
    let payBtnLabel = 'Pagar';
    if (hasInstallments) payBtnLabel = 'Pagar parcela';
    else if (isCartao && isFixa) payBtnLabel = 'Pagar fatura';
    else if (isFixa) payBtnLabel = 'Pagar mês';

    return `
      <div class="debt-item ${d.status === 'paid' ? 'debt-paid' : ''} ${hasInstallments ? 'debt-financing' : ''} ${isEmprestimo ? 'debt-emprestimo' : ''} ${isCartao ? 'debt-cartao' : ''} ${isFixa && !isCartao ? 'debt-fixed' : ''}" data-debt-id="${d.id}">
        <div class="debt-item-header">
          <div class="debt-type-icon ${isCartao ? 'type-cartao' : isEmprestimo ? 'type-emprestimo' : isFinanciamento ? 'type-financing' : isFixa ? 'type-fixed' : 'type-unica'}">
            ${typeIcon || '<i class="fa-solid fa-receipt"></i>'}
          </div>
          <div class="debt-header-info">
            <span class="debt-creditor">${esc(d.creditor)}</span>
            <span class="debt-type-label">${typeBadge || 'Única'}</span>
          </div>
          <div class="debt-header-right">
            <span class="debt-amount-badge">${hasInstallments ? formatCurrency(instValue) : formatCurrency(d.amount)}</span>
            <span class="debt-status-badge ${statusBadge}">${statusLabel}</span>
          </div>
        </div>
        ${installmentHtml}
        <div class="debt-details-grid">
          <div class="debt-detail-item">
            <i class="fa-solid fa-user"></i>
            <span>${esc(d.responsible)}</span>
          </div>
          <div class="debt-detail-item">
            <i class="fa-solid fa-calendar"></i>
            <span>${formatDate(d.dueDate)}</span>
          </div>
          ${catInfo ? `<div class="debt-detail-item"><span class="debt-detail-cat-icon">${catInfo.icon}</span><span>${catInfo.label}</span></div>` : ''}
          ${d.description ? `<div class="debt-detail-item debt-detail-full"><i class="fa-solid fa-comment"></i><span>${esc(d.description)}</span></div>` : ''}
        </div>
        <div class="debt-item-actions">
          ${d.status !== 'paid' ? `<button onclick="editDebt('${d.id}')" class="debt-action-btn debt-btn-edit" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
          ${d.status !== 'paid' ? `<button onclick="payDebt('${d.id}')" class="debt-action-btn debt-btn-pay"><i class="fa-solid fa-circle-check"></i> ${payBtnLabel}</button>` : ''}
          <button onclick="deleteDebt('${d.id}')" class="debt-action-btn debt-btn-delete" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>`;
  }).join('');

  // Atualizar alertas de vencimento
  updateDebtAlerts();

  // Reaplicar filtro ativo (se houver)
  if (currentDebtFilter) applyDebtFilter();
}

// ===== ALERTAS DE VENCIMENTO =====
function updateDebtAlerts() {
  const container = document.getElementById('debtAlerts');
  const bellBtn = document.getElementById('debtAlertsBell');
  const badgeEl = document.getElementById('debtAlertsBadge');
  if (!container || !bellBtn || !badgeEl) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeDebts = state.debts.filter(d => d.status === 'active');
  const alerts = [];

  activeDebts.forEach(d => {
    const dueDate = new Date(d.dueDate + 'T12:00:00');
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      alerts.push({
        type: 'overdue',
        icon: 'fa-circle-exclamation',
        label: `<strong>${esc(d.creditor)}</strong> venceu há ${Math.abs(diffDays)} dia(s) — ${formatCurrency(d.installmentValue || d.amount)}`,
        days: diffDays
      });
    } else if (diffDays === 0) {
      alerts.push({
        type: 'today',
        icon: 'fa-bell',
        label: `<strong>${esc(d.creditor)}</strong> vence <strong>hoje</strong> — ${formatCurrency(d.installmentValue || d.amount)}`,
        days: diffDays
      });
    } else if (diffDays <= 7) {
      alerts.push({
        type: 'soon',
        icon: 'fa-clock',
        label: `<strong>${esc(d.creditor)}</strong> vence em ${diffDays} dia(s) (${formatDate(d.dueDate)}) — ${formatCurrency(d.installmentValue || d.amount)}`,
        days: diffDays
      });
    }
  });

  // Ordenar: atrasadas primeiro, depois por proximidade
  alerts.sort((a, b) => a.days - b.days);

  if (alerts.length === 0) {
    container.innerHTML = '';
    bellBtn.style.display = 'none';
    return;
  }

  bellBtn.style.display = 'flex';
  badgeEl.textContent = alerts.length;
  
  // Set bell color based on severity
  bellBtn.classList.remove('has-alerts', 'has-overdue');
  if (alerts.some(a => a.type === 'overdue')) {
    bellBtn.classList.add('has-overdue');
  } else {
    bellBtn.classList.add('has-alerts');
  }

  container.innerHTML = alerts.map(a => `
    <div class="debt-alert debt-alert-${a.type}">
      <i class="fa-solid ${a.icon}"></i>
      <span>${a.label}</span>
    </div>
  `).join('');
}

// ===== BELL TOGGLE =====
document.addEventListener('click', (e) => {
  const bellBtn = document.getElementById('debtAlertsBell');
  const dropdown = document.getElementById('debtAlertsDropdown');
  if (!bellBtn || !dropdown) return;
  
  if (bellBtn.contains(e.target)) {
    dropdown.classList.toggle('open');
  } else if (!dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

// ===== DEBT FILTER BY OVERVIEW CARD =====
let currentDebtFilter = null;

function setupDebtFilterListeners() {
  document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter;
      
      // Toggle: click same card again to clear
      if (currentDebtFilter === filter) {
        clearDebtFilter();
        return;
      }
      
      currentDebtFilter = filter;
      
      // Update active states
      document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(c => c.classList.remove('filter-active'));
      card.classList.add('filter-active');
      
      // Show filter bar
      const filterBar = document.getElementById('debtFilterBar');
      const filterLabel = document.getElementById('debtFilterLabel');
      const labels = {
        'monthly': 'Mensais (Fixas + Únicas)',
        'financing': 'Financiamentos',
        'all': 'Todas Ativas',
        'paid': 'Pagas'
      };
      // Labels dinâmicos para cartões por membro
      (state.familyMembers || []).forEach(m => {
        const slug = m.name.replace(/\s+/g, '_');
        labels[`cartao-${slug}`] = `Cartão ${m.name}`;
      });
      filterLabel.innerHTML = `<i class="fa-solid fa-filter"></i> ${labels[filter] || filter}`;
      filterBar.classList.add('show');
      
      applyDebtFilter();
    });
  });
}

function clearDebtFilter() {
  currentDebtFilter = null;
  document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(c => c.classList.remove('filter-active'));
  document.getElementById('debtFilterBar').classList.remove('show');
  
  // Show all debt items
  document.querySelectorAll('#debtsList .debt-item').forEach(el => {
    el.style.display = '';
  });
}

function applyDebtFilter() {
  if (!currentDebtFilter) return;
  
  const items = document.querySelectorAll('#debtsList .debt-item');
  
  items.forEach(el => {
    const debtId = el.dataset.debtId;
    
    if (!debtId) { el.style.display = ''; return; }
    
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) { el.style.display = ''; return; }
    
    let show = false;
    const cartaoMode = debt.cartaoMode || 'unica';
    const isInstType = (debt.debtType === 'financiamento' || debt.debtType === 'parcelada' || debt.debtType === 'emprestimo') || (debt.debtType === 'cartao' && cartaoMode === 'parcelado');
    
    switch (currentDebtFilter) {
      case 'monthly':
        show = debt.status === 'active' && !isInstType;
        break;
      case 'financing':
        show = debt.status === 'active' && isInstType;
        break;
      case 'all':
        show = debt.status === 'active';
        break;
      case 'paid':
        show = debt.status === 'paid';
        break;
      default:
        // Filtros dinâmicos de cartão por membro: "cartao-NomeMembro"
        if (currentDebtFilter.startsWith('cartao-')) {
          const memberSlug = currentDebtFilter.replace('cartao-', '');
          const memberName = (state.familyMembers || []).find(m => m.name.replace(/\s+/g, '_') === memberSlug)?.name;
          if (memberName) {
            show = debt.status === 'active' && debt.debtType === 'cartao' && (debt.responsible === memberName || debt.responsible === 'Ambos');
          } else {
            show = true;
          }
        } else {
          show = true;
        }
    }
    
    el.style.display = show ? '' : 'none';
  });
}
function updateSalaryDisplay() {
  const members = state.familyMembers || [];
  
  // Mês selecionado no filtro do dashboard (ou mês atual)
  const monthVal = document.getElementById('monthFilter').value;
  let curMonth, curYear;
  if (monthVal) {
    const parts = monthVal.split('-');
    curYear = parseInt(parts[0]);
    curMonth = parseInt(parts[1]) - 1;
  } else {
    const now = new Date();
    curMonth = now.getMonth();
    curYear = now.getFullYear();
  }

  let combinedMonth = 0, combinedAnnual = 0;

  members.forEach(m => {
    const slug = m.name.replace(/\s+/g, '_');
    const personSalaries = state.salaries.filter(s => s.person === m.name);
    const annual = personSalaries.reduce((sum, s) => sum + s.amount, 0);
    const monthly = personSalaries
      .filter(s => { const d = new Date(s.date + 'T12:00:00'); return d.getMonth() === curMonth && d.getFullYear() === curYear; })
      .reduce((sum, s) => sum + s.amount, 0);

    combinedMonth += monthly;
    combinedAnnual += annual;

    const salEl = document.getElementById(`salary_${slug}`);
    if (salEl) salEl.textContent = formatCurrency(monthly);
    const annEl = document.getElementById(`annual_${slug}`);
    if (annEl) annEl.textContent = `Anual: ${formatCurrency(annual)}`;
  });

  const combSalEl = document.getElementById('combinedSalary');
  if (combSalEl) combSalEl.textContent = formatCurrency(combinedMonth);
  const combAnnEl = document.getElementById('combinedAnnual');
  if (combAnnEl) combAnnEl.textContent = `Anual: ${formatCurrency(combinedAnnual)}`;
  
  // Update month filter and history
  populateSalaryMonthFilter();
  updateSalaryHistory();
}

// ===== POPULAR FILTRO DE MÊS DO SALÁRIO =====
function populateSalaryMonthFilter() {
  const select = document.getElementById('salaryMonthFilter');
  if (!select) return;
  
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  // Coletar meses que têm entradas
  const monthsSet = new Set();
  state.salaries.forEach(s => {
    const d = new Date(s.date + 'T12:00:00');
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  
  // Adicionar mês atual se não tiver
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthsSet.add(curKey);
  
  const sortedMonths = Array.from(monthsSet).sort().reverse();
  
  const prevValue = select.value;
  select.innerHTML = sortedMonths.map(key => {
    const [y, m] = key.split('-');
    const label = `${months[parseInt(m) - 1]} ${y}`;
    return `<option value="${key}">${label}</option>`;
  }).join('');
  
  // Manter seleção anterior ou selecionar mês atual
  if (prevValue && sortedMonths.includes(prevValue)) {
    select.value = prevValue;
  } else {
    select.value = curKey;
  }
}

// ===== ATUALIZAR HISTÓRICO DE SALÁRIOS =====
function updateSalaryHistory() {
  const container = document.getElementById('salaryHistoryList');
  if (!container) return;
  
  // Filtrar pelo mês selecionado
  const filterVal = document.getElementById('salaryMonthFilter')?.value;
  let filtered = state.salaries;
  
  if (filterVal) {
    filtered = state.salaries.filter(s => s.date.startsWith(filterVal));
  }
  
  if (filtered.length === 0) {
    container.innerHTML = emptyState('Nenhuma entrada neste mês');
    return;
  }
  
  const sorted = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));
  const defaultIcons = ['👔', '💼', '🧑‍💻', '👨‍🔧', '👩‍⚕️', '🧑‍🎓'];
  const personIcon = {};
  (state.familyMembers || []).forEach((m, i) => { personIcon[m.name] = defaultIcons[i % defaultIcons.length]; });
  
  container.innerHTML = sorted.map(s => {
    const hasAdditions = s.additions && s.additions.length > 0;
    const hasDeductions = s.deductions && s.deductions.length > 0;
    const hasExtras = hasAdditions || hasDeductions;
    const grossLabel = hasExtras ? `Bruto: ${formatCurrency(s.grossAmount || s.amount)}` : '';
    const additionsHtml = hasAdditions ? `
      <div class="salary-deductions-detail">
        ${s.additions.map(a => `<span class="addition-tag">↑ ${esc(a.name)}: ${formatCurrency(a.value)}</span>`).join('')}
      </div>` : '';
    const deductionsHtml = hasDeductions ? `
      <div class="salary-deductions-detail">
        ${s.deductions.map(d => `<span class="deduction-tag">↓ ${esc(d.name)}: ${formatCurrency(d.value)}</span>`).join('')}
      </div>` : '';

    return `
    <div class="transaction-item">
      <div class="trans-icon-wrap cat-entrada">${personIcon[s.person] || '💰'}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(s.description) || `Salário de ${esc(s.person)}`}</div>
        <div class="trans-meta">
          <span>${formatDate(s.date)}</span>
          <span>·</span>
          <span>${esc(s.person)}</span>
          ${grossLabel ? `<span>·</span><span>${grossLabel}</span>` : ''}
        </div>
        ${additionsHtml}
        ${deductionsHtml}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="trans-amount entrada">+${formatCurrency(s.amount)}</div>
        <button onclick="deleteSalary('${s.id}')" class="btn-delete" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `}).join('');
}

// ===== DELETAR TRANSAÇÃO =====
function deleteTransaction(id) {
  if (confirm('Deseja deletar esta transação?')) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveDataToStorage();
    deleteFromFirebase('transactions', id);
    updateDashboard();
    updateTransactionHistory();
    showAlert('Transação deletada com sucesso!', 'success');
  }
}

// ===== DELETAR DÍVIDA =====
function deleteDebt(id) {
  if (confirm('Deseja deletar esta dívida?')) {
    state.debts = state.debts.filter(d => d.id !== id);
    saveDataToStorage();
    deleteFromFirebase('debts', id);
    updateDebtsList();
    showAlert('Dívida deletada com sucesso!', 'success');
  }
}

// ===== PAGAR DÍVIDA =====
function payDebt(id) {
  const debt = state.debts.find(d => d.id === id);
  if (!debt) return;

  const debtCartaoMode = debt.cartaoMode || 'unica';
  const isInstallmentDebt = ((debt.debtType === 'financiamento' || debt.debtType === 'parcelada' || debt.debtType === 'emprestimo') && debt.installments > 1)
                         || (debt.debtType === 'cartao' && debtCartaoMode === 'parcelado' && debt.installments > 1);
  const isFixaDebt = debt.debtType === 'fixa' || (debt.debtType === 'cartao' && debtCartaoMode === 'recorrente');

  // Financiamento ou cartão parcelado: pagar uma parcela
  if (isInstallmentDebt) {
    const paidSoFar = (debt.paidInstallments || 0);
    const remaining = debt.installments - paidSoFar;
    if (remaining <= 0) {
      showAlert('Todas as parcelas já foram pagas!', 'info');
      return;
    }
    const installmentValue = debt.installmentValue || (debt.amount / debt.installments);
    const parcNum = paidSoFar + 1;
    if (!confirm(`Pagar parcela ${parcNum}/${debt.installments} de ${formatCurrency(installmentValue)}?`)) return;

    debt.paidInstallments = parcNum;

    const transaction = {
      id: generateId(),
      type: 'saida',
      amount: installmentValue,
      category: debt.category || 'outros',
      responsible: debt.responsible,
      date: toDateStr(new Date()),
      description: `${debt.creditor} - Parcela ${parcNum}/${debt.installments}`,
      fromDebt: debt.id,
      createdAt: new Date().toISOString()
    };
    state.transactions.push(transaction);
    saveToFirebase('transactions', transaction);

    if (parcNum >= debt.installments) {
      debt.status = 'paid';
      debt.paidAt = new Date().toISOString();
      showAlert(`Todas as ${debt.installments} parcelas pagas! Financiamento quitado!`, 'success');
    } else {
      const nextDue = new Date(debt.dueDate + 'T12:00:00');
      nextDue.setMonth(nextDue.getMonth() + 1);
      debt.dueDate = toDateStr(nextDue);
      showAlert(`Parcela ${parcNum}/${debt.installments} paga! Próximo vencimento: ${formatDate(debt.dueDate)}`, 'success');
    }

    updateInFirebase('debts', id, {
      paidInstallments: debt.paidInstallments,
      status: debt.status,
      dueDate: debt.dueDate,
      paidAt: debt.paidAt
    });

  } else if (isFixaDebt) {
    // Dívida fixa/cartão recorrente: pagar o mês, avança vencimento
    const label = debt.debtType === 'cartao' ? 'fatura' : 'mês';
    if (!confirm(`Pagar ${esc(debt.creditor)} deste ${label}: ${formatCurrency(debt.amount)}?`)) return;

    const transaction = {
      id: generateId(),
      type: 'saida',
      amount: debt.amount,
      category: debt.category || 'outros',
      responsible: debt.responsible,
      date: toDateStr(new Date()),
      description: `${debt.creditor} - ${debt.debtType === 'cartao' ? 'Fatura' : 'Mensal'}`,
      fromDebt: debt.id,
      createdAt: new Date().toISOString()
    };
    state.transactions.push(transaction);
    saveToFirebase('transactions', transaction);

    // Avança vencimento para o próximo mês
    const nextDue = new Date(debt.dueDate + 'T12:00:00');
    nextDue.setMonth(nextDue.getMonth() + 1);
    debt.dueDate = toDateStr(nextDue);

    updateInFirebase('debts', id, { dueDate: debt.dueDate });
    showAlert(`${debt.creditor} pago! Próximo vencimento: ${formatDate(debt.dueDate)}`, 'success');

  } else {
    // Dívida única
    if (!confirm(`Marcar dívida de ${formatCurrency(debt.amount)} como paga?`)) return;

    debt.status = 'paid';
    debt.paidAt = new Date().toISOString();

    const transaction = {
      id: generateId(),
      type: 'saida',
      amount: debt.amount,
      category: debt.category || 'outros',
      responsible: debt.responsible,
      date: toDateStr(new Date()),
      description: `Dívida paga: ${debt.creditor}`,
      fromDebt: debt.id,
      createdAt: new Date().toISOString()
    };
    state.transactions.push(transaction);
    saveToFirebase('transactions', transaction);

    updateInFirebase('debts', id, { status: 'paid', paidAt: debt.paidAt });
    showAlert('Dívida marcada como paga e registrada como despesa!', 'success');
  }

  saveDataToStorage();
  updateDebtsList();
  updateDashboard();
  updateTransactionHistory();
}

// ===== DELETAR SALÁRIO =====
function deleteSalary(id) {
  if (confirm('Deseja deletar este salário?')) {
    state.salaries = state.salaries.filter(s => s.id !== id);
    saveDataToStorage();
    deleteFromFirebase('salaries', id);
    updateSalaryDisplay();
    updateDashboard();
    showAlert('Salário deletado com sucesso!', 'success');
  }
}

// ===== ARMAZENAMENTO LOCAL + FIREBASE =====
function saveDataToStorage() {
  const key = getFamilyStorageKey();
  if (!key) {
    console.warn('Sem familyId — dados não serão salvos no localStorage.');
    return;
  }
  const data = {
    transactions: state.transactions,
    debts: state.debts,
    salaries: state.salaries,
    lastSaved: new Date().toISOString()
  };
  localStorage.setItem(key, JSON.stringify(data));
}

function loadDataFromStorage() {
  // Limpa estado para evitar dados de outra família
  state.transactions = [];
  state.debts = [];
  state.salaries = [];

  const key = getFamilyStorageKey();
  if (!key) {
    console.warn('Sem familyId — dados não serão carregados.');
    updateDashboard();
    return;
  }

  // Carrega do localStorage primeiro (rápido)
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
  // Depois tenta carregar do Firebase (mais atualizado)
  if (firebaseReady) {
    loadDataFromFirebase().then(() => {
      listenFirebaseChanges();
    });
  }
}

// ===== FIREBASE FIRESTORE — CRUD =====
async function saveToFirebase(collection, item) {
  if (!firebaseReady) return;
  try {
    const familyId = getFamilyId();
    if (!familyId) {
      console.warn(`Sem familyId — item ${item.id} não será salvo no Firebase.`);
      return;
    }
    const itemWithFamily = { ...item, familyId };
    await db.collection(collection).doc(item.id).set(itemWithFamily);
    console.log(`Salvo no Firebase: ${collection}/${item.id}`);
  } catch (error) {
    console.error(`Erro ao salvar no Firebase (${collection}):`, error);
  }
}

async function deleteFromFirebase(collection, id) {
  if (!firebaseReady) return;
  try {
    await db.collection(collection).doc(id).delete();
    console.log(`Deletado do Firebase: ${collection}/${id}`);
  } catch (error) {
    console.error(`Erro ao deletar do Firebase (${collection}):`, error);
  }
}

async function updateInFirebase(collection, id, data) {
  if (!firebaseReady) return;
  try {
    await db.collection(collection).doc(id).update(data);
    console.log(`Atualizado no Firebase: ${collection}/${id}`);
  } catch (error) {
    console.error(`Erro ao atualizar no Firebase (${collection}):`, error);
  }
}

async function loadDataFromFirebase() {
  if (!firebaseReady) return;
  const familyId = getFamilyId();
  if (!familyId) {
    console.warn('Sem familyId — dados do Firebase não serão carregados.');
    return;
  }
  try {
    // Carregar transações filtradas por família
    const transSnap = await db.collection('transactions')
      .where('familyId', '==', familyId).orderBy('createdAt', 'desc').get();
    state.transactions = transSnap.docs.map(doc => doc.data());

    // Carregar dívidas filtradas por família
    const debtsSnap = await db.collection('debts')
      .where('familyId', '==', familyId).orderBy('createdAt', 'desc').get();
    state.debts = debtsSnap.docs.map(doc => doc.data());

    // Carregar salários filtrados por família
    const salSnap = await db.collection('salaries')
      .where('familyId', '==', familyId).orderBy('createdAt', 'desc').get();
    state.salaries = salSnap.docs.map(doc => doc.data());

    // Salva localmente também
    saveDataToStorage();

    // Atualiza a interface
    updateDashboard();
    updateTransactionHistory();
    updateDebtsList();
    updateSalaryDisplay();

    console.log('Dados carregados do Firebase com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar do Firebase:', error);
  }
}

// Escutar mudanças em tempo real do Firestore (com debounce para evitar loop)
let _fbSyncTimer = null;
let _fbListeners = [];
function listenFirebaseChanges() {
  if (!firebaseReady) return;

  // Limpar listeners anteriores
  _fbListeners.forEach(unsub => unsub());
  _fbListeners = [];

  const familyId = getFamilyId();
  if (!familyId) {
    console.warn('Sem familyId — listeners do Firebase não serão ativados.');
    return;
  }

  const debouncedLoad = () => {
    clearTimeout(_fbSyncTimer);
    _fbSyncTimer = setTimeout(() => loadDataFromFirebase(), 500);
  };

  ['transactions', 'debts', 'salaries'].forEach(col => {
    const unsub = db.collection(col)
      .where('familyId', '==', familyId)
      .onSnapshot(debouncedLoad);
    _fbListeners.push(unsub);
  });
}

// Sincronizar todos os dados locais para o Firebase
async function syncAllToFirebase() {
  if (!firebaseReady) return;
  const familyId = getFamilyId();
  if (!familyId) {
    console.warn('Sem familyId — sincronização cancelada.');
    return;
  }
  try {
    for (const t of state.transactions) {
      await db.collection('transactions').doc(t.id).set({ ...t, familyId });
    }
    for (const d of state.debts) {
      await db.collection('debts').doc(d.id).set({ ...d, familyId });
    }
    for (const s of state.salaries) {
      await db.collection('salaries').doc(s.id).set({ ...s, familyId });
    }
    console.log('Todos os dados sincronizados com Firebase!');
  } catch (error) {
    console.error('Erro na sincronização completa:', error);
  }
}

// ===== EXPORTAR DADOS =====
function exportData() {
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

// ===== IMPORTAR DADOS =====
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      
      if (confirm('Substituir todos os dados pelos do arquivo?')) {
        const familyId = getFamilyId();
        if (!familyId) {
          showAlert('Erro: família não identificada. Faça login novamente.', 'danger');
          return;
        }
        // Injeta familyId em todos os itens importados
        state.transactions = (data.transactions || []).map(t => ({ ...t, familyId }));
        state.debts = (data.debts || []).map(d => ({ ...d, familyId }));
        state.salaries = (data.salaries || []).map(s => ({ ...s, familyId }));
        saveDataToStorage();
        
        // Sincronizar com Firebase
        syncAllToFirebase();
        
        updateDashboard();
        updateTransactionHistory();
        updateDebtsList();
        updateSalaryDisplay();
        
        showAlert('Dados importados com sucesso!', 'success');
      }
    } catch (err) {
      showAlert('Erro ao importar arquivo!', 'danger');
    }
  };
  reader.readAsText(file);
  
  e.target.value = '';
}

// ===== SINCRONIZAR COM FIREBASE =====
function syncData() {
  if (state.syncStatus === 'offline') {
    showAlert('Sem conexão! Sincronização será feita quando voltar online.', 'warning');
    return;
  }
  
  if (!firebaseReady) {
    showAlert('Firebase não configurado. Configure as credenciais no script.js.', 'warning');
    return;
  }
  
  showAlert('Sincronizando dados...', 'info');
  
  syncAllToFirebase().then(() => {
    showAlert('Dados sincronizados com Firebase!', 'success');
  }).catch(() => {
    showAlert('Erro ao sincronizar.', 'danger');
  });
}

// ===== LIMPAR CACHE =====
function clearCache() {
  if (confirm('Deseja limpar o cache da aplicação?')) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }
    
    localStorage.clear();
    sessionStorage.clear();
    
    showAlert('Cache limpo! Atualizando página...', 'success');
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

// ===== STATUS ONLINE/OFFLINE =====
function setupOnlineOfflineListeners() {
  window.addEventListener('online', () => {
    state.syncStatus = 'online';
    document.getElementById('offlineBadge').style.display = 'none';
    const ss = document.getElementById('syncStatus');
    if (ss) { ss.textContent = 'Conectado'; ss.className = 'status-pill connected'; }
    showAlert('Conexão restaurada!', 'success');
    if (firebaseReady) syncAllToFirebase();
  });
  
  window.addEventListener('offline', () => {
    state.syncStatus = 'offline';
    document.getElementById('offlineBadge').style.display = 'flex';
    const ss = document.getElementById('syncStatus');
    if (ss) { ss.textContent = 'Desconectado'; ss.className = 'status-pill disconnected'; }
    showAlert('Você está offline!', 'warning');
  });
}

// ===== TEMA (DARK/LIGHT MODE) =====
function initializeTheme() {
  // Check if there's a saved theme preference
  const savedTheme = localStorage.getItem('theme');
  
  // Check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set theme: saved > system > default 'light'
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  // Apply theme to document
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon('light_mode');
  } else {
    document.documentElement.removeAttribute('data-theme');
    updateThemeIcon('dark_mode');
  }
  
  // Save preference
  localStorage.setItem('theme', theme);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      applyTheme(newTheme);
    }
  });
}

function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon('light_mode');
  } else {
    document.documentElement.removeAttribute('data-theme');
    updateThemeIcon('dark_mode');
  }
  
  localStorage.setItem('theme', theme);
}

function updateThemeIcon(icon) {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const faIcon = icon === 'dark_mode' ? 'fa-moon' : 'fa-sun';
    themeToggle.innerHTML = `<i class="fa-solid ${faIcon}"></i>`;
  }
}

// ===== UTILITÁRIOS =====
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Sanitizar texto para evitar XSS ao usar innerHTML
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateString) {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T12:00:00'));
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function getCategoryLabel(category) {
  return CATEGORY_MAP[category]?.label || category;
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert ${type}`;
  const icons = { success: 'fa-circle-check', danger: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  alertDiv.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  
  const main = document.querySelector('.main-content');
  if (main) main.insertBefore(alertDiv, main.firstChild);
  
  setTimeout(() => {
    alertDiv.style.opacity = '0';
    setTimeout(() => alertDiv.remove(), 300);
  }, 3000);
}

// Reusable empty state HTML
function emptyState(text) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i class="fa-regular fa-folder-open"></i></div>
      <p class="empty-state-text">${text}</p>
    </div>`;
}

// ===== EVENT LISTENERS PARA RESPONSIVIDADE =====
window.addEventListener('resize', () => {
  // Recreate charts on resize for responsiveness
  if (document.querySelector('.tab-content.active')?.id === 'dashboard') {
    const monthVal = document.getElementById('monthFilter').value;
    let month, year;
    if (monthVal) {
      const parts = monthVal.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]) - 1;
    } else {
      const now = new Date();
      month = now.getMonth();
      year = now.getFullYear();
    }
    
    const monthTransactions = state.transactions.filter(t => {
      const tDate = new Date(t.date + 'T12:00:00');
      return tDate.getMonth() === month && tDate.getFullYear() === year;
    });
    
    const monthDebts = state.debts.filter(d => d.status === 'active');
    updateCharts(monthTransactions, monthDebts);
  }
});

console.log('Aplicação Financeiro Lopes iniciada com sucesso! 💰');
