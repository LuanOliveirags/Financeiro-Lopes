// ============================================================
// TRANSACTIONS.JS — CRUD e UI de transações
// ============================================================

import { CATEGORY_MAP } from '../../app/providers/firebase-config.js';
import { state, getFamilyId } from '../../app/state/store.js';
import { generateId, esc, formatCurrency, formatDate, showAlert, emptyState, toDateStr } from '../../shared/utils/helpers.js';
import { saveDataToStorage } from '../../app/providers/firebase-provider.js';
import { saveToFirebase, deleteFromFirebase } from '../../app/providers/firebase-provider.js';
import { updateDashboard } from '../dashboard/dashboard.js';

// ===== ADICIONAR TRANSAÇÃO =====
export function addTransaction(e) {
  e.preventDefault();
  const familyId = getFamilyId();
  if (!familyId) { showAlert('Erro: família não identificada.', 'danger'); return; }

  const transaction = {
    id: generateId(),
    type: document.getElementById('transType').value,
    amount: parseFloat(document.getElementById('tranAmount').value),
    category: document.getElementById('tranCategory').value,
    responsible: document.getElementById('tranResponsible').value,
    date: document.getElementById('tranDate').value,
    description: document.getElementById('tranDescription').value,
    paymentMethod: document.getElementById('tranPaymentMethod')?.value || 'dinheiro',
    familyId,
    createdAt: new Date().toISOString()
  };

  if (!transaction.type || !transaction.amount || !transaction.category || !transaction.responsible) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }

  state.transactions.push(transaction);
  saveDataToStorage();
  saveToFirebase('transactions', transaction);
  showAlert('Transação registrada!', 'success');

  e.target.reset();
  document.getElementById('tranDate').value = toDateStr(new Date());
  document.getElementById('transType').value = 'saida';
  document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btnSaida')?.classList.add('active');

  // Reset payment method
  document.getElementById('tranPaymentMethod').value = 'dinheiro';
  document.querySelectorAll('#tranPaymentMethods .shop-pay-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#tranPaymentMethods .shop-pay-btn[data-method="dinheiro"]')?.classList.add('active');

  updateDashboard();
  updateTransactionHistory();
}

// ===== DELETAR TRANSAÇÃO =====
export function deleteTransaction(id) {
  if (confirm('Deseja deletar esta transação?')) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveDataToStorage();
    deleteFromFirebase('transactions', id);
    updateDashboard();
    updateTransactionHistory();
    showAlert('Transação deletada!', 'success');
  }
}

// ===== RENDER TRANSACTION ITEM =====
export function renderTransactionItem(t) {
  const cat = CATEGORY_MAP[t.category] || { icon: '📁', label: t.category, css: 'cat-outros' };
  const isIn = t.type === 'entrada';
  const iconCss = isIn ? 'cat-entrada' : cat.css;
  const icon = isIn ? '💰' : cat.icon;
  const sign = isIn ? '+' : '−';
  const amtClass = isIn ? 'entrada' : 'saida';
  const catLabel = isIn ? 'Receita' : cat.label;

  const isVR = t.paymentMethod === 'vr';
  const vrBadge = isVR ? ' <span class="vr-badge">VR/VA</span>' : '';

  return `
    <div class="transaction-item">
      <div class="trans-icon-wrap ${isVR ? 'cat-vr' : iconCss}">${isVR ? '🍽️' : icon}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(t.description) || catLabel}${vrBadge}</div>
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

// ===== TRANSAÇÕES RECENTES (Dashboard) =====
export function updateRecentTransactions(transactions) {
  const container = document.getElementById('recentTransactionsList');
  if (!container) return;
  if (transactions.length === 0) { container.innerHTML = emptyState('Nenhuma transação este mês'); return; }
  container.innerHTML = transactions.slice(-5).reverse().map(t => renderTransactionItem(t)).join('');
}

// ===== HISTÓRICO DE TRANSAÇÕES =====
export function updateTransactionHistory() {
  const container = document.getElementById('transactionHistoryList');
  if (!container) return;

  const monthVal = document.getElementById('historyMonth')?.value;
  const filter = document.getElementById('historyFilter')?.value || 'all';
  let filtered = state.transactions;

  if (state.selectedDay) {
    filtered = filtered.filter(t => t.date === state.selectedDay);
  } else if (monthVal) {
    filtered = filtered.filter(t => t.date.startsWith(monthVal));
  }

  if (filter !== 'all') filtered = filtered.filter(t => t.type === filter);

  if (filtered.length === 0) {
    container.innerHTML = emptyState(state.selectedDay ? 'Nenhuma transação neste dia' : 'Nenhuma transação encontrada');
    return;
  }

  const grouped = {};
  filtered.forEach(t => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });

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

// Registra funções no escopo global para chamadas inline do HTML
window.deleteTransaction = deleteTransaction;
