// ============================================================
// DEBTS.JS — Controller de UI de dívidas
// Responsabilidade: DOM, eventos e orquestração.
// Lógica de dados → packages/services/debts/debts.service.js
// ============================================================

import { CATEGORY_MAP, BANK_IMG, CREDITOR_IMG } from '../../../../../packages/services/firebase/firebase.config.js';
import { state, getFamilyId } from '../../../../../packages/core/state/store.js';
import { generateId, esc, formatCurrency, formatDate, showAlert, emptyState } from '../../../../../packages/utils/helpers.js';
import { saveDataToStorage, saveToFirebase, deleteFromFirebase, updateInFirebase } from '../../../../../packages/services/firebase/firebase.service.js';
import { updateDashboard } from '../dashboard/dashboard.js';
import { updateTransactionHistory } from '../transactions/transactions.js';
import {
  buildDebtObject,
  buildPaymentTransaction,
  computeDebtStats,
  computeAlerts,
  getDebtDisplayStatus,
  matchesDebtFilter
} from '../../../../../packages/services/debts/debts.service.js';

// ===== ESTADO DO FILTRO =====
let currentDebtFilter    = null;
let _debtFilterDelegated = false;

// ===== ADICIONAR DÍVIDA =====
export function addDebt(e) {
  e.preventDefault();

  const familyId = getFamilyId();
  if (!familyId) { showAlert('Erro: família não identificada. Faça login novamente.', 'danger'); return; }

  const editId           = document.getElementById('editDebtId').value;
  const debtType         = document.getElementById('debtType').value;
  const totalAmount      = parseFloat(document.getElementById('debtAmount').value);
  const installments     = parseInt(document.getElementById('debtInstallments').value) || 1;
  const paidInstallments = parseInt(document.getElementById('debtPaidInstallments').value) || 0;
  const manualInstValue  = parseFloat(document.getElementById('debtInstallmentValue').value) || (totalAmount / installments);

  const isFinanciamento  = debtType === 'financiamento';
  const isEmprestimo     = debtType === 'emprestimo';
  const isCartao         = debtType === 'cartao';
  const cartaoMode       = document.getElementById('cartaoMode').value;
  const usesInstallments = isFinanciamento || isEmprestimo || (isCartao && cartaoMode === 'parcelado');

  const fixedSel = document.getElementById('debtFixedCreditor');
  const creditor = debtType === 'cartao'
    ? document.getElementById('debtCardIssuer').value
    : (debtType === 'emprestimo' || debtType === 'financiamento')
      ? document.getElementById('debtBankIssuer').value
      : debtType === 'fixa' && fixedSel && fixedSel.value !== '__outro__'
        ? fixedSel.value
        : document.getElementById('debtCreditor').value;
  const dueDate     = document.getElementById('debtDueDate').value;
  const responsible = document.getElementById('debtResponsible').value;
  const category    = document.getElementById('debtCategory').value || '';
  const description = document.getElementById('debtDescription').value;

  if (!creditor || !totalAmount || !dueDate) { alert('Por favor, preencha todos os campos obrigatórios!'); return; }

  if (editId) {
    const debt = state.debts.find(d => d.id === editId);
    if (!debt) return;
    const updates = {
      creditor, amount: totalAmount, dueDate, responsible, category, description,
      debtType, cartaoMode,
      installments:     usesInstallments ? installments     : 1,
      paidInstallments: usesInstallments ? paidInstallments : 0,
      installmentValue: usesInstallments ? manualInstValue  : totalAmount
    };
    Object.assign(debt, updates);
    saveDataToStorage();
    updateInFirebase('debts', editId, updates);
    showAlert('Dívida atualizada com sucesso!', 'success');
  } else {
    const debt = buildDebtObject({
      creditor, totalAmount, dueDate, responsible, category, description,
      debtType, cartaoMode, usesInstallments,
      installments, paidInstallments, installmentValue: manualInstValue,
      familyId
    });
    state.debts.push(debt);
    saveDataToStorage();
    saveToFirebase('debts', debt);
    showAlert('Dívida registrada com sucesso!', 'success');
  }

  resetDebtModal();
  document.getElementById('debtModal').classList.remove('active');
  updateDebtsList();
  updateDashboard();
}

// ===== RESETAR MODAL =====
export function resetDebtModal() {
  document.getElementById('debtForm').reset();
  document.getElementById('editDebtId').value = '';
  document.getElementById('debtType').value = 'unica';
  document.getElementById('installmentFields').style.display = 'none';
  document.getElementById('cartaoOptions').style.display = 'none';
  document.getElementById('cartaoMode').value = 'unica';
  document.getElementById('creditorTextGroup').style.display = 'block';
  document.getElementById('creditorFixedGroup').style.display = 'none';
  document.getElementById('creditorCardGroup').style.display = 'none';
  document.getElementById('creditorBankGroup').style.display = 'none';
  document.getElementById('debtCreditor').setAttribute('required', '');
  document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
  document.querySelector('.debt-type-toggle[data-value="unica"]')?.classList.add('active');
  document.querySelectorAll('.cartao-mode-toggle').forEach(b => b.classList.remove('active'));
  document.querySelector('.cartao-mode-toggle[data-value="unica"]')?.classList.add('active');
  document.getElementById('debtAmountLabel').textContent = 'Valor (R$)';
  document.getElementById('debtModalTitle').innerHTML = '<i class="fa-solid fa-credit-card"></i> Nova dívida';
  document.getElementById('debtSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Registrar';
}

// ===== EDITAR DÍVIDA =====
export function editDebt(id) {
  const debt = state.debts.find(d => d.id === id);
  if (!debt) return;

  document.getElementById('editDebtId').value        = debt.id;
  document.getElementById('debtAmount').value        = debt.amount;
  document.getElementById('debtDueDate').value       = debt.dueDate;
  document.getElementById('debtResponsible').value   = debt.responsible;
  document.getElementById('debtCategory').value      = debt.category || '';
  document.getElementById('debtDescription').value   = debt.description || '';

  const debtType  = (debt.debtType === 'parcelada') ? 'financiamento' : (debt.debtType || 'unica');
  document.getElementById('debtType').value = debtType;
  document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.debt-type-toggle[data-value="${debtType}"]`);

  if (debtType === 'cartao') {
    document.getElementById('creditorTextGroup').style.display = 'none';
    document.getElementById('creditorFixedGroup').style.display = 'none';
    document.getElementById('creditorCardGroup').style.display = 'block';
    document.getElementById('creditorBankGroup').style.display = 'none';
    document.getElementById('debtCreditor').removeAttribute('required');
    document.getElementById('debtCardIssuer').value = debt.creditor;
  } else if (debtType === 'emprestimo' || debtType === 'financiamento') {
    document.getElementById('creditorTextGroup').style.display = 'none';
    document.getElementById('creditorFixedGroup').style.display = 'none';
    document.getElementById('creditorCardGroup').style.display = 'none';
    document.getElementById('creditorBankGroup').style.display = 'block';
    document.getElementById('debtCreditor').removeAttribute('required');
    document.getElementById('debtBankIssuer').value = debt.creditor;
  } else if (debtType === 'fixa') {
    const fixedSel = document.getElementById('debtFixedCreditor');
    const isKnown  = [...fixedSel.options].some(o => o.value === debt.creditor);
    document.getElementById('creditorFixedGroup').style.display = 'block';
    document.getElementById('creditorCardGroup').style.display = 'none';
    document.getElementById('creditorBankGroup').style.display = 'none';
    if (isKnown) {
      fixedSel.value = debt.creditor;
      document.getElementById('creditorTextGroup').style.display = 'none';
      document.getElementById('debtCreditor').removeAttribute('required');
    } else {
      fixedSel.value = '__outro__';
      document.getElementById('creditorTextGroup').style.display = 'block';
      document.getElementById('debtCreditor').setAttribute('required', '');
      document.getElementById('debtCreditor').value = debt.creditor;
    }
  } else {
    document.getElementById('creditorTextGroup').style.display = 'block';
    document.getElementById('creditorFixedGroup').style.display = 'none';
    document.getElementById('creditorCardGroup').style.display = 'none';
    document.getElementById('creditorBankGroup').style.display = 'none';
    document.getElementById('debtCreditor').setAttribute('required', '');
    document.getElementById('debtCreditor').value = debt.creditor;
  }
  if (activeBtn) activeBtn.classList.add('active');

  const cartaoMode       = debt.cartaoMode || 'unica';
  const usesInstallments = debtType === 'financiamento' || debtType === 'emprestimo' || (debtType === 'cartao' && cartaoMode === 'parcelado');

  document.getElementById('cartaoOptions').style.display = debtType === 'cartao' ? 'block' : 'none';
  if (debtType === 'cartao') {
    document.getElementById('cartaoMode').value = cartaoMode;
    document.querySelectorAll('.cartao-mode-toggle').forEach(b => b.classList.remove('active'));
    document.querySelector(`.cartao-mode-toggle[data-value="${cartaoMode}"]`)?.classList.add('active');
  }

  document.getElementById('installmentFields').style.display = usesInstallments ? 'block' : 'none';
  if (usesInstallments) {
    document.getElementById('debtInstallments').value      = debt.installments || '';
    document.getElementById('debtInstallmentValue').value  = debt.installmentValue || '';
    document.getElementById('debtPaidInstallments').value  = debt.paidInstallments || 0;
    const remaining = debt.amount - ((debt.installmentValue || 0) * (debt.paidInstallments || 0));
    document.getElementById('debtRemainingValue').value    = remaining.toFixed(2);
    document.getElementById('debtAmountLabel').textContent = 'Valor Total (R$)';
  } else if (debtType === 'fixa' || (debtType === 'cartao' && cartaoMode === 'recorrente')) {
    document.getElementById('debtAmountLabel').textContent = 'Valor Mensal (R$)';
  } else {
    document.getElementById('debtAmountLabel').textContent = 'Valor (R$)';
  }

  document.getElementById('debtModalTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Editar dívida';
  document.getElementById('debtSubmitBtn').innerHTML  = '<i class="fa-solid fa-check"></i> Salvar';
  document.getElementById('debtModal').classList.add('active');
}

// ===== SETUP TOGGLES DE TIPO =====
export function setupDebtTypeListeners() {
  document.querySelectorAll('.debt-type-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const val          = this.dataset.value;
      const cartaoOpts   = document.getElementById('cartaoOptions');
      const installFields = document.getElementById('installmentFields');
      const bankGroup    = document.getElementById('creditorBankGroup');
      const fixedGroup   = document.getElementById('creditorFixedGroup');
      document.getElementById('debtType').value = val;

      if (val === 'cartao') {
        cartaoOpts.style.display = 'block';
        document.getElementById('creditorTextGroup').style.display = 'none';
        fixedGroup.style.display = 'none';
        document.getElementById('creditorCardGroup').style.display = 'block';
        bankGroup.style.display = 'none';
        document.getElementById('debtCreditor').removeAttribute('required');
        installFields.style.display = document.getElementById('cartaoMode').value === 'parcelado' ? 'block' : 'none';
      } else if (val === 'emprestimo' || val === 'financiamento') {
        cartaoOpts.style.display = 'none';
        document.getElementById('creditorTextGroup').style.display = 'none';
        fixedGroup.style.display = 'none';
        document.getElementById('creditorCardGroup').style.display = 'none';
        bankGroup.style.display = 'block';
        document.getElementById('debtCreditor').removeAttribute('required');
        installFields.style.display = 'block';
      } else if (val === 'fixa') {
        cartaoOpts.style.display = 'none';
        fixedGroup.style.display = 'block';
        document.getElementById('creditorCardGroup').style.display = 'none';
        bankGroup.style.display = 'none';
        installFields.style.display = 'none';
        const fixedSel = document.getElementById('debtFixedCreditor');
        if (fixedSel.value === '__outro__') {
          document.getElementById('creditorTextGroup').style.display = 'block';
          document.getElementById('debtCreditor').setAttribute('required', '');
        } else {
          document.getElementById('creditorTextGroup').style.display = 'none';
          document.getElementById('debtCreditor').removeAttribute('required');
        }
      } else {
        cartaoOpts.style.display = 'none';
        document.getElementById('creditorTextGroup').style.display = 'block';
        fixedGroup.style.display = 'none';
        document.getElementById('creditorCardGroup').style.display = 'none';
        bankGroup.style.display = 'none';
        document.getElementById('debtCreditor').setAttribute('required', '');
        installFields.style.display = 'none';
      }
      const amountLabel = document.getElementById('debtAmountLabel');
      const cartaoMode  = document.getElementById('cartaoMode').value;
      if (val === 'financiamento' || val === 'emprestimo' || (val === 'cartao' && cartaoMode === 'parcelado')) amountLabel.textContent = 'Valor Total (R$)';
      else if (val === 'fixa' || (val === 'cartao' && cartaoMode === 'recorrente'))                            amountLabel.textContent = 'Valor Mensal (R$)';
      else                                                                                                     amountLabel.textContent = 'Valor (R$)';
    });
  });

  document.querySelectorAll('.cartao-mode-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.cartao-mode-toggle').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const mode = this.dataset.value;
      document.getElementById('cartaoMode').value = mode;
      document.getElementById('installmentFields').style.display = mode === 'parcelado' ? 'block' : 'none';
      const amountLabel = document.getElementById('debtAmountLabel');
      if (mode === 'parcelado')   amountLabel.textContent = 'Valor Total (R$)';
      else if (mode === 'recorrente') amountLabel.textContent = 'Valor Mensal (R$)';
      else                            amountLabel.textContent = 'Valor (R$)';
    });
  });

  const fixedCreditorSel = document.getElementById('debtFixedCreditor');
  if (fixedCreditorSel) {
    fixedCreditorSel.addEventListener('change', function() {
      const textGroup     = document.getElementById('creditorTextGroup');
      const creditorInput = document.getElementById('debtCreditor');
      if (this.value === '__outro__') {
        textGroup.style.display = 'block';
        creditorInput.setAttribute('required', '');
        creditorInput.value = '';
      } else {
        textGroup.style.display = 'none';
        creditorInput.removeAttribute('required');
      }
    });
  }

  const amountInput      = document.getElementById('debtAmount');
  const installmentsInput = document.getElementById('debtInstallments');
  const paidInput        = document.getElementById('debtPaidInstallments');
  const instValueInput   = document.getElementById('debtInstallmentValue');

  function updateInstallmentCalc() {
    const total    = parseFloat(amountInput.value) || 0;
    const inst     = parseInt(installmentsInput.value) || 1;
    instValueInput.value = (total / inst).toFixed(2);
    updateRemainingCalc();
  }
  function updateRemainingCalc() {
    const paid     = parseInt(paidInput.value) || 0;
    const instVal  = parseFloat(instValueInput.value) || 0;
    const total    = parseFloat(amountInput.value) || 0;
    document.getElementById('debtRemainingValue').value = (total - (instVal * paid)).toFixed(2);
  }

  if (amountInput)       amountInput.addEventListener('input', updateInstallmentCalc);
  if (installmentsInput) installmentsInput.addEventListener('input', updateInstallmentCalc);
  if (instValueInput)    instValueInput.addEventListener('input', updateRemainingCalc);
  if (paidInput)         paidInput.addEventListener('input', updateRemainingCalc);
}

// ===== DELETAR DÍVIDA =====
export function deleteDebt(id) {
  if (!confirm('Deseja deletar esta dívida?')) return;
  state.debts = state.debts.filter(d => d.id !== id);
  saveDataToStorage();
  deleteFromFirebase('debts', id);
  updateDebtsList();
  showAlert('Dívida deletada com sucesso!', 'success');
}

// ===== PAGAR DÍVIDA =====
export function payDebt(id) {
  const debt = state.debts.find(d => d.id === id);
  if (!debt) return;

  const payment = buildPaymentTransaction(debt);
  if (!payment) { showAlert('Todas as parcelas já foram pagas!', 'info'); return; }

  let confirmMsg;
  if (payment.type === 'installment') {
    confirmMsg = `Pagar parcela ${payment.parcNum}/${debt.installments} de ${formatCurrency(payment.installmentValue)}?`;
  } else if (payment.type === 'fixa') {
    confirmMsg = `Pagar ${debt.creditor} deste ${payment.label}: ${formatCurrency(debt.amount)}?`;
  } else {
    confirmMsg = `Marcar dívida de ${formatCurrency(debt.amount)} como paga?`;
  }
  if (!confirm(confirmMsg)) return;

  Object.assign(debt, payment.debtUpdates);
  state.transactions.push(payment.transaction);
  saveToFirebase('transactions', payment.transaction);
  updateInFirebase('debts', id, payment.debtUpdates);

  let alertMsg;
  if (payment.type === 'installment') {
    alertMsg = payment.allPaid
      ? `Todas as ${debt.installments} parcelas pagas! Financiamento quitado!`
      : `Parcela ${payment.parcNum}/${debt.installments} paga! Próximo vencimento: ${formatDate(payment.nextDueDate)}`;
  } else if (payment.type === 'fixa') {
    alertMsg = `${debt.creditor} pago! Próximo vencimento: ${formatDate(payment.nextDueDate)}`;
  } else {
    alertMsg = 'Dívida marcada como paga e registrada como despesa!';
  }
  showAlert(alertMsg, 'success');

  saveDataToStorage();
  updateDebtsList();
  updateDashboard();
  updateTransactionHistory();
}

// ===== ATUALIZAR LISTA =====
export function updateDebtsList() {
  const container = document.getElementById('debtsList');
  const stats     = computeDebtStats(state.debts, state.familyMembers || []);

  document.getElementById('totalDebts').textContent  = formatCurrency(stats.totalMonthly);
  document.getElementById('activeDebts').textContent = stats.activeCount;

  const financingEl  = document.getElementById('totalFinancing');
  if (financingEl)   financingEl.textContent = formatCurrency(stats.totalFinancing);
  const loansEl      = document.getElementById('totalLoans');
  if (loansEl)       loansEl.textContent = formatCurrency(stats.totalLoan);
  const paidTabEl    = document.getElementById('totalPaidDebtsTab');
  if (paidTabEl)     paidTabEl.textContent = formatCurrency(stats.totalPaid);

  const monthlyCountEl = document.getElementById('monthlyDebtCount');
  if (monthlyCountEl) monthlyCountEl.textContent = `${stats.monthlyDebts.length} dívida${stats.monthlyDebts.length !== 1 ? 's' : ''}`;
  const financingCountEl = document.getElementById('financingDebtCount');
  if (financingCountEl) financingCountEl.textContent = `${stats.financingDebts.length} dívida${stats.financingDebts.length !== 1 ? 's' : ''}`;
  const financingRemEl = document.getElementById('financingRemaining');
  if (financingRemEl) financingRemEl.textContent = `Restante: ${formatCurrency(stats.totalFinancingRemaining)}`;
  const loanCountEl    = document.getElementById('loanDebtCount');
  if (loanCountEl)     loanCountEl.textContent = `${stats.loanDebts.length} dívida${stats.loanDebts.length !== 1 ? 's' : ''}`;
  const loanRemEl      = document.getElementById('loanRemaining');
  if (loanRemEl)       loanRemEl.textContent = `Restante: ${formatCurrency(stats.totalLoanRemaining)}`;

  (state.familyMembers || []).forEach(m => {
    const slug  = m.name.replace(/\s+/g, '_');
    const card  = stats.cardByMember[slug] || { total: 0, count: 0 };
    const totalEl = document.getElementById(`cardTotal_${slug}`);
    if (totalEl) totalEl.textContent = formatCurrency(card.total);
    const countEl = document.getElementById(`cardCount_${slug}`);
    if (countEl) countEl.textContent = `${card.count} dívida${card.count !== 1 ? 's' : ''}`;
  });

  if (state.debts.length === 0) { container.innerHTML = emptyState('Nenhuma dívida registrada ✅'); return; }

  const sorted = state.debts.slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return new Date(a.dueDate + 'T12:00:00') - new Date(b.dueDate + 'T12:00:00');
  });

  container.innerHTML = sorted.map(d => {
    const { statusBadge, statusLabel } = getDebtDisplayStatus(d);
    const cartaoMode     = d.cartaoMode || 'unica';
    const isFinanciamento = ((d.debtType === 'financiamento' || d.debtType === 'parcelada') && d.installments > 1) || (d.debtType === 'cartao' && cartaoMode === 'parcelado' && d.installments > 1);
    const isEmprestimo   = d.debtType === 'emprestimo' && d.installments > 1;
    const isFixa         = d.debtType === 'fixa' || (d.debtType === 'cartao' && cartaoMode === 'recorrente');
    const isCartao       = d.debtType === 'cartao';
    const hasInstallments = isFinanciamento || isEmprestimo;
    const paidInst       = d.paidInstallments || 0;
    const instValue      = d.installmentValue || (d.amount / (d.installments || 1));
    const remaining      = d.amount - (instValue * paidInst);
    const catInfo        = d.category ? CATEGORY_MAP[d.category] : null;

    let typeBadge = '', typeIcon = '';
    const bankImg = (isCartao || isEmprestimo || isFinanciamento) && BANK_IMG[d.creditor]
      ? `<img src="${BANK_IMG[d.creditor]}" alt="${esc(d.creditor)}" class="debt-bank-logo">` : '';

    if (isCartao && isFinanciamento)      { typeBadge = 'Cartão Parcelado';   typeIcon = bankImg || '<i class="fa-solid fa-credit-card"></i>'; }
    else if (isCartao && isFixa)          { typeBadge = 'Cartão Recorrente';  typeIcon = bankImg || '<i class="fa-solid fa-credit-card"></i>'; }
    else if (isCartao)                    { typeBadge = 'Cartão';             typeIcon = bankImg || '<i class="fa-solid fa-credit-card"></i>'; }
    else if (isEmprestimo)                { typeBadge = 'Empréstimo';         typeIcon = bankImg || '<i class="fa-solid fa-hand-holding-dollar"></i>'; }
    else if (isFinanciamento)             { typeBadge = 'Financiamento';      typeIcon = bankImg || '<i class="fa-solid fa-building-columns"></i>'; }
    else if (isFixa) {
      typeBadge = 'Fixa';
      const credImg = CREDITOR_IMG[d.creditor];
      typeIcon = credImg ? `<img src="${credImg}" alt="${esc(d.creditor)}" class="debt-bank-logo">` : '<i class="fa-solid fa-rotate"></i>';
    }

    let installmentHtml = '';
    if (hasInstallments) {
      const progressPct = Math.round((paidInst / d.installments) * 100);
      installmentHtml = `
        <div class="debt-installment-info">
          <div class="debt-installment-bar"><div class="debt-installment-progress" style="width:${progressPct}%"></div></div>
          <span class="debt-installment-text">${paidInst}/${d.installments} parcelas · Parcela: ${formatCurrency(instValue)}</span>
          <span class="debt-installment-remaining">Restante: ${formatCurrency(remaining)}</span>
        </div>`;
    }

    let payBtnLabel = 'Pagar';
    if (hasInstallments)         payBtnLabel = 'Pagar parcela';
    else if (isCartao && isFixa) payBtnLabel = 'Pagar fatura';
    else if (isFixa)             payBtnLabel = 'Pagar mês';

    return `
      <div class="debt-item ${d.status === 'paid' ? 'debt-paid' : ''} ${statusBadge === 'overdue' ? 'debt-overdue' : ''} ${hasInstallments ? 'debt-financing' : ''} ${isEmprestimo ? 'debt-emprestimo' : ''} ${isCartao ? 'debt-cartao' : ''} ${isFixa && !isCartao ? 'debt-fixed' : ''}" data-debt-id="${d.id}">
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
          <div class="debt-detail-item"><i class="fa-solid fa-user"></i><span>${esc(d.responsible)}</span></div>
          <div class="debt-detail-item"><i class="fa-solid fa-calendar"></i><span>${formatDate(d.dueDate)}</span></div>
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

  _updateDebtAlerts();
  if (currentDebtFilter) applyDebtFilter();
}

// ===== ALERTAS DE VENCIMENTO =====
function _updateDebtAlerts() {
  const container = document.getElementById('debtAlerts');
  const bellBtn   = document.getElementById('debtAlertsBell');
  const badgeEl   = document.getElementById('debtAlertsBadge');
  if (!container || !bellBtn || !badgeEl) return;

  const alerts = computeAlerts(state.debts);
  if (alerts.length === 0) { container.innerHTML = ''; bellBtn.style.display = 'none'; return; }

  bellBtn.style.display = 'flex';
  badgeEl.textContent   = alerts.length;
  bellBtn.classList.remove('has-alerts', 'has-overdue');
  bellBtn.classList.add(alerts.some(a => a.type === 'overdue') ? 'has-overdue' : 'has-alerts');

  container.innerHTML = alerts.map(a => {
    let label;
    if (a.type === 'overdue') label = `<strong>${esc(a.creditor)}</strong> venceu há ${Math.abs(a.days)} dia(s) — ${formatCurrency(a.amount)}`;
    else if (a.type === 'today') label = `<strong>${esc(a.creditor)}</strong> vence <strong>hoje</strong> — ${formatCurrency(a.amount)}`;
    else                         label = `<strong>${esc(a.creditor)}</strong> vence em ${a.days} dia(s) (${formatDate(a.dueDate)}) — ${formatCurrency(a.amount)}`;
    return `
    <div class="debt-alert debt-alert-${a.type}">
      <i class="fa-solid ${a.icon}"></i>
      <span>${label}</span>
    </div>`;
  }).join('');
}

// ===== BELL TOGGLE =====
document.addEventListener('click', (e) => {
  const bellBtn  = document.getElementById('debtAlertsBell');
  const dropdown = document.getElementById('debtAlertsDropdown');
  if (!bellBtn || !dropdown) return;
  if (bellBtn.contains(e.target)) dropdown.classList.toggle('open');
  else if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
});

// ===== FILTRO DE DÍVIDAS =====
export function setupDebtFilterListeners() {
  if (_debtFilterDelegated) return;
  _debtFilterDelegated = true;

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.debt-overview-card[data-filter], .summary-mini[data-filter]');
    if (!card) return;
    const filter = card.dataset.filter;
    if (currentDebtFilter === filter) { clearDebtFilter(); return; }
    currentDebtFilter = filter;
    document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(c => c.classList.remove('filter-active'));
    card.classList.add('filter-active');
    const filterBar   = document.getElementById('debtFilterBar');
    const filterLabel = document.getElementById('debtFilterLabel');
    const labels = { monthly: 'Mensais (Fixas + Únicas)', financing: 'Financiamentos', loan: 'Empréstimos', all: 'Todas Ativas', paid: 'Pagas' };
    (state.familyMembers || []).forEach(m => { labels[`cartao-${m.name.replace(/\s+/g, '_')}`] = `Cartão ${m.name}`; });
    filterLabel.innerHTML = `<i class="fa-solid fa-filter"></i> ${labels[filter] || filter}`;
    filterBar.classList.add('show');
    applyDebtFilter();
  });
}

export function clearDebtFilter() {
  currentDebtFilter = null;
  document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(c => c.classList.remove('filter-active'));
  document.getElementById('debtFilterBar').classList.remove('show');
  document.querySelectorAll('#debtsList .debt-item').forEach(el => { el.style.display = ''; });
}

function applyDebtFilter() {
  if (!currentDebtFilter) return;
  document.querySelectorAll('#debtsList .debt-item').forEach(el => {
    const debtId = el.dataset.debtId;
    if (!debtId) { el.style.display = ''; return; }
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) { el.style.display = ''; return; }
    el.style.display = matchesDebtFilter(debt, currentDebtFilter, state.familyMembers || []) ? '' : 'none';
  });
}

// Globals para inline handlers
window.editDebt  = editDebt;
window.payDebt   = payDebt;
window.deleteDebt = deleteDebt;
window.clearDebtFilter = clearDebtFilter;
window._setupDebtFilterListeners = setupDebtFilterListeners;
