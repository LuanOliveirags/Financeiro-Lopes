// ============================================================
// NOTIFICATIONS.JS — Notificações locais de dívidas (PWA)
// Suporta: Local Notifications via SW, Periodic Background Sync
// ============================================================

import { state } from '../../app/state/store.js';
import { formatCurrency } from '../utils/helpers.js';

const SETTINGS_KEY  = 'notif_settings_v1';
const LAST_CHECK_KEY = 'notif_last_check';

const IDB_NAME  = 'wolfsource-notif-db';
const IDB_VER   = 1;
const IDB_STORE = 'debtSummary';

const DEFAULT_SETTINGS = {
  enabled: false,
  notifyOverdue: true,
  notifyToday: true,
  notifyDaysBefore: 3,
};

// ===== SETTINGS =====
export function getNotifSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveNotifSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ===== SUPORTE =====
export function isNotifSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return await Notification.requestPermission();
}

// ===== INDEXEDDB (Compartilhada com Service Worker) =====
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

// Armazena resumo das dívidas para que o SW possa ler em background
export async function storeDebtSummaryForSW() {
  if (!isNotifSupported()) return;
  const settings  = getNotifSettings();
  const activeDebts = (state.debts || [])
    .filter(d => d.status === 'active')
    .map(d => ({
      id:       d.id,
      creditor: d.creditor,
      dueDate:  d.dueDate,
      amount:   d.installmentValue || d.amount,
    }));

  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ id: 'current', debts: activeDebts, settings, updatedAt: Date.now() });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  } catch (err) {
    console.warn('[Notif] Falha ao gravar IDB:', err);
  }
}

// ===== ANÁLISE DE DÍVIDAS =====
function getDaysUntilDue(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T12:00:00');
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function analyzeDebts(settings) {
  const active = (state.debts || []).filter(d => d.status === 'active');
  const overdue = [], dueToday = [], dueSoon = [];

  active.forEach(d => {
    const days = getDaysUntilDue(d.dueDate);
    if      (days < 0 && settings.notifyOverdue)                             overdue.push(d);
    else if (days === 0 && settings.notifyToday)                             dueToday.push(d);
    else if (days > 0 && days <= settings.notifyDaysBefore) dueSoon.push({ debt: d, days });
  });

  return { overdue, dueToday, dueSoon };
}

// ===== EXIBIR NOTIFICAÇÃO VIA SW =====
async function showNotification(title, body, tag, extraData = {}) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon:              'frontend/assets/images/icon-any-192.png',
      badge:             'frontend/assets/images/icon-any-96.png',
      tag,
      renotify:          true,
      requireInteraction: false,
      data:              { tab: 'debts', ...extraData },
      actions: [
        { action: 'view',    title: '📋 Ver Dívidas' },
        { action: 'dismiss', title: 'Dispensar'      },
      ],
    });
  } catch (err) {
    console.warn('[Notif] Erro ao exibir notificação:', err);
  }
}

// ===== VERIFICAÇÃO PRINCIPAL =====
export async function checkAndNotify(force = false) {
  const settings = getNotifSettings();
  if (!settings.enabled)                        return;
  if (Notification.permission !== 'granted')    return;

  // Limita a 1 disparo por dia (a não ser que force=true)
  if (!force) {
    const last  = localStorage.getItem(LAST_CHECK_KEY);
    const today = new Date().toDateString();
    if (last === today) return;
    localStorage.setItem(LAST_CHECK_KEY, today);
  }

  const { overdue, dueToday, dueSoon } = analyzeDebts(settings);

  if (overdue.length > 0) {
    const total = overdue.reduce((s, d) => s + (d.installmentValue || d.amount), 0);
    const names = overdue.slice(0, 2).map(d => d.creditor).join(', ');
    const extra = overdue.length > 2 ? ` e mais ${overdue.length - 2}` : '';
    await showNotification(
      `⚠️ ${overdue.length} dívida${overdue.length > 1 ? 's' : ''} em atraso!`,
      `${names}${extra}. Total: ${formatCurrency(total)}`,
      'debt-overdue',
    );
  }

  if (dueToday.length > 0) {
    const total = dueToday.reduce((s, d) => s + (d.installmentValue || d.amount), 0);
    const plural = dueToday.length > 1;
    await showNotification(
      `📅 ${dueToday.length} dívida${plural ? 's' : ''} vence${plural ? 'm' : ''} hoje!`,
      `${dueToday.slice(0, 2).map(d => d.creditor).join(', ')}. Total: ${formatCurrency(total)}`,
      'debt-today',
    );
  }

  if (dueSoon.length > 0) {
    const total = dueSoon.reduce((s, i) => s + (i.debt.installmentValue || i.debt.amount), 0);
    const desc  = dueSoon.slice(0, 2).map(i => `${i.debt.creditor} (${i.days}d)`).join(', ');
    const extra = dueSoon.length > 2 ? '...' : '';
    await showNotification(
      `🔔 ${dueSoon.length} dívida${dueSoon.length > 1 ? 's' : ''} vencendo em breve`,
      `${desc}${extra}. Total: ${formatCurrency(total)}`,
      'debt-upcoming',
    );
  }

  if (!overdue.length && !dueToday.length && !dueSoon.length && force) {
    await showNotification(
      '✅ Tudo em dia!',
      'Nenhuma dívida urgente encontrada.',
      'debt-ok',
    );
  }
}

// ===== PERIODIC BACKGROUND SYNC =====
async function registerPeriodicSync() {
  try {
    const reg    = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return;
    await reg.periodicSync.register('debt-check', { minInterval: 24 * 60 * 60 * 1000 });
    console.log('[Notif] Periodic Background Sync registrado');
  } catch (err) {
    // Não é erro crítico — recurso disponível apenas em Chrome Android com HTTPS
    console.log('[Notif] Periodic Sync indisponível neste ambiente:', err.message);
  }
}

// ===== AGENDAMENTO DIÁRIO (app aberto) =====
let _dailyTimer = null;
function scheduleDailyAt9am() {
  if (_dailyTimer) return; // Já agendado
  const now   = new Date();
  const next9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  if (now >= next9) next9.setDate(next9.getDate() + 1);
  const msUntil = next9 - now;

  _dailyTimer = setTimeout(async () => {
    _dailyTimer = null;
    await checkAndNotify();
    scheduleDailyAt9am(); // Reagenda para o próximo dia
  }, msUntil);
}

// ===== INICIALIZAÇÃO =====
export async function initNotifications() {
  if (!isNotifSupported()) return;
  const settings = getNotifSettings();
  if (!settings.enabled || Notification.permission !== 'granted') return;

  await checkAndNotify();
  scheduleDailyAt9am();
  await registerPeriodicSync();
}

// ===== ATIVAR NOTIFICAÇÕES =====
export async function enableNotifications() {
  const perm = await requestPermission();
  if (perm !== 'granted') return perm;

  const settings = { ...getNotifSettings(), enabled: true };
  saveNotifSettings(settings);

  await storeDebtSummaryForSW();
  await checkAndNotify(true);
  scheduleDailyAt9am();
  await registerPeriodicSync();
  return 'granted';
}

// ===== DESATIVAR NOTIFICAÇÕES =====
export function disableNotifications() {
  saveNotifSettings({ ...getNotifSettings(), enabled: false });
  if (_dailyTimer) {
    clearTimeout(_dailyTimer);
    _dailyTimer = null;
  }
}
