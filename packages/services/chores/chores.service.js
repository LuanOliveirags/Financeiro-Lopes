// ============================================================
// CHORES.SERVICE.JS — Dados e lógica de negócio das tarefas
// Sem dependências de DOM. Importável por qualquer camada.
// ============================================================

// ===== DADOS PADRÃO =====
export const CHORES_DEFAULT = {
  1: { luan: ['Fazer comida','Tirar o lixo','Levar o lixo','Lavar louça'],                                         bianca: ['Limpar o fogão','Dobrar e guardar roupas','Organizar bagunças'] },
  2: { luan: ['Fazer comida','Passar pano','Limpar o microondas','Limpar gordura do armário'],                      bianca: ['Lavar louça','Limpar o fogão','Varrer','Organizar bagunças'] },
  3: { luan: ['Fazer comida','Lavar o banheiro','Tirar o lixo','Levar o lixo'],                                    bianca: ['Lavar louça','Limpar o fogão','Lavar roupa','Organizar bagunças'] },
  4: { luan: ['Fazer comida','Passar pano','Lavar e lustrar mármore'],                                             bianca: ['Lavar louça','Limpar o fogão','Varrer','Dobrar e guardar roupas','Organizar bagunças'] },
  5: { luan: ['Fazer comida','Tirar o lixo','Levar o lixo','Limpar o microondas'],                                 bianca: ['Lavar louça','Limpar o fogão','Lavar o banheiro','Organizar bagunças'] },
  6: { luan: ['Fazer comida','Limpar armários (fora e dentro)','Lavar e lustrar mármore','Limpar geladeira','Limpar gordura do armário'], bianca: ['Lavar louça','Limpar o fogão','Limpar vidro da sacada','Limpar janelas','Limpar portas de vidro','Organizar bagunças'] },
  0: { luan: ['Fazer comida (marmitas)','Passar pano','Passar lustra móveis (varanda)','Reorganizar coisas'],      bianca: ['Lavar louça','Limpar o fogão','Varrer','Lavar roupa','Passar lustra móveis (roupas)','Dobrar roupas','Organizar bagunças'] }
};

// ===== PERSISTÊNCIA DE TAREFAS =====

export function loadChores() {
  const raw = localStorage.getItem('chores_custom_data');
  if (raw) { try { return JSON.parse(raw); } catch { /* ignore */ } }
  return JSON.parse(JSON.stringify(CHORES_DEFAULT));
}

export function saveChores(data) {
  localStorage.setItem('chores_custom_data', JSON.stringify(data));
}

// ===== PERSISTÊNCIA DE ESTADO CONCLUÍDO =====

export function getDoneKey(dayIndex) {
  return `chores_done_${dayIndex}_${new Date().toISOString().slice(0, 10)}`;
}

export function loadDoneState(dayIndex) {
  return JSON.parse(localStorage.getItem(getDoneKey(dayIndex)) || '{}');
}

export function saveDoneState(dayIndex, saved) {
  localStorage.setItem(getDoneKey(dayIndex), JSON.stringify(saved));
}

export function toggleDone(dayIndex, key) {
  const saved = loadDoneState(dayIndex);
  saved[key] = !saved[key];
  saveDoneState(dayIndex, saved);
  return saved;
}

// ===== OPERAÇÕES DE TAREFA =====

export function addChore(allData, day, person, text) {
  if (!allData[day]) allData[day] = { luan: [], bianca: [] };
  allData[day][person].push(text);
}

export function deleteChore(allData, day, person, index) {
  allData[day][person].splice(index, 1);
}

export function editChore(allData, day, person, index, text) {
  allData[day][person][index] = text;
}

// ===== ESTATÍSTICAS (função pura) =====

export function computeStats(data, saved) {
  const luanTotal = data.luan.length;
  const biancaTotal = data.bianca.length;
  const luanDone = data.luan.filter((_, i) => saved[`luan_${i}`]).length;
  const biancaDone = data.bianca.filter((_, i) => saved[`bianca_${i}`]).length;
  const total = luanTotal + biancaTotal;
  const done = luanDone + biancaDone;
  return {
    luanTotal, luanDone,
    biancaTotal, biancaDone,
    total, done,
    pct: total > 0 ? Math.round((done / total) * 100) : 0
  };
}
