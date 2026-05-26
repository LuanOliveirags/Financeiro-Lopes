// ============================================================
// STATE.JS — Estado global da aplicação e helpers de role
// ============================================================

export const state = {
  isLoggedIn: false,
  user: null,
  currentUser: null,
  currentFamily: null,
  familyMembers: [],
  currentMonth: new Date(),
  transactions: [],
  debts: [],
  salaries: [],
  shoppingLists: [],
  syncStatus: 'online',
  charts: {},
  selectedDay: null
};

export function isSuperAdmin() {
  return state.currentUser && state.currentUser.role === 'superadmin';
}

export function isAdmin() {
  return state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin');
}

export function getFamilyId() {
  return state.currentUser && state.currentUser.familyId ? state.currentUser.familyId : null;
}

export function getFamilyStorageKey() {
  const fid = getFamilyId();
  if (!fid) return null;
  return `wolfsource_data_${fid}`;
}
