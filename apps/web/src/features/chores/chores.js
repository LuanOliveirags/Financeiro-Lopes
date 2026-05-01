// ============================================================
// CHORES.JS — Controller de UI das Tarefas da Casa
// Responsabilidade: DOM, eventos e orquestração.
// Lógica de dados → packages/services/chores/chores.service.js
// ============================================================

import { esc } from '../../../../../packages/utils/helpers.js';
import {
  loadChores,
  saveChores,
  loadDoneState,
  toggleDone,
  addChore,
  deleteChore,
  editChore,
  computeStats
} from '../../../../../packages/services/chores/chores.service.js';

// ===== ESTADO DO CONTROLLER =====
let choresEditMode = false;
let choresCurrentDay = new Date().getDay();

// ===== ABERTURA DA ABA =====
export function openChoresTab() {
  choresCurrentDay = new Date().getDay();
  initChoresDayScroller();
  renderChoresTab(choresCurrentDay);
}

// ===== SCROLLER DE DIAS =====
function initChoresDayScroller() {
  const scroller = document.getElementById('choresDayScroller');
  if (!scroller) return;
  const days = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const today = new Date();
  const currentDow = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDow);

  scroller.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dow = d.getDay();
    const isToday = dow === currentDow && d.toDateString() === today.toDateString();
    const isSelected = dow === choresCurrentDay;

    const btn = document.createElement('button');
    btn.className = 'cds-day' + (isToday ? ' today' : '') + (isSelected ? ' active' : '');
    btn.dataset.day = dow;
    btn.innerHTML = `<span class="cds-label">${days[dow]}</span><span class="cds-num">${d.getDate()}</span>`;
    btn.addEventListener('click', () => {
      choresCurrentDay = dow;
      document.querySelectorAll('.cds-day').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChoresTab(dow);
    });
    scroller.appendChild(btn);
  }
}

// ===== RENDER =====
function renderChoresTab(dayIndex) {
  const allData = loadChores();
  const data = allData[dayIndex] || { luan: [], bianca: [] };
  const saved = loadDoneState(dayIndex);

  const luanList = document.getElementById('choresLuanList');
  const biancaList = document.getElementById('choresBiancaList');
  if (luanList) luanList.innerHTML = data.luan.map((task, i) => buildChoreItem(task, i, 'luan', dayIndex, saved)).join('');
  if (biancaList) biancaList.innerHTML = data.bianca.map((task, i) => buildChoreItem(task, i, 'bianca', dayIndex, saved)).join('');

  renderStats(data, saved);
  updateEditMode();
}

function buildChoreItem(task, index, person, dayIndex, saved) {
  const key = `${person}_${index}`;
  const done = saved[key] || false;
  const editBtns = choresEditMode ? `
    <div class="chore-edit-actions">
      <button class="chore-edit-btn" data-action="edit" data-person="${person}" data-index="${index}" data-day="${dayIndex}"><i class="fa-solid fa-pen"></i></button>
      <button class="chore-edit-btn danger" data-action="delete" data-person="${person}" data-index="${index}" data-day="${dayIndex}"><i class="fa-solid fa-trash"></i></button>
    </div>` : '';

  return `<li class="chore-task-item ${done ? 'done' : ''}" data-key="${key}" data-day="${dayIndex}">
    <div class="cti-left">
      <span class="cti-check"><i class="fa-solid ${done ? 'fa-circle-check' : 'fa-circle'}"></i></span>
      <span class="cti-text">${esc(task)}</span>
    </div>
    ${editBtns}
  </li>`;
}

function renderStats(data, saved) {
  const { luanTotal, luanDone, biancaTotal, biancaDone, total, done, pct } = computeStats(data, saved);

  const ring = document.getElementById('choresRingFill');
  if (ring) {
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('choresRingPct',     pct + '%');
  el('choresLuanCount',   `${luanDone}/${luanTotal}`);
  el('choresBiancaCount', `${biancaDone}/${biancaTotal}`);
  el('choresTotalDone',   done);
  el('choresTotalPending', total - done);
  el('choresLuanBadge',   `${luanDone}/${luanTotal}`);
  el('choresBiancaBadge', `${biancaDone}/${biancaTotal}`);
}

function updateEditMode() {
  const addLuan = document.getElementById('choresAddLuan');
  const addBianca = document.getElementById('choresAddBianca');
  const toggleBtn = document.getElementById('editChoresToggle');
  if (addLuan) addLuan.style.display = choresEditMode ? 'flex' : 'none';
  if (addBianca) addBianca.style.display = choresEditMode ? 'flex' : 'none';
  if (toggleBtn) {
    toggleBtn.classList.toggle('active-edit', choresEditMode);
    toggleBtn.title = choresEditMode ? 'Sair da edição' : 'Editar tarefas';
  }
}

// ===== HANDLERS =====
function handleAddChore(person) {
  const inputId = person === 'luan' ? 'choresNewLuan' : 'choresNewBianca';
  const input = document.getElementById(inputId);
  const text = input?.value.trim();
  if (!text) return;

  const allData = loadChores();
  addChore(allData, choresCurrentDay, person, text);
  saveChores(allData);
  input.value = '';
  renderChoresTab(choresCurrentDay);
}

// ===== SETUP DE EVENTOS =====
export function setupChoresListeners() {
  document.getElementById('editChoresToggle')?.addEventListener('click', () => {
    choresEditMode = !choresEditMode;
    renderChoresTab(choresCurrentDay);
  });

  document.getElementById('chores')?.addEventListener('click', function(e) {
    const editBtn = e.target.closest('.chore-edit-btn');
    if (editBtn) {
      const { action, person, day } = editBtn.dataset;
      const index = parseInt(editBtn.dataset.index);
      const dayInt = parseInt(day);
      const allData = loadChores();

      if (action === 'delete') {
        deleteChore(allData, dayInt, person, index);
        saveChores(allData);
        renderChoresTab(dayInt);
        return;
      }

      if (action === 'edit') {
        document.getElementById('editChoreText').value = allData[dayInt][person][index];
        document.getElementById('editChorePerson').value = person;
        document.getElementById('editChoreIndex').value = index;
        document.getElementById('editChoreDay').value = dayInt;
        document.getElementById('editChoreModal').classList.add('active');
        return;
      }
      return;
    }

    const item = e.target.closest('.chore-task-item');
    if (!item || choresEditMode) return;
    const saved = toggleDone(parseInt(item.dataset.day), item.dataset.key);
    renderChoresTab(parseInt(item.dataset.day));
  });

  document.getElementById('editChoreForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const text = document.getElementById('editChoreText').value.trim();
    const person = document.getElementById('editChorePerson').value;
    const index = parseInt(document.getElementById('editChoreIndex').value);
    const day = parseInt(document.getElementById('editChoreDay').value);
    if (!text) return;

    const allData = loadChores();
    editChore(allData, day, person, index, text);
    saveChores(allData);
    document.getElementById('editChoreModal').classList.remove('active');
    renderChoresTab(day);
  });

  document.getElementById('choresAddLuanBtn')?.addEventListener('click', () => handleAddChore('luan'));
  document.getElementById('choresAddBiancaBtn')?.addEventListener('click', () => handleAddChore('bianca'));
  document.getElementById('choresNewLuan')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChore('luan'); } });
  document.getElementById('choresNewBianca')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChore('bianca'); } });
}
