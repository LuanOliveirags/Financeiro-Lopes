// ============================================================
// DEBTS.SERVICE.JS — Dados e lógica de negócio de dívidas
// Sem dependências de DOM. Importável por qualquer camada.
// ============================================================

import { generateId, toDateStr } from '../../utils/helpers.js';

// ===== FACTORY =====

export function buildDebtObject({ creditor, totalAmount, dueDate, responsible, category, description, debtType, cartaoMode, usesInstallments, installments, paidInstallments, installmentValue, familyId }) {
  return {
    id: generateId(),
    creditor,
    amount: totalAmount,
    dueDate,
    responsible,
    category,
    description,
    debtType,
    cartaoMode,
    installments: usesInstallments ? installments : 1,
    paidInstallments: usesInstallments ? paidInstallments : 0,
    installmentValue: usesInstallments ? installmentValue : totalAmount,
    status: 'active',
    paidAt: null,
    familyId,
    createdAt: new Date().toISOString()
  };
}

// ===== PAGAMENTO =====

/**
 * Calcula os dados de pagamento de uma dívida.
 * Retorna null se todas as parcelas já foram pagas.
 * Retorna { type, transaction, debtUpdates, ...campos específicos por tipo }
 */
export function buildPaymentTransaction(debt) {
  const cartaoMode = debt.cartaoMode || 'unica';
  const isInstallmentDebt =
    ((debt.debtType === 'financiamento' || debt.debtType === 'parcelada' || debt.debtType === 'emprestimo') && debt.installments > 1) ||
    (debt.debtType === 'cartao' && cartaoMode === 'parcelado' && debt.installments > 1);
  const isFixaDebt = debt.debtType === 'fixa' || (debt.debtType === 'cartao' && cartaoMode === 'recorrente');

  const now = new Date();
  const today = toDateStr(now);

  if (isInstallmentDebt) {
    const paidSoFar = debt.paidInstallments || 0;
    if (paidSoFar >= debt.installments) return null;
    const installmentValue = debt.installmentValue || (debt.amount / debt.installments);
    const parcNum = paidSoFar + 1;
    const allPaid = parcNum >= debt.installments;
    const nextDue = new Date(debt.dueDate + 'T12:00:00');
    nextDue.setMonth(nextDue.getMonth() + 1);
    const nextDueDate = toDateStr(nextDue);

    return {
      type: 'installment',
      parcNum,
      installmentValue,
      allPaid,
      nextDueDate,
      transaction: {
        id: generateId(), type: 'saida', amount: installmentValue,
        category: debt.category || 'outros', responsible: debt.responsible,
        date: today,
        description: `${debt.creditor} - Parcela ${parcNum}/${debt.installments}`,
        fromDebt: debt.id, createdAt: now.toISOString()
      },
      debtUpdates: {
        paidInstallments: parcNum,
        status: allPaid ? 'paid' : 'active',
        dueDate: allPaid ? debt.dueDate : nextDueDate,
        paidAt: allPaid ? now.toISOString() : null
      }
    };
  }

  if (isFixaDebt) {
    const nextDue = new Date(debt.dueDate + 'T12:00:00');
    nextDue.setMonth(nextDue.getMonth() + 1);
    const nextDueDate = toDateStr(nextDue);
    return {
      type: 'fixa',
      label: debt.debtType === 'cartao' ? 'fatura' : 'mês',
      nextDueDate,
      transaction: {
        id: generateId(), type: 'saida', amount: debt.amount,
        category: debt.category || 'outros', responsible: debt.responsible,
        date: today,
        description: `${debt.creditor} - ${debt.debtType === 'cartao' ? 'Fatura' : 'Mensal'}`,
        fromDebt: debt.id, createdAt: now.toISOString()
      },
      debtUpdates: { dueDate: nextDueDate }
    };
  }

  return {
    type: 'unica',
    transaction: {
      id: generateId(), type: 'saida', amount: debt.amount,
      category: debt.category || 'outros', responsible: debt.responsible,
      date: today,
      description: `Dívida paga: ${debt.creditor}`,
      fromDebt: debt.id, createdAt: now.toISOString()
    },
    debtUpdates: { status: 'paid', paidAt: now.toISOString() }
  };
}

// ===== ESTATÍSTICAS =====

export function computeDebtStats(debts, familyMembers) {
  const activeDebts = debts.filter(d => d.status === 'active');

  const isInstType = d => {
    const m = d.cartaoMode || 'unica';
    return (d.debtType === 'financiamento' || d.debtType === 'parcelada' || d.debtType === 'emprestimo') ||
      (d.debtType === 'cartao' && m === 'parcelado');
  };

  const monthlyDebts   = activeDebts.filter(d => !isInstType(d));
  const financingDebts = activeDebts.filter(d => {
    const m = d.cartaoMode || 'unica';
    return (d.debtType === 'financiamento' || d.debtType === 'parcelada') || (d.debtType === 'cartao' && m === 'parcelado');
  });
  const loanDebts = activeDebts.filter(d => d.debtType === 'emprestimo');

  const remainingFor = d => {
    const instVal = d.installmentValue || (d.amount / (d.installments || 1));
    return d.amount - (instVal * (d.paidInstallments || 0));
  };

  const totalMonthly           = monthlyDebts.reduce((s, d) => s + d.amount, 0);
  const totalFinancing         = financingDebts.reduce((s, d) => s + (d.installmentValue || d.amount), 0);
  const totalFinancingRemaining = financingDebts.reduce((s, d) => s + remainingFor(d), 0);
  const totalLoan              = loanDebts.reduce((s, d) => s + (d.installmentValue || d.amount), 0);
  const totalLoanRemaining     = loanDebts.reduce((s, d) => s + remainingFor(d), 0);
  const activeCount            = activeDebts.length;
  const totalPaid              = debts.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0);

  const cardDebts          = activeDebts.filter(d => d.debtType === 'cartao');
  const cardAmbosByPerson  = cardDebts.filter(d => d.responsible === 'Ambos');
  const memberCount        = familyMembers.length || 1;
  const cardByMember       = {};
  familyMembers.forEach(m => {
    const slug     = m.name.replace(/\s+/g, '_');
    const personal = cardDebts.filter(d => d.responsible === m.name);
    const total    = personal.reduce((s, d) => s + (d.installmentValue || d.amount), 0)
      + cardAmbosByPerson.reduce((s, d) => s + (d.installmentValue || d.amount) / memberCount, 0);
    cardByMember[slug] = { total, count: personal.length + cardAmbosByPerson.length };
  });

  return {
    totalMonthly, totalFinancing, totalFinancingRemaining,
    totalLoan, totalLoanRemaining,
    activeCount, totalPaid,
    monthlyDebts, financingDebts, loanDebts,
    cardByMember
  };
}

// ===== ALERTAS =====

export function computeAlerts(debts) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const alerts = [];

  debts.filter(d => d.status === 'active').forEach(d => {
    const due = new Date(d.dueDate + 'T12:00:00'); due.setHours(0, 0, 0, 0);
    const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    const amount = d.installmentValue || d.amount;
    if      (days < 0)  alerts.push({ type: 'overdue', icon: 'fa-circle-exclamation', creditor: d.creditor, days, amount, dueDate: d.dueDate });
    else if (days === 0) alerts.push({ type: 'today',   icon: 'fa-bell',              creditor: d.creditor, days, amount, dueDate: d.dueDate });
    else if (days <= 7)  alerts.push({ type: 'soon',    icon: 'fa-clock',             creditor: d.creditor, days, amount, dueDate: d.dueDate });
  });

  alerts.sort((a, b) => a.days - b.days);
  return alerts;
}

// ===== STATUS VISUAL =====

export function getDebtDisplayStatus(debt) {
  if (debt.status === 'paid') return { statusBadge: 'paid', statusLabel: 'Paga' };
  const dueDate = new Date(debt.dueDate + 'T12:00:00');
  const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue < 0) return { statusBadge: 'overdue',  statusLabel: 'Atrasada' };
  if (daysUntilDue < 7) return { statusBadge: 'due-soon', statusLabel: `${daysUntilDue}d restantes` };
  return { statusBadge: 'active', statusLabel: 'Ativa' };
}

// ===== FILTRO =====

export function matchesDebtFilter(debt, filter, familyMembers) {
  if (!filter) return true;
  const cartaoMode    = debt.cartaoMode || 'unica';
  const isFinancing   = (debt.debtType === 'financiamento' || debt.debtType === 'parcelada') || (debt.debtType === 'cartao' && cartaoMode === 'parcelado');
  const isLoan        = debt.debtType === 'emprestimo';
  const isInstType    = isFinancing || isLoan;

  switch (filter) {
    case 'monthly':   return debt.status === 'active' && !isInstType;
    case 'financing': return debt.status === 'active' && isFinancing;
    case 'loan':      return debt.status === 'active' && isLoan;
    case 'all':       return debt.status === 'active';
    case 'paid':      return debt.status === 'paid';
    default:
      if (filter.startsWith('cartao-')) {
        const slug       = filter.replace('cartao-', '');
        const memberName = (familyMembers || []).find(m => m.name.replace(/\s+/g, '_') === slug)?.name;
        return memberName
          ? debt.status === 'active' && debt.debtType === 'cartao' && (debt.responsible === memberName || debt.responsible === 'Ambos')
          : true;
      }
      return true;
  }
}
