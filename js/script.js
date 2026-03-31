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
let firebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
      console.log('Firebase Firestore conectado!');
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
  currentMonth: new Date(),
  transactions: [],
  debts: [],
  salaries: [],
  syncStatus: 'online',
  charts: {},
  selectedDay: null
};

// ===== MAPEAMENTO DE CATEGORIAS =====
const CATEGORY_MAP = {
  alimentacao: { icon: '🍽️', label: 'Alimentação',  css: 'cat-alimentacao' },
  transporte:  { icon: '🚗', label: 'Transporte',   css: 'cat-transporte'  },
  saude:       { icon: '💊', label: 'Saúde',        css: 'cat-saude'       },
  educacao:    { icon: '📚', label: 'Educação',     css: 'cat-educacao'    },
  moradia:     { icon: '🏠', label: 'Moradia',      css: 'cat-moradia'     },
  lazer:       { icon: '🎮', label: 'Lazer',        css: 'cat-lazer'       },
  utilidades:  { icon: '⚡', label: 'Utilidades',   css: 'cat-utilidades'  },
  outros:      { icon: '📁', label: 'Outros',       css: 'cat-outros'      }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  createDefaultAdmin();
  initializeApp();
  setupEventListeners();
  loadDataFromStorage();
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

  // Scroll to current
  requestAnimationFrame(() => {
    const active = scroller.querySelector('.month-btn.active');
    if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth' });
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
  // Scroll to today
  requestAnimationFrame(() => {
    const active = scroller.querySelector('.week-day-btn.active');
    if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth' });
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
    const snap = await db.collection('users').where('login', '==', 'luangs').get();
    if (snap.empty) {
      const hash = await hashPassword('Space@10');
      await db.collection('users').doc('admin-luangs').set({
        id: 'admin-luangs',
        fullName: 'Luan Gs',
        email: 'luanoliveirags@gmail.com',
        login: 'luangs',
        passwordHash: hash,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      console.log('Usuário admin padrão criado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao criar admin padrão:', error);
  }
}

async function loginUser(login, password) {
  const hash = await hashPassword(password);
  if (firebaseReady) {
    const snap = await db.collection('users').where('login', '==', login).get();
    if (!snap.empty) {
      const userData = snap.docs[0].data();
      if (userData.passwordHash === hash) return userData;
    }
    return null;
  }
  throw new Error('Firebase não disponível. Verifique sua conexão.');
}

async function registerUser(fullName, email, login, password) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
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
    profileRole.textContent = user.role === 'admin' ? 'Administrador' : 'Usuário';
    profileRole.className = user.role === 'admin' ? 'status-pill connected' : 'status-pill';
  }

  const adminSection = document.getElementById('adminSection');
  if (adminSection) adminSection.style.display = user.role === 'admin' ? 'block' : 'none';
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
    state.isLoggedIn = false;
    state.user = null;
    state.currentUser = null;
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
        loadDataFromStorage();
        updateDashboard();
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
      this.closest('.modal').classList.remove('active');
    });
  });
  
  // Close modal on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
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

  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', () => {
      document.getElementById('createUserModal').classList.add('active');
    });
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

      if (password.length < 6) {
        showAlert('A senha deve ter pelo menos 6 caracteres.', 'danger');
        return;
      }

      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';

      try {
        await registerUser(fullName, email, login, password);
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
}

// ===== TROCA DE ABAS =====
function switchTab(tabName) {
  // Remove active de todas as abas e botões
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));

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
  
  const transaction = {
    id: generateId(),
    type: document.getElementById('transType').value,
    amount: parseFloat(document.getElementById('tranAmount').value),
    category: document.getElementById('tranCategory').value,
    responsible: document.getElementById('tranResponsible').value,
    date: document.getElementById('tranDate').value,
    description: document.getElementById('tranDescription').value,
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
  
  const debt = {
    id: generateId(),
    creditor: document.getElementById('debtCreditor').value,
    amount: parseFloat(document.getElementById('debtAmount').value),
    dueDate: document.getElementById('debtDueDate').value,
    responsible: document.getElementById('debtResponsible').value,
    description: document.getElementById('debtDescription').value,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  
  if (!debt.creditor || !debt.amount || !debt.dueDate) {
    alert('Por favor, preencha todos os campos obrigatórios!');
    return;
  }
  
  state.debts.push(debt);
  saveDataToStorage();
  saveToFirebase('debts', debt);
  
  showAlert('Dívida registrada com sucesso!', 'success');
  
  // Reset and close modal
  e.target.reset();
  document.getElementById('debtModal').classList.remove('active');
  
  // Update displays
  updateDebtsList();
  updateDashboard();
}

// ===== ADICIONAR SALÁRIO =====
function addSalary(e) {
  e.preventDefault();
  
  const salary = {
    id: generateId(),
    person: document.getElementById('salaryPerson').value,
    amount: parseFloat(document.getElementById('salaryAmount').value),
    date: document.getElementById('salaryDate').value,
    description: document.getElementById('salaryDescription').value,
    createdAt: new Date().toISOString()
  };
  
  if (!salary.person || !salary.amount || !salary.date) {
    alert('Por favor, preencha todos os campos obrigatórios!');
    return;
  }
  
  state.salaries.push(salary);
  saveDataToStorage();
  saveToFirebase('salaries', salary);
  
  showAlert('Entrada registrada com sucesso!', 'success');
  
  // Reset and close modal
  e.target.reset();
  document.getElementById('salaryModal').classList.remove('active');
  
  // Update displays
  updateSalaryDisplay();
  updateDashboard();
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
  
  // Update KPI Cards
  document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
  document.getElementById('totalSpent').textContent = formatCurrency(totalDebt);
  document.getElementById('totalResponsible').textContent = responsibleCount;
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

  const incomesData = {};
  salaries.forEach(s => {
    const date = new Date(s.date + 'T12:00:00');
    const key  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!incomesData[key]) incomesData[key] = { Luan: 0, Bianca: 0 };
    incomesData[key][s.person] += s.amount;
  });

  const months = Object.keys(incomesData).sort();

  // Se não houver dados, não renderizar gráfico
  if (months.length === 0) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Luan',   data: months.map(m => incomesData[m].Luan),   backgroundColor: '#4361EE', borderRadius: 6 },
        { label: 'Bianca', data: months.map(m => incomesData[m].Bianca), backgroundColor: '#F72585', borderRadius: 6 }
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
  
  const totalDebts = state.debts
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + d.amount, 0);
  
  const activeDebts = state.debts.filter(d => d.status === 'active').length;
  
  document.getElementById('totalDebts').textContent = formatCurrency(totalDebts);
  document.getElementById('activeDebts').textContent = activeDebts;
  
  if (state.debts.length === 0) {
    container.innerHTML = emptyState('Nenhuma dívida registrada ✅');
    return;
  }
  
  const sorted = state.debts.sort((a, b) => new Date(a.dueDate + 'T12:00:00') - new Date(b.dueDate + 'T12:00:00'));
  
  container.innerHTML = sorted.map(d => {
    const dueDate = new Date(d.dueDate + 'T12:00:00');
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    let statusBadge = 'active';
    let statusLabel = 'Ativa';
    if (d.status === 'paid') { statusBadge = 'paid'; statusLabel = 'Paga'; }
    else if (daysUntilDue < 0) { statusBadge = 'overdue'; statusLabel = 'Atrasada'; }
    else if (daysUntilDue < 7) { statusBadge = 'due-soon'; statusLabel = `${daysUntilDue}d restantes`; }
    
    return `
      <div class="debt-item">
        <div class="debt-item-top">
          <span class="debt-creditor">${esc(d.creditor)}</span>
          <span class="debt-amount-badge">${formatCurrency(d.amount)}</span>
        </div>
        <div class="debt-item-meta">
          <span class="debt-meta-tag"><i class="fa-solid fa-user"></i> ${esc(d.responsible)}</span>
          <span class="debt-meta-tag"><i class="fa-solid fa-calendar"></i> ${formatDate(d.dueDate)}</span>
          ${d.description ? `<span class="debt-meta-tag">${esc(d.description)}</span>` : ''}
          <span class="debt-status-badge ${statusBadge}">${statusLabel}</span>
        </div>
        <div class="debt-item-actions">
          ${d.status !== 'paid' ? `<button onclick="payDebt('${d.id}')" class="btn-pay"><i class="fa-solid fa-check"></i> Pagar</button>` : ''}
          <button onclick="deleteDebt('${d.id}')" class="btn-delete"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>`;
  }).join('');
}

// ===== ATUALIZAR EXIBIÇÃO DE SALÁRIOS =====
function updateSalaryDisplay() {
  const luanSalaries = state.salaries.filter(s => s.person === 'Luan');
  const biancaSalaries = state.salaries.filter(s => s.person === 'Bianca');
  
  const luanTotal = luanSalaries.reduce((sum, s) => sum + s.amount, 0);
  const biancaTotal = biancaSalaries.reduce((sum, s) => sum + s.amount, 0);
  const combined = luanTotal + biancaTotal;
  
  // Get last salary of each
  const luanLast = luanSalaries.length > 0 ? luanSalaries[luanSalaries.length - 1].amount : 0;
  const biancaLast = biancaSalaries.length > 0 ? biancaSalaries[biancaSalaries.length - 1].amount : 0;
  
  document.getElementById('luanSalary').textContent = formatCurrency(luanLast);
  document.getElementById('luanAnnual').textContent = `Anual: ${formatCurrency(luanTotal)}`;
  
  document.getElementById('biancaSalary').textContent = formatCurrency(biancaLast);
  document.getElementById('biancaAnnual').textContent = `Anual: ${formatCurrency(biancaTotal)}`;
  
  document.getElementById('combinedSalary').textContent = formatCurrency(luanLast + biancaLast);
  document.getElementById('combinedAnnual').textContent = `Anual: ${formatCurrency(combined)}`;
  
  // Update history
  updateSalaryHistory();
}

// ===== ATUALIZAR HISTÓRICO DE SALÁRIOS =====
function updateSalaryHistory() {
  const container = document.getElementById('salaryHistoryList');
  if (!container) return;
  
  if (state.salaries.length === 0) {
    container.innerHTML = emptyState('Nenhuma entrada de salário registrada');
    return;
  }
  
  const sorted = state.salaries.slice().reverse();
  const personCss = { Luan: 'cat-transporte', Bianca: 'cat-lazer' };
  const personIcon = { Luan: '👔', Bianca: '💼' };
  
  container.innerHTML = sorted.map(s => `
    <div class="transaction-item">
      <div class="trans-icon-wrap cat-entrada">${personIcon[s.person] || '💰'}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(s.description) || `Salário de ${esc(s.person)}`}</div>
        <div class="trans-meta">
          <span>${formatDate(s.date)}</span>
          <span>·</span>
          <span>${esc(s.person)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="trans-amount entrada">+${formatCurrency(s.amount)}</div>
        <button onclick="deleteSalary('${s.id}')" class="btn-delete" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
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
  if (debt && confirm(`Marcar dívida de R$ ${debt.amount.toFixed(2)} como paga?`)) {
    debt.status = 'paid';
    saveDataToStorage();
    updateInFirebase('debts', id, { status: 'paid' });
    updateDebtsList();
    showAlert('Dívida marcada como paga!', 'success');
  }
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
  // Sempre salva no localStorage (funciona offline)
  const data = {
    transactions: state.transactions,
    debts: state.debts,
    salaries: state.salaries,
    lastSaved: new Date().toISOString()
  };
  localStorage.setItem('financeiro_data', JSON.stringify(data));
}

function loadDataFromStorage() {
  // Carrega do localStorage primeiro (rápido)
  const data = localStorage.getItem('financeiro_data');
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
    await db.collection(collection).doc(item.id).set(item);
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
  try {
    // Carregar transações
    const transSnap = await db.collection('transactions').orderBy('createdAt', 'desc').get();
    if (!transSnap.empty) {
      state.transactions = transSnap.docs.map(doc => doc.data());
    }

    // Carregar dívidas
    const debtsSnap = await db.collection('debts').orderBy('createdAt', 'desc').get();
    if (!debtsSnap.empty) {
      state.debts = debtsSnap.docs.map(doc => doc.data());
    }

    // Carregar salários
    const salSnap = await db.collection('salaries').orderBy('createdAt', 'desc').get();
    if (!salSnap.empty) {
      state.salaries = salSnap.docs.map(doc => doc.data());
    }

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
function listenFirebaseChanges() {
  if (!firebaseReady) return;

  const debouncedLoad = () => {
    clearTimeout(_fbSyncTimer);
    _fbSyncTimer = setTimeout(() => loadDataFromFirebase(), 500);
  };

  db.collection('transactions').onSnapshot(debouncedLoad);
  db.collection('debts').onSnapshot(debouncedLoad);
  db.collection('salaries').onSnapshot(debouncedLoad);
}

// Sincronizar todos os dados locais para o Firebase
async function syncAllToFirebase() {
  if (!firebaseReady) return;
  try {
    for (const t of state.transactions) {
      await db.collection('transactions').doc(t.id).set(t);
    }
    for (const d of state.debts) {
      await db.collection('debts').doc(d.id).set(d);
    }
    for (const s of state.salaries) {
      await db.collection('salaries').doc(s.id).set(s);
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
        state.transactions = data.transactions || [];
        state.debts = data.debts || [];
        state.salaries = data.salaries || [];
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
