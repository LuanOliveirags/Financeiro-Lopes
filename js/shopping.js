// ============================================================
// SHOPPING.JS — Lista de Compras da Casa
// ============================================================

import { getFamilyId } from './state.js';
import { generateId, esc, formatCurrency, showAlert } from './utils.js';

// ===== CATEGORIAS DE COMPRAS =====
const SHOPPING_CATEGORIES = {
  frutas:     { label: 'Frutas & Verduras', icon: 'fa-apple-whole',        color: '#06D6A0' },
  carnes:     { label: 'Carnes & Frios',    icon: 'fa-drumstick-bite',     color: '#EF233C' },
  padaria:    { label: 'Padaria',           icon: 'fa-bread-slice',        color: '#F8961E' },
  bebidas:    { label: 'Bebidas',           icon: 'fa-bottle-water',       color: '#4CC9F0' },
  laticinios: { label: 'Laticínios',        icon: 'fa-cheese',             color: '#FFD166' },
  mercearia:  { label: 'Mercearia',         icon: 'fa-jar',                color: '#8338EC' },
  limpeza:    { label: 'Limpeza',           icon: 'fa-spray-can-sparkles', color: '#4361EE' },
  higiene:    { label: 'Higiene & Beleza',  icon: 'fa-pump-soap',          color: '#FF69B4' },
  casa:       { label: 'Casa & Utilidades', icon: 'fa-house',              color: '#0096C7' },
  pets:       { label: 'Pets',              icon: 'fa-paw',                color: '#FFA500' },
  outros:     { label: 'Outros',            icon: 'fa-box',                color: '#9CA3AF' }
};

// ===== ITENS RÁPIDOS (sugestões) =====
const QUICK_ITEMS = [
  { name: 'Arroz',            category: 'mercearia',  unit: 'kg'  },
  { name: 'Feijão',           category: 'mercearia',  unit: 'kg'  },
  { name: 'Macarrão',         category: 'mercearia',  unit: 'un'  },
  { name: 'Óleo',             category: 'mercearia',  unit: 'un'  },
  { name: 'Açúcar',           category: 'mercearia',  unit: 'kg'  },
  { name: 'Sal',              category: 'mercearia',  unit: 'un'  },
  { name: 'Café',             category: 'mercearia',  unit: 'un'  },
  { name: 'Farinha de Trigo', category: 'mercearia',  unit: 'kg'  },
  { name: 'Leite',            category: 'laticinios', unit: 'L'   },
  { name: 'Ovos',             category: 'mercearia',  unit: 'dz'  },
  { name: 'Manteiga',         category: 'laticinios', unit: 'un'  },
  { name: 'Queijo',           category: 'laticinios', unit: 'g'   },
  { name: 'Presunto',         category: 'carnes',     unit: 'g'   },
  { name: 'Frango',           category: 'carnes',     unit: 'kg'  },
  { name: 'Carne Moída',      category: 'carnes',     unit: 'kg'  },
  { name: 'Linguiça',         category: 'carnes',     unit: 'kg'  },
  { name: 'Pão',              category: 'padaria',    unit: 'un'  },
  { name: 'Pão de Forma',     category: 'padaria',    unit: 'un'  },
  { name: 'Banana',           category: 'frutas',     unit: 'kg'  },
  { name: 'Maçã',             category: 'frutas',     unit: 'kg'  },
  { name: 'Tomate',           category: 'frutas',     unit: 'kg'  },
  { name: 'Cebola',           category: 'frutas',     unit: 'kg'  },
  { name: 'Batata',           category: 'frutas',     unit: 'kg'  },
  { name: 'Alho',             category: 'frutas',     unit: 'un'  },
  { name: 'Alface',           category: 'frutas',     unit: 'un'  },
  { name: 'Água',             category: 'bebidas',    unit: 'L'   },
  { name: 'Refrigerante',     category: 'bebidas',    unit: 'L'   },
  { name: 'Suco',             category: 'bebidas',    unit: 'L'   },
  { name: 'Detergente',       category: 'limpeza',    unit: 'un'  },
  { name: 'Sabão em Pó',      category: 'limpeza',    unit: 'un'  },
  { name: 'Amaciante',        category: 'limpeza',    unit: 'un'  },
  { name: 'Desinfetante',     category: 'limpeza',    unit: 'un'  },
  { name: 'Água Sanitária',   category: 'limpeza',    unit: 'un'  },
  { name: 'Esponja',          category: 'limpeza',    unit: 'un'  },
  { name: 'Papel Higiênico',  category: 'higiene',    unit: 'pct' },
  { name: 'Sabonete',         category: 'higiene',    unit: 'un'  },
  { name: 'Shampoo',          category: 'higiene',    unit: 'un'  },
  { name: 'Pasta de Dente',   category: 'higiene',    unit: 'un'  },
  { name: 'Ração',            category: 'pets',       unit: 'kg'  }
];

// ===== ESTADO LOCAL =====
let shoppingLists = [];
let activeListId = null;
let shoppingView = 'lists'; // 'lists' | 'detail'
let editingItemId = null;

// ===== PERSISTÊNCIA =====
function getStorageKey() {
  const fid = getFamilyId();
  return fid ? `shopping_lists_${fid}` : 'shopping_lists_local';
}

function loadShoppingData() {
  const data = localStorage.getItem(getStorageKey());
  if (data) {
    try { shoppingLists = JSON.parse(data); } catch (e) { shoppingLists = []; }
  } else {
    shoppingLists = [];
  }
}

function saveShoppingData() {
  localStorage.setItem(getStorageKey(), JSON.stringify(shoppingLists));
}

// ===== ABERTURA / FECHAMENTO =====
export function openShoppingPanel() {
  loadShoppingData();
  shoppingView = 'lists';
  activeListId = null;
  const panel = document.getElementById('shoppingPanel');
  if (panel) {
    panel.classList.add('active');
    renderShoppingView();
  }
}

export function closeShoppingPanel() {
  const panel = document.getElementById('shoppingPanel');
  if (panel) {
    panel.classList.remove('active');
    shoppingView = 'lists';
    activeListId = null;
    editingItemId = null;
  }
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
        <p>Crie sua primeira lista de compras!</p>
        <button class="shop-empty-btn" id="shopEmptyNewBtn">
          <i class="fa-solid fa-plus"></i> Nova Lista
        </button>
      </div>`;
    document.getElementById('shopEmptyNewBtn')?.addEventListener('click', createNewList);
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

  // Attach click listeners
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
      reuseList(btn.dataset.id);
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

  const categories = [...new Set(list.items.map(i => i.category))];
  const catIcons = categories.slice(0, 4).map(cat => {
    const c = SHOPPING_CATEGORIES[cat] || SHOPPING_CATEGORIES.outros;
    return `<span class="shop-card-cat" style="background:${c.color}20;color:${c.color}"><i class="fa-solid ${c.icon}"></i></span>`;
  }).join('');

  const estimatedTotal = list.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);

  return `
    <div class="shop-list-card ${isCompleted ? 'completed' : ''}" data-id="${list.id}">
      <div class="shop-card-top">
        <div class="shop-card-info">
          <h4 class="shop-card-name">${esc(list.name)}</h4>
          <div class="shop-card-meta">
            <span class="shop-card-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
            <span class="shop-card-count"><i class="fa-solid fa-basket-shopping"></i> ${checked}/${total}</span>
            ${estimatedTotal > 0 ? `<span class="shop-card-price">${formatCurrency(estimatedTotal)}</span>` : ''}
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

function createNewList() {
  const modal = document.getElementById('shoppingNewListModal');
  const input = document.getElementById('shoppingNewListName');
  if (modal && input) {
    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 200);
  }
}

function confirmNewList() {
  const input = document.getElementById('shoppingNewListName');
  const name = input?.value.trim();
  if (!name) { showAlert('Digite um nome para a lista.', 'warning'); return; }

  const newList = {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    items: [],
    status: 'active'
  };
  shoppingLists.unshift(newList);
  saveShoppingData();

  document.getElementById('shoppingNewListModal').classList.remove('active');
  activeListId = newList.id;
  shoppingView = 'detail';
  renderShoppingView();
  showAlert('Lista criada!', 'success');
}

function reuseList(listId) {
  const source = shoppingLists.find(l => l.id === listId);
  if (!source) return;

  const newList = {
    id: generateId(),
    name: source.name + ' (cópia)',
    createdAt: new Date().toISOString(),
    items: source.items.map(item => ({
      ...item,
      id: generateId(),
      checked: false,
      price: null
    })),
    status: 'active'
  };
  shoppingLists.unshift(newList);
  saveShoppingData();
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

  const body = document.getElementById('shoppingDetailBody');
  if (!body) return;

  const total = list.items.length;
  const checked = list.items.filter(i => i.checked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const estimatedTotal = list.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const isCompleted = list.status === 'completed';

  // Progress + Stats
  let html = `
    <div class="shop-detail-stats">
      <div class="shop-progress-bar-wrap">
        <div class="shop-progress-bar">
          <div class="shop-progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="shop-progress-label">${checked} de ${total} itens</span>
      </div>
      <div class="shop-stats-row">
        <div class="shop-stat">
          <span class="shop-stat-val">${total}</span>
          <span class="shop-stat-label">Total</span>
        </div>
        <div class="shop-stat">
          <span class="shop-stat-val shop-stat-success">${checked}</span>
          <span class="shop-stat-label">Pegos</span>
        </div>
        <div class="shop-stat">
          <span class="shop-stat-val shop-stat-warning">${total - checked}</span>
          <span class="shop-stat-label">Faltam</span>
        </div>
        ${estimatedTotal > 0 ? `
        <div class="shop-stat">
          <span class="shop-stat-val shop-stat-price">${formatCurrency(estimatedTotal)}</span>
          <span class="shop-stat-label">Estimado</span>
        </div>` : ''}
      </div>
    </div>`;

  // Quick-add chips
  if (!isCompleted) {
    const existingNames = new Set(list.items.map(i => i.name.toLowerCase()));
    const suggestions = QUICK_ITEMS.filter(q => !existingNames.has(q.name.toLowerCase())).slice(0, 20);
    if (suggestions.length > 0) {
      html += `<div class="shop-quick-wrap">
        <p class="shop-quick-label"><i class="fa-solid fa-bolt"></i> Adicionar rápido</p>
        <div class="shop-quick-chips">${suggestions.map(s => {
          const cat = SHOPPING_CATEGORIES[s.category] || SHOPPING_CATEGORIES.outros;
          return `<button class="shop-quick-chip" data-name="${esc(s.name)}" data-cat="${s.category}" data-unit="${s.unit}">
            <i class="fa-solid ${cat.icon}" style="color:${cat.color}"></i> ${esc(s.name)}
          </button>`;
        }).join('')}</div>
      </div>`;
    }
  }

  // Items grouped by category
  const grouped = {};
  list.items.forEach(item => {
    const cat = item.category || 'outros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  // Sort categories — unchecked categories first
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

  // Complete list button
  if (!isCompleted && total > 0) {
    html += `<div class="shop-complete-wrap">
      <button class="shop-complete-btn" id="shopCompleteListBtn">
        <i class="fa-solid fa-check-double"></i> Finalizar Compras
      </button>
    </div>`;
  }

  body.innerHTML = html;

  // Add bar visibility
  const addBar = document.getElementById('shoppingAddBar');
  if (addBar) addBar.style.display = isCompleted ? 'none' : '';

  // Event listeners
  body.querySelectorAll('.shop-quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      addItemToList(chip.dataset.name, chip.dataset.cat, chip.dataset.unit);
    });
  });

  body.querySelectorAll('.shop-item').forEach(el => {
    const itemId = el.dataset.id;
    el.querySelector('.shop-item-check')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleItem(itemId);
    });
    el.querySelector('.shop-item-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(itemId);
    });
    el.addEventListener('click', () => {
      if (!isCompleted) openEditItemModal(itemId);
    });
  });

  document.getElementById('shopCompleteListBtn')?.addEventListener('click', completeList);

  // Autocomplete setup
  setupAutocomplete();
}

function renderShopItem(item, isCompleted) {
  const cat = SHOPPING_CATEGORIES[item.category] || SHOPPING_CATEGORIES.outros;
  const qtyLabel = item.quantity > 1 ? `${item.quantity} ${item.unit || 'un'}` : (item.unit ? `1 ${item.unit}` : '');

  return `
    <li class="shop-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
      <button class="shop-item-check" ${isCompleted ? 'disabled' : ''}>
        <i class="fa-solid ${item.checked ? 'fa-circle-check' : 'fa-circle'}"></i>
      </button>
      <div class="shop-item-info">
        <span class="shop-item-name">${esc(item.name)}</span>
        ${qtyLabel ? `<span class="shop-item-qty">${qtyLabel}</span>` : ''}
      </div>
      ${item.price ? `<span class="shop-item-price">${formatCurrency(item.price * (item.quantity || 1))}</span>` : ''}
      ${!isCompleted ? `<button class="shop-item-delete"><i class="fa-solid fa-xmark"></i></button>` : ''}
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

    if (val.length < 2) {
      dropdown.classList.remove('active');
      return;
    }

    const list = getActiveList();
    const existingNames = new Set((list?.items || []).map(i => i.name.toLowerCase()));
    const matches = QUICK_ITEMS.filter(q =>
      q.name.toLowerCase().includes(val) && !existingNames.has(q.name.toLowerCase())
    ).slice(0, 5);

    if (matches.length === 0) {
      dropdown.classList.remove('active');
      return;
    }

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
        addItemToList(btn.dataset.name, btn.dataset.cat, btn.dataset.unit);
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
      if (match) {
        addItemToList(match.name, match.category, match.unit);
      } else {
        addItemToList(val, 'outros', 'un');
      }
      input.value = '';
      document.getElementById('shoppingAutocomplete')?.classList.remove('active');
    }
  });

  // Close autocomplete on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.shopping-add-bar')) {
      document.getElementById('shoppingAutocomplete')?.classList.remove('active');
    }
  });
}

// ===== CRUD DE ITENS =====
function addItemToList(name, category, unit) {
  const list = getActiveList();
  if (!list) return;

  const exists = list.items.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    exists.quantity = (exists.quantity || 1) + 1;
  } else {
    list.items.push({
      id: generateId(),
      name,
      category: category || 'outros',
      quantity: 1,
      unit: unit || 'un',
      price: null,
      checked: false
    });
  }
  saveShoppingData();
  renderListDetail();
}

function toggleItem(itemId) {
  const list = getActiveList();
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;
  item.checked = !item.checked;
  saveShoppingData();
  renderListDetail();
}

function deleteItem(itemId) {
  const list = getActiveList();
  if (!list) return;
  list.items = list.items.filter(i => i.id !== itemId);
  saveShoppingData();
  renderListDetail();
}

function completeList() {
  const list = getActiveList();
  if (!list) return;
  list.status = 'completed';
  list.completedAt = new Date().toISOString();
  saveShoppingData();
  showAlert('Compras finalizadas!', 'success');
  shoppingView = 'lists';
  renderShoppingView();
}

function deleteList() {
  const list = getActiveList();
  if (!list) return;
  if (!confirm(`Excluir a lista "${list.name}"?`)) return;
  shoppingLists = shoppingLists.filter(l => l.id !== list.id);
  saveShoppingData();
  showAlert('Lista excluída.', 'info');
  shoppingView = 'lists';
  renderShoppingView();
}

// ===== EDITAR ITEM (MODAL) =====
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
  const item = list.items.find(i => i.id === editingItemId);
  if (!item) return;

  item.name = document.getElementById('editShopItemName').value.trim() || item.name;
  item.quantity = parseFloat(document.getElementById('editShopItemQty').value) || 1;
  item.unit = document.getElementById('editShopItemUnit').value || 'un';
  const price = parseFloat(document.getElementById('editShopItemPrice').value);
  item.price = isNaN(price) ? null : price;
  item.category = document.getElementById('editShopItemCategory').value || 'outros';

  saveShoppingData();
  editingItemId = null;
  document.getElementById('shoppingEditItemModal').classList.remove('active');
  renderListDetail();
}

// ===== SETUP DE EVENTOS =====
export function setupShoppingListeners() {
  // Close panel
  document.getElementById('shoppingCloseBtn')?.addEventListener('click', closeShoppingPanel);

  // Back to lists
  document.getElementById('shoppingBackBtn')?.addEventListener('click', () => {
    shoppingView = 'lists';
    renderShoppingView();
  });

  // New list
  document.getElementById('shopNewListBtn')?.addEventListener('click', createNewList);

  // Confirm new list
  document.getElementById('shopConfirmNewListBtn')?.addEventListener('click', confirmNewList);
  document.getElementById('shoppingNewListName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmNewList(); }
  });

  // Delete list
  document.getElementById('shoppingDeleteListBtn')?.addEventListener('click', deleteList);

  // Add item button
  document.getElementById('shoppingAddItemBtn')?.addEventListener('click', () => {
    const input = document.getElementById('shoppingItemInput');
    const val = input?.value.trim();
    if (!val) return;
    const match = QUICK_ITEMS.find(q => q.name.toLowerCase() === val.toLowerCase());
    if (match) {
      addItemToList(match.name, match.category, match.unit);
    } else {
      addItemToList(val, 'outros', 'un');
    }
    input.value = '';
    document.getElementById('shoppingAutocomplete')?.classList.remove('active');
  });

  // Edit item form
  document.getElementById('editShopItemForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEditItem();
  });

  // Close modals inside shopping
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

  // Close panel on backdrop
  document.getElementById('shoppingPanel')?.addEventListener('click', (e) => {
    if (e.target.id === 'shoppingPanel') closeShoppingPanel();
  });
}
