// ============================================================
// AUTH.JS — Autenticação, família, admin, recuperação de senha
// ============================================================
/* global firebase, emailjs */

import { EMAILJS_CONFIG } from './config.js';
import { state, isSuperAdmin, isAdmin, getFamilyId } from './state.js';
import { esc, showAlert, generateId } from './utils.js';
import { db, firebaseReady, storage as fbStorage, saveDataToStorage, loadDataFromStorage, cleanupFirebaseListeners } from './data.js';

// ===== HASH DE SENHA =====
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== CRIAR ADMIN PADRÃO =====
export async function createDefaultAdmin() {
  if (!firebaseReady) return;
  try {
    const familySnap = await db.collection('families').doc('family-lopes').get();
    if (!familySnap.exists) {
      await db.collection('families').doc('family-lopes').set({
        id: 'family-lopes', name: 'Lopes', createdAt: new Date().toISOString()
      });
    }
    const snap = await db.collection('users').where('login', '==', 'luangs').get();
    if (snap.empty) {
      const hash = await hashPassword('Space@10');
      await db.collection('users').doc('admin-luangs').set({
        id: 'admin-luangs', fullName: 'Luan Gs', email: 'luanoliveirags@gmail.com',
        login: 'luangs', passwordHash: hash, role: 'superadmin',
        familyId: 'family-lopes', createdAt: new Date().toISOString()
      });
    } else {
      const adminDoc = snap.docs[0];
      const adminData = adminDoc.data();
      const updates = {};
      if (!adminData.familyId) updates.familyId = 'family-lopes';
      if (adminData.role !== 'superadmin') updates.role = 'superadmin';
      if (Object.keys(updates).length > 0) await db.collection('users').doc(adminDoc.id).update(updates);
    }
  } catch (error) {
    console.error('Erro ao criar admin padrão:', error);
  }
}

// ===== LOGIN / REGISTRO =====
export async function loginUser(login, password) {
  const hash = await hashPassword(password);
  if (firebaseReady) {
    try {
      const snap = await db.collection('users').where('login', '==', login).get();
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        if (userData.passwordHash === hash) return userData;
      }
      return null;
    } catch (error) {
      if (error.code === 'permission-denied') throw new Error('Sem permissão no Firestore.');
      throw new Error('Erro ao conectar com o servidor.');
    }
  }
  throw new Error('Firebase não disponível.');
}

export async function registerUser(fullName, email, login, password, familyId) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  if (!familyId) throw new Error('É necessário selecionar uma família.');
  const existing = await db.collection('users').where('login', '==', login).get();
  if (!existing.empty) throw new Error('Esse login já está em uso.');
  const emailCheck = await db.collection('users').where('email', '==', email).get();
  if (!emailCheck.empty) throw new Error('Esse e-mail já está cadastrado.');

  const hash = await hashPassword(password);
  const id = `user-${Date.now()}`;
  const user = { id, fullName, email, login, passwordHash: hash, role: 'user', familyId, createdAt: new Date().toISOString() };
  await db.collection('users').doc(id).set(user);
  return user;
}

export async function changeUserPassword(userId, oldPassword, newPassword) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) throw new Error('Usuário não encontrado.');
  const userData = doc.data();
  const oldHash = await hashPassword(oldPassword);
  if (userData.passwordHash !== oldHash) throw new Error('Senha atual incorreta.');
  const newHash = await hashPassword(newPassword);
  await db.collection('users').doc(userId).update({ passwordHash: newHash });
  if (state.currentUser && state.currentUser.id === userId) {
    state.currentUser.passwordHash = newHash;
    localStorage.setItem('user', JSON.stringify(state.currentUser));
  }
  return true;
}

/** Salva/atualiza o número de telefone do usuário atual. */
export async function savePhoneNumber(rawPhone) {
  if (!firebaseReady || !state.currentUser) throw new Error('Não autenticado.');
  const normalized = rawPhone.replace(/\D/g, '');
  if (normalized.length < 10 || normalized.length > 11) {
    throw new Error('Número inválido. Use o formato (DDD) + número com 9 dígitos.');
  }
  // Garante unicidade: nenhum outro usuário pode ter o mesmo telefone
  const existing = await db.collection('users').where('phone', '==', normalized).limit(1).get();
  if (!existing.empty && existing.docs[0].id !== state.currentUser.id) {
    throw new Error('Este número já está cadastrado para outro usuário.');
  }
  await db.collection('users').doc(state.currentUser.id).update({ phone: normalized });
  state.currentUser.phone = normalized;
  localStorage.setItem('user', JSON.stringify(state.currentUser));
  return normalized;
}

export async function saveRecado(text) {
  if (!firebaseReady || !state.currentUser) throw new Error('Não autenticado.');
  const trimmed = text.trim().slice(0, 120);
  await db.collection('users').doc(state.currentUser.id).update({ recado: trimmed });
  state.currentUser.recado = trimmed;
  localStorage.setItem('user', JSON.stringify(state.currentUser));
  return trimmed;
}

// ===== FAMÍLIA =====
export async function loadFamily() {
  if (!firebaseReady || !state.currentUser || !state.currentUser.familyId) {
    state.currentFamily = null;
    state.familyMembers = [];
    return;
  }
  try {
    const doc = await db.collection('families').doc(state.currentUser.familyId).get();
    if (doc.exists) state.currentFamily = doc.data();
    await loadFamilyMembers();
  } catch (e) {
    console.error('Erro ao carregar família:', e);
  }
}

export async function loadFamilyMembers() {
  state.familyMembers = [];
  const familyId = getFamilyId();
  if (!familyId || !firebaseReady) return;
  try {
    const snap = await db.collection('users').where('familyId', '==', familyId).get();
    state.familyMembers = snap.docs.map(doc => {
      const d = doc.data();
      return { id: d.id, name: d.fullName || d.login, login: d.login };
    });
  } catch (e) {
    console.error('Erro ao carregar membros da família:', e);
  }
  populateMemberSelects();
  renderPersonIncomeCards();
  renderCardDebtCards();
}

export function populateMemberSelects() {
  const members = state.familyMembers || [];
  const selects = [
    { el: document.getElementById('tranResponsible'), placeholder: 'Selecione...', addAmbos: true },
    { el: document.getElementById('debtResponsible'), placeholder: null, addAmbos: true },
    { el: document.getElementById('salaryPerson'), placeholder: null, addAmbos: false, prefix: 'Salário ' }
  ];
  selects.forEach(({ el, placeholder, addAmbos, prefix }) => {
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    if (placeholder) el.innerHTML += `<option value="">${placeholder}</option>`;
    members.forEach(m => { el.innerHTML += `<option value="${m.name}">${prefix || ''}${m.name}</option>`; });
    if (addAmbos) el.innerHTML += `<option value="Ambos">Ambos</option>`;
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
  });
}

export function renderPersonIncomeCards() {
  const container = document.querySelector('.person-cards-grid');
  if (!container) return;
  const members = state.familyMembers || [];
  const gradients = [
    ['#1e3a8a', '#1e1b6e'],
    ['#9d174d', '#701a75'],
    ['#065f46', '#064e3b'],
    ['#9a3412', '#7c2d12'],
    ['#5b21b6', '#4c1d95'],
    ['#0e7490', '#155e75']
  ];
  const icons = ['fa-user-tie', 'fa-user', 'fa-user-astronaut', 'fa-user-ninja', 'fa-user-secret', 'fa-user-graduate'];
  let html = '';
  members.forEach((m, i) => {
    const slug = m.name.replace(/\s+/g, '_');
    const [g1, g2] = gradients[i % gradients.length];
    html += `
      <div class="person-income-card" style="background:linear-gradient(135deg, ${g1}, ${g2})">
        <div class="pic-header">
          <div class="pic-avatar">${m.name.toLowerCase().startsWith('bianca') ? '<img src="img/bianca.jpeg" alt="Bianca" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : m.name.toLowerCase().startsWith('luan') ? '<img src="img/luan.jpg" alt="Luan" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : '<i class="fa-solid ' + icons[i % icons.length] + '"></i>'}</div>
          <span class="pic-name">${m.name}</span>
        </div>
        <div class="pic-salaries">
          <div class="pic-salary-row">
            <span class="pic-salary-label"><i class="fa-solid fa-sack-dollar"></i> Salário</span>
            <span class="pic-salary-val" id="salary_${slug}">R$ 0,00</span>
          </div>
          <div class="pic-salary-row pic-vr-row">
            <span class="pic-salary-label"><i class="fa-solid fa-utensils"></i> VR/VA</span>
            <span class="pic-salary-val pic-vr-val" id="vr_${slug}">R$ 0,00</span>
          </div>
        </div>
        <p class="salary-annual" id="annual_${slug}">Anual: R$ 0,00</p>
      </div>`;
  });
  html += `
    <div class="person-income-card combined-card" style="grid-column: 1 / -1;">
      <div class="pic-header">
        <div class="pic-avatar combined-avatar"><i class="fa-solid fa-users"></i></div>
        <span class="pic-name">Combinado</span>
      </div>
      <div class="pic-combined-grid">
        <div class="pic-combined-item">
          <span class="pic-combined-label"><i class="fa-solid fa-sack-dollar"></i> Salários</span>
          <span class="pic-combined-val" id="combinedSalary">R$ 0,00</span>
          <span class="pic-combined-sub" id="combinedAnnual">Anual: R$ 0,00</span>
        </div>
        <div class="pic-combined-divider"></div>
        <div class="pic-combined-item pic-combined-vr">
          <span class="pic-combined-label"><i class="fa-solid fa-utensils"></i> VR/VA</span>
          <span class="pic-combined-val pic-vr-val" id="combinedVR">R$ 0,00</span>
          <span class="pic-combined-sub" id="combinedVRAnnual">Anual: R$ 0,00</span>
        </div>
      </div>
    </div>`;
  container.innerHTML = html;
}

export function renderCardDebtCards() {
  const container = document.getElementById('cardDebtCardsContainer');
  if (!container) return;
  const members = state.familyMembers || [];
  let html = '';
  members.forEach(m => {
    const slug = m.name.replace(/\s+/g, '_');
    html += `
      <div class="debt-overview-card debt-ov-cartao" data-filter="cartao-${slug}" role="button" tabindex="0">
        <div class="debt-ov-header">
          <div class="debt-ov-icon"><i class="fa-solid fa-credit-card"></i></div>
          <div>
            <p class="debt-ov-title">Cartão ${m.name}</p>
            <p class="debt-ov-subtitle" id="cardCount_${slug}">0 dívidas</p>
          </div>
        </div>
        <p class="debt-ov-amount" id="cardTotal_${slug}">R$ 0,00</p>
      </div>`;
  });
  container.innerHTML = html;
  // Re-aplicar listeners de filtro nos novos cards dinâmicos
  if (typeof window._setupDebtFilterListeners === 'function') window._setupDebtFilterListeners();
}

export async function createFamily(name) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const id = `family-${Date.now()}`;
  const family = { id, name, createdAt: new Date().toISOString() };
  await db.collection('families').doc(id).set(family);
  return family;
}

export async function loadFamiliesList() {
  if (!firebaseReady) return [];
  try {
    const snap = await db.collection('families').get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('Erro ao carregar famílias:', e);
    return [];
  }
}

export async function deleteFamily(familyId) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const usersSnap = await db.collection('users').where('familyId', '==', familyId).get();
  if (!usersSnap.empty) throw new Error('Não é possível excluir uma família que ainda possui usuários.');
  await db.collection('families').doc(familyId).delete();
}

export async function populateFamilySelects() {
  const families = await loadFamiliesList();
  const selects = [document.getElementById('newUserFamily'), document.getElementById('editUserFamily')];
  selects.forEach(sel => {
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Selecione uma família...</option>';
    families.forEach(f => { sel.innerHTML += `<option value="${esc(f.id)}">${esc(f.name)}</option>`; });
    if (currentVal) sel.value = currentVal;
  });
}

export async function loadFamiliesListUI() {
  const container = document.getElementById('familiesListContainer');
  if (!container) return;
  container.innerHTML = '<div class="users-list-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando famílias...</div>';
  try {
    const families = await loadFamiliesList();
    if (families.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma família cadastrada.</p>';
      return;
    }
    const usersSnap = await db.collection('users').get();
    const memberCount = {};
    usersSnap.forEach(doc => { const fid = doc.data().familyId; if (fid) memberCount[fid] = (memberCount[fid] || 0) + 1; });

    let html = '<div class="users-list">';
    families.forEach(f => {
      const count = memberCount[f.id] || 0;
      html += `
        <div class="user-card">
          <div class="user-card-info">
            <div class="user-card-name"><i class="fa-solid fa-people-roof" style="margin-right:6px;"></i>${esc(f.name)}</div>
            <div class="user-card-detail">${count} membro${count !== 1 ? 's' : ''}</div>
          </div>
          <div class="user-card-actions">
            <button class="user-action-btn delete-family-btn danger" data-id="${esc(f.id)}" data-name="${esc(f.name)}" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.delete-family-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fid = btn.dataset.id;
        const fname = btn.dataset.name;
        if (!confirm(`Excluir a família "${fname}"?`)) return;
        try {
          await deleteFamily(fid);
          showAlert(`Família "${fname}" excluída.`, 'success');
          loadFamiliesListUI();
        } catch (err) { showAlert(err.message, 'danger'); }
      });
    });
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Erro ao carregar famílias.</p>';
  }
}

// ===== UI DO USUÁRIO =====
export function applyUserToUI() {
  const user = state.currentUser;
  if (!user) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('headerUserName', user.fullName);
  set('settingsUserName', user.fullName);
  set('settingsUserEmail', user.email);

  // Exibir telefone no perfil
  const phoneEl = document.getElementById('settingsUserPhone');
  if (phoneEl) {
    const p = user.phone || '';
    if (p) {
      const norm = p.replace(/\D/g, '');
      phoneEl.textContent = norm.length === 11
        ? `(${norm.slice(0,2)}) ${norm[2]} ${norm.slice(3,7)}-${norm.slice(7)}`
        : norm.length === 10
          ? `(${norm.slice(0,2)}) ${norm.slice(2,6)}-${norm.slice(6)}`
          : p;
    } else {
      phoneEl.textContent = 'Nenhum telefone cadastrado';
    }
  }

  // Exibir recado no perfil
  const recadoEl = document.getElementById('settingsUserRecado');
  if (recadoEl) recadoEl.textContent = user.recado || 'Nenhum recado';

  // Chat: barra inferior e painel "Meu Perfil"
  const chatMyName   = document.getElementById('chatMyName');
  const chatMyRecado = document.getElementById('chatMyRecado');
  if (chatMyName)   chatMyName.textContent   = user.fullName || 'Meu Perfil';
  if (chatMyRecado) chatMyRecado.textContent = user.recado   || 'Sem recado';
  const myProfileName   = document.getElementById('myProfileName');
  const myProfileRecado = document.getElementById('myProfileRecado');
  const myProfilePhone  = document.getElementById('myProfilePhone');
  if (myProfileName)   myProfileName.textContent   = user.fullName || '—';
  if (myProfileRecado) myProfileRecado.textContent = user.recado   || 'Nenhum recado';
  if (myProfilePhone) {
    const p = user.phone || '';
    const n = p.replace(/\D/g, '');
    myProfilePhone.textContent = n.length === 11
      ? `(${n.slice(0,2)}) ${n[2]} ${n.slice(3,7)}-${n.slice(7)}`
      : n.length === 10
        ? `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
        : p || 'Não cadastrado';
  }

  const profileRole = document.getElementById('settingsUserRole');
  if (profileRole) {
    const roleText = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Usuário';
    profileRole.textContent = roleText;
    profileRole.className = (user.role === 'admin' || user.role === 'superadmin') ? 'status-pill connected' : 'status-pill';
  }
  const familyLabel = document.getElementById('settingsFamilyName');
  if (familyLabel) familyLabel.textContent = state.currentFamily ? state.currentFamily.name : 'Sem família';

  const avatarURL = user.photoURL || (user.fullName && user.fullName.toLowerCase().includes('bianca') ? 'img/bianca.jpeg' : null);
  applyAvatar(avatarURL);

  const adminSection = document.getElementById('adminSection');
  if (adminSection) adminSection.style.display = isAdmin() ? 'block' : 'none';
  const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
  if (manageFamiliesBtn) manageFamiliesBtn.style.display = isSuperAdmin() ? '' : 'none';
  const isLopes = getFamilyId() === 'family-lopes';
  const choresBtn = document.getElementById('choresNavBtn');
  const settingsNavBtn = document.getElementById('settingsNavBtn');
  if (choresBtn) choresBtn.style.display = isLopes ? '' : 'none';
  if (settingsNavBtn) settingsNavBtn.style.display = 'none';
}

export function applyAvatar(photoURL) {
  const headerImg      = document.getElementById('headerAvatar');
  const settingsImg    = document.getElementById('settingsAvatar');
  const chatMyImg      = document.getElementById('chatMyAvatar');
  const chatMyFallback = document.getElementById('chatMyAvatarFallback');
  const myProfImg      = document.getElementById('myProfileAvatar');
  const myProfFallback = document.getElementById('myProfileAvatarFallback');
  if (photoURL) {
    if (headerImg)   { headerImg.src   = photoURL; headerImg.style.display   = 'block'; }
    if (settingsImg) { settingsImg.src = photoURL; settingsImg.style.display = 'block'; }
    if (chatMyImg)   { chatMyImg.src   = photoURL; chatMyImg.style.display   = 'block'; if (chatMyFallback) chatMyFallback.style.display = 'none'; }
    if (myProfImg)   { myProfImg.src   = photoURL; myProfImg.style.display   = 'block'; if (myProfFallback) myProfFallback.style.display = 'none'; }
  } else {
    if (headerImg)   headerImg.style.display   = 'none';
    if (settingsImg) settingsImg.style.display = 'none';
    if (chatMyImg)   { chatMyImg.style.display = 'none'; if (chatMyFallback) chatMyFallback.style.display = 'flex'; }
    if (myProfImg)   { myProfImg.style.display = 'none'; if (myProfFallback) myProfFallback.style.display = 'flex'; }
  }
}

export function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatar(file) {
  const dataURL = await resizeImage(file, 256);
  let photoURL = dataURL;
  if (firebaseReady && fbStorage && state.currentUser) {
    try {
      const ref = fbStorage.ref(`avatars/${state.currentUser.id}.jpg`);
      const res = await fetch(dataURL);
      const blob = await res.blob();
      await ref.put(blob, { contentType: 'image/jpeg' });
      photoURL = await ref.getDownloadURL();
      await db.collection('users').doc(state.currentUser.id).update({ photoURL });
    } catch (error) {
      console.error('Erro no upload da foto:', error);
      await db.collection('users').doc(state.currentUser.id).update({ photoURL: dataURL });
    }
  }
  state.currentUser.photoURL = photoURL;
  localStorage.setItem('user', JSON.stringify(state.currentUser));
  applyAvatar(photoURL);
  showAlert('Foto atualizada com sucesso!', 'success');
}

// ===== CHECK LOGIN =====
export function checkLoginStatus() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user && user.login) {
        state.isLoggedIn = true;
        state.user = user.login;
        state.currentUser = user;
        document.getElementById('loginContainer').classList.remove('active');
        document.getElementById('appContainer').classList.add('active');
        applyUserToUI();

        const refreshUser = firebaseReady
          ? db.collection('users').doc(user.id).get().then(doc => {
              if (doc.exists) {
                const freshData = doc.data();
                state.currentUser = freshData;
                state.user = freshData.login;
                localStorage.setItem('user', JSON.stringify(freshData));
              } else {
                localStorage.removeItem('user');
                state.isLoggedIn = false;
                state.currentUser = null;
                document.getElementById('appContainer').classList.remove('active');
                document.getElementById('loginContainer').classList.add('active');
              }
            }).catch(err => console.warn('Erro ao revalidar usuário:', err))
          : Promise.resolve();

        refreshUser.then(() => loadFamily()).then(() => {
          loadDataFromStorage();
          applyUserToUI();
        });
        return;
      }
    } catch (e) { /* formato corrompido */ }
    localStorage.removeItem('user');
  }
}

// ===== LOGOUT =====
export function logout() {
  if (confirm('Tem certeza que deseja sair?')) {
    cleanupFirebaseListeners();
    state.isLoggedIn = false;
    state.user = null;
    state.currentUser = null;
    state.currentFamily = null;
    state.transactions = [];
    state.debts = [];
    state.salaries = [];
    localStorage.removeItem('user');
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('loginContainer').classList.add('active');
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').classList.remove('show');
  }
}

// ===== ADMIN: CRUD USUÁRIOS =====
export async function loadUsersList() {
  if (!firebaseReady) { showAlert('Firebase não disponível.', 'danger'); return; }
  if (!isAdmin()) return;
  const container = document.getElementById('usersListContainer');
  container.innerHTML = '<div class="users-list-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando usuários...</div>';
  try {
    const familyId = getFamilyId();
    let snapshot;
    if (isSuperAdmin()) {
      snapshot = await db.collection('users').get();
    } else if (familyId) {
      snapshot = await db.collection('users').where('familyId', '==', familyId).get();
    } else {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma família associada.</p>';
      return;
    }
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum usuário encontrado.</p>';
      return;
    }
    const familiesMap = {};
    if (isSuperAdmin()) {
      const famSnap = await db.collection('families').get();
      famSnap.forEach(d => { familiesMap[d.data().id] = d.data().name; });
    }
    let html = '<div class="users-list">';
    snapshot.forEach(doc => {
      const u = doc.data();
      const isCurrentUser = u.id === state.currentUser.id;
      const roleLabel = u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Usuário';
      const roleClass = (u.role === 'admin' || u.role === 'superadmin') ? 'connected' : '';
      const familyName = isSuperAdmin() && u.familyId && familiesMap[u.familyId] ? ` · ${esc(familiesMap[u.familyId])}` : '';
      html += `
        <div class="user-card" data-user-id="${esc(u.id)}">
          <div class="user-card-info">
            <div class="user-card-name">${esc(u.fullName)}</div>
            <div class="user-card-detail">${esc(u.login)} · ${esc(u.email)}${familyName}</div>
            <span class="status-pill ${roleClass}">${esc(roleLabel)}</span>
          </div>
          <div class="user-card-actions">
            <button class="user-action-btn edit-user-btn" data-id="${esc(u.id)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            ${isCurrentUser ? '' : `<button class="user-action-btn delete-user-btn danger" data-id="${esc(u.id)}" data-name="${esc(u.fullName)}" title="Excluir"><i class="fa-solid fa-trash"></i></button>`}
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', () => openEditUser(btn.dataset.id)));
    container.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id, btn.dataset.name)));
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Erro ao carregar usuários.</p>';
  }
}

export async function openEditUser(userId) {
  if (!firebaseReady) return;
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) { showAlert('Usuário não encontrado.', 'danger'); return; }
    const u = doc.data();
    if (!isSuperAdmin() && u.role === 'superadmin') { showAlert('Você não tem permissão.', 'danger'); return; }
    if (!isSuperAdmin() && u.familyId !== getFamilyId()) { showAlert('Você não tem permissão.', 'danger'); return; }

    document.getElementById('editUserId').value = u.id;
    document.getElementById('editUserFullName').value = u.fullName || '';
    document.getElementById('editUserEmail').value = u.email || '';
    document.getElementById('editUserLogin').value = u.login || '';
    document.getElementById('editUserRole').value = u.role || 'user';
    document.getElementById('editUserNewPassword').value = '';

    // Preencher telefone (formatar se existir)
    const phoneInput = document.getElementById('editUserPhone');
    if (phoneInput) {
      const p = u.phone || '';
      if (p) {
        const n = p.replace(/\D/g, '');
        phoneInput.value = n.length === 11
          ? `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
          : n.length === 10
            ? `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
            : p;
      } else {
        phoneInput.value = '';
      }
    }

    const roleGroup = document.getElementById('editUserRoleGroup');
    const familyGroup = document.getElementById('editUserFamilyGroup');
    const superadminOpt = document.getElementById('editUserRole')?.querySelector('option[value="superadmin"]');

    if (isSuperAdmin()) {
      if (roleGroup) roleGroup.style.display = '';
      if (familyGroup) familyGroup.style.display = '';
      if (superadminOpt) superadminOpt.style.display = '';
      await populateFamilySelects();
      const editFamilySel = document.getElementById('editUserFamily');
      if (editFamilySel) editFamilySel.value = u.familyId || '';
    } else {
      if (roleGroup) roleGroup.style.display = '';
      if (superadminOpt) superadminOpt.style.display = 'none';
      if (familyGroup) familyGroup.style.display = 'none';
    }
    document.getElementById('editUserModal').classList.add('active');
  } catch (err) {
    showAlert('Erro ao carregar dados do usuário.', 'danger');
  }
}

export async function saveUserEdit(e) {
  e.preventDefault();
  if (!isAdmin()) return;
  const userId = document.getElementById('editUserId').value;
  const fullName = document.getElementById('editUserFullName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const login = document.getElementById('editUserLogin').value.trim().toLowerCase();
  const newPassword = document.getElementById('editUserNewPassword').value;

  if (!fullName || !email || !login) { showAlert('Preencha todos os campos obrigatórios.', 'danger'); return; }
  if (newPassword && newPassword.length < 6) { showAlert('A senha deve ter pelo menos 6 caracteres.', 'danger'); return; }

  const btn = document.querySelector('#editUserForm button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try {
    if (!isSuperAdmin()) {
      const targetDoc = await db.collection('users').doc(userId).get();
      if (targetDoc.exists) {
        const td = targetDoc.data();
        if (td.familyId !== getFamilyId() || td.role === 'superadmin') {
          showAlert('Sem permissão.', 'danger'); return;
        }
      }
    }
    const loginCheck = await db.collection('users').where('login', '==', login).get();
    if (loginCheck.docs.find(d => d.data().id !== userId)) { showAlert('Login já em uso.', 'danger'); return; }
    const emailCheck = await db.collection('users').where('email', '==', email).get();
    if (emailCheck.docs.find(d => d.data().id !== userId)) { showAlert('E-mail já cadastrado.', 'danger'); return; }

    // Telefone: normaliza e verifica unicidade
    const rawPhone = (document.getElementById('editUserPhone')?.value || '').trim();
    const normalizedPhone = rawPhone.replace(/\D/g, '');
    if (normalizedPhone) {
      if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
        showAlert('Telefone inválido. Use o formato (DDD) + número com 8 ou 9 dígitos.', 'danger');
        return;
      }
      const phoneCheck = await db.collection('users').where('phone', '==', normalizedPhone).limit(1).get();
      if (!phoneCheck.empty && phoneCheck.docs[0].id !== userId) {
        showAlert('Este número de telefone já está cadastrado para outro usuário.', 'danger');
        return;
      }
    }

    const updates = { fullName, email, login };
    updates.phone = normalizedPhone || '';

    if (isSuperAdmin()) {
      updates.role = document.getElementById('editUserRole').value;
      const familyId = document.getElementById('editUserFamily')?.value;
      if (!familyId) { showAlert('Selecione uma família.', 'danger'); return; }
      updates.familyId = familyId;
    } else {
      const selectedRole = document.getElementById('editUserRole').value;
      if (selectedRole === 'admin' || selectedRole === 'user') updates.role = selectedRole;
    }
    if (newPassword) updates.passwordHash = await hashPassword(newPassword);

    await db.collection('users').doc(userId).update(updates);
    showAlert('Usuário atualizado!', 'success');
    document.getElementById('editUserModal').classList.remove('active');
    if (state.currentUser.id === userId) {
      Object.assign(state.currentUser, updates);
      localStorage.setItem('user', JSON.stringify(state.currentUser));
      await loadFamily();
      applyUserToUI();
      loadDataFromStorage();
    }
    loadUsersList();
  } catch (err) {
    showAlert(err.message || 'Erro ao atualizar.', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar Alterações';
  }
}

export async function confirmDeleteUser(userId, userName) {
  if (!isAdmin()) return;
  if (userId === state.currentUser.id) { showAlert('Você não pode excluir sua própria conta.', 'danger'); return; }
  if (!isSuperAdmin()) {
    try {
      const targetDoc = await db.collection('users').doc(userId).get();
      if (targetDoc.exists) {
        const td = targetDoc.data();
        if (td.role === 'superadmin' || td.familyId !== getFamilyId()) { showAlert('Sem permissão.', 'danger'); return; }
      }
    } catch (e) { /* continua */ }
  }
  if (!confirm(`Excluir o usuário "${userName}"?\nEssa ação não pode ser desfeita.`)) return;
  try {
    await db.collection('users').doc(userId).delete();
    showAlert(`Usuário "${userName}" excluído.`, 'success');
    loadUsersList();
  } catch (err) { showAlert('Erro ao excluir usuário.', 'danger'); }
}

// ===== RECUPERAÇÃO DE SENHA =====
let _resetState = { email: '', userId: '', code: '', expiresAt: null };

export function initResetPasswordUI() {
  const modal = document.getElementById('resetPasswordModal');
  const openBtn = document.getElementById('forgotPasswordBtn');
  const closeBtn = document.getElementById('resetModalClose');
  if (!modal || !openBtn) return;

  openBtn.addEventListener('click', () => {
    _resetState = { email: '', userId: '', code: '', expiresAt: null };
    showResetStep(1);
    modal.classList.add('active');
    document.getElementById('resetEmail').value = '';
    document.getElementById('resetStep1Error').textContent = '';
  });
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

  document.getElementById('sendResetCode').addEventListener('click', handleSendResetCode);
  document.getElementById('verifyResetCode').addEventListener('click', handleVerifyResetCode);
  document.getElementById('resendResetCode').addEventListener('click', handleSendResetCode);
  document.getElementById('saveNewPassword').addEventListener('click', handleSaveNewPassword);

  document.querySelectorAll('.reset-code-digit').forEach(input => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val && e.target.dataset.index < 5) {
        const next = document.querySelector(`.reset-code-digit[data-index="${parseInt(e.target.dataset.index) + 1}"]`);
        if (next) next.focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && e.target.dataset.index > 0) {
        const prev = document.querySelector(`.reset-code-digit[data-index="${parseInt(e.target.dataset.index) - 1}"]`);
        if (prev) { prev.value = ''; prev.focus(); }
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      document.querySelectorAll('.reset-code-digit').forEach((inp, i) => { inp.value = paste[i] || ''; });
    });
  });
}

function showResetStep(step) {
  document.querySelectorAll('.reset-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.getElementById(`resetStep${step}`);
  if (stepEl) stepEl.classList.add('active');
  const titles = { 1: 'Recuperar Senha', 2: 'Verificar Código', 3: 'Nova Senha' };
  const icons = { 1: 'fa-envelope-open-text', 2: 'fa-shield-halved', 3: 'fa-lock-open' };
  const titleEl = document.querySelector('.reset-modal-title');
  const iconEl = document.querySelector('.reset-modal-icon i');
  if (titleEl) titleEl.textContent = titles[step];
  if (iconEl) iconEl.className = `fa-solid ${icons[step]}`;
}

async function handleSendResetCode() {
  const emailInput = document.getElementById('resetEmail');
  const errorDiv = document.getElementById('resetStep1Error');
  const btn = document.getElementById('sendResetCode');
  const email = emailInput.value.trim().toLowerCase();
  errorDiv.textContent = '';
  if (!email) { errorDiv.textContent = 'Informe seu e-mail.'; return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
  try {
    if (!firebaseReady) throw new Error('Firebase não disponível.');
    const snap = await db.collection('users').where('email', '==', email).get();
    if (snap.empty) { errorDiv.textContent = 'Nenhuma conta com este e-mail.'; return; }
    const userData = snap.docs[0].data();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.collection('passwordResets').doc(userData.id).set({
      userId: userData.id, code, email, expiresAt: expiresAt.toISOString(), used: false, createdAt: new Date().toISOString()
    });
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      to_email: email, to_name: userData.fullName || userData.login, reset_code: code, app_name: 'Lopes - Gestão Financeira'
    }, EMAILJS_CONFIG.publicKey);
    _resetState.email = email;
    _resetState.userId = userData.id;
    document.getElementById('resetEmailDisplay').textContent = email;
    document.querySelectorAll('.reset-code-digit').forEach(i => i.value = '');
    document.getElementById('resetStep2Error').textContent = '';
    showResetStep(2);
    document.querySelector('.reset-code-digit[data-index="0"]').focus();
  } catch (err) {
    errorDiv.textContent = err.message || 'Erro ao enviar código.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Enviar código</span><i class="fa-solid fa-paper-plane"></i>';
  }
}

async function handleVerifyResetCode() {
  const errorDiv = document.getElementById('resetStep2Error');
  const btn = document.getElementById('verifyResetCode');
  errorDiv.textContent = '';
  const code = Array.from(document.querySelectorAll('.reset-code-digit')).map(i => i.value).join('');
  if (code.length !== 6) { errorDiv.textContent = 'Digite o código completo.'; return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
  try {
    const doc = await db.collection('passwordResets').doc(_resetState.userId).get();
    if (!doc.exists) { errorDiv.textContent = 'Código não encontrado.'; return; }
    const data = doc.data();
    if (data.used) { errorDiv.textContent = 'Código já utilizado.'; return; }
    if (new Date(data.expiresAt) < new Date()) { errorDiv.textContent = 'Código expirado.'; return; }
    if (data.code !== code) { errorDiv.textContent = 'Código incorreto.'; return; }
    _resetState.code = code;
    showResetStep(3);
    document.getElementById('resetNewPassword').focus();
  } catch (err) {
    errorDiv.textContent = 'Erro ao verificar.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Verificar código</span><i class="fa-solid fa-shield-check"></i>';
  }
}

async function handleSaveNewPassword() {
  const errorDiv = document.getElementById('resetStep3Error');
  const btn = document.getElementById('saveNewPassword');
  const newPass = document.getElementById('resetNewPassword').value;
  const confirmPass = document.getElementById('resetConfirmPassword').value;
  errorDiv.textContent = '';
  if (!newPass || newPass.length < 4) { errorDiv.textContent = 'Mínimo 4 caracteres.'; return; }
  if (newPass !== confirmPass) { errorDiv.textContent = 'As senhas não coincidem.'; return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  try {
    const newHash = await hashPassword(newPass);
    await db.collection('users').doc(_resetState.userId).update({ passwordHash: newHash });
    await db.collection('passwordResets').doc(_resetState.userId).update({ used: true });
    document.getElementById('resetPasswordModal').classList.remove('active');
    _resetState = { email: '', userId: '', code: '', expiresAt: null };
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = 'Senha alterada com sucesso! Faça login.';
    errorEl.classList.add('show');
    errorEl.style.color = '#06D6A0';
    setTimeout(() => { errorEl.classList.remove('show'); errorEl.style.color = ''; }, 5000);
  } catch (err) {
    errorDiv.textContent = 'Erro ao salvar.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Salvar nova senha</span><i class="fa-solid fa-check"></i>';
  }
}
