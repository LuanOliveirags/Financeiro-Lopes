// ============================================================
// SHOPPING.JS — Controller de UI da Lista de Compras
// Responsabilidade: DOM, eventos e orquestração.
// Lógica de dados e catálogos → packages/services/shopping/shopping.service.js
// ============================================================

import { state, getFamilyId } from '../../../../../packages/core/state/store.js';
import { esc, formatCurrency, showAlert } from '../../../../../packages/utils/helpers.js';
import { saveDataToStorage, saveToFirebase } from '../../../../../packages/services/firebase/firebase.service.js';
import { updateDashboard } from '../dashboard/dashboard.js';
import { updateTransactionHistory } from '../transactions/transactions.service.js';
import {
  STORES,
  SHOPPING_CATEGORIES,
  QUICK_ITEMS,
  loadLists,
  saveLists,
  createList,
  reuseList,
  addItem,
  toggleItem,
  removeItem,
  editItem,
  buildCheckoutTransaction,
  finalizeList
} from '../../../../../packages/services/shopping/shopping.service.js';

// ===== ESTADO DO CONTROLLER =====
let shoppingLists = [];
let activeListId = null;
let shoppingView = 'lists'; // 'lists' | 'detail'
let editingItemId = null;
let quickAddCollapsed = localStorage.getItem('shop_quick_collapsed') === 'true';

// ===== ABERTURA / FECHAMENTO =====
export function openShoppingPanel() {
  shoppingLists = loadLists();
  shoppingView = 'lists';
  activeListId = null;
  renderShoppingView();
}

export function closeShoppingPanel() {
  shoppingView = 'lists';
  activeListId = null;
  editingItemId = null;
}

// ===== RENDER PRINCIPAL =====
function renderShoppingView() {
  const listsView = document.getElementById('shoppingListsView');
  const detailView = document.getElementById('shoppingDetailView');
  if (shoppingView === 'lists') {
    listsView.style.display = '';
    detailView.style.display = 'none';
    renderShoppingLists();
  } else {
    listsView.style.display = 'none';
    detailView.style.display = '';
    renderListDetail();
  }
}

// ===== LISTAS =====
function renderShoppingLists() {
  const body = document.getElementById('shoppingListsBody');
  if (!body) return;

  const active = shoppingLists.filter(l => l.status === 'active');
  const completed = shoppingLists.filter(l => l.status === 'completed').sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

  if (active.length === 0 && completed.length === 0) {
    body.innerHTML = `
      <div class="shop-empty">
        <div class="shop-empty-icon"><i class="fa-solid fa-cart-shopping"></i></div>
        <h3>Nenhuma lista ainda</h3>
        <p>Onde vamos fazer compras hoje?</p>
        <div class="shop-store-picker-inline">
          ${Object.entries(STORES).map(([key, s]) => `
            <button class="shop-store-pick" data-store="${key}">
              ${s.img
                ? `<img src="${s.img}" alt="${esc(s.name)}" class="shop-store-logo-pick">`
                : `<div class="shop-store-icon-pick"><i class="fa-solid fa-store"></i></div>`}
              <span>${esc(s.name)}</span>
            </button>`).join('')}
        </div>
      </div>`;
    body.querySelectorAll('.shop-store-pick').forEach(btn =>
      btn.addEventListener('click', () => openNewListModal(btn.dataset.store))
    );
    return;
  }

  let html = '';
  if (active.length > 0) {
    html += '<p class="shop-section-label">Listas ativas</p>';
    html += active.map(list => renderListCard(list)).join('');
  }
  if (completed.length > 0) {
    html += '<p class="shop-section-label">Concluídas</p>';
    html += completed.slice(0, 10).map(list => renderListCard(list)).join('');
  }

  body.innerHTML = html;

  body.querySelectorAll('.shop-list-card').forEach(card => {
    card.addEventListener('click', () => {
      activeListId = card.dataset.id;
      shoppingView = 'detail';
      renderShoppingView();
    });
  });

  body.querySelectorAll('.shop-card-reuse').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleReuseList(btn.dataset.id);
    });
  });
}

function renderListCard(list) {
  const total = list.items.length;
  const checked = list.items.filter(i => i.checked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const isCompleted = list.status === 'completed';
  const date = new Date(list.createdAt);
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const store = STORES[list.store] || STORES.outro;

  const categories = [...new Set(list.items.map(i => i.category))];
  const catIcons = categories.slice(0, 4).map(cat => {
    const c = SHOPPING_CATEGORIES[cat] || SHOPPING_CATEGORIES.outros;
    return `<span class="shop-card-cat" style="background:${c.color}20;color:${c.color}"><i class="fa-solid ${c.icon}"></i></span>`;
  }).join('');

  const estimatedTotal = list.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const displayTotal = isCompleted && list.totalSpent ? list.totalSpent : estimatedTotal;

  const storeBadge = store.img
    ? `<img src="${store.img}" alt="${esc(store.name)}" class="shop-card-store-logo">`
    : `<span class="shop-card-store-icon"><i class="fa-solid fa-store"></i></span>`;

  return `
    <div class="shop-list-card ${isCompleted ? 'completed' : ''}" data-id="${list.id}">
      <div class="shop-card-top">
        <div class="shop-card-store-badge">${storeBadge}</div>
        <div class="shop-card-info">
          <h4 class="shop-card-name">${esc(list.name)}</h4>
          <div class="shop-card-meta">
            <span class="shop-card-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
            <span class="shop-card-count"><i class="fa-solid fa-basket-shopping"></i> ${checked}/${total}</span>
            ${displayTotal > 0 ? `<span class="shop-card-price">${isCompleted ? '<i class="fa-solid fa-receipt"></i> ' : ''}${formatCurrency(displayTotal)}</span>` : ''}
          </div>
        </div>
        <div class="shop-card-progress-ring">
          <svg viewBox="0 0 36 36">
            <circle class="shop-ring-bg" cx="18" cy="18" r="15.5"/>
            <circle class="shop-ring-fill" cx="18" cy="18" r="15.5" style="stroke-dashoffset:${97.4 - (pct / 100) * 97.4};stroke:${isCompleted ? 'var(--success)' : 'var(--primary)'}"/>
          </svg>
          <span class="shop-ring-text">${pct}%</span>
        </div>
      </div>
      <div class="shop-card-bottom">
        <div class="shop-card-cats">${catIcons}</div>
        ${isCompleted ? `<button class="shop-card-reuse" data-id="${list.id}" title="Reutilizar lista"><i class="fa-solid fa-rotate-right"></i> Reusar</button>` : ''}
      </div>
    </div>`;
}

// ===== CRIAÇÃO DE LISTA =====
function openNewListModal(preselectedStore) {
  const modal = document.getElementById('shoppingNewListModal');
  const input = document.getElementById('shoppingNewListName');
  if (!modal || !input) return;

  input.value = '';
  const storeGrid = document.getElementById('shopStoreSelector');
  if (storeGrid) {
    storeGrid.innerHTML = Object.entries(STORES).map(([key, s]) => `
      <button type="button" class="shop-store-option ${key === (preselectedStore || '') ? 'active' : ''}" data-store="${key}">
        ${s.img
          ? `<img src="${s.img}" alt="${esc(s.name)}" class="shop-store-opt-img">`
          : `<div class="shop-store-opt-icon"><i class="fa-solid fa-store"></i></div>`}
        <span class="shop-store-opt-name">${esc(s.name)}</span>
      </button>
    `).join('');
    storeGrid.querySelectorAll('.shop-store-option').forEach(btn => {
      btn.addEventListener('click', () => {
        storeGrid.querySelectorAll('.shop-store-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  if (preselectedStore && STORES[preselectedStore]) {
    const today = new Date();
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    input.value = `${STORES[preselectedStore].name} — ${months[today.getMonth()]}/${today.getFullYear()}`;
  }

  modal.classList.add('active');
  setTimeout(() => input.focus(), 200);
}

function confirmNewList() {
  const input = document.getElementById('shoppingNewListName');
  const name = input?.value.trim();
  if (!name) { showAlert('Digite um nome para a lista.', 'warning'); return; }

  const selectedStore = document.querySelector('#shopStoreSelector .shop-store-option.active');
  const storeKey = selectedStore?.dataset.store || 'outro';

  const newList = createList(name, storeKey);
  shoppingLists.unshift(newList);
  saveLists(shoppingLists);

  document.getElementById('shoppingNewListModal').classList.remove('active');
  activeListId = newList.id;
  shoppingView = 'detail';
  renderShoppingView();
  showAlert('Lista criada!', 'success');
}

function handleReuseList(listId) {
  const source = shoppingLists.find(l => l.id === listId);
  if (!source) return;

  const newList = reuseList(source);
  shoppingLists.unshift(newList);
  saveLists(shoppingLists);
  activeListId = newList.id;
  shoppingView = 'detail';
  renderShoppingView();
  showAlert('Lista reutilizada!', 'success');
}

// ===== DETALHE DA LISTA =====
function getActiveList() {
  return shoppingLists.find(l => l.id === activeListId);
}

function renderListDetail() {
  const list = getActiveList();
  if (!list) { shoppingView = 'lists'; renderShoppingView(); return; }

  const titleEl = document.getElementById('shoppingDetailTitle');
  if (titleEl) titleEl.textContent = list.name;

  const store = STORES[list.store] || STORES.outro;
  const storeHeader = document.getElementById('shoppingDetailStoreBar');
  if (storeHeader) {
    storeHeader.style.display = 'flex';
    storeHeader.innerHTML = store.img
      ? `<img src="${store.img}" alt="${esc(store.name)}" class="shop-detail-store-logo"><span class="shop-detail-store-name">${esc(store.label)}</span>`
      : `<i class="fa-solid fa-store shop-detail-store-icon"></i><span class="shop-detail-store-name">${esc(store.label)}</span>`;
    storeHeader.style.setProperty('--store-accent', store.color);
  }

  const body = document.getElementById('shoppingDetailBody');
  if (!body) return;

  const total = list.items.length;
  const checked = list.items.filter(i => i.checked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const estimatedTotal = list.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const isCompleted = list.status === 'completed';

  let html = `
    <div class="shop-detail-stats">
      <div class="shop-progress-bar-wrap">
        <div class="shop-progress-bar">
          <div class="shop-progress-fill ${pct === 100 ? 'complete' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="shop-progress-label">${checked}/${total}</span>
      </div>
      <div class="shop-stats-row">
        <div class="shop-stat">
          <div class="shop-stat-icon" style="background:rgba(var(--primary-rgb),0.12)"><i class="fa-solid fa-list" style="color:var(--primary)"></i></div>
          <span class="shop-stat-val">${total}</span>
          <span class="shop-stat-label">Total</span>
        </div>
        <div class="shop-stat">
          <div class="shop-stat-icon" style="background:rgba(6,214,160,0.12)"><i class="fa-solid fa-check" style="color:var(--success)"></i></div>
          <span class="shop-stat-val shop-stat-success">${checked}</span>
          <span class="shop-stat-label">Pegos</span>
        </div>
        <div class="shop-stat">
          <div class="shop-stat-icon" style="background:rgba(248,150,30,0.12)"><i class="fa-solid fa-clock" style="color:var(--warning)"></i></div>
          <span class="shop-stat-val shop-stat-warning">${total - checked}</span>
          <span class="shop-stat-label">Faltam</span>
        </div>
        <div class="shop-stat">
          <div class="shop-stat-icon" style="background:rgba(var(--primary-rgb),0.12)"><i class="fa-solid fa-tag" style="color:var(--primary)"></i></div>
          <span class="shop-stat-val shop-stat-price">${estimatedTotal > 0 ? formatCurrency(estimatedTotal) : '—'}</span>
          <span class="shop-stat-label">Estimado</span>
        </div>
      </div>
    </div>`;

  if (!isCompleted) {
    const existingNames = new Set(list.items.map(i => i.name.toLowerCase()));
    const suggestions = QUICK_ITEMS.filter(q => !existingNames.has(q.name.toLowerCase())).slice(0, 24);
    if (suggestions.length > 0) {
      html += `<div class="shop-quick-wrap">
        <button class="shop-quick-toggle" id="shopQuickToggle">
          <div class="shop-quick-toggle-left">
            <i class="fa-solid fa-bolt"></i>
            <span>Adicionar rápido</span>
            <span class="shop-quick-badge">${suggestions.length}</span>
          </div>
          <i class="fa-solid fa-chevron-down shop-quick-chevron ${quickAddCollapsed ? '' : 'open'}"></i>
        </button>
        <div class="shop-quick-chips ${quickAddCollapsed ? 'collapsed' : ''}" id="shopQuickChips">${suggestions.map(s => {
          const cat = SHOPPING_CATEGORIES[s.category] || SHOPPING_CATEGORIES.outros;
          return `<button class="shop-quick-chip" data-name="${esc(s.name)}" data-cat="${s.category}" data-unit="${s.unit}">
            <i class="fa-solid ${cat.icon}" style="color:${cat.color}"></i> ${esc(s.name)}
          </button>`;
        }).join('')}</div>
      </div>`;
    }
  }

  const grouped = {};
  list.items.forEach(item => {
    const cat = item.category || 'outros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const catOrder = Object.keys(grouped).sort((a, b) => {
    const aAllChecked = grouped[a].every(i => i.checked);
    const bAllChecked = grouped[b].every(i => i.checked);
    if (aAllChecked !== bAllChecked) return aAllChecked ? 1 : -1;
    return (SHOPPING_CATEGORIES[a]?.label || a).localeCompare(SHOPPING_CATEGORIES[b]?.label || b);
  });

  if (catOrder.length > 0) {
    html += '<div class="shop-items-groups">';
    catOrder.forEach(cat => {
      const catInfo = SHOPPING_CATEGORIES[cat] || SHOPPING_CATEGORIES.outros;
      const items = grouped[cat];
      const catChecked = items.filter(i => i.checked).length;
      const allDone = catChecked === items.length;

      html += `
        <div class="shop-category-group ${allDone ? 'all-done' : ''}">
          <div class="shop-cat-header">
            <div class="shop-cat-left">
              <span class="shop-cat-icon" style="background:${catInfo.color}20;color:${catInfo.color}">
                <i class="fa-solid ${catInfo.icon}"></i>
              </span>
              <span class="shop-cat-name">${catInfo.label}</span>
            </div>
            <span class="shop-cat-count">${catChecked}/${items.length}</span>
          </div>
          <ul class="shop-items-list">
            ${items.map(item => renderShopItem(item, isCompleted)).join('')}
          </ul>
        </div>`;
    });
    html += '</div>';
  } else {
    html += `<div class="shop-empty-items">
      <i class="fa-solid fa-basket-shopping"></i>
      <p>Lista vazia — adicione itens abaixo!</p>
    </div>`;
  }

  if (!isCompleted && total > 0) {
    html += `<div class="shop-complete-wrap">
      <button class="shop-complete-btn" id="shopCompleteListBtn">
        <i class="fa-solid fa-check-double"></i> Finalizar Compras
      </button>
    </div>`;
  }

  body.innerHTML = html;

  const addBar = document.getElementById('shoppingAddBar');
  if (addBar) addBar.style.display = isCompleted ? 'none' : '';

  document.getElementById('shopQuickToggle')?.addEventListener('click', () => {
    quickAddCollapsed = !quickAddCollapsed;
    localStorage.setItem('shop_quick_collapsed', quickAddCollapsed);
    document.getElementById('shopQuickChips')?.classList.toggle('collapsed', quickAddCollapsed);
    document.querySelector('.shop-quick-chevron')?.classList.toggle('open', !quickAddCollapsed);
  });

  body.querySelectorAll('.shop-quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.add('adding');
      setTimeout(() => handleAddItem(chip.dataset.name, chip.dataset.cat, chip.dataset.unit), 150);
    });
  });

  body.querySelectorAll('.shop-item').forEach(el => {
    const itemId = el.dataset.id;
    el.querySelector('.shop-item-check')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggleItem(itemId);
    });
    el.querySelector('.shop-item-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteItem(itemId);
    });
    el.addEventListener('click', () => {
      if (!isCompleted) openEditItemModal(itemId);
    });
  });

  document.getElementById('shopCompleteListBtn')?.addEventListener('click', openCheckoutModal);

  setupAutocomplete();
}

function renderShopItem(item, isCompleted) {
  const cat = SHOPPING_CATEGORIES[item.category] || SHOPPING_CATEGORIES.outros;
  const qty = item.quantity || 1;
  const unitLabel = item.unit || 'un';
  const totalPrice = item.price ? item.price * qty : null;

  return `
    <li class="shop-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
      <button class="shop-item-check" ${isCompleted ? 'disabled' : ''}>
        <i class="fa-solid ${item.checked ? 'fa-circle-check' : 'fa-circle'}"></i>
      </button>
      <span class="shop-item-dot" style="background:${cat.color}"></span>
      <div class="shop-item-info">
        <span class="shop-item-name">${esc(item.name)}</span>
        <span class="shop-item-meta">
          <span class="shop-item-qty">${qty} ${unitLabel}</span>
          ${totalPrice ? `<span class="shop-item-sep">·</span><span class="shop-item-price">${formatCurrency(totalPrice)}</span>` : ''}
        </span>
      </div>
      ${!isCompleted ? `<button class="shop-item-delete" title="Remover"><i class="fa-solid fa-trash-can"></i></button>` : ''}
    </li>`;
}

// ===== AUTOCOMPLETE =====
function setupAutocomplete() {
  const input = document.getElementById('shoppingItemInput');
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('shoppingAutocomplete');
    if (!dropdown) return;

    if (val.length < 2) { dropdown.classList.remove('active'); return; }

    const list = getActiveList();
    const existingNames = new Set((list?.items || []).map(i => i.name.toLowerCase()));
    const matches = QUICK_ITEMS.filter(q =>
      q.name.toLowerCase().includes(val) && !existingNames.has(q.name.toLowerCase())
    ).slice(0, 5);

    if (matches.length === 0) { dropdown.classList.remove('active'); return; }

    dropdown.innerHTML = matches.map(m => {
      const cat = SHOPPING_CATEGORIES[m.category] || SHOPPING_CATEGORIES.outros;
      return `<button class="shop-ac-item" data-name="${esc(m.name)}" data-cat="${m.category}" data-unit="${m.unit}">
        <i class="fa-solid ${cat.icon}" style="color:${cat.color}"></i>
        <span>${esc(m.name)}</span>
        <span class="shop-ac-cat">${cat.label}</span>
      </button>`;
    }).join('');
    dropdown.classList.add('active');

    dropdown.querySelectorAll('.shop-ac-item').forEach(btn => {
      btn.addEventListener('click', () => {
        handleAddItem(btn.dataset.name, btn.dataset.cat, btn.dataset.unit);
        input.value = '';
        dropdown.classList.remove('active');
      });
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      const match = QUICK_ITEMS.find(q => q.name.toLowerCase() === val.toLowerCase());
      handleAddItem(match?.name || val, match?.category || 'outros', match?.unit || 'un');
      input.value = '';
      document.getElementById('shoppingAutocomplete')?.classList.remove('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.shopping-add-bar')) {
      document.getElementById('shoppingAutocomplete')?.classList.remove('active');
    }
  });
}

// ===== HANDLERS DE ITEM =====
function handleAddItem(name, category, unit) {
  const list = getActiveList();
  if (!list) return;
  addItem(list, name, category, unit);
  saveLists(shoppingLists);
  renderListDetail();
}

function handleToggleItem(itemId) {
  const list = getActiveList();
  if (!list) return;
  toggleItem(list, itemId);
  saveLists(shoppingLists);
  renderListDetail();
}

function handleDeleteItem(itemId) {
  const list = getActiveList();
  if (!list) return;
  removeItem(list, itemId);
  saveLists(shoppingLists);
  renderListDetail();
}

function handleDeleteList() {
  const list = getActiveList();
  if (!list) return;
  if (!confirm(`Excluir a lista "${list.name}"?`)) return;
  shoppingLists = shoppingLists.filter(l => l.id !== list.id);
  saveLists(shoppingLists);
  showAlert('Lista excluída.', 'info');
  shoppingView = 'lists';
  renderShoppingView();
}

// ===== CHECKOUT =====
function openCheckoutModal() {
  const list = getActiveList();
  if (!list) return;

  const total = list.items.length;
  const checked = list.items.filter(i => i.checked).length;
  const estimatedTotal = list.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const store = STORES[list.store] || STORES.outro;

  const storeBrand = store.img
    ? `<div class="shop-checkout-store"><img src="${store.img}" alt="${esc(store.name)}" class="shop-checkout-store-logo"><span>${esc(store.label)}</span></div>`
    : `<div class="shop-checkout-store"><i class="fa-solid fa-store"></i><span>${esc(store.label)}</span></div>`;

  const summaryEl = document.getElementById('shopCheckoutSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      ${storeBrand}
      <div class="shop-checkout-info">
        <div class="shop-checkout-info-row">
          <span><i class="fa-solid fa-basket-shopping"></i> ${esc(list.name)}</span>
          <span class="shop-checkout-items">${checked}/${total} pegos</span>
        </div>
        ${estimatedTotal > 0 ? `<div class="shop-checkout-info-row">
          <span>Estimado</span>
          <span class="shop-checkout-estimated">${formatCurrency(estimatedTotal)}</span>
        </div>` : ''}
      </div>`;
  }

  const totalInput = document.getElementById('shopCheckoutTotal');
  if (totalInput) totalInput.value = estimatedTotal > 0 ? estimatedTotal.toFixed(2) : '';

  const descInput = document.getElementById('shopCheckoutDesc');
  if (descInput) descInput.value = list.name;

  const responsibleSelect = document.getElementById('shopCheckoutResponsible');
  if (responsibleSelect) {
    const members = state.familyMembers || [];
    const currentUser = state.currentUser;
    if (members.length > 0) {
      responsibleSelect.innerHTML = members.map(m =>
        `<option value="${esc(m.name || m.login)}" ${m.login === currentUser?.login ? 'selected' : ''}>${esc(m.name || m.login)}</option>`
      ).join('');
    } else if (currentUser) {
      responsibleSelect.innerHTML = `<option value="${esc(currentUser.fullName || currentUser.login)}" selected>${esc(currentUser.fullName || currentUser.login)}</option>`;
    }
  }

  document.getElementById('shopPaymentMethod').value = 'dinheiro';
  document.querySelectorAll('#shopPaymentMethods .shop-pay-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#shopPaymentMethods .shop-pay-btn[data-method="dinheiro"]')?.classList.add('active');
  const vrHint = document.getElementById('shopPayVrHint');
  if (vrHint) vrHint.style.display = 'none';
  const regToggle = document.getElementById('shopCheckoutRegister');
  if (regToggle) {
    regToggle.checked = true;
    const toggleWrap = regToggle.closest('.shop-checkout-toggle');
    if (toggleWrap) toggleWrap.style.display = '';
  }

  document.getElementById('shoppingCheckoutModal').classList.add('active');
}

function confirmCheckout() {
  const list = getActiveList();
  if (!list) return;

  const registerAsExpense = document.getElementById('shopCheckoutRegister')?.checked;
  const totalValue = parseFloat(document.getElementById('shopCheckoutTotal')?.value);

  if (registerAsExpense && totalValue > 0) {
    const familyId = getFamilyId();
    if (!familyId) { showAlert('Erro: família não identificada.', 'danger'); return; }

    const transaction = buildCheckoutTransaction({
      list,
      totalValue,
      responsible: document.getElementById('shopCheckoutResponsible')?.value,
      category: document.getElementById('shopCheckoutCategory')?.value || 'alimentacao',
      description: document.getElementById('shopCheckoutDesc')?.value?.trim() || list.name,
      paymentMethod: document.getElementById('shopPaymentMethod')?.value || 'dinheiro',
      familyId
    });

    state.transactions.push(transaction);
    saveDataToStorage();
    saveToFirebase('transactions', transaction);
    updateDashboard();
    updateTransactionHistory();
  }

  finalizeList(list, totalValue || 0);
  saveLists(shoppingLists);

  document.getElementById('shoppingCheckoutModal').classList.remove('active');
  showAlert(
    registerAsExpense && totalValue > 0
      ? `Compras finalizadas! Despesa de ${formatCurrency(totalValue)} registrada.`
      : 'Compras finalizadas!',
    'success'
  );
  shoppingView = 'lists';
  renderShoppingView();
}

// ===== EDITAR ITEM =====
function openEditItemModal(itemId) {
  const list = getActiveList();
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  document.getElementById('editShopItemName').value = item.name;
  document.getElementById('editShopItemQty').value = item.quantity || 1;
  document.getElementById('editShopItemUnit').value = item.unit || 'un';
  document.getElementById('editShopItemPrice').value = item.price || '';
  document.getElementById('editShopItemCategory').value = item.category || 'outros';
  document.getElementById('shoppingEditItemModal').classList.add('active');
}

function saveEditItem() {
  const list = getActiveList();
  if (!list || !editingItemId) return;

  const price = parseFloat(document.getElementById('editShopItemPrice').value);
  editItem(list, editingItemId, {
    name: document.getElementById('editShopItemName').value.trim() || undefined,
    quantity: parseFloat(document.getElementById('editShopItemQty').value) || 1,
    unit: document.getElementById('editShopItemUnit').value || 'un',
    price: isNaN(price) ? null : price,
    category: document.getElementById('editShopItemCategory').value || 'outros'
  });

  saveLists(shoppingLists);
  editingItemId = null;
  document.getElementById('shoppingEditItemModal').classList.remove('active');
  renderListDetail();
}

// ===== SETUP DE EVENTOS =====
export function setupShoppingListeners() {
  document.getElementById('shoppingBackBtn')?.addEventListener('click', () => {
    shoppingView = 'lists';
    renderShoppingView();
  });

  document.getElementById('shopNewListBtn')?.addEventListener('click', () => openNewListModal());

  document.getElementById('shopConfirmNewListBtn')?.addEventListener('click', confirmNewList);
  document.getElementById('shoppingNewListName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmNewList(); }
  });

  document.getElementById('shoppingDeleteListBtn')?.addEventListener('click', handleDeleteList);

  document.getElementById('shoppingAddItemBtn')?.addEventListener('click', () => {
    const input = document.getElementById('shoppingItemInput');
    const val = input?.value.trim();
    if (!val) return;
    const match = QUICK_ITEMS.find(q => q.name.toLowerCase() === val.toLowerCase());
    handleAddItem(match?.name || val, match?.category || 'outros', match?.unit || 'un');
    input.value = '';
    document.getElementById('shoppingAutocomplete')?.classList.remove('active');
  });

  document.getElementById('editShopItemForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEditItem();
  });

  document.getElementById('shopCheckoutForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    confirmCheckout();
  });

  document.querySelectorAll('#shopPaymentMethods .shop-pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#shopPaymentMethods .shop-pay-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const method = btn.dataset.method;
      document.getElementById('shopPaymentMethod').value = method;
      const hint = document.getElementById('shopPayVrHint');
      if (hint) hint.style.display = method === 'vr' ? '' : 'none';
      const regToggle = document.getElementById('shopCheckoutRegister');
      if (regToggle) {
        const toggleWrap = regToggle.closest('.shop-checkout-toggle');
        if (toggleWrap) toggleWrap.style.display = method === 'vr' ? 'none' : '';
        if (method === 'vr') regToggle.checked = true;
      }
    });
  });

  document.querySelectorAll('#shoppingPanel .modal .close, #shoppingPanel .modal .modal-close-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      this.closest('.modal').classList.remove('active');
    });
  });

  document.querySelectorAll('#shoppingPanel .modal').forEach(modal => {
    modal.addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('active');
    });
  });

  setupSwipeBack();
}

// ===== SWIPE BACK (MOBILE) =====
function setupSwipeBack() {
  const panel = document.getElementById('shoppingPanel');
  if (!panel) return;

  let startX = 0, startY = 0, tracking = false;
  const THRESHOLD = 80;

  panel.addEventListener('touchstart', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (panel.querySelector('.modal.active')) return;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dy) > Math.abs(dx)) { tracking = false; }
  }, { passive: true });

  panel.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx > THRESHOLD && shoppingView === 'detail') {
      shoppingView = 'lists';
      renderShoppingView();
    }
  }, { passive: true });

  panel.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });
}
