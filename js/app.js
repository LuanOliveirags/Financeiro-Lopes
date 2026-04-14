// ============================================================
// APP.JS — Entry point da aplicação Financeiro Lopes
// ============================================================

import { initFirebase, setRefreshCallback } from './data.js';
import { createDefaultAdmin, checkLoginStatus, initResetPasswordUI } from './auth.js';
import { setupEventListeners, setupOnlineOfflineListeners } from './navigation.js';
import { updateDashboard, setupDashboardToggle, setupKpiClickListeners, setupValuesToggle } from './dashboard.js';
import { updateTransactionHistory } from './transactions.js';
import { updateDebtsList } from './debts.js';
import { updateSalaryDisplay } from './salaries.js';
import { initNotifications, storeDebtSummaryForSW } from './notifications.js';
import { initChat } from './chat.js';
import { initFCM } from './fcm.js';
import './shopping.js';

// Registra callback centralizado para refresh de UI após carregamento de dados
setRefreshCallback(async () => {
  updateDashboard();
  updateTransactionHistory();
  updateDebtsList();
  updateSalaryDisplay();
  // Inicializa chat em tempo real (seguro chamar múltiplas vezes)
  initChat();
  // Inicializa FCM para push notifications do chat no celular
  initFCM().catch(() => {});
  // Mantém IDB do SW atualizado e verifica notificações
  await storeDebtSummaryForSW();
  await initNotifications();
});

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  await createDefaultAdmin();
  setupEventListeners();
  setupDashboardToggle();
  setupKpiClickListeners();
  setupValuesToggle();
  setupOnlineOfflineListeners();
  initResetPasswordUI();
  await checkLoginStatus();

  console.log('Aplicação Financeiro Lopes iniciada com sucesso! 💰');
});
