// ============================================================
// SALARIES.JS — CRUD e UI de salários / entradas
// ============================================================

import { state, getFamilyId } from '../../../utils/state.js';
import { generateId, esc, formatCurrency, formatDate, showAlert, emptyState } from '../../../utils/helpers.js';
import { saveDataToStorage, saveToFirebase, deleteFromFirebase } from '../../../services/firebase/collections.js';
import { updateDashboard } from './dashboard.js';

// ===== TEMP DEDUCTIONS/ADDITIONS =====
let tempDeductions = [];
let tempAdditions = [];

// ===== ADICIONAR SALÁRIO =====
export function addSalary(e) {
  e.preventDefault();
  const grossAmount = parseFloat(document.getElementById('salaryAmount').value);
  const totalAdditionsVal = tempAdditions.reduce((sum, a) => sum + a.value, 0);
  const totalDeductionsVal = tempDeductions.reduce((sum, d) => sum + d.value, 0);
  const netAmount = grossAmount + totalAdditionsVal - totalDeductionsVal;

  const familyId = getFamilyId();
  if (!familyId) { showAlert('Erro: família não identificada.', 'danger'); return; }

  const salary = {
    id: generateId(),
    person: document.getElementById('salaryPerson').value,
    amount: netAmount,
    grossAmount,
    salaryType: document.getElementById('salaryType')?.value || 'salario',
    additions: tempAdditions.length > 0 ? [...tempAdditions] : [],
    totalAdditions: totalAdditionsVal,
    deductions: tempDeductions.length > 0 ? [...tempDeductions] : [],
    totalDeductions: totalDeductionsVal,
    date: document.getElementById('salaryDate').value,
    description: document.getElementById('salaryDescription').value,
    familyId,
    createdAt: new Date().toISOString()
  };

  if (!salary.person || !grossAmount || !salary.date) { alert('Preencha todos os campos!'); return; }

  state.salaries.push(salary);
  saveDataToStorage();
  saveToFirebase('salaries', salary);
  showAlert('Entrada registrada!', 'success');

  e.target.reset();
  tempDeductions = [];
  tempAdditions = [];
  updateDeductionsUI();
  updateAdditionsUI();
  // Reset salary type toggle
  document.getElementById('salaryType').value = 'salario';
  document.querySelectorAll('.salary-type-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btnSalario')?.classList.add('active');
  document.getElementById('salaryModal').classList.remove('active');
  updateSalaryDisplay();
  updateDashboard();
}

// ===== DELETAR SALÁRIO =====
export function deleteSalary(id) {
  if (confirm('Deseja deletar este salário?')) {
    state.salaries = state.salaries.filter(s => s.id !== id);
    saveDataToStorage();
    deleteFromFirebase('salaries', id);
    updateSalaryDisplay();
    updateDashboard();
    showAlert('Salário deletado!', 'success');
  }
}

// ===== ACRÉSCIMOS =====
export function addAddition() {
  const nameInput = document.getElementById('additionName');
  const valueInput = document.getElementById('additionValue');
  const name = nameInput.value.trim();
  const value = parseFloat(valueInput.value);
  if (!name || !value || value <= 0) { showAlert('Preencha nome e valor.', 'warning'); return; }
  tempAdditions.push({ id: generateId(), name, value });
  nameInput.value = ''; valueInput.value = '';
  updateAdditionsUI();
}

export function removeAddition(id) {
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
      <button type="button" class="btn-remove-deduction" onclick="removeAddition('${a.id}')"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
  const total = tempAdditions.reduce((sum, a) => sum + a.value, 0);
  const totalEl = document.getElementById('totalAdditions');
  if (totalEl) totalEl.textContent = formatCurrency(total);
  updateNetSalaryPreview();
}

// ===== DESCONTOS =====
export function addDeduction() {
  const nameInput = document.getElementById('deductionName');
  const valueInput = document.getElementById('deductionValue');
  const name = nameInput.value.trim();
  const value = parseFloat(valueInput.value);
  if (!name || !value || value <= 0) { showAlert('Preencha nome e valor.', 'warning'); return; }
  tempDeductions.push({ id: generateId(), name, value });
  nameInput.value = ''; valueInput.value = '';
  updateDeductionsUI();
}

export function removeDeduction(id) {
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
      <button type="button" class="btn-remove-deduction" onclick="removeDeduction('${d.id}')"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
  const total = tempDeductions.reduce((sum, d) => sum + d.value, 0);
  const totalEl = document.getElementById('totalDeductions');
  if (totalEl) totalEl.textContent = formatCurrency(total);
  updateNetSalaryPreview();
}

function updateNetSalaryPreview() {
  const gross = parseFloat(document.getElementById('salaryAmount').value) || 0;
  const totalAdd = tempAdditions.reduce((sum, a) => sum + a.value, 0);
  const totalDed = tempDeductions.reduce((sum, d) => sum + d.value, 0);
  const net = gross + totalAdd - totalDed;
  const netEl = document.getElementById('netSalaryPreview');
  if (netEl) netEl.textContent = formatCurrency(net);
}

// ===== SETUP DEDUCTION LISTENERS =====
export function setupDeductionListeners() {
  // Salary type toggle (Salário / VR)
  document.querySelectorAll('.salary-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.salary-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('salaryType').value = btn.dataset.type;
    });
  });

  const toggleAddBtn = document.getElementById('toggleAdditionsBtn');
  const addBody = document.getElementById('additionsBody');
  if (toggleAddBtn && addBody) {
    toggleAddBtn.addEventListener('click', () => {
      const isOpen = addBody.classList.toggle('open');
      const chevron = toggleAddBtn.querySelector('.deductions-chevron');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
    });
  }
  document.getElementById('addAdditionBtn')?.addEventListener('click', addAddition);

  const toggleBtn = document.getElementById('toggleDeductionsBtn');
  const body = document.getElementById('deductionsBody');
  if (toggleBtn && body) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = body.classList.toggle('open');
      const chevron = toggleBtn.querySelector('.deductions-chevron');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
    });
  }
  document.getElementById('addDeductionBtn')?.addEventListener('click', addDeduction);

  const salaryAmountInput = document.getElementById('salaryAmount');
  if (salaryAmountInput) salaryAmountInput.addEventListener('input', updateNetSalaryPreview);
}

// ===== ATUALIZAR DISPLAY DE SALÁRIOS =====
export function updateSalaryDisplay() {
  const members = state.familyMembers || [];
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
  let combinedVRMonth = 0, combinedVRAnnual = 0;
  members.forEach(m => {
    const slug = m.name.replace(/\s+/g, '_');
    const personSalaries = state.salaries.filter(s => s.person === m.name && s.salaryType !== 'vr');
    const personVR = state.salaries.filter(s => s.person === m.name && s.salaryType === 'vr');

    const annual = personSalaries.reduce((sum, s) => sum + s.amount, 0);
    const monthly = personSalaries
      .filter(s => { const d = new Date(s.date + 'T12:00:00'); return d.getMonth() === curMonth && d.getFullYear() === curYear; })
      .reduce((sum, s) => sum + s.amount, 0);

    const vrAnnual = personVR.reduce((sum, s) => sum + s.amount, 0);
    const vrMonthly = personVR
      .filter(s => { const d = new Date(s.date + 'T12:00:00'); return d.getMonth() === curMonth && d.getFullYear() === curYear; })
      .reduce((sum, s) => sum + s.amount, 0);

    combinedMonth += monthly;
    combinedAnnual += annual;
    combinedVRMonth += vrMonthly;
    combinedVRAnnual += vrAnnual;

    const salEl = document.getElementById(`salary_${slug}`);
    if (salEl) salEl.textContent = formatCurrency(monthly);
    const vrEl = document.getElementById(`vr_${slug}`);
    if (vrEl) vrEl.textContent = formatCurrency(vrMonthly);
    const annEl = document.getElementById(`annual_${slug}`);
    if (annEl) annEl.textContent = `Anual: ${formatCurrency(annual)}`;
  });
  const combSalEl = document.getElementById('combinedSalary');
  if (combSalEl) combSalEl.textContent = formatCurrency(combinedMonth);
  const combAnnEl = document.getElementById('combinedAnnual');
  if (combAnnEl) combAnnEl.textContent = `Anual: ${formatCurrency(combinedAnnual)}`;
  const combVREl = document.getElementById('combinedVR');
  if (combVREl) combVREl.textContent = formatCurrency(combinedVRMonth);
  const combVRAnnEl = document.getElementById('combinedVRAnnual');
  if (combVRAnnEl) combVRAnnEl.textContent = `Anual: ${formatCurrency(combinedVRAnnual)}`;

  populateSalaryMonthFilter();
  updateSalaryHistory();
}

// ===== FILTRO MÊS SALÁRIO =====
export function populateSalaryMonthFilter() {
  const select = document.getElementById('salaryMonthFilter');
  if (!select) return;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthsSet = new Set();
  state.salaries.forEach(s => {
    const d = new Date(s.date + 'T12:00:00');
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthsSet.add(curKey);
  const sortedMonths = Array.from(monthsSet).sort().reverse();
  const prevValue = select.value;
  select.innerHTML = sortedMonths.map(key => {
    const [y, m] = key.split('-');
    return `<option value="${key}">${months[parseInt(m) - 1]} ${y}</option>`;
  }).join('');
  select.value = (prevValue && sortedMonths.includes(prevValue)) ? prevValue : curKey;
}

// ===== HISTÓRICO DE SALÁRIOS =====
export function updateSalaryHistory() {
  const container = document.getElementById('salaryHistoryList');
  if (!container) return;
  const filterVal = document.getElementById('salaryMonthFilter')?.value;
  let filtered = state.salaries;
  if (filterVal) filtered = state.salaries.filter(s => s.date.startsWith(filterVal));
  if (filtered.length === 0) { container.innerHTML = emptyState('Nenhuma entrada neste mês'); return; }

  const sorted = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));
  const defaultIcons = ['👔', '💼', '🧑‍💻', '👨‍🔧', '👩‍⚕️', '🧑‍🎓'];
  const personIcon = {};
  (state.familyMembers || []).forEach((m, i) => { personIcon[m.name] = defaultIcons[i % defaultIcons.length]; });

  container.innerHTML = sorted.map(s => {
    const hasAdditions = s.additions && s.additions.length > 0;
    const hasDeductions = s.deductions && s.deductions.length > 0;
    const hasExtras = hasAdditions || hasDeductions;
    const grossLabel = hasExtras ? `Bruto: ${formatCurrency(s.grossAmount || s.amount)}` : '';
    const additionsHtml = hasAdditions ? `<div class="salary-deductions-detail">${s.additions.map(a => `<span class="addition-tag">↑ ${esc(a.name)}: ${formatCurrency(a.value)}</span>`).join('')}</div>` : '';
    const deductionsHtml = hasDeductions ? `<div class="salary-deductions-detail">${s.deductions.map(d => `<span class="deduction-tag">↓ ${esc(d.name)}: ${formatCurrency(d.value)}</span>`).join('')}</div>` : '';

    const isVR = s.salaryType === 'vr';
    const typeIcon = isVR ? '🍽️' : (personIcon[s.person] || '💰');
    const typeBadge = isVR ? '<span class="vr-badge">VR/VA</span>' : '';
    const defaultDesc = isVR ? `VR/VA de ${esc(s.person)}` : `Salário de ${esc(s.person)}`;

    return `
    <div class="transaction-item ${isVR ? 'transaction-vr' : ''}">
      <div class="trans-icon-wrap ${isVR ? 'cat-vr' : 'cat-entrada'}">${typeIcon}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(s.description) || defaultDesc} ${typeBadge}</div>
        <div class="trans-meta">
          <span>${formatDate(s.date)}</span><span>·</span><span>${esc(s.person)}</span>
          ${grossLabel ? `<span>·</span><span>${grossLabel}</span>` : ''}
        </div>
        ${additionsHtml}${deductionsHtml}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="trans-amount ${isVR ? 'vr-amount' : 'entrada'}">+${formatCurrency(s.amount)}</div>
        <button onclick="deleteSalary('${s.id}')" class="btn-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// Globals para inline handlers
window.deleteSalary = deleteSalary;
window.removeDeduction = removeDeduction;
window.removeAddition = removeAddition;
