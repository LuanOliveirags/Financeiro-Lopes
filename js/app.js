// ============================================================
// APP.JS — Entry point da aplicação Financeiro Lopes
// ============================================================

import { initFirebase, setRefreshCallback } from './data.js';
import { createDefaultAdmin, checkLoginStatus, initResetPasswordUI } from './auth.js';
import { setupEventListeners, setupOnlineOfflineListeners } from './navigation.js';
import { updateDashboard } from './dashboard.js';
import { updateTransactionHistory } from './transactions.js';
import { updateDebtsList } from './debts.js';
import { updateSalaryDisplay } from './salaries.js';

// Registra callback centralizado para refresh de UI após carregamento de dados
setRefreshCallback(() => {
  updateDashboard();
  updateTransactionHistory();
  updateDebtsList();
  updateSalaryDisplay();
});

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  await createDefaultAdmin();
  setupEventListeners();
  setupOnlineOfflineListeners();
  initResetPasswordUI();
  await checkLoginStatus();

  console.log('Aplicação Financeiro Lopes iniciada com sucesso! 💰');
});
