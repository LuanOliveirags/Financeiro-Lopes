// ============================================================
// APP.JS — Entry point da aplicação WolfSource
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
  console.log('🔄 Atualizando UI com novos dados...');
  try {
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
    console.log('✅ UI atualizada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao atualizar UI:', error);
  }
});

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando aplicação WolfSource...');
  initFirebase();
  await createDefaultAdmin();
  setupEventListeners();
  setupDashboardToggle();
  setupKpiClickListeners();
  setupValuesToggle();
  setupOnlineOfflineListeners();
  initResetPasswordUI();
  await checkLoginStatus();

  console.log('✅ Aplicação WolfSource iniciada com sucesso! 💰');
});
