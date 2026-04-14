// ============================================================
// DASHBOARD.JS — Dashboard KPIs e gráficos (Chart.js)
// ============================================================
/* global Chart */

import { CATEGORY_MAP } from './config.js';
import { state } from './state.js';
import { formatCurrency } from './utils.js';
import { updateRecentTransactions } from './transactions.js';

// ===== DASHBOARD MODE STATE =====
let dashboardMode = 'geral'; // 'geral' | 'vr'

// ===== KPI CARD CLICK → NAVIGATE + FILTER =====
export function setupKpiClickListeners() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-kpi-action]');
    if (!card) return;
    const action = card.dataset.kpiAction;
    const filter = card.dataset.kpiFilter;

    // Navigate to the target tab
    if (typeof window.switchTab === 'function') {
      window.switchTab(action);
    }

    // If there's a debt filter, simulate clicking the matching filter card in debts tab
    if (action === 'debts' && filter) {
      setTimeout(() => {
        // Clear any existing filter first
        if (typeof window.clearDebtFilter === 'function') {
          window.clearDebtFilter();
        }
        // Find and click the matching debt overview card or summary-mini
        const targetCard = document.querySelector(`.debt-overview-card[data-filter="${filter}"], .summary-mini[data-filter="${filter}"]`);
        if (targetCard) {
          targetCard.click();
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  });
}

export function setupDashboardToggle() {
  const btnGeral = document.getElementById('btnModeGeral');
  const btnVR = document.getElementById('btnModeVR');
  const slider = document.getElementById('dashModeSlider');
  if (!btnGeral || !btnVR) return;

  const setMode = (mode) => {
    dashboardMode = mode;
    const dashboard = document.getElementById('dashboard');

    // Toggle active button
    btnGeral.classList.toggle('active', mode === 'geral');
    btnVR.classList.toggle('active', mode === 'vr');
    slider.classList.toggle('vr-active', mode === 'vr');

    // Toggle VR mode class on dashboard section
    dashboard.classList.toggle('dashboard-vr-mode', mode === 'vr');

    // Toggle VR mode on balance card & IE cards
    document.querySelector('.balance-card')?.classList.toggle('vr-mode', mode === 'vr');
    document.querySelectorAll('.ie-card').forEach(c => c.classList.toggle('vr-mode', mode === 'vr'));

    updateDashboard();
  };

  btnGeral.addEventListener('click', () => setMode('geral'));
  btnVR.addEventListener('click', () => setMode('vr'));
}

// ===== HIDE/SHOW VALUES TOGGLE =====
export function setupValuesToggle() {
  const btn = document.getElementById('toggleValuesBtn');
  const icon = document.getElementById('toggleValuesIcon');
  if (!btn || !icon) return;

  const hidden = localStorage.getItem('valuesHidden') === 'true';
  const dashboard = document.getElementById('dashboard');
  if (hidden) {
    dashboard.classList.add('values-hidden');
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  }

  btn.addEventListener('click', () => {
    const isHidden = dashboard.classList.toggle('values-hidden');
    icon.classList.replace(
      isHidden ? 'fa-eye' : 'fa-eye-slash',
      isHidden ? 'fa-eye-slash' : 'fa-eye'
    );
    localStorage.setItem('valuesHidden', isHidden);
  });
}

// ===== ATUALIZAR DASHBOARD =====
export function updateDashboard() {
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

  const monthSalaries = state.salaries.filter(s => {
    const sDate = new Date(s.date + 'T12:00:00');
    return sDate.getMonth() === month && sDate.getFullYear() === year;
  });

  const monthDebts = state.debts.filter(d => d.status === 'active');

  // Separate VR/VA from general
  const generalTransactions = monthTransactions.filter(t => t.paymentMethod !== 'vr');
  const vrTransactions = monthTransactions.filter(t => t.paymentMethod === 'vr');
  const generalSalaries = monthSalaries.filter(s => s.salaryType !== 'vr');
  const vrSalaries = monthSalaries.filter(s => s.salaryType === 'vr');

  const totalExpenses = generalTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.amount, 0);
  const totalTransactionIncome = generalTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + t.amount, 0);
  const totalSalaryIncome = generalSalaries.reduce((sum, s) => sum + s.amount, 0);
  const totalIncome = totalTransactionIncome + totalSalaryIncome;
  const totalBalance = totalIncome - totalExpenses;
  const totalDebt = monthDebts.reduce((sum, d) => sum + d.amount, 0);
  const responsibleCount = new Set(monthTransactions.map(t => t.responsible)).size;

  const isInstallmentType = d => (d.debtType === 'financiamento' || d.debtType === 'parcelada' || d.debtType === 'emprestimo') || (d.debtType === 'cartao' && d.cartaoMode === 'parcelado');
  const monthlyDebtsActive = monthDebts.filter(d => !isInstallmentType(d));
  const financingDebtsOnly = monthDebts.filter(d => (d.debtType === 'financiamento' || d.debtType === 'parcelada') || (d.debtType === 'cartao' && d.cartaoMode === 'parcelado'));
  const loanDebtsOnly = monthDebts.filter(d => d.debtType === 'emprestimo');
  const totalMonthlyDebts = monthlyDebtsActive.reduce((sum, d) => sum + d.amount, 0);
  const totalFinancingInstallment = financingDebtsOnly.reduce((sum, d) => sum + (d.installmentValue || d.amount), 0);
  const totalFinancingRemaining = financingDebtsOnly.reduce((sum, d) => {
    const instVal = d.installmentValue || (d.amount / (d.installments || 1));
    return sum + (d.amount - (instVal * (d.paidInstallments || 0)));
  }, 0);
  const totalLoanInstallment = loanDebtsOnly.reduce((sum, d) => sum + (d.installmentValue || d.amount), 0);
  const totalLoanRemaining = loanDebtsOnly.reduce((sum, d) => {
    const instVal = d.installmentValue || (d.amount / (d.installments || 1));
    return sum + (d.amount - (instVal * (d.paidInstallments || 0)));
  }, 0);

  const paidDebtsThisMonth = state.transactions.filter(t => {
    if (!t.fromDebt) return false;
    const tDate = new Date(t.date + 'T12:00:00');
    return tDate.getMonth() === month && tDate.getFullYear() === year;
  });
  const totalPaidDebts = paidDebtsThisMonth.reduce((sum, t) => sum + t.amount, 0);
  const totalMonthDeductions = monthSalaries.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);

  // VR/VA values (always computed)
  const vrIncomeTotal = vrSalaries.reduce((sum, s) => sum + s.amount, 0);
  const vrExpenseTotal = vrTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.amount, 0);
  const vrBalanceVal = vrIncomeTotal - vrExpenseTotal;

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  if (dashboardMode === 'vr') {
    // === VR MODE: Main cards show VR data ===
    document.getElementById('totalBalance').textContent = formatCurrency(vrBalanceVal);
    document.getElementById('totalExpenses').textContent = formatCurrency(vrExpenseTotal);
    el('totalIncomeDash', formatCurrency(vrIncomeTotal));

    // VR KPI Summary
    const vrExpenses = vrTransactions.filter(t => t.type === 'saida');
    const vrCount = vrExpenses.length;
    const vrAvg = vrCount > 0 ? vrExpenseTotal / vrCount : 0;
    const vrMax = vrCount > 0 ? Math.max(...vrExpenses.map(t => t.amount)) : 0;
    const vrPct = vrIncomeTotal > 0 ? Math.min(100, (vrExpenseTotal / vrIncomeTotal) * 100) : 0;

    el('vrPurchaseCount', String(vrCount));
    el('vrAvgTicket', formatCurrency(vrAvg));
    el('vrMaxExpense', formatCurrency(vrMax));
    el('vrUsagePercent', `${vrPct.toFixed(0)}%`);

    // Charts & recents use VR data only
    updateCharts(vrTransactions, []);
    updateRecentTransactions(vrTransactions);

  } else {
    // === GERAL MODE ===
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
    document.getElementById('totalSpent').textContent = formatCurrency(totalDebt);
    document.getElementById('totalResponsible').textContent = responsibleCount;

    el('dashMonthlyDebts', formatCurrency(totalMonthlyDebts));
    el('dashMonthlyCount', `${monthlyDebtsActive.length} ativa${monthlyDebtsActive.length !== 1 ? 's' : ''}`);
    el('dashFinancingDebts', formatCurrency(totalFinancingInstallment));
    el('dashFinancingRemaining', `Restante: ${formatCurrency(totalFinancingRemaining)}`);
    el('dashLoanDebts', formatCurrency(totalLoanInstallment));
    el('dashLoanRemaining', `Restante: ${formatCurrency(totalLoanRemaining)}`);
    el('totalPaidDebts', formatCurrency(totalPaidDebts));
    el('totalDeductionsDash', formatCurrency(totalMonthDeductions));
    el('totalIncomeDash', formatCurrency(totalIncome));

    // VR/VA small card (only in geral mode)
    el('vrIncome', formatCurrency(vrIncomeTotal));
    el('vrExpense', formatCurrency(vrExpenseTotal));
    el('vrBalance', formatCurrency(vrBalanceVal));
    const vrCard = document.getElementById('vrDashboardCard');
    if (vrCard) vrCard.style.display = (vrIncomeTotal > 0 || vrExpenseTotal > 0) ? '' : 'none';

    updateCharts(generalTransactions, monthDebts);
    updateRecentTransactions(monthTransactions);
  }

  // Update balance label
  const balanceLabel = document.querySelector('.balance-label');
  if (balanceLabel) balanceLabel.textContent = dashboardMode === 'vr' ? 'Saldo VR / VA' : 'Saldo líquido';

  // Dynamic balance pulse — card "breathes" based on financial health
  const balanceCard = document.querySelector('.balance-card');
  if (balanceCard) {
    balanceCard.classList.remove('positive-pulse', 'negative-pulse');
    const bal = dashboardMode === 'vr' ? vrBalanceVal : totalBalance;
    if (bal > 0) balanceCard.classList.add('positive-pulse');
    else if (bal < 0) balanceCard.classList.add('negative-pulse');
  }

  // Value flash on balance update
  const balanceEl = document.getElementById('totalBalance');
  if (balanceEl) {
    balanceEl.classList.remove('value-updated');
    void balanceEl.offsetWidth; // force reflow
    balanceEl.classList.add('value-updated');
  }
}

// ===== ATUALIZAR GRÁFICOS =====
export function updateCharts(transactions, debts) {
  Object.values(state.charts).forEach(chart => { if (chart) chart.destroy(); });
  state.charts = {};
  state.charts.sparkline = createBalanceSparkline(transactions);
  state.charts.category = createCategoryChart(transactions);
  state.charts.responsible = createResponsibleChart(transactions);
  state.charts.debtType = createDebtTypeChart(debts);
}

// ===== SPARKLINE =====
function createBalanceSparkline(transactions) {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return null;

  const monthVal = document.getElementById('monthFilter').value;
  let month, year;
  if (monthVal) { const p = monthVal.split('-'); year = parseInt(p[0]); month = parseInt(p[1]) - 1; }
  else { const n = new Date(); month = n.getMonth(); year = n.getFullYear(); }
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyNet = Array(daysInMonth).fill(0);
  transactions.forEach(t => {
    const d = new Date(t.date + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      dailyNet[d.getDate() - 1] += t.type === 'entrada' ? t.amount : -t.amount;
    }
  });

  let cum = 0;
  const cumData = dailyNet.map(v => { cum += v; return cum; });
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  if (!cumData.some(v => v !== 0)) { ctx.style.display = 'none'; return null; }
  ctx.style.display = '';

  const isVR = dashboardMode === 'vr';
  const sparkColor = isVR ? '#689F38' : '#3D6A8E';
  const sparkBg = isVR ? 'rgba(139,195,74,0.10)' : 'rgba(61, 106, 142,0.10)';

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: cumData, borderColor: sparkColor, backgroundColor: sparkBg, tension: 0.42, fill: true, pointRadius: 0, borderWidth: 2.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: { duration: 800, easing: 'easeInOutQuart' }
    }
  });
}

// ===== GRÁFICO POR CATEGORIA =====
function createCategoryChart(transactions) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return null;
  const categories = {};
  transactions.filter(t => t.type === 'saida').forEach(t => { categories[t.category] = (categories[t.category] || 0) + t.amount; });
  if (Object.keys(categories).length === 0) return null;
  const COLORS = ['#3D6A8E', '#4CC9F0', '#C9A84C', '#4361EE', '#06D6A0', '#F8961E', '#4895EF', '#9CA3AF'];
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(categories).map(k => CATEGORY_MAP[k]?.label || k), datasets: [{ data: Object.values(categories), backgroundColor: COLORS, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } } }, cutout: '60%', animation: { duration: 800 } }
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
  if (Object.keys(responsible).length === 0) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(responsible),
      datasets: [
        { label: 'Receitas', data: Object.values(responsible).map(r => r.entrada), backgroundColor: '#4CC9F0', borderRadius: 6 },
        { label: 'Despesas', data: Object.values(responsible).map(r => r.saida), backgroundColor: '#3D6A8E', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } },
      animation: { duration: 800 }
    }
  });
}

// ===== GRÁFICO POR TIPO DE DÍVIDA =====
function createDebtTypeChart(debts) {
  const ctx = document.getElementById('debtTypeChart');
  if (!ctx) return null;
  const typeMap = {
    unica: { label: 'Únicas', color: '#9CA3AF' }, fixa: { label: 'Fixas', color: '#FF9F43' },
    cartao: { label: 'Cartão', color: '#8B5CF6' }, emprestimo: { label: 'Empréstimo', color: '#06D6A0' },
    financiamento: { label: 'Financiamento', color: '#4361EE' }, parcelada: { label: 'Financiamento', color: '#4361EE' }
  };
  const totals = {};
  debts.forEach(d => {
    const key = (d.debtType === 'parcelada') ? 'financiamento' : (d.debtType || 'unica');
    const val = (key === 'financiamento' || key === 'emprestimo' || (key === 'cartao' && d.cartaoMode === 'parcelado')) ? (d.installmentValue || d.amount) : d.amount;
    totals[key] = (totals[key] || 0) + val;
  });
  const keys = Object.keys(totals);
  if (keys.length === 0) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: keys.map(k => typeMap[k]?.label || k),
      datasets: [{ data: keys.map(k => totals[k]), backgroundColor: keys.map(k => typeMap[k]?.color || '#9CA3AF'), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: function(ctx) { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0; return `${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`; } } }
      },
      cutout: '60%', animation: { duration: 800 }
    }
  });
}
