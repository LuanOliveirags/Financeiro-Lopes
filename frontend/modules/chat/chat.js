// ============================================================
// CHAT.JS â€” Chat profissional com DMs entre usuÃ¡rios Lopes
// Arquitetura: conversations (Firestore) + messages subcollection
// Busca de contato por nÃºmero de telefone (DDD + 9 + nÃºmero)
// ============================================================

import { state } from '../../app/state/store.js';
import { db, firebaseReady, storage } from '../../app/providers/firebase-provider.js';
import { generateId, esc } from '../../shared/utils/helpers.js';
import { initFCM, sendFCMPush } from './fcm.js';
import { savePhoneNumber } from '../../app/providers/auth-provider.js';

// ===== ESTADO INTERNO =====
let _convListListener = null;   // listener da lista de conversas
let _msgListener      = null;   // listener das mensagens da conversa atual
let _currentConvId    = null;   // id da conversa aberta
let _currentOtherUser = null;   // { id, name, photoURL }
let _chatOpen         = false;
let _unreadByConv     = {};     // { convId: true }
let _formBound        = false;
let _btnBound         = false;
let _lastTimestamp    = null;
let _otherSeenAt      = '';     // seenAt do outro (atualizado via listener em tempo real)
let _editingMsgId     = null;   // id da mensagem sendo editada
let _convDocListener  = null;   // listener do doc da conversa atual (para seenAt)
let _activeReactionBar = null;  // elemento da barra de reações ativa

// ================================================================
// PÚBLICO
// ================================================================

/** Abre o painel de chat na lista de conversas. */
export function openChat() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  _bindButtons();
  panel.classList.add('active');
  document.body.style.overflow = 'hidden';
  _chatOpen = true;

  // Verifica se o usuário tem telefone cadastrado
  if (!state.currentUser?.phone) {
    _showView('chatViewPhoneGate');
    const inp = document.getElementById('phoneGateInput');
    if (inp) { inp.value = ''; inp.focus(); }
    const err = document.getElementById('phoneGateError');
    if (err) err.style.display = 'none';
    return;
  }

  if (!_convListListener) _initConvList();
  initFCM().catch(() => {});
  _showView('chatViewList');
}

/** Fecha o painel de chat. */
export function closeChat() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  panel.classList.remove('active');
  document.body.style.overflow = '';
  _chatOpen = false;
  _stopMsgListener();
}

/** Inicializa listeners (chamado após login bem-sucedido). */
export function initChat() {
  if (!firebaseReady || !state.currentUser) return;
  _bindButtons();
  _initConvList();
}

/** Limpa tudo ao fazer logout. */
export function cleanupChat() {
  _stopConvList();
  _stopMsgListener();
  closeChat();
  _chatOpen         = false;
  _unreadByConv     = {};
  _formBound        = false;
  _btnBound         = false;
  _currentConvId    = null;
  _currentOtherUser = null;
  _lastTimestamp    = null;
  _otherSeenAt      = '';
  _editingMsgId     = null;
  _stopConvDocListener();
  const listEl = document.getElementById('chatMessagesList');
  if (listEl) listEl.innerHTML = '';
  _updateBadge(0);
}

// ================================================================
// LISTA DE CONVERSAS
// ================================================================

function _initConvList() {
  if (!firebaseReady || !state.currentUser) return;
  _stopConvList();

  _convListListener = db.collection('conversations')
    .where('participantIds', 'array-contains', state.currentUser.id)
    .onSnapshot(snapshot => {
      const me      = state.currentUser;
      const allData = snapshot.docs.map(d => d.data());

      // Separa ativas e arquivadas
      const active = allData
        .filter(conv => !(conv.archived || {})[me.id])
        .sort((a, b) => {
          const ta = a.updatedAt || a.createdAt || '';
          const tb = b.updatedAt || b.createdAt || '';
          return tb > ta ? 1 : tb < ta ? -1 : 0;
        });

      const archivedCount = allData.filter(conv => !!(conv.archived || {})[me.id]).length;
      _renderConvList(active);
      _updateArchivedBadge(archivedCount);

      // Recalcula badge de nao lidos (apenas ativas)
      active.forEach(conv => {
        const last = conv.lastMessage;
        if (!last || last.senderId === me.id) {
          delete _unreadByConv[conv.id];
          return;
        }
        const seenAt = (conv.seenAt || {})[me.id] || '';
        if (last.timestamp > seenAt) {
          _unreadByConv[conv.id] = true;
        } else {
          delete _unreadByConv[conv.id];
        }
      });
      _updateBadge(Object.keys(_unreadByConv).length);

    }, err => console.error('[Chat] Conv list error:', err));
}

function _stopConvList() {
  if (_convListListener) { _convListListener(); _convListListener = null; }
}

function _renderConvList(convs) {
  const listEl  = document.getElementById('convListEl');
  const emptyEl = document.getElementById('convListEmpty');
  if (!listEl) return;

  listEl.querySelectorAll('.conv-item').forEach(el => el.remove());

  if (convs.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const me = state.currentUser;
  convs.forEach(conv => {
    const otherId  = conv.participantIds.find(id => id !== me.id) || '';
    const info     = (conv.participants || {})[otherId] || {};
    const name     = info.name || 'Usuario';
    const photo    = _resolvePhoto(info.photoURL, name);
    const last     = conv.lastMessage;
    const lastText = last ? _truncate(last.text, 46) : '';
    const lastTime = last ? _shortTime(last.timestamp) : '';
    const initial  = name.charAt(0).toUpperCase();
    const seenAt   = (conv.seenAt || {})[me.id] || '';
    const isUnread = last && last.senderId !== me.id && last.timestamp > seenAt;

    const avatarHtml = photo
      ? `<img src="${photo}" alt="${esc(name)}" class="conv-avatar-img"
              onerror="this.outerHTML='<div class=\\'conv-avatar-initial\\'>${esc(initial)}</div>'">`
      : `<div class="conv-avatar-initial">${esc(initial)}</div>`;

    const item = document.createElement('div');
    item.className = `conv-item${isUnread ? ' conv-unread' : ''}`;
    item.dataset.convId     = conv.id;
    item.dataset.otherId    = otherId;
    item.dataset.otherName  = name;
    item.dataset.otherPhoto = photo;

    item.innerHTML = `
      <div class="conv-avatar-wrap">${avatarHtml}</div>
      <div class="conv-info">
        <div class="conv-top-row">
          <span class="conv-name">${esc(name)}</span>
          <span class="conv-time">${esc(lastTime)}</span>
        </div>
        <div class="conv-preview${isUnread ? ' conv-preview-unread' : ''}">
          ${lastText ? esc(lastText) : '<em>Iniciar conversa</em>'}
        </div>
      </div>
      ${isUnread ? '<div class="conv-dot"></div>' : ''}
    `;

    item.addEventListener('click', () => _openConversation(
      item.dataset.convId,
      { id: item.dataset.otherId, name: item.dataset.otherName, photoURL: item.dataset.otherPhoto }
    ));
    listEl.appendChild(item);
  });
}

// ================================================================
// BUSCA POR TELEFONE — NOVA CONVERSA
// ================================================================

function _showSearch() {
  _showView('chatViewSearch');
  const inp = document.getElementById('searchPhoneInput');
  if (inp) { inp.value = ''; inp.focus(); }
  const res = document.getElementById('searchPhoneResult');
  if (res) { res.style.display = 'none'; res.innerHTML = ''; }
}

async function _doSearch() {
  if (!firebaseReady) return;
  const input      = document.getElementById('searchPhoneInput');
  const resultArea = document.getElementById('searchPhoneResult');
  if (!input || !resultArea) return;

  const raw        = input.value.trim();
  const normalized = raw.replace(/\D/g, '');

  resultArea.style.display = 'block';

  if (normalized.length < 10) {
    resultArea.innerHTML = `<div class="srm srm-warn">
      <i class="fa-solid fa-triangle-exclamation"></i>
      Digite um numero valido com DDD (minimo 10 digitos).
    </div>`;
    return;
  }

  resultArea.innerHTML = `<div class="srm"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>`;

  try {
    const snap = await db.collection('users').where('phone', '==', normalized).limit(1).get();

    if (snap.empty) {
      resultArea.innerHTML = `<div class="srm srm-warn">
        <i class="fa-solid fa-user-xmark"></i>
        Nenhum usuario cadastrado com esse numero no WolfSource.
      </div>`;
      return;
    }

    const found = snap.docs[0].data();

    if (found.id === state.currentUser.id) {
      resultArea.innerHTML = `<div class="srm srm-warn">
        <i class="fa-solid fa-circle-info"></i>
        Este e o seu proprio numero de telefone.
      </div>`;
      return;
    }

    const initial    = (found.fullName || '?').charAt(0).toUpperCase();
    const photo      = _resolvePhoto(found.photoURL, found.fullName || found.login);
    const avatarHtml = photo
      ? `<img src="${photo}" alt="${esc(found.fullName)}" class="conv-avatar-img"
              onerror="this.outerHTML='<div class=\\'conv-avatar-initial\\'>${esc(initial)}</div>'">`
      : `<div class="conv-avatar-initial">${esc(initial)}</div>`;

    resultArea.innerHTML = `
      <div class="search-result-card">
        <div class="conv-avatar-wrap">${avatarHtml}</div>
        <div class="search-result-info">
          <span class="search-result-name">${esc(found.fullName)}</span>
          <span class="search-result-phone">${_formatPhone(normalized)}</span>
        </div>
        <button class="btn-start-chat" id="btnStartChat">
          <i class="fa-solid fa-message"></i> Conversar
        </button>
      </div>`;

    document.getElementById('btnStartChat')?.addEventListener('click', async () => {
      const convId = await _getOrCreate(found);
      _openConversation(convId, {
        id:       found.id,
        name:     found.fullName,
        login:    found.login || '',
        photoURL: photo
      });
    });

  } catch (err) {
    console.error('[Chat] Erro ao buscar:', err);
    resultArea.innerHTML = `<div class="srm srm-warn">
      <i class="fa-solid fa-circle-xmark"></i>
      Erro ao buscar. Verifique sua conexao.
    </div>`;
  }
}

async function _getOrCreate(otherUser) {
  const me     = state.currentUser;
  const ids    = [me.id, otherUser.id].sort();
  const convId = ids.join('__');
  const ref    = db.collection('conversations').doc(convId);
  const snap   = await ref.get();

  if (!snap.exists) {
    await ref.set({
      id:             convId,
      participantIds: ids,
      participants: {
        [me.id]: { name: me.fullName || me.login, photoURL: _resolvePhoto(me.photoURL, me.fullName || me.login) },
        [otherUser.id]: { name: otherUser.fullName || otherUser.name || '', photoURL: _resolvePhoto(otherUser.photoURL, otherUser.name || otherUser.fullName || otherUser.login) }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seenAt:    {}
    });
  }
  return convId;
}

// ================================================================
// CONVERSA INDIVIDUAL
// ================================================================

function _openConversation(convId, otherUser) {
  _currentConvId    = convId;
  _currentOtherUser = otherUser;

  const titleEl = document.querySelector('#chatViewMessages .chat-title');
  if (titleEl) titleEl.textContent = otherUser.name || 'Chat';

  const subEl = document.getElementById('chatHdrSubtitle');
  if (subEl) subEl.textContent = 'toque aqui para ver o perfil';

  const avatarEl = document.getElementById('chatHdrAvatar');
  if (avatarEl) {
    const hdrPhoto = _resolvePhoto(otherUser.photoURL, otherUser.name || otherUser.login);
    if (hdrPhoto) {
      avatarEl.src = hdrPhoto;
      avatarEl.style.display = '';
    } else {
      avatarEl.style.display = 'none';
    }
  }

  // Listener em tempo real do doc da conversa para saber quando o outro usuário visualizou
  _stopConvDocListener();
  const _listenOtherId = otherUser.id;
  _convDocListener = db.collection('conversations').doc(convId).onSnapshot(snap => {
    if (snap.exists) _otherSeenAt = (snap.data().seenAt || {})[_listenOtherId] || '';
  }, () => {});

  // Destacar conversa ativa na lista (desktop)
  document.querySelectorAll('.conv-item').forEach(el =>
    el.classList.toggle('conv-active', el.dataset.convId === convId)
  );

  _showView('chatViewMessages');
  _bindForm();
  _initEmojiPicker();
  _startMsgListener(convId);
  _markSeen(convId);

  setTimeout(() => {
    _scrollToBottom(false);
    document.getElementById('chatInput')?.focus();
  }, 80);
}

function _startMsgListener(convId) {
  _stopMsgListener();
  const listEl = document.getElementById('chatMessagesList');
  if (listEl) listEl.innerHTML = '';
  _showEmptyState(true);
  _lastTimestamp = null;

  _msgListener = db.collection('conversations').doc(convId)
    .collection('messages')
    .onSnapshot(snapshot => {
      const msgs = snapshot.docs
        .map(d => d.data())
        .sort((a, b) => a.timestamp > b.timestamp ? 1 : a.timestamp < b.timestamp ? -1 : 0);

      _renderMessages(msgs);

      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const msg = change.doc.data();
        if (msg.senderId === state.currentUser.id) return;
        if (_lastTimestamp && msg.timestamp <= _lastTimestamp) return;

        if (_chatOpen) {
          _markSeen(convId);
        } else {
          _unreadByConv[convId] = true;
          _updateBadge(Object.keys(_unreadByConv).length);
          _notifyNewMessage(msg);
        }
      });

      if (msgs.length > 0) {
        _lastTimestamp = msgs[msgs.length - 1].timestamp;
      }
    }, err => console.error('[Chat] Msg listener error:', err));
}

function _stopMsgListener() {
  if (_msgListener) { _msgListener(); _msgListener = null; }
  _stopConvDocListener();
  _otherSeenAt = '';
}

async function _markSeen(convId) {
  if (!firebaseReady || !state.currentUser) return;
  delete _unreadByConv[convId];
  _updateBadge(Object.keys(_unreadByConv).length);
  try {
    await db.collection('conversations').doc(convId).update({
      [`seenAt.${state.currentUser.id}`]: new Date().toISOString()
    });
  } catch (e) { /* ignore */ }
}

/** Envia uma mensagem na conversa atual. */
export async function sendMessage(text) {
  if (!firebaseReady || !state.currentUser || !_currentConvId) return;
  const sanitized = (text || '').trim().substring(0, 1000);
  if (!sanitized) return;

  const now = new Date().toISOString();
  const msg = {
    id:          generateId(),
    senderId:    state.currentUser.id,
    senderName:  state.currentUser.fullName || state.currentUser.login,
    senderPhoto: _resolvePhoto(state.currentUser.photoURL, state.currentUser.fullName || state.currentUser.login),
    text:        sanitized,
    timestamp:   now
  };

  try {
    const convRef = db.collection('conversations').doc(_currentConvId);
    await convRef.collection('messages').doc(msg.id).set(msg);
    await convRef.update({
      lastMessage: { text: sanitized, timestamp: now, senderId: msg.senderId },
      updatedAt:   now
    });

    // FCM push para o destinatario
    if (_currentOtherUser) {
      try {
        const doc = await db.collection('users').doc(_currentOtherUser.id).get();
        const token = doc.exists ? doc.data().fcmToken : null;
        if (token) sendFCMPush(token, msg.senderName, msg.text);
      } catch (e) { /* ignore FCM errors */ }
    }

  } catch (err) {
    console.error('[Chat] Erro ao enviar:', err);
    const inp = document.getElementById('chatInput');
    if (inp && !inp.value) inp.value = text;
    import('./utils.js').then(({ showAlert }) =>
      showAlert('Nao foi possivel enviar a mensagem.', 'error')
    );
  }
}

// ================================================================
// BINDINGS DE UI
// ================================================================

function _bindButtons() {
  if (_btnBound) return;

  document.getElementById('chatCloseBtn')
    ?.addEventListener('click', closeChat);

  document.getElementById('newChatBtn')
    ?.addEventListener('click', _showSearch);

  document.getElementById('searchBackBtn')
    ?.addEventListener('click', () => _showView('chatViewList'));

  document.getElementById('chatMsgBackBtn')
    ?.addEventListener('click', () => {
      _stopMsgListener();
      _currentConvId    = null;
      _currentOtherUser = null;
      _lastTimestamp    = null;
      document.querySelectorAll('.conv-item.conv-active').forEach(el => el.classList.remove('conv-active'));
      _showView('chatViewList');
    });

  document.getElementById('searchPhoneBtn')
    ?.addEventListener('click', _doSearch);

  document.getElementById('searchPhoneInput')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _doSearch(); } });

  document.getElementById('searchPhoneInput')
    ?.addEventListener('input', _maskPhone);

  // Opções da conversa
  document.getElementById('chatOptionsBtn')
    ?.addEventListener('click', _openOptions);
  document.getElementById('chatOptClear')
    ?.addEventListener('click', _clearConversation);
  document.getElementById('chatOptArchive')
    ?.addEventListener('click', _archiveConversation);
  document.getElementById('chatOptDelete')
    ?.addEventListener('click', _deleteConversation);
  document.getElementById('chatOptCancel')
    ?.addEventListener('click', _closeOptions);
  document.getElementById('chatOptionsSheet')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) _closeOptions(); });

  // Imagem
  document.getElementById('chatImageBtn')
    ?.addEventListener('click', () => document.getElementById('chatImageInput')?.click());
  document.getElementById('chatImageInput')
    ?.addEventListener('change', _handleImageUpload);

  // Perfil do contato
  document.getElementById('chatHeaderInfo')
    ?.addEventListener('click', _openProfile);
  document.getElementById('profileCloseBtn')
    ?.addEventListener('click', _closeProfile);
  document.getElementById('chatProfilePanel')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) _closeProfile(); });
  document.getElementById('profileBtnClear')
    ?.addEventListener('click', () => { _closeProfile(); _clearConversation(); });
  document.getElementById('profileBtnArchive')
    ?.addEventListener('click', () => { _closeProfile(); _archiveConversation(); });
  document.getElementById('profileBtnBlock')
    ?.addEventListener('click', () => {
      import('./utils.js').then(({ showAlert }) =>
        showAlert('Funcionalidade em breve.', 'info')
      );
    });

  // Meu perfil (barra inferior da lista)
  document.getElementById('chatMyProfileBtn')
    ?.addEventListener('click', _openMyProfile);
  document.getElementById('myProfileCloseBtn')
    ?.addEventListener('click', _closeMyProfile);
  document.getElementById('chatMyProfilePanel')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) _closeMyProfile(); });
  document.getElementById('myProfileAvatarUploadBtn')
    ?.addEventListener('click', () => document.getElementById('avatarFileInput')?.click());
  document.getElementById('myProfileEditPhoneBtn')
    ?.addEventListener('click', () => document.getElementById('editPhoneBtn')?.click());
  document.getElementById('myProfileEditRecadoBtn')
    ?.addEventListener('click', () => document.getElementById('editRecadoBtn')?.click());

  // Arquivadas
  document.getElementById('convArchivedBtn')
    ?.addEventListener('click', _loadArchivedView);
  document.getElementById('archivedBackBtn')
    ?.addEventListener('click', () => _showView('chatViewList'));

  // Editar mensagem
  document.getElementById('chatEditSaveBtn')
    ?.addEventListener('click', _commitEdit);
  document.getElementById('chatEditCancelBtn')
    ?.addEventListener('click', _closeEditModal);
  document.getElementById('chatEditCloseBtn')
    ?.addEventListener('click', _closeEditModal);
  document.getElementById('chatEditMsgModal')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) _closeEditModal(); });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _chatOpen) closeChat(); });

  // Gate de telefone
  document.getElementById('phoneGateCloseBtn')
    ?.addEventListener('click', closeChat);

  document.getElementById('phoneGateInput')
    ?.addEventListener('input', _maskPhone.bind(null, { target: document.getElementById('phoneGateInput') }));
  document.getElementById('phoneGateInput')
    ?.addEventListener('input', e => _maskPhone(e));

  document.getElementById('phoneGateForm')
    ?.addEventListener('submit', async e => {
      e.preventDefault();
      const inp    = document.getElementById('phoneGateInput');
      const errEl  = document.getElementById('phoneGateError');
      const btn    = document.getElementById('phoneGateSubmit');
      const raw    = inp?.value || '';
      if (errEl) errEl.style.display = 'none';
      if (btn)   { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }
      try {
        await savePhoneNumber(raw);
        // Atualiza exibição do telefone no perfil (settings)
        const phoneEl = document.getElementById('settingsUserPhone');
        if (phoneEl) phoneEl.textContent = inp.value;
        // Entra no chat normalmente
        if (!_convListListener) _initConvList();
        initFCM().catch(() => {});
        _showView('chatViewList');
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar e entrar no Chat'; }
      }
    });

  _btnBound = true;
}

function _maskPhone(e) {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (!v) { e.target.value = ''; return; }
  let r = '(' + v.slice(0, 2);
  if (v.length > 2) r += ') ' + v.slice(2, 7);
  if (v.length > 7) r += '-' + v.slice(7, 11);
  e.target.value = r;
}

function _bindForm() {
  if (_formBound) return;
  const form = document.getElementById('chatForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text  = input?.value?.trim();
    if (!text) return;
    input.value = '';
    sendMessage(text);
    // Close emoji picker on send
    const picker = document.getElementById('emojiPicker');
    if (picker) picker.style.display = 'none';
    document.getElementById('emojiToggleBtn')?.classList.remove('active');
  });
  document.getElementById('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chatForm')?.dispatchEvent(new Event('submit'));
    }
  });
  _formBound = true;
}

// ================================================================
// EMOJI PICKER
// ================================================================
const EMOJI_DATA = {
  smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  gestos: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋'],
  coracoes: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','😍','🥰','😘','💑','💏','💌','🌹','🥀','💐'],
  animais: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🐢','🐍','🦎','🦂','🦀','🦞','🦐','🦑','🐙','🐠','🐟','🐡','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'],
  comida: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🥐','🍞','🥖','🥨','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🫗','🍴','🥄','🔪','🫙'],
  objetos: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🧸','🪄','🎈','🎉','🎊','🎁','🎀','🪅','🪩','🎗️','🏆','🥇','🥈','🥉','🏅']
};

function _initEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  const grid = document.getElementById('emojiGrid');
  const toggleBtn = document.getElementById('emojiToggleBtn');
  const input = document.getElementById('chatInput');
  if (!picker || !grid || !toggleBtn || !input) return;

  function renderCategory(cat) {
    grid.innerHTML = '';
    (EMOJI_DATA[cat] || []).forEach(em => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, start) + em + input.value.slice(end);
        const pos = start + em.length;
        input.setSelectionRange(pos, pos);
        input.focus();
      });
      grid.appendChild(btn);
    });
  }

  // Tab clicks
  picker.querySelectorAll('.emoji-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      picker.querySelector('.emoji-tab.active')?.classList.remove('active');
      tab.classList.add('active');
      renderCategory(tab.dataset.cat);
    });
  });

  // Toggle picker
  toggleBtn.addEventListener('click', () => {
    const showing = picker.style.display === 'none';
    picker.style.display = showing ? '' : 'none';
    toggleBtn.classList.toggle('active', showing);
    if (showing) renderCategory(picker.querySelector('.emoji-tab.active')?.dataset.cat || 'smileys');
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !toggleBtn.contains(e.target)) {
      picker.style.display = 'none';
      toggleBtn.classList.remove('active');
    }
  });

  // Render default
  renderCategory('smileys');
}

// ================================================================
// VIEWS
// ================================================================

const VIEWS = ['chatViewPhoneGate', 'chatViewList', 'chatViewSearch', 'chatViewMessages', 'chatViewArchived'];

function _showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('active', v === id);
  });
}

// ================================================================
// RENDERIZACAO
// ================================================================

function _renderMessages(messages) {
  const listEl = document.getElementById('chatMessagesList');
  if (!listEl) return;
  if (messages.length === 0) { listEl.innerHTML = ''; _showEmptyState(true); return; }
  _showEmptyState(false);

  const me = state.currentUser;
  let lastDateKey = '';
  let html = '';

  messages.forEach(msg => {
    const tsDate  = msg.timestamp ? new Date(msg.timestamp) : null;
    const dateKey = tsDate ? tsDate.toLocaleDateString('pt-BR') : '';
    if (dateKey && dateKey !== lastDateKey) {
      html += `<div class="chat-date-sep"><span>${esc(_friendlyDate(tsDate))}</span></div>`;
      lastDateKey = dateKey;
    }

    const isMine  = msg.senderId === me.id;
    const timeStr = tsDate
      ? tsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const initial  = (msg.senderName || '?').charAt(0).toUpperCase();
    const photo    = _resolvePhoto(msg.senderPhoto, msg.senderName);
    const avatarEl = photo
      ? `<img src="${photo}" alt="${esc(msg.senderName)}" class="chat-avatar-bubble"
              onerror="this.outerHTML='<div class=\\'chat-avatar-bubble chat-initial\\'>${esc(initial)}</div>'">`
      : `<div class="chat-avatar-bubble chat-initial">${esc(initial)}</div>`;

    const isEdited = !!msg.editedAt;
    const reactionsHtml = _buildReactionsHtml(msg.reactions, me.id);

    const bubbleContent = msg.type === 'image' && msg.imageUrl
      ? `<a href="${esc(msg.imageUrl)}" target="_blank" rel="noopener noreferrer" class="chat-img-link">
           <img src="${esc(msg.imageUrl)}" class="chat-bubble-img" alt="Imagem" loading="lazy">
         </a>`
      : `<p class="chat-bubble-text">${_formatText(msg.text)}</p>`;

    html += `
      <div class="chat-msg ${isMine ? 'msg-mine' : 'msg-theirs'}" data-msg-id="${esc(msg.id)}" data-msg-ts="${esc(msg.timestamp)}" data-msg-mine="${isMine}">
        ${!isMine ? `<div class="chat-msg-avatar">${avatarEl}</div>` : ''}
        <div class="chat-bubble-col">
          ${!isMine ? `<span class="chat-sender-name">${esc(msg.senderName)}</span>` : ''}
          <div class="chat-bubble-wrap">
            <div class="chat-bubble${msg.type === 'image' ? ' chat-bubble--img' : ''}">
              ${bubbleContent}
            </div>
            <button type="button" class="chat-react-trigger" title="Reagir" data-msg-id="${esc(msg.id)}">
              <i class="fa-regular fa-face-smile"></i>
            </button>
          </div>
          ${reactionsHtml}
          <span class="chat-time-label">${timeStr}${isEdited ? ' <span class="chat-edited">\u2022 editado</span>' : ''}</span>
        </div>
        ${isMine ? `<div class="chat-msg-avatar chat-avatar-mine">${avatarEl}</div>` : ''}
      </div>`;
  });

  listEl.innerHTML = html;
  _bindMsgLongPress(listEl);
  _bindReactionBadges(listEl);
  _bindReactTriggers(listEl);
  _scrollToBottom(_chatOpen);
}

/**
 * Resolve a foto de um usuário.
 * Prioridade: photoURL → imagem local por nome → string vazia.
 */
function _resolvePhoto(photoURL, nameOrLogin) {
  if (photoURL) return photoURL;
  const n = (nameOrLogin || '').toLowerCase();
  if (n.includes('bianca')) return 'frontend/assets/images/bianca.jpeg';
  if (n.includes('luan'))   return 'frontend/assets/images/luan.jpg';
  return '';
}

function _formatText(text) {
  return esc(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`
  );
}

function _friendlyDate(date) {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const fmt = d => d.toLocaleDateString('pt-BR');
  if (fmt(date) === fmt(today))     return 'Hoje';
  if (fmt(date) === fmt(yesterday)) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function _shortTime(ts) {
  if (!ts) return '';
  const d     = new Date(ts);
  const today = new Date();
  if (d.toLocaleDateString('pt-BR') === today.toLocaleDateString('pt-BR')) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function _formatPhone(norm) {
  if (norm.length === 11) return `(${norm.slice(0,2)}) ${norm[2]} ${norm.slice(3,7)}-${norm.slice(7)}`;
  if (norm.length === 10) return `(${norm.slice(0,2)}) ${norm.slice(2,6)}-${norm.slice(6)}`;
  return norm;
}

function _truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function _scrollToBottom(smooth = true) {
  const listEl = document.getElementById('chatMessagesList');
  if (!listEl) return;
  listEl.scrollTo({ top: listEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function _showEmptyState(show) {
  const el = document.getElementById('chatEmptyState');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function _updateBadge(count) {
  const badge = document.getElementById('chatUnreadBadge');
  if (badge) {
    badge.textContent   = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  const dot = document.getElementById('chatFabDot');
  if (dot) dot.style.display = count > 0 ? 'block' : 'none';
}

async function _notifyNewMessage(msg) {
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(`💬 ${msg.senderName}`, {
      body:               msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text,
      icon:               'frontend/assets/images/icon-any-192.png',
      badge:              'frontend/assets/images/icon-any-96.png',
      tag:                'chat-incoming',
      renotify:           true,
      requireInteraction: false,
      vibrate:            [200, 100, 200],
      data:               { type: 'chat' },
      actions: [
        { action: 'open',    title: '💬 Abrir Chat' },
        { action: 'dismiss', title: 'Fechar'        }
      ]
    });
  } catch (err) {
    console.warn('[Chat] Notificacao falhou:', err);
  }
}

// ================================================================
// CONV DOC LISTENER (seenAt do outro usuário)
// ================================================================
function _stopConvDocListener() {
  if (_convDocListener) { _convDocListener(); _convDocListener = null; }
}

// ================================================================
// OPÇÕES DA CONVERSA
// ================================================================
function _openOptions() {
  const sheet = document.getElementById('chatOptionsSheet');
  if (sheet) sheet.style.display = 'flex';
}

function _closeOptions() {
  const sheet = document.getElementById('chatOptionsSheet');
  if (sheet) sheet.style.display = 'none';
}

// ================================================================
// PERFIL DO CONTATO
// ================================================================
function _openMyProfile() {
  const panel = document.getElementById('chatMyProfilePanel');
  if (!panel || !state.currentUser) return;
  panel.style.display = 'flex';
}

function _closeMyProfile() {
  const panel = document.getElementById('chatMyProfilePanel');
  if (panel) panel.style.display = 'none';
}

function _openProfile() {
  if (!_currentOtherUser) return;
  const panel = document.getElementById('chatProfilePanel');
  if (!panel) return;

  const user = _currentOtherUser;
  const photo = _resolvePhoto(user.photoURL, user.name || user.login);

  // Avatar
  const avatarEl = document.getElementById('profileAvatar');
  const fallback = document.getElementById('profileAvatarFallback');
  if (avatarEl && photo) {
    avatarEl.src = photo;
    avatarEl.style.display = '';
    if (fallback) fallback.style.display = 'none';
  } else {
    if (avatarEl) avatarEl.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
  }

  // Name
  const nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = user.name || 'Contato';

  // Phone - tentamos buscar do Firestore
  const phoneEl = document.getElementById('profilePhone');
  if (phoneEl) {
    phoneEl.textContent = '';
    db.collection('users').doc(user.id).get().then(snap => {
      if (snap.exists && snap.data().phone) {
        phoneEl.textContent = _formatPhone(snap.data().phone);
      }
    }).catch(() => {});
  }

  panel.style.display = 'flex';
}

function _closeProfile() {
  const panel = document.getElementById('chatProfilePanel');
  if (panel) panel.style.display = 'none';
}

async function _clearConversation() {
  _closeOptions();
  if (!_currentConvId) return;
  if (!confirm('Apagar todas as mensagens desta conversa? Esta ação não pode ser desfeita.')) return;

  try {
    const msgsRef = db.collection('conversations').doc(_currentConvId).collection('messages');
    const snap    = await msgsRef.get();

    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      if (++count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    await db.collection('conversations').doc(_currentConvId).update({
      lastMessage: null,
      updatedAt:   new Date().toISOString()
    });
  } catch (err) {
    console.error('[Chat] Erro ao limpar conversa:', err);
    import('./utils.js').then(({ showAlert }) =>
      showAlert('Não foi possível limpar a conversa.', 'error')
    );
  }
}

async function _archiveConversation() {
  _closeOptions();
  if (!_currentConvId || !state.currentUser) return;
  const me = state.currentUser.id;

  try {
    const convRef = db.collection('conversations').doc(_currentConvId);
    const snap    = await convRef.get();
    const isArch  = snap.exists && !!(snap.data().archived || {})[me];

    await convRef.update({ [`archived.${me}`]: !isArch });

    _stopMsgListener();
    _currentConvId    = null;
    _currentOtherUser = null;
    _lastTimestamp    = null;
    _showView('chatViewList');

    import('./utils.js').then(({ showAlert }) =>
      showAlert(isArch ? 'Conversa restaurada.' : 'Conversa arquivada.', 'success')
    );
  } catch (err) {
    console.error('[Chat] Erro ao arquivar conversa:', err);
    import('./utils.js').then(({ showAlert }) =>
      showAlert('Erro ao arquivar conversa.', 'error')
    );
  }
}

async function _deleteConversation() {
  _closeOptions();
  if (!_currentConvId) return;
  if (!confirm('Excluir esta conversa permanentemente? As mensagens serão apagadas para todos os participantes.')) return;

  try {
    const convRef = db.collection('conversations').doc(_currentConvId);
    const msgsRef = convRef.collection('messages');
    const snap    = await msgsRef.get();

    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count > 0) await batch.commit();
    await convRef.delete();

    _stopMsgListener();
    _currentConvId    = null;
    _currentOtherUser = null;
    _lastTimestamp    = null;
    _showView('chatViewList');

    import('./utils.js').then(({ showAlert }) =>
      showAlert('Conversa excluída.', 'success')
    );
  } catch (err) {
    console.error('[Chat] Erro ao excluir conversa:', err);
    import('./utils.js').then(({ showAlert }) =>
      showAlert('Não foi possível excluir a conversa.', 'error')
    );
  }
}

// ================================================================
// ENVIO DE IMAGEM
// ================================================================
async function _handleImageUpload(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    import('./utils.js').then(({ showAlert }) => showAlert('Selecione um arquivo de imagem válido.', 'error'));
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    import('./utils.js').then(({ showAlert }) => showAlert('Imagem muito grande. Limite: 10 MB.', 'error'));
    return;
  }
  if (!storage) {
    import('./utils.js').then(({ showAlert }) => showAlert('Firebase Storage não disponível.', 'error'));
    return;
  }
  if (!_currentConvId || !state.currentUser) return;

  const btn = document.getElementById('chatImageBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

  try {
    const msgId   = generateId();
    const ext     = file.name.split('.').pop() || 'jpg';
    const path    = `chat-images/${_currentConvId}/${msgId}.${ext}`;
    const ref     = storage.ref(path);
    await ref.put(file);
    const url     = await ref.getDownloadURL();

    const now     = new Date().toISOString();
    const me      = state.currentUser;
    const msg = {
      id:          msgId,
      senderId:    me.id,
      senderName:  me.fullName || me.login,
      senderPhoto: _resolvePhoto(me.photoURL, me.fullName || me.login),
      text:        '',
      imageUrl:    url,
      type:        'image',
      timestamp:   now
    };

    const convRef = db.collection('conversations').doc(_currentConvId);
    await convRef.collection('messages').doc(msgId).set(msg);
    await convRef.update({
      lastMessage: { text: '📷 Imagem', timestamp: now, senderId: me.id },
      updatedAt:   now
    });

    if (_currentOtherUser) {
      try {
        const doc = await db.collection('users').doc(_currentOtherUser.id).get();
        const token = doc.exists ? doc.data().fcmToken : null;
        if (token) sendFCMPush(token, msg.senderName, '📷 Imagem');
      } catch (_) { /* ignore */ }
    }
  } catch (err) {
    console.error('[Chat] Erro ao enviar imagem:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível enviar a imagem.', 'error'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-image"></i>'; }
  }
}

// ================================================================
// CONVERSAS ARQUIVADAS
// ================================================================
function _updateArchivedBadge(count) {
  const btn = document.getElementById('convArchivedBtn');
  if (!btn) return;
  btn.style.display = count > 0 ? 'flex' : 'none';
  const badge = btn.querySelector('.archived-count');
  if (badge) badge.textContent = count;
}

async function _loadArchivedView() {
  _showView('chatViewArchived');
  const listEl  = document.getElementById('archivedListEl');
  const emptyEl = document.getElementById('archivedListEmpty');
  if (!listEl) return;

  listEl.querySelectorAll('.conv-item').forEach(el => el.remove());
  listEl.insertAdjacentHTML('afterbegin',
    '<div class="srm" id="archLoadingEl"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>'
  );

  try {
    const snap = await db.collection('conversations')
      .where('participantIds', 'array-contains', state.currentUser.id)
      .get();

    const me       = state.currentUser;
    const archived = snap.docs
      .map(d => d.data())
      .filter(conv => !!(conv.archived || {})[me.id])
      .sort((a, b) => {
        const ta = a.updatedAt || a.createdAt || '';
        const tb = b.updatedAt || b.createdAt || '';
        return tb > ta ? 1 : -1;
      });

    document.getElementById('archLoadingEl')?.remove();

    if (archived.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    archived.forEach(conv => {
      const otherId    = conv.participantIds.find(id => id !== me.id) || '';
      const info       = (conv.participants || {})[otherId] || {};
      const name       = info.name || 'Usuário';
      const photo      = _resolvePhoto(info.photoURL, name);
      const initial    = name.charAt(0).toUpperCase();
      const avatarHtml = photo
        ? `<img src="${photo}" alt="${esc(name)}" class="conv-avatar-img"
                onerror="this.outerHTML='<div class=\\'conv-avatar-initial\\'>${esc(initial)}</div>'">`
        : `<div class="conv-avatar-initial">${esc(initial)}</div>`;

      const item = document.createElement('div');
      item.className = 'conv-item';
      item.innerHTML = `
        <div class="conv-avatar-wrap">${avatarHtml}</div>
        <div class="conv-info" style="flex:1">
          <div class="conv-top-row">
            <span class="conv-name">${esc(name)}</span>
          </div>
          <div class="conv-preview">Arquivada</div>
        </div>
        <button class="conv-unarchive-btn" data-conv-id="${esc(conv.id)}" title="Restaurar conversa">
          <i class="fa-solid fa-box-open"></i>
        </button>`;

      item.querySelector('.conv-unarchive-btn')?.addEventListener('click', async e => {
        e.stopPropagation();
        const convId = e.currentTarget.dataset.convId;
        try {
          await db.collection('conversations').doc(convId).update({
            [`archived.${me.id}`]: false
          });
          _loadArchivedView();
        } catch (err) { console.error('[Chat] Erro ao restaurar:', err); }
      });

      item.addEventListener('click', () => {
        _openConversation(conv.id, { id: otherId, name, photoURL: photo });
      });
      listEl.appendChild(item);
    });

  } catch (err) {
    console.error('[Chat] Erro ao carregar arquivadas:', err);
    document.getElementById('archLoadingEl')?.remove();
    const listEl2 = document.getElementById('archivedListEl');
    if (listEl2) listEl2.insertAdjacentHTML('afterbegin',
      '<div class="srm srm-warn">Erro ao carregar arquivadas.</div>'
    );
  }
}

// ================================================================
// REAÇÕES EM MENSAGENS
// ================================================================
const QUICK_REACTIONS = ['❤️','😂','😮','😢','😡','👍'];

const MORE_REACTIONS = [
  '😍','🥰','😘','🤣','😅','😜','🤭','🤩',
  '🙏','👏','🔥','🎉','💯','✨','💔','😱',
  '😈','😔','😳','🤔','🙄','🥵','🥶','🤢',
  '😴','💀','🤡','👻','👎','✌️','🤞','🤙',
  '💪','🌹','🌟','🌈','🎂','🏆','⚽','🍻'
];

function _buildReactionsHtml(reactions, myId) {
  if (!reactions || typeof reactions !== 'object') return '';
  // Agrupar: { emoji: { count, hasMine } }
  const grouped = {};
  for (const [uid, emoji] of Object.entries(reactions)) {
    if (!grouped[emoji]) grouped[emoji] = { count: 0, hasMine: false };
    grouped[emoji].count++;
    if (uid === myId) grouped[emoji].hasMine = true;
  }
  if (Object.keys(grouped).length === 0) return '';
  let html = '<div class="chat-reactions">';
  for (const [emoji, data] of Object.entries(grouped)) {
    html += `<span class="chat-reaction-badge${data.hasMine ? ' mine' : ''}" data-react-emoji="${emoji}">`;
    html += `<span class="react-emoji">${emoji}</span>`;
    if (data.count > 1) html += `<span class="react-count">${data.count}</span>`;
    html += '</span>';
  }
  html += '</div>';
  return html;
}

function _showReactionBar(msgEl) {
  _closeReactionBar();
  const bubbleWrap = msgEl.querySelector('.chat-bubble-wrap');
  if (!bubbleWrap) return;

  const bar = document.createElement('div');
  bar.className = 'chat-reaction-bar';

  // Quick reactions
  QUICK_REACTIONS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = em;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleReaction(msgEl.dataset.msgId, em);
      _closeReactionBar();
    });
    bar.appendChild(btn);
  });

  // "+" button for more emojis
  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'reaction-more-btn';
  plusBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _showExpandedReactions(bar, msgEl);
  });
  bar.appendChild(plusBtn);

  // Position above the bubble
  msgEl.style.position = 'relative';
  const isMine = msgEl.dataset.msgMine === 'true';
  bar.style.bottom = '100%';
  bar.style.marginBottom = '6px';
  if (isMine) {
    bar.style.right = '40px';
  } else {
    bar.style.left = '40px';
  }
  msgEl.appendChild(bar);
  _activeReactionBar = bar;
}

function _showExpandedReactions(bar, msgEl) {
  // Toggle expanded grid
  let grid = bar.querySelector('.reaction-expanded-grid');
  if (grid) { grid.remove(); return; }

  grid = document.createElement('div');
  grid.className = 'reaction-expanded-grid';
  MORE_REACTIONS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = em;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleReaction(msgEl.dataset.msgId, em);
      _closeReactionBar();
    });
    grid.appendChild(btn);
  });
  bar.appendChild(grid);
}

function _closeReactionBar() {
  if (_activeReactionBar) {
    _activeReactionBar.remove();
    _activeReactionBar = null;
  }
}

async function _toggleReaction(msgId, emoji) {
  if (!_currentConvId || !state.currentUser) return;
  const me = state.currentUser.id;
  try {
    const msgRef = db.collection('conversations').doc(_currentConvId)
      .collection('messages').doc(msgId);
    const snap = await msgRef.get();
    if (!snap.exists) return;
    const reactions = snap.data().reactions || {};
    if (reactions[me] === emoji) {
      // Remove own reaction (toggle off)
      delete reactions[me];
    } else {
      // Set/change reaction
      reactions[me] = emoji;
    }
    await msgRef.update({ reactions });
  } catch (err) {
    console.error('[Chat] Erro ao reagir:', err);
  }
}

function _bindReactionBadges(listEl) {
  listEl.addEventListener('click', e => {
    const badge = e.target.closest('.chat-reaction-badge');
    if (!badge) return;
    const msgEl = badge.closest('.chat-msg');
    if (!msgEl) return;
    const emoji = badge.dataset.reactEmoji;
    if (emoji) _toggleReaction(msgEl.dataset.msgId, emoji);
  });
}

function _bindReactTriggers(listEl) {
  listEl.querySelectorAll('.chat-react-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msgEl = btn.closest('.chat-msg');
      if (msgEl) _showReactionBar(msgEl);
    });
  });
}

// Close reaction bar on click outside
document.addEventListener('click', e => {
  if (_activeReactionBar && !_activeReactionBar.contains(e.target) && !e.target.closest('.chat-msg')) {
    _closeReactionBar();
  }
});

// ================================================================
// EDITAR MENSAGEM (long-press + modal) & REAÇÃO (double-tap)
// ================================================================
function _bindMsgLongPress(listEl) {
  if (listEl._lpBound) return;
  listEl._lpBound = true;

  let timer = null;
  let lastTap = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };

  // Double-tap → reaction bar (any message)
  listEl.addEventListener('click', e => {
    const msgEl = e.target.closest('.chat-msg');
    if (!msgEl || e.target.closest('.chat-reaction-bar') || e.target.closest('.chat-reaction-badge')) return;
    const now = Date.now();
    if (now - lastTap < 350) {
      e.preventDefault();
      _showReactionBar(msgEl);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });

  // Long-press → edit (own messages only)
  listEl.addEventListener('pointerdown', e => {
    const msgEl = e.target.closest('[data-msg-mine="true"]');
    if (!msgEl) return;
    timer = setTimeout(() => {
      timer = null;
      const msgId   = msgEl.dataset.msgId;
      const msgTs   = msgEl.dataset.msgTs;
      const msgText = msgEl.querySelector('.chat-bubble-text')?.textContent?.trim() || '';
      _promptEdit(msgId, msgTs, msgText);
    }, 600);
  });

  listEl.addEventListener('pointerup',     cancel);
  listEl.addEventListener('pointercancel', cancel);
  listEl.addEventListener('pointermove',   cancel);
  listEl.addEventListener('contextmenu', e => {
    if (e.target.closest('.chat-msg')) e.preventDefault();
  });
}

function _promptEdit(msgId, msgTs, msgText) {
  // Só pode editar se o outro ainda não visualizou
  if (_otherSeenAt && msgTs <= _otherSeenAt) {
    import('./utils.js').then(({ showAlert }) =>
      showAlert('Esta mensagem já foi visualizada e não pode ser editada.', 'warning')
    );
    return;
  }
  _editingMsgId = msgId;
  const modal = document.getElementById('chatEditMsgModal');
  const input = document.getElementById('chatEditMsgInput');
  if (!modal || !input) return;
  input.value = msgText;
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(0, input.value.length);
  });
}

function _closeEditModal() {
  const modal = document.getElementById('chatEditMsgModal');
  if (modal) modal.style.display = 'none';
  _editingMsgId = null;
}

async function _commitEdit() {
  const input   = document.getElementById('chatEditMsgInput');
  const newText = input?.value?.trim().substring(0, 1000);
  if (!newText || !_editingMsgId || !_currentConvId) { _closeEditModal(); return; }

  const msgId = _editingMsgId;
  _closeEditModal();

  try {
    const now    = new Date().toISOString();
    const msgRef = db.collection('conversations').doc(_currentConvId)
      .collection('messages').doc(msgId);
    const msgSnap = await msgRef.get();
    const msgData = msgSnap.exists ? msgSnap.data() : null;

    await msgRef.update({ text: newText, editedAt: now });

    // Atualiza lastMessage se for a última mensagem da conversa
    if (msgData) {
      const convSnap = await db.collection('conversations').doc(_currentConvId).get();
      if (convSnap.exists && convSnap.data().lastMessage?.timestamp === msgData.timestamp) {
        await db.collection('conversations').doc(_currentConvId).update({
          lastMessage: { text: newText, timestamp: msgData.timestamp, senderId: msgData.senderId }
        });
      }
    }
  } catch (err) {
    console.error('[Chat] Erro ao editar mensagem:', err);
    import('./utils.js').then(({ showAlert }) =>
      showAlert('Não foi possível editar a mensagem.', 'error')
    );
  }
}

