// ============================================================
// NAVIGATION.JS — Navegação, scrollers, tema, eventos de UI
// ============================================================

import { state, isSuperAdmin, getFamilyId } from './state.js';
import { showAlert, toDateStr } from './utils.js';
import { firebaseReady, saveDataToStorage, loadDataFromStorage, exportData, importData, syncData, clearCache, syncAllToFirebase } from './data.js';
import { uploadAvatar, loginUser, registerUser, changeUserPassword, savePhoneNumber, saveRecado, loadUsersList, saveUserEdit, loadFamiliesListUI, createFamily, populateFamilySelects, loadFamily, applyUserToUI, logout } from './auth.js';
import { addTransaction, updateTransactionHistory } from './transactions.js';
import { addDebt, resetDebtModal, setupDebtTypeListeners, setupDebtFilterListeners, updateDebtsList } from './debts.js';
import { addSalary, setupDeductionListeners, updateSalaryDisplay, updateSalaryHistory } from './salaries.js';
import { updateDashboard, updateCharts, setupKpiClickListeners } from './dashboard.js';
import { openChoresTab, setupChoresListeners } from './chores.js';
import { openShoppingPanel, setupShoppingListeners } from './shopping.js';
import { getNotifSettings, saveNotifSettings, enableNotifications, disableNotifications, checkAndNotify, isNotifSupported } from './notifications.js';
import { openChat, initChat, cleanupChat } from './chat.js';

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
  else if (tabName === 'shopping') { openShoppingPanel(); }
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
    switchTab('shopping');
  } else if (action === 'settings') {
    switchTab('settings');
  } else if (action === 'chores') {
    switchTab('chores');
  } else if (action === 'chat') {
    openChat();
  }
}

// ===== SETUP EVENT LISTENERS =====
export function setupEventListeners() {
  // Toggle password visibility
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      const icon = togglePasswordBtn.querySelector('i');
      icon.classList.toggle('fa-eye', !isHidden);
      icon.classList.toggle('fa-eye-slash', isHidden);
    });
  }

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

  // Logout — limpa chat antes de sair
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    const wasLoggedIn = state.isLoggedIn;
    logout();
    if (wasLoggedIn && !state.isLoggedIn) cleanupChat();
  });

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

  // Transaction payment method toggle
  document.querySelectorAll('#tranPaymentMethods .shop-pay-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#tranPaymentMethods .shop-pay-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('tranPaymentMethod').value = this.dataset.method;
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

  // ── Telefone do perfil ──
  _setupPhoneModal();

  // ── Recado do perfil ──
  _setupRecadoModal();

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

  // Máscara de telefone no modal de edição de usuário
  document.getElementById('editUserPhone')?.addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (!v) { e.target.value = ''; return; }
    let r = '(' + v.slice(0, 2);
    if (v.length > 2) r += ') ' + v.slice(2, 7);
    if (v.length > 7) r += '-' + v.slice(7, 11);
    e.target.value = r;
  });

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
  setupTabSwipe();
  setupChatSwipe();

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

  // Escuta mensagem do SW para navegar até uma aba (ex: clique em notificação)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_NAVIGATE')  switchTab(event.data.tab || 'debts');
      if (event.data?.type === 'SW_OPEN_CHAT') openChat();
    });
  }

  // Configurar painel de notificações (assíncrono, não bloqueia UI)
  setupNotificationSettings();
}

// ===== NOTIFICATION SETTINGS =====
async function setupNotificationSettings() {
  const group = document.getElementById('notifSettingsGroup');
  if (!group) return;

  // Oculta o bloco se o navegador não suporta notificações
  if (!isNotifSupported()) {
    group.style.display = 'none';
    return;
  }

  // Atualiza badge de permissão do sistema
  function updatePermBadge() {
    const badge = document.getElementById('notifPermBadge');
    if (!badge) return;
    const perm = Notification.permission;
    badge.textContent  = perm === 'granted' ? 'Permitido' : perm === 'denied' ? 'Bloqueado' : 'Pendente';
    badge.className    = 'status-pill ' + (perm === 'granted' ? 'connected' : perm === 'denied' ? 'disconnected' : '');
  }

  // Preenche controles com valores salvos
  function loadUI() {
    const s    = getNotifSettings();
    const perm = Notification.permission === 'granted';
    const el   = id => document.getElementById(id);

    if (el('notifToggle'))     el('notifToggle').checked     = s.enabled && perm;
    if (el('notifOverdue'))    el('notifOverdue').checked    = s.notifyOverdue;
    if (el('notifToday'))      el('notifToday').checked      = s.notifyToday;
    if (el('notifDaysBefore')) el('notifDaysBefore').value   = String(s.notifyDaysBefore);

    const sub = el('notifSubSettings');
    if (sub) sub.style.display = (s.enabled && perm) ? '' : 'none';
  }

  updatePermBadge();
  loadUI();

  // Toggle principal — solicita permissão e ativa/desativa
  document.getElementById('notifToggle')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const result = await enableNotifications();
      if (result !== 'granted') {
        e.target.checked = false;
        showAlert('Permissão de notificação negada pelo sistema. Habilite nas configurações do navegador.', 'danger');
        updatePermBadge();
        return;
      }
      document.getElementById('notifSubSettings').style.display = '';
      showAlert('Notificações ativadas! Você será avisado sobre dívidas pendentes.', 'success');
    } else {
      disableNotifications();
      document.getElementById('notifSubSettings').style.display = 'none';
      showAlert('Notificações desativadas.', 'info');
    }
    updatePermBadge();
    const s = getNotifSettings();
    s.enabled = e.target.checked && Notification.permission === 'granted';
    saveNotifSettings(s);
  });

  // Sub-opções
  document.getElementById('notifOverdue')?.addEventListener('change', (e) => {
    saveNotifSettings({ ...getNotifSettings(), notifyOverdue: e.target.checked });
  });
  document.getElementById('notifToday')?.addEventListener('change', (e) => {
    saveNotifSettings({ ...getNotifSettings(), notifyToday: e.target.checked });
  });
  document.getElementById('notifDaysBefore')?.addEventListener('change', (e) => {
    saveNotifSettings({ ...getNotifSettings(), notifyDaysBefore: parseInt(e.target.value) });
  });

  // Botão de teste
  document.getElementById('notifTestBtn')?.addEventListener('click', async () => {
    const s = getNotifSettings();
    if (!s.enabled || Notification.permission !== 'granted') {
      showAlert('Ative as notificações primeiro.', 'danger');
      return;
    }
    showAlert('Verificando dívidas e enviando notificação de teste...', 'info');
    await checkAndNotify(true);
  });
}

// ===== SWIPE BETWEEN TABS (MOBILE) =====
function setupTabSwipe() {
  const main = document.querySelector('main.main-content');
  if (!main) return;
  const TABS = ['dashboard', 'transactions', 'debts', 'shopping', 'salaries'];
  let startX = 0, startY = 0, tracking = false;
  const THRESHOLD = 70;

  main.addEventListener('touchstart', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'CANVAS') return;
    // Don't swipe if any modal is open
    if (document.querySelector('.modal.active')) return;
    // Don't swipe if chat panel is open
    if (document.getElementById('chatPanel')?.classList.contains('active')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  main.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    if (Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX)) {
      tracking = false;
    }
  }, { passive: true });

  main.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < THRESHOLD) return;
    const activeTab = document.querySelector('.tab-content.active')?.id;
    const idx = TABS.indexOf(activeTab);
    if (idx === -1) return;
    if (dx > 0 && idx > 0) switchTab(TABS[idx - 1]);         // swipe right → prev tab
    else if (dx < 0 && idx < TABS.length - 1) switchTab(TABS[idx + 1]); // swipe left → next tab
  }, { passive: true });
}

// ===== SWIPE TO GO BACK INSIDE CHAT PANEL =====
function setupChatSwipe() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;

  const THRESHOLD = 60;   // px mínimos para ativar
  const EDGE_ZONE = 40;   // px da borda esquerda para iniciar (swipe-from-edge)
  let startX = 0, startY = 0, tracking = false;

  // Importa closeChat e as funções de navegação do chat dinamicamente
  async function _chatBack() {
    const { closeChat } = await import('./chat.js');

    const views = ['chatViewPhoneGate', 'chatViewSearch', 'chatViewMessages', 'chatViewArchived'];
    const activeView = views.find(id => document.getElementById(id)?.classList.contains('active'));

    if (activeView === 'chatViewMessages') {
      // Vai para lista de conversas
      document.getElementById('chatMsgBackBtn')?.click();
    } else if (activeView === 'chatViewSearch') {
      document.getElementById('searchBackBtn')?.click();
    } else if (activeView === 'chatViewArchived') {
      document.getElementById('archivedBackBtn')?.click();
    } else {
      // chatViewList ou gate → fecha o chat
      closeChat();
    }
  }

  panel.addEventListener('touchstart', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Só rastreia se o toque começar perto da borda esquerda (swipe-from-edge nativo)
    if (e.touches[0].clientX > EDGE_ZONE) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    // Cancela se o movimento for mais vertical que horizontal
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) { tracking = false; }
  }, { passive: true });

  panel.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx > THRESHOLD) _chatBack();
  }, { passive: true });
}

// Globals para inline handlers
window.switchTab = switchTab;
window.selectMonth = selectMonth;
window.selectWeekDay = selectWeekDay;

// ================================================================
// MODAL DE EDIÇÃO DE TELEFONE
// ================================================================

function _setupPhoneModal() {
  const editBtn   = document.getElementById('editPhoneBtn');
  const modal     = document.getElementById('phoneEditModal');
  const closeBtn  = document.getElementById('phoneModalClose');
  const saveBtn   = document.getElementById('savePhoneBtn');
  const input     = document.getElementById('profilePhoneInput');
  const errorEl   = document.getElementById('phoneModalError');

  if (!editBtn || !modal) return;

  function _maskInput(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (!v) { e.target.value = ''; return; }
    let r = '(' + v.slice(0, 2);
    if (v.length > 2) r += ') ' + v.slice(2, 7);
    if (v.length > 7) r += '-' + v.slice(7, 11);
    e.target.value = r;
  }

  function _openModal() {
    // Preenche com telefone atual, se existir
    const current = (state.currentUser && state.currentUser.phone) || '';
    if (current) {
      const n = current.replace(/\D/g, '');
      input.value = n.length === 11
        ? `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
        : current;
    } else {
      input.value = '';
    }
    errorEl.style.display = 'none';
    errorEl.textContent = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  }

  function _closeModal() {
    modal.style.display = 'none';
  }

  editBtn.addEventListener('click', _openModal);
  closeBtn.addEventListener('click', _closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
  input.addEventListener('input', _maskInput);

  saveBtn.addEventListener('click', async () => {
    errorEl.style.display = 'none';
    const raw = input.value.trim();
    if (!raw) { errorEl.textContent = 'Digite um número de telefone.'; errorEl.style.display = 'block'; return; }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    try {
      await savePhoneNumber(raw);
      applyUserToUI();
      _closeModal();
      showAlert('Telefone salvo com sucesso!', 'success');
    } catch (err) {
      errorEl.textContent = err.message || 'Erro ao salvar telefone.';
      errorEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
    }
  });
}

function _setupRecadoModal() {
  const editBtn  = document.getElementById('editRecadoBtn');
  const modal    = document.getElementById('recadoEditModal');
  const closeBtn = document.getElementById('recadoModalClose');
  const saveBtn  = document.getElementById('saveRecadoBtn');
  const input    = document.getElementById('profileRecadoInput');
  const countEl  = document.getElementById('recadoCharCount');
  const errorEl  = document.getElementById('recadoModalError');

  if (!editBtn || !modal) return;

  function _updateCount() {
    countEl.textContent = `${input.value.length} / 120`;
  }

  function _openModal() {
    input.value = (state.currentUser && state.currentUser.recado) || '';
    _updateCount();
    errorEl.style.display = 'none';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  }

  function _closeModal() {
    modal.style.display = 'none';
  }

  editBtn.addEventListener('click', _openModal);
  closeBtn.addEventListener('click', _closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
  input.addEventListener('input', _updateCount);

  saveBtn.addEventListener('click', async () => {
    errorEl.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    try {
      await saveRecado(input.value);
      applyUserToUI();
      _closeModal();
      showAlert('Recado salvo!', 'success');
    } catch (err) {
      errorEl.textContent = err.message || 'Erro ao salvar recado.';
      errorEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
    }
  });
}

