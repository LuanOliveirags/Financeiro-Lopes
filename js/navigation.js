// ============================================================
// NAVIGATION.JS — Navegação, scrollers, tema, eventos de UI
// ============================================================

import { state, isSuperAdmin, getFamilyId } from './state.js';
import { showAlert, toDateStr } from './utils.js';
import { firebaseReady, saveDataToStorage, loadDataFromStorage, exportData, importData, syncData, clearCache, syncAllToFirebase } from './data.js';
import { uploadAvatar, loginUser, registerUser, changeUserPassword, loadUsersList, saveUserEdit, loadFamiliesListUI, createFamily, populateFamilySelects, loadFamily, applyUserToUI, logout } from './auth.js';
import { addTransaction, updateTransactionHistory } from './transactions.js';
import { addDebt, resetDebtModal, setupDebtTypeListeners, setupDebtFilterListeners, updateDebtsList } from './debts.js';
import { addSalary, setupDeductionListeners, updateSalaryDisplay, updateSalaryHistory } from './salaries.js';
import { updateDashboard, updateCharts } from './dashboard.js';
import { openChoresTab, setupChoresListeners } from './chores.js';
import { openShoppingPanel, setupShoppingListeners } from './shopping.js';

// ===== THEME =====
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
  localStorage.setItem('theme', theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(current === 'dark' ? 'light' : 'dark');
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

// ===== ONLINE/OFFLINE =====
export function setupOnlineOfflineListeners() {
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

// ===== MONTH SCROLLER =====
export function initMonthScroller() {
  const scroller = document.getElementById('monthScroller');
  if (!scroller) return;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  scroller.innerHTML = months.map((m, i) => {
    const isActive = i === currentMonth;
    return `<button class="month-btn ${isActive ? 'active' : ''}" data-month="${i}" onclick="selectMonth(${i}, ${currentYear})">${m}</button>`;
  }).join('');

  requestAnimationFrame(() => {
    const active = scroller.querySelector('.month-btn.active');
    if (active) {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      scroller.scrollLeft += activeRect.left - scrollerRect.left - (scrollerRect.width / 2) + (activeRect.width / 2);
    }
  });
}

export function selectMonth(monthIndex, year) {
  const y = year || new Date().getFullYear();
  document.getElementById('monthFilter').value = `${y}-${String(monthIndex + 1).padStart(2, '0')}`;
  document.querySelectorAll('.month-btn').forEach((btn, i) => btn.classList.toggle('active', i === monthIndex));
  updateDashboard();
  updateSalaryDisplay();
}

// ===== WEEK SCROLLER =====
export function initWeekScroller() {
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
    html.push(`<button class="week-day-btn ${isToday ? 'active' : ''}" data-date="${dStr}" onclick="selectWeekDay('${dStr}')">
      <span class="wday-name">${days[d.getDay()]}</span><span class="wday-num">${d.getDate()}</span>
    </button>`);
  }
  scroller.innerHTML = html.join('');
  state.selectedDay = todayStr;
  requestAnimationFrame(() => {
    const active = scroller.querySelector('.week-day-btn.active');
    if (active) {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      scroller.scrollLeft += activeRect.left - scrollerRect.left - (scrollerRect.width / 2) + (activeRect.width / 2);
    }
  });
}

export function selectWeekDay(dateStr) {
  state.selectedDay = dateStr;
  document.querySelectorAll('.week-day-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.date === dateStr));
  updateTransactionHistory();
}

// ===== TROCA DE ABAS =====
export function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));

  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.scrollLeft = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  const tabSection = document.getElementById(tabName);
  const tabBtn = document.querySelector(`.bottom-nav-item[data-tab="${tabName}"]`);
  if (tabSection) tabSection.classList.add('active');
  if (tabBtn) tabBtn.classList.add('active');

  if (tabName === 'dashboard') { updateDashboard(); initMonthScroller(); }
  else if (tabName === 'transactions') { initWeekScroller(); updateTransactionHistory(); }
  else if (tabName === 'debts') { updateDebtsList(); }
  else if (tabName === 'salaries') { updateSalaryDisplay(); }
  else if (tabName === 'chores') { openChoresTab(); }
}

// ===== QUICK ACTIONS =====
function handleQuickAction(action) {
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
    switchTab('debts');
    setTimeout(() => document.getElementById('debtModal').classList.add('active'), 300);
  } else if (action === 'salary') {
    switchTab('salaries');
    setTimeout(() => document.getElementById('salaryModal').classList.add('active'), 300);
  } else if (action === 'shopping') {
    openShoppingPanel();
  } else if (action === 'settings') {
    switchTab('settings');
  } else if (action === 'chores') {
    switchTab('chores');
  }
}

// ===== SETUP EVENT LISTENERS =====
export function setupEventListeners() {
  // Avatar upload
  const avatarBtn = document.getElementById('avatarUploadBtn');
  const avatarInput = document.getElementById('avatarFileInput');
  if (avatarBtn && avatarInput) {
    avatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showAlert('Selecione um arquivo de imagem.', 'danger'); return; }
      if (file.size > 5 * 1024 * 1024) { showAlert('A imagem deve ter no máximo 5 MB.', 'danger'); return; }
      try { await uploadAvatar(file); } catch (err) { showAlert('Erro ao salvar foto.', 'danger'); }
      e.target.value = '';
    });
  }

  // Login form
  document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
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

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  // Bottom Navigation
  document.querySelectorAll('.bottom-nav-item').forEach(tab => {
    tab.addEventListener('click', function() { switchTab(this.getAttribute('data-tab')); });
  });

  // FAB
  const fabBtn = document.getElementById('fabBtn');
  const quickActionsMenu = document.getElementById('quickActionsMenu');
  fabBtn.addEventListener('click', () => { fabBtn.classList.toggle('active'); quickActionsMenu.classList.toggle('active'); });
  document.querySelectorAll('.quick-action-item').forEach(item => {
    item.addEventListener('click', function() {
      handleQuickAction(this.getAttribute('data-action'));
      fabBtn.classList.remove('active');
      quickActionsMenu.classList.remove('active');
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fab-container')) { fabBtn.classList.remove('active'); quickActionsMenu.classList.remove('active'); }
  });

  // Type toggle buttons
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

  // Forms
  document.getElementById('transactionForm').addEventListener('submit', addTransaction);
  document.getElementById('addDebtBtn').addEventListener('click', () => { resetDebtModal(); document.getElementById('debtModal').classList.add('active'); });
  document.getElementById('debtForm').addEventListener('submit', addDebt);
  document.getElementById('addSalaryBtn').addEventListener('click', () => { document.getElementById('salaryModal').classList.add('active'); });
  document.getElementById('salaryForm').addEventListener('submit', addSalary);

  // Modal close
  document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      modal.classList.remove('active');
      if (modal.id === 'debtModal') resetDebtModal();
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) { this.classList.remove('active'); if (this.id === 'debtModal') resetDebtModal(); }
    });
  });

  // Settings
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('syncBtn').addEventListener('click', syncData);
  document.getElementById('clearCacheBtn').addEventListener('click', clearCache);

  // Install PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const installBtn = document.getElementById('installBtn');
    installBtn.style.display = 'block';
    installBtn.addEventListener('click', () => e.prompt());
  });

  // Filters
  document.getElementById('monthFilter').addEventListener('change', updateDashboard);
  document.getElementById('historyMonth').addEventListener('change', () => {
    state.selectedDay = null;
    document.querySelectorAll('.week-day-btn').forEach(b => b.classList.remove('active'));
    updateTransactionHistory();
  });
  document.getElementById('historyFilter').addEventListener('change', updateTransactionHistory);

  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // User management
  const changePassBtn = document.getElementById('changePasswordBtn');
  if (changePassBtn) changePassBtn.addEventListener('click', () => document.getElementById('changePasswordModal').classList.add('active'));

  const manageUsersBtn = document.getElementById('manageUsersBtn');
  if (manageUsersBtn) manageUsersBtn.addEventListener('click', () => { document.getElementById('manageUsersModal').classList.add('active'); loadUsersList(); });

  const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
  if (manageFamiliesBtn) manageFamiliesBtn.addEventListener('click', () => { document.getElementById('manageFamiliesModal').classList.add('active'); loadFamiliesListUI(); });

  const addFamilyBtn = document.getElementById('addFamilyBtn');
  if (addFamilyBtn) {
    addFamilyBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('newFamilyName');
      const name = nameInput.value.trim();
      if (!name) { showAlert('Digite o nome da família.', 'danger'); return; }
      try { addFamilyBtn.disabled = true; await createFamily(name); nameInput.value = ''; showAlert(`Família "${name}" criada com sucesso!`, 'success'); loadFamiliesListUI(); }
      catch (err) { showAlert(err.message || 'Erro ao criar família.', 'danger'); }
      finally { addFamilyBtn.disabled = false; }
    });
  }

  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', async () => {
      document.getElementById('createUserModal').classList.add('active');
      const familyGroup = document.getElementById('newUserFamilyGroup');
      if (isSuperAdmin()) { if (familyGroup) familyGroup.style.display = ''; await populateFamilySelects(); }
      else { if (familyGroup) familyGroup.style.display = 'none'; }
    });
  }

  const editUserForm = document.getElementById('editUserForm');
  if (editUserForm) editUserForm.addEventListener('submit', saveUserEdit);

  const changePassForm = document.getElementById('changePasswordForm');
  if (changePassForm) {
    changePassForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const currentPass = document.getElementById('currentPassword').value;
      const newPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmPassword').value;
      if (newPass !== confirmPass) { showAlert('As senhas não coincidem!', 'danger'); return; }
      if (newPass.length < 6) { showAlert('A nova senha deve ter pelo menos 6 caracteres.', 'danger'); return; }
      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alterando...';
      try { await changeUserPassword(state.currentUser.id, currentPass, newPass); showAlert('Senha alterada com sucesso!', 'success'); this.reset(); document.getElementById('changePasswordModal').classList.remove('active'); }
      catch (err) { showAlert(err.message || 'Erro ao alterar senha.', 'danger'); }
      finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterar Senha'; }
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
        ? (document.getElementById('newUserFamily')?.value || getFamilyId())
        : getFamilyId();
      if (password.length < 6) { showAlert('A senha deve ter pelo menos 6 caracteres.', 'danger'); return; }
      if (!familyId) { showAlert('Selecione uma família para o usuário.', 'danger'); return; }
      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';
      try { await registerUser(fullName, email, login, password, familyId); showAlert(`Usuário "${login}" cadastrado com sucesso!`, 'success'); this.reset(); document.getElementById('createUserModal').classList.remove('active'); }
      catch (err) { showAlert(err.message || 'Erro ao cadastrar usuário.', 'danger'); }
      finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Cadastrar'; }
    });
  }

  // Initialize theme on load
  initializeTheme();

  // Feature-specific setup
  setupDeductionListeners();
  setupDebtTypeListeners();
  setupShoppingListeners();
  setupDebtFilterListeners();
  setupChoresListeners();

  // Salary month filter
  const salaryMonthFilter = document.getElementById('salaryMonthFilter');
  if (salaryMonthFilter) salaryMonthFilter.addEventListener('change', () => updateSalaryHistory());

  // Resize handler for charts
  window.addEventListener('resize', () => {
    if (document.querySelector('.tab-content.active')?.id === 'dashboard') {
      const monthVal = document.getElementById('monthFilter').value;
      let month, year;
      if (monthVal) { const p = monthVal.split('-'); year = parseInt(p[0]); month = parseInt(p[1]) - 1; }
      else { const n = new Date(); month = n.getMonth(); year = n.getFullYear(); }
      const monthTransactions = state.transactions.filter(t => {
        const tDate = new Date(t.date + 'T12:00:00');
        return tDate.getMonth() === month && tDate.getFullYear() === year;
      });
      const monthDebts = state.debts.filter(d => d.status === 'active');
      updateCharts(monthTransactions, monthDebts);
    }
  });
}

// Globals para inline handlers
window.switchTab = switchTab;
window.selectMonth = selectMonth;
window.selectWeekDay = selectWeekDay;
