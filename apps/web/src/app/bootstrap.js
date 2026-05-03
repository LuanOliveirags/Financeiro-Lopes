// ============================================================
// APP.JS — Entry point da aplicação WolfSource
// ============================================================

import { loadPages } from './router.js';
import { initFirebase, setRefreshCallback } from '../../../../packages/services/firebase/firebase.service.js';
import { createDefaultAdmin, checkLoginStatus, initResetPasswordUI } from '../../../../packages/services/auth/auth.service.js';
import { setupEventListeners, setupOnlineOfflineListeners, initMonthScroller } from '../../../../packages/ui/navigation/navigation.js';
import { updateDashboard, setupDashboardToggle, setupKpiClickListeners, setupValuesToggle } from '../features/dashboard/dashboard.js';
import { updateTransactionHistory } from '../features/transactions/transactions.js';
import { updateDebtsList } from '../features/debts/debts.js';
import { updateSalaryDisplay } from '../features/salaries/salaries.js';
import { initNotifications, storeDebtSummaryForSW } from '../../../../packages/services/notifications/notification.service.js';
import { initChat } from '../features/chat/chat.js';
import { initFCM } from '../../../../packages/services/firebase/fcm.service.js';
import { refreshShoppingIfOpen } from '../features/shopping/shopping.js';

// Carrega todos os fragmentos HTML antes de qualquer acesso ao DOM
await loadPages();

setRefreshCallback(async () => {
  try {
    updateDashboard();
    updateTransactionHistory();
    updateDebtsList();
    updateSalaryDisplay();
    refreshShoppingIfOpen();
    initChat();
    initFCM().catch(() => {});
    await storeDebtSummaryForSW();
    await initNotifications();
  } catch (error) {
    console.error('Erro ao atualizar UI:', error);
  }
});

// ===== INICIALIZAÇÃO =====
// Não usa DOMContentLoaded — o top-level await loadPages() já garante
// que DOM está pronto e scripts externos (Firebase, Chart.js) carregados.
initFirebase();

// Registra event listeners ANTES de qualquer operação async
// para que o formulário de login tenha e.preventDefault() ativo
setupEventListeners();
setupDashboardToggle();
setupKpiClickListeners();
setupValuesToggle();
setupOnlineOfflineListeners();
initResetPasswordUI();
initMonthScroller();

// Operações async que dependem do Firebase (podem demorar)
await createDefaultAdmin();
await checkLoginStatus();;
