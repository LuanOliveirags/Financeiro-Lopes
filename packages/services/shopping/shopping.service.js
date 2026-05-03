// ============================================================
// SHOPPING.SERVICE.JS — Dados e lógica de negócio da lista de compras
// Sem dependências de DOM. Importável por qualquer camada (web, testes, mobile).
// ============================================================

import { state, getFamilyId } from '../../core/state/store.js';
import { generateId, toDateStr } from '../../utils/helpers.js';

// ===== CATÁLOGOS =====

export const STORES = {
  ayumi:   { name: 'Ayumi',   label: 'Ayumi Supermercados',  img: 'assets/images/ayumi.png',   color: '#1a56db' },
  assai:   { name: 'Assaí',   label: 'Assaí Atacadista',     img: 'assets/images/Assai.png',   color: '#e63312' },
  westboi: { name: 'Westboi', label: 'Westboi Açougue',      img: 'assets/images/westboi.png', color: '#b91c1c' },
  outro:   { name: 'Outro',   label: 'Outro mercado',        img: null,                        color: '#6B7280' }
};

export const SHOPPING_CATEGORIES = {
  frutas:     { label: 'Frutas & Verduras', icon: 'fa-apple-whole',        color: '#06D6A0' },
  carnes:     { label: 'Carnes & Frios',    icon: 'fa-drumstick-bite',     color: '#EF233C' },
  padaria:    { label: 'Padaria',           icon: 'fa-bread-slice',        color: '#F8961E' },
  bebidas:    { label: 'Bebidas',           icon: 'fa-bottle-water',       color: '#4CC9F0' },
  laticinios: { label: 'Laticínios',        icon: 'fa-cheese',             color: '#FFD166' },
  mercearia:  { label: 'Mercearia',         icon: 'fa-jar',                color: '#8338EC' },
  limpeza:    { label: 'Limpeza',           icon: 'fa-spray-can-sparkles', color: '#4361EE' },
  higiene:    { label: 'Higiene & Beleza',  icon: 'fa-pump-soap',          color: '#C9A84C' },
  casa:       { label: 'Casa & Utilidades', icon: 'fa-house',              color: '#0096C7' },
  pets:       { label: 'Pets',              icon: 'fa-paw',                color: '#FFA500' },
  outros:     { label: 'Outros',            icon: 'fa-box',                color: '#9CA3AF' }
};

export const QUICK_ITEMS = [
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

// ===== PERSISTÊNCIA =====

export function loadLists() {
  return state.shoppingLists;
}

export function saveLists(lists) {
  state.shoppingLists = lists;
}

// ===== OPERAÇÕES DE LISTA =====

export function createList(name, storeKey) {
  return {
    id: generateId(),
    name,
    store: storeKey || 'outro',
    createdAt: new Date().toISOString(),
    items: [],
    status: 'active'
  };
}

export function reuseList(source) {
  return {
    id: generateId(),
    name: source.name + ' (cópia)',
    store: source.store || 'outro',
    createdAt: new Date().toISOString(),
    items: source.items.map(item => ({
      ...item,
      id: generateId(),
      checked: false,
      price: null
    })),
    status: 'active'
  };
}

// ===== OPERAÇÕES DE ITEM =====

export function addItem(list, name, category, unit) {
  const existing = list.items.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
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
}

export function toggleItem(list, itemId) {
  const item = list.items.find(i => i.id === itemId);
  if (item) item.checked = !item.checked;
}

export function removeItem(list, itemId) {
  list.items = list.items.filter(i => i.id !== itemId);
}

export function editItem(list, itemId, patch) {
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;
  Object.assign(item, patch);
}

// ===== CHECKOUT =====

const PAY_LABELS = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'Pix', vr: 'VR/VA' };

/**
 * Constrói o objeto de transação a partir do checkout da lista.
 * Puro — sem efeitos colaterais, sem DOM, sem Firebase.
 */
export function buildCheckoutTransaction({ list, totalValue, responsible, category, description, paymentMethod, familyId }) {
  const store = STORES[list.store] || STORES.outro;
  return {
    id: generateId(),
    type: 'saida',
    amount: totalValue,
    category,
    responsible: responsible || 'Família',
    date: toDateStr(new Date()),
    description: `🛒 ${description} — ${store.name} (${PAY_LABELS[paymentMethod] || paymentMethod})`,
    paymentMethod,
    familyId,
    createdAt: new Date().toISOString()
  };
}

export function finalizeList(list, totalSpent) {
  list.status = 'completed';
  list.completedAt = new Date().toISOString();
  list.totalSpent = totalSpent || 0;
}
