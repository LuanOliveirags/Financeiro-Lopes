// ============================================================
// TRANSACTIONS.SERVICE.JS — Dados e lógica de negócio de transações
// Sem dependências de DOM. Importável por qualquer camada.
// ============================================================

import { generateId } from '../../utils/helpers.js';

// ===== FACTORY =====

export function buildTransactionObject({ type, amount, category, responsible, date, description, paymentMethod, familyId }) {
  return {
    id: generateId(),
    type,
    amount,
    category,
    responsible,
    date,
    description,
    paymentMethod: paymentMethod || 'dinheiro',
    familyId,
    createdAt: new Date().toISOString()
  };
}

// ===== FILTROS =====

export function filterTransactions(transactions, { monthVal, selectedDay, typeFilter }) {
  let filtered = transactions;
  if (selectedDay) {
    filtered = filtered.filter(t => t.date === selectedDay);
  } else if (monthVal) {
    filtered = filtered.filter(t => t.date.startsWith(monthVal));
  }
  if (typeFilter && typeFilter !== 'all') {
    filtered = filtered.filter(t => t.type === typeFilter);
  }
  return filtered;
}

// ===== AGRUPAMENTO =====

export function groupByDate(transactions) {
  const grouped = {};
  transactions.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items,
      dayTotal: items.reduce((s, t) => s + (t.type === 'entrada' ? t.amount : -t.amount), 0)
    }));
}
