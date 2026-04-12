// ============================================================
// DASHBOARD.JS — Dashboard KPIs e gráficos (Chart.js)
// ============================================================
/* global Chart */

import { CATEGORY_MAP } from './config.js';
import { state } from './state.js';
import { formatCurrency } from './utils.js';
import { updateRecentTransactions } from './transactions.js';

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

  // KPI Cards
  document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
  document.getElementById('totalSpent').textContent = formatCurrency(totalDebt);
  document.getElementById('totalResponsible').textContent = responsibleCount;

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('dashMonthlyDebts', formatCurrency(totalMonthlyDebts));
  el('dashMonthlyCount', `${monthlyDebtsActive.length} ativa${monthlyDebtsActive.length !== 1 ? 's' : ''}`);
  el('dashFinancingDebts', formatCurrency(totalFinancingInstallment));
  el('dashFinancingRemaining', `Restante: ${formatCurrency(totalFinancingRemaining)}`);
  el('dashLoanDebts', formatCurrency(totalLoanInstallment));
  el('dashLoanRemaining', `Restante: ${formatCurrency(totalLoanRemaining)}`);
  el('totalPaidDebts', formatCurrency(totalPaidDebts));
  el('totalDeductionsDash', formatCurrency(totalMonthDeductions));
  el('totalIncomeDash', formatCurrency(totalIncome));

  // VR/VA Dashboard
  const vrIncomeTotal = vrSalaries.reduce((sum, s) => sum + s.amount, 0);
  const vrExpenseTotal = vrTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.amount, 0);
  const vrBalanceVal = vrIncomeTotal - vrExpenseTotal;
  el('vrIncome', formatCurrency(vrIncomeTotal));
  el('vrExpense', formatCurrency(vrExpenseTotal));
  el('vrBalance', formatCurrency(vrBalanceVal));
  const vrCard = document.getElementById('vrDashboardCard');
  if (vrCard) vrCard.style.display = (vrIncomeTotal > 0 || vrExpenseTotal > 0) ? '' : 'none';

  updateCharts(generalTransactions, monthDebts);
  updateRecentTransactions(monthTransactions);
}

// ===== ATUALIZAR GRÁFICOS =====
export function updateCharts(transactions, debts) {
  Object.values(state.charts).forEach(chart => { if (chart) chart.destroy(); });
  state.charts = {};
  state.charts.sparkline = createBalanceSparkline(transactions);
  state.charts.category = createCategoryChart(transactions);
  state.charts.responsible = createResponsibleChart(transactions);
  state.charts.incomes = createIncomesChart(state.salaries);
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

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: cumData, borderColor: '#F72585', backgroundColor: 'rgba(247,37,133,0.10)', tension: 0.42, fill: true, pointRadius: 0, borderWidth: 2.5 }] },
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
  const COLORS = ['#F72585', '#4CC9F0', '#7209B7', '#4361EE', '#06D6A0', '#F8961E', '#4895EF', '#9CA3AF'];
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
        { label: 'Despesas', data: Object.values(responsible).map(r => r.saida), backgroundColor: '#F72585', borderRadius: 6 }
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

// ===== GRÁFICO DE SALÁRIOS =====
function createIncomesChart(salaries) {
  const ctx = document.getElementById('incomesChart');
  if (!ctx) return null;
  const members = state.familyMembers || [];
  const chartColors = ['#4361EE', '#F72585', '#06D6A0', '#FF6B35', '#8B5CF6', '#14B8A6'];
  const incomesData = {};
  salaries.forEach(s => {
    const date = new Date(s.date + 'T12:00:00');
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!incomesData[key]) { incomesData[key] = {}; members.forEach(m => { incomesData[key][m.name] = 0; }); }
    if (incomesData[key][s.person] !== undefined) incomesData[key][s.person] += s.amount;
  });
  const months = Object.keys(incomesData).sort();
  if (months.length === 0) return null;
  const datasets = members.map((m, i) => ({
    label: m.name, data: months.map(mo => incomesData[mo][m.name] || 0),
    backgroundColor: chartColors[i % chartColors.length], borderRadius: 6
  }));
  return new Chart(ctx, {
    type: 'bar', data: { labels: months, datasets },
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
