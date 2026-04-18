// ============================================================
// APP.JS — Entry point da aplicação WolfSource
// ============================================================

import { loadPages } from './router.js';
import { initFirebase, setRefreshCallback } from './providers/firebase-provider.js';
import { createDefaultAdmin, checkLoginStatus, initResetPasswordUI } from './providers/auth-provider.js';
import { setupEventListeners, setupOnlineOfflineListeners } from '../shared/components/navigation/navigation.js';
import { updateDashboard, setupDashboardToggle, setupKpiClickListeners, setupValuesToggle } from '../modules/dashboard/dashboard.js';
import { updateTransactionHistory } from '../modules/transactions/transactions.service.js';
import { updateDebtsList } from '../modules/debts/debts.js';
import { updateSalaryDisplay } from '../modules/salaries/salaries.js';
import { initNotifications, storeDebtSummaryForSW } from '../shared/services/notifications.js';
import { initChat } from '../modules/chat/chat.js';
import { initFCM } from '../modules/chat/fcm.js';
import '../modules/shopping/shopping.js';

// Carrega todos os fragmentos HTML antes de qualquer acesso ao DOM
await loadPages();

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
// Não usa DOMContentLoaded — o top-level await loadPages() já garante
// que DOM está pronto e scripts externos (Firebase, Chart.js) carregados.
console.log('🚀 Iniciando aplicação WolfSource...');
initFirebase();

// Registra event listeners ANTES de qualquer operação async
// para que o formulário de login tenha e.preventDefault() ativo
setupEventListeners();
setupDashboardToggle();
setupKpiClickListeners();
setupValuesToggle();
setupOnlineOfflineListeners();
initResetPasswordUI();

// Operações async que dependem do Firebase (podem demorar)
await createDefaultAdmin();
await checkLoginStatus();

console.log('✅ Aplicação WolfSource iniciada com sucesso! 💰');
