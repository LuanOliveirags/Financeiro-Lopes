// ============================================================
// UTILS.JS — Funções utilitárias compartilhadas
// ============================================================

import { CATEGORY_MAP } from '../../app/providers/firebase-config.js';

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatDate(dateString) {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T12:00:00'));
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getCategoryLabel(category) {
  return CATEGORY_MAP[category]?.label || category;
}

export function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert ${type}`;
  const icons = {
    success: 'fa-circle-check',
    danger: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };
  alertDiv.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  const main = document.querySelector('.main-content');
  if (main) {
    main.insertBefore(alertDiv, main.firstChild);
    // Ambient screen flash feedback
    if (type === 'success') { main.classList.add('feedback-success'); }
    else if (type === 'danger') { main.classList.add('feedback-error'); }
    setTimeout(() => main.classList.remove('feedback-success', 'feedback-error'), 900);
  }
  setTimeout(() => {
    alertDiv.style.opacity = '0';
    setTimeout(() => alertDiv.remove(), 300);
  }, 3000);
}

export function emptyState(text) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i class="fa-regular fa-folder-open"></i></div>
      <p class="empty-state-text">${text}</p>
    </div>`;
}
