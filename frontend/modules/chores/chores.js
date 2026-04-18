// ============================================================
// CHORES.JS — Tarefas da casa
// ============================================================

import { esc } from '../../shared/utils/helpers.js';

// ===== DADOS PADRÃO =====
const CHORES_DEFAULT = {
  1: { luan: ['Fazer comida','Tirar o lixo','Levar o lixo','Lavar louça'], bianca: ['Limpar o fogão','Dobrar e guardar roupas','Organizar bagunças'] },
  2: { luan: ['Fazer comida','Passar pano','Limpar o microondas','Limpar gordura do armário'], bianca: ['Lavar louça','Limpar o fogão','Varrer','Organizar bagunças'] },
  3: { luan: ['Fazer comida','Lavar o banheiro','Tirar o lixo','Levar o lixo'], bianca: ['Lavar louça','Limpar o fogão','Lavar roupa','Organizar bagunças'] },
  4: { luan: ['Fazer comida','Passar pano','Lavar e lustrar mármore'], bianca: ['Lavar louça','Limpar o fogão','Varrer','Dobrar e guardar roupas','Organizar bagunças'] },
  5: { luan: ['Fazer comida','Tirar o lixo','Levar o lixo','Limpar o microondas'], bianca: ['Lavar louça','Limpar o fogão','Lavar o banheiro','Organizar bagunças'] },
  6: { luan: ['Fazer comida','Limpar armários (fora e dentro)','Lavar e lustrar mármore','Limpar geladeira','Limpar gordura do armário'], bianca: ['Lavar louça','Limpar o fogão','Limpar vidro da sacada','Limpar janelas','Limpar portas de vidro','Organizar bagunças'] },
  0: { luan: ['Fazer comida (marmitas)','Passar pano','Passar lustra móveis (varanda)','Reorganizar coisas'], bianca: ['Lavar louça','Limpar o fogão','Varrer','Lavar roupa','Passar lustra móveis (roupas)','Dobrar roupas','Organizar bagunças'] }
};

let choresEditMode = false;
let choresCurrentDay = new Date().getDay();

function getChoresData() {
  const custom = localStorage.getItem('chores_custom_data');
  if (custom) { try { return JSON.parse(custom); } catch(e) { /* ignore */ } }
  return JSON.parse(JSON.stringify(CHORES_DEFAULT));
}

function saveChoresData(data) {
  localStorage.setItem('chores_custom_data', JSON.stringify(data));
}

function getDoneKey(dayIndex) {
  return `chores_done_${dayIndex}_${new Date().toISOString().slice(0,10)}`;
}

export function openChoresTab() {
  choresCurrentDay = new Date().getDay();
  initChoresDayScroller();
  renderChoresTab(choresCurrentDay);
}

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
    const dayNum = d.getDate();
    const dow = d.getDay();
    const isToday = dow === currentDow && d.toDateString() === today.toDateString();
    const isSelected = dow === choresCurrentDay;

    const btn = document.createElement('button');
    btn.className = 'cds-day' + (isToday ? ' today' : '') + (isSelected ? ' active' : '');
    btn.dataset.day = dow;
    btn.innerHTML = `<span class="cds-label">${days[dow]}</span><span class="cds-num">${dayNum}</span>`;
    btn.addEventListener('click', () => {
      choresCurrentDay = dow;
      document.querySelectorAll('.cds-day').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChoresTab(dow);
    });
    scroller.appendChild(btn);
  }
}

function renderChoresTab(dayIndex) {
  const allData = getChoresData();
  const data = allData[dayIndex] || { luan: [], bianca: [] };
  const saved = JSON.parse(localStorage.getItem(getDoneKey(dayIndex)) || '{}');

  const luanList = document.getElementById('choresLuanList');
  const biancaList = document.getElementById('choresBiancaList');
  if (luanList) luanList.innerHTML = data.luan.map((task, i) => buildChoreItem(task, i, 'luan', dayIndex, saved)).join('');
  if (biancaList) biancaList.innerHTML = data.bianca.map((task, i) => buildChoreItem(task, i, 'bianca', dayIndex, saved)).join('');

  updateChoresDashboard(data, saved);
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

function updateChoresDashboard(data, saved) {
  const luanTotal = data.luan.length;
  const biancaTotal = data.bianca.length;
  const luanDone = data.luan.filter((_,i) => saved[`luan_${i}`]).length;
  const biancaDone = data.bianca.filter((_,i) => saved[`bianca_${i}`]).length;
  const total = luanTotal + biancaTotal;
  const done = luanDone + biancaDone;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const ring = document.getElementById('choresRingFill');
  if (ring) {
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }
  const ringPct = document.getElementById('choresRingPct');
  if (ringPct) ringPct.textContent = pct + '%';

  const el = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  el('choresLuanCount', `${luanDone}/${luanTotal}`);
  el('choresBiancaCount', `${biancaDone}/${biancaTotal}`);
  el('choresTotalDone', done);
  el('choresTotalPending', total - done);
  el('choresLuanBadge', `${luanDone}/${luanTotal}`);
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

function addNewChore(person) {
  const inputId = person === 'luan' ? 'choresNewLuan' : 'choresNewBianca';
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) return;
  const allData = getChoresData();
  if (!allData[choresCurrentDay]) allData[choresCurrentDay] = { luan: [], bianca: [] };
  allData[choresCurrentDay][person].push(text);
  saveChoresData(allData);
  input.value = '';
  renderChoresTab(choresCurrentDay);
}

// ===== SETUP DE EVENTOS DO CHORES =====
export function setupChoresListeners() {
  document.getElementById('editChoresToggle')?.addEventListener('click', () => {
    choresEditMode = !choresEditMode;
    renderChoresTab(choresCurrentDay);
  });

  document.getElementById('chores')?.addEventListener('click', function(e) {
    const editBtn = e.target.closest('.chore-edit-btn');
    if (editBtn) {
      const action = editBtn.dataset.action;
      const person = editBtn.dataset.person;
      const index = parseInt(editBtn.dataset.index);
      const day = parseInt(editBtn.dataset.day);
      if (action === 'delete') {
        const allData = getChoresData();
        allData[day][person].splice(index, 1);
        saveChoresData(allData);
        renderChoresTab(day);
        return;
      }
      if (action === 'edit') {
        const allData = getChoresData();
        document.getElementById('editChoreText').value = allData[day][person][index];
        document.getElementById('editChorePerson').value = person;
        document.getElementById('editChoreIndex').value = index;
        document.getElementById('editChoreDay').value = day;
        document.getElementById('editChoreModal').classList.add('active');
        return;
      }
      return;
    }
    const item = e.target.closest('.chore-task-item');
    if (!item || choresEditMode) return;
    const key = item.dataset.key;
    const dayIndex = parseInt(item.dataset.day);
    const savedKey = getDoneKey(dayIndex);
    const saved = JSON.parse(localStorage.getItem(savedKey) || '{}');
    saved[key] = !saved[key];
    localStorage.setItem(savedKey, JSON.stringify(saved));
    renderChoresTab(dayIndex);
  });

  document.getElementById('editChoreForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const text = document.getElementById('editChoreText').value.trim();
    const person = document.getElementById('editChorePerson').value;
    const index = parseInt(document.getElementById('editChoreIndex').value);
    const day = parseInt(document.getElementById('editChoreDay').value);
    if (!text) return;
    const allData = getChoresData();
    allData[day][person][index] = text;
    saveChoresData(allData);
    document.getElementById('editChoreModal').classList.remove('active');
    renderChoresTab(day);
  });

  document.getElementById('choresAddLuanBtn')?.addEventListener('click', () => addNewChore('luan'));
  document.getElementById('choresAddBiancaBtn')?.addEventListener('click', () => addNewChore('bianca'));
  document.getElementById('choresNewLuan')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addNewChore('luan'); } });
  document.getElementById('choresNewBianca')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addNewChore('bianca'); } });
}
