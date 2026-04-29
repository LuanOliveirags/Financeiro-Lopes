// ============================================================
// CHAT.JS — Chat estilo WhatsApp
// Recursos: DMs, ticks de leitura, typing indicator, reply,
//           menu de contexto, scroll FAB, send/mic morph
// ============================================================

import { state } from '../../../../../packages/core/state/store.js';
import { db, firebaseReady, storage } from '../../../../../packages/services/firebase/firebase.service.js';
import { generateId, esc } from '../../../../../packages/utils/helpers.js';
import { initFCM, sendFCMPush } from '../../../../../packages/services/firebase/fcm.service.js';
import { savePhoneNumber } from '../../../../../packages/services/auth/auth.service.js';

// ── Estado interno ──
let _convListListener  = null;
let _msgListener       = null;
let _currentConvId     = null;
let _currentOtherUser  = null;
let _chatOpen          = false;
let _unreadByConv      = {};
let _formBound         = false;
let _btnBound          = false;
let _lastTimestamp     = null;
let _otherSeenAt       = '';
let _editingMsgId      = null;
let _convDocListener   = null;
let _activeReactionBar = null;
let _replyTo           = null;
let _ctxMsgEl          = null;
let _typingTimer       = null;
let _scrollUnread      = 0;
let _isAtBottom        = true;

// Áudio
let _recorder          = null;
let _audioChunks       = [];
let _recTimer          = null;
let _recSeconds        = 0;
let _recStream         = null;
let _activeAudio       = null;

// ================================================================
// PÚBLICO
// ================================================================

export function openChat() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  _bindButtons();
  panel.classList.add('active');
  document.body.style.overflow = 'hidden';
  _chatOpen = true;

  if (!state.currentUser?.phone) {
    _showView('chatViewPhoneGate');
    const inp = document.getElementById('phoneGateInput');
    if (inp) { inp.value = ''; inp.focus(); }
    document.getElementById('phoneGateError')?.style && (document.getElementById('phoneGateError').style.display = 'none');
    return;
  }

  if (!_convListListener) _initConvList();
  initFCM().catch(() => {});
  _showView('chatViewList');
}

export function closeChat() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  panel.classList.remove('active');
  document.body.style.overflow = '';
  _chatOpen = false;
  _stopMsgListener();
  _hideCtxMenu();
}

export function initChat() {
  if (!firebaseReady || !state.currentUser) return;
  _bindButtons();
  _initConvList();
}

export function cleanupChat() {
  _stopConvList();
  _stopMsgListener();
  closeChat();
  _chatOpen = false; _unreadByConv = {}; _formBound = false; _btnBound = false;
  _currentConvId = null; _currentOtherUser = null; _lastTimestamp = null;
  _otherSeenAt = ''; _editingMsgId = null;
  _stopConvDocListener();
  _clearReply();
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
      const me = state.currentUser;
      const allData = snapshot.docs.map(d => d.data());

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

      active.forEach(conv => {
        const last = conv.lastMessage;
        if (!last || last.senderId === me.id) { delete _unreadByConv[conv.id]; return; }
        const seenAt = (conv.seenAt || {})[me.id] || '';
        if (last.timestamp > seenAt) _unreadByConv[conv.id] = true;
        else delete _unreadByConv[conv.id];
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

  if (convs.length === 0) { if (emptyEl) emptyEl.style.display = 'flex'; return; }
  if (emptyEl) emptyEl.style.display = 'none';

  const me = state.currentUser;
  convs.forEach(conv => {
    const otherId  = conv.participantIds.find(id => id !== me.id) || '';
    const info     = (conv.participants || {})[otherId] || {};
    const name     = info.name || 'Usuário';
    const photo    = _resolvePhoto(info.photoURL, name);
    const last     = conv.lastMessage;
    const lastText = last ? _truncate(last.text || (last.type === 'image' ? '📷 Foto' : ''), 46) : '';
    const lastTime = last ? _shortTime(last.timestamp) : '';
    const initial  = name.charAt(0).toUpperCase();
    const seenAt   = (conv.seenAt || {})[me.id] || '';
    const isUnread = last && last.senderId !== me.id && last.timestamp > seenAt;
    const isSentByMe = last && last.senderId === me.id;
    // Tick: lida = seenAt do outro > timestamp
    const otherSeenAtConv = (conv.seenAt || {})[otherId] || '';
    const isReadByOther   = isSentByMe && otherSeenAtConv && last.timestamp <= otherSeenAtConv;

    const avatarHtml = photo
      ? `<img src="${photo}" alt="${esc(name)}" class="conv-avatar-img"
              onerror="this.outerHTML='<div class=\\'conv-avatar-initial\\'>${esc(initial)}</div>'">`
      : `<div class="conv-avatar-initial">${esc(initial)}</div>`;

    const tickHtml = isSentByMe
      ? `<span class="conv-last-tick${isReadByOther ? ' tick-read' : ''}">
           <i class="fa-solid fa-check-double"></i>
         </span>`
      : '';

    const unreadHtml = isUnread
      ? `<div class="conv-unread-badge">${_unreadByConv[conv.id] ? '1' : ''}</div>`
      : '';

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
          <span class="conv-time${isUnread ? ' conv-time--unread' : ''}">${esc(lastTime)}</span>
        </div>
        <div class="conv-bottom-row">
          <div class="conv-preview${isUnread ? ' conv-preview-unread' : ''}">
            ${tickHtml}${lastText ? esc(lastText) : '<em>Iniciar conversa</em>'}
          </div>
          ${unreadHtml}
        </div>
      </div>
    `;

    item.addEventListener('click', () => _openConversation(
      item.dataset.convId,
      { id: item.dataset.otherId, name: item.dataset.otherName, photoURL: item.dataset.otherPhoto }
    ));
    listEl.appendChild(item);
  });
}

// ================================================================
// BUSCA POR TELEFONE
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
    resultArea.innerHTML = `<div class="srm srm-warn"><i class="fa-solid fa-triangle-exclamation"></i> Digite um numero valido com DDD.</div>`;
    return;
  }

  resultArea.innerHTML = `<div class="srm"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>`;

  try {
    const snap = await db.collection('users').where('phone', '==', normalized).limit(1).get();

    if (snap.empty) {
      resultArea.innerHTML = `<div class="srm srm-warn"><i class="fa-solid fa-user-xmark"></i> Nenhum usuario com esse numero.</div>`;
      return;
    }

    const found = snap.docs[0].data();
    if (found.id === state.currentUser.id) {
      resultArea.innerHTML = `<div class="srm srm-warn"><i class="fa-solid fa-circle-info"></i> Este e o seu proprio numero.</div>`;
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
      _openConversation(convId, { id: found.id, name: found.fullName, login: found.login || '', photoURL: photo });
    });

  } catch (err) {
    console.error('[Chat] Erro ao buscar:', err);
    resultArea.innerHTML = `<div class="srm srm-warn"><i class="fa-solid fa-circle-xmark"></i> Erro ao buscar. Verifique sua conexao.</div>`;
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
      id: convId, participantIds: ids,
      participants: {
        [me.id]: { name: me.fullName || me.login, photoURL: _resolvePhoto(me.photoURL, me.fullName || me.login) },
        [otherUser.id]: { name: otherUser.fullName || otherUser.name || '', photoURL: _resolvePhoto(otherUser.photoURL, otherUser.name || otherUser.fullName || otherUser.login) }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seenAt: {}
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
  _scrollUnread     = 0;
  _isAtBottom       = true;

  const nameEl = document.getElementById('chatHdrName');
  if (nameEl) nameEl.textContent = otherUser.name || 'Chat';

  const subEl = document.getElementById('chatHdrSubtitle');
  if (subEl) subEl.textContent = 'toque aqui para ver o perfil';

  const avatarEl  = document.getElementById('chatHdrAvatar');
  const initialEl = document.getElementById('chatHdrAvatarFallback');
  const hdrPhoto  = _resolvePhoto(otherUser.photoURL, otherUser.name || otherUser.login);
  if (hdrPhoto && avatarEl) {
    avatarEl.src = hdrPhoto;
    avatarEl.style.display = '';
    if (initialEl) initialEl.style.display = 'none';
  } else {
    if (avatarEl) avatarEl.style.display = 'none';
    if (initialEl) {
      initialEl.textContent = (otherUser.name || '?').charAt(0).toUpperCase();
      initialEl.style.display = 'flex';
    }
  }

  _stopConvDocListener();
  _convDocListener = db.collection('conversations').doc(convId).onSnapshot(snap => {
    if (!snap.exists) return;
    const data = snap.data();
    _otherSeenAt = (data.seenAt || {})[otherUser.id] || '';

    // Typing indicator
    const typingTs = (data.typing || {})[otherUser.id] || '';
    const isTyping = typingTs && (Date.now() - new Date(typingTs).getTime()) < 5000;
    _setTypingIndicator(isTyping, otherUser.name);
  }, () => {});

  document.querySelectorAll('.conv-item').forEach(el =>
    el.classList.toggle('conv-active', el.dataset.convId === convId)
  );

  _showView('chatViewMessages');
  _bindForm();
  _initEmojiPicker();
  _initScrollFab();
  _startMsgListener(convId);
  _markSeen(convId);

  setTimeout(() => {
    _scrollToBottom(false);
    document.getElementById('chatInput')?.focus();
  }, 80);
}

function _setTypingIndicator(isTyping, name) {
  const row    = document.getElementById('chatTypingRow');
  const subEl  = document.getElementById('chatHdrSubtitle');
  if (row) row.style.display = isTyping ? 'block' : 'none';
  if (subEl) {
    subEl.innerHTML = isTyping
      ? `<span class="chat-typing-label">digitando...</span>`
      : 'toque aqui para ver o perfil';
  }
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

        if (_chatOpen && _isAtBottom) {
          _markSeen(convId);
        } else if (_chatOpen && !_isAtBottom) {
          _scrollUnread++;
          _updateScrollFab();
        } else {
          _unreadByConv[convId] = true;
          _updateBadge(Object.keys(_unreadByConv).length);
          _notifyNewMessage(msg);
        }
      });

      if (msgs.length > 0) _lastTimestamp = msgs[msgs.length - 1].timestamp;
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
  } catch (_) {}
}

export async function sendMessage(text, replyTo) {
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
    timestamp:   now,
    ...(replyTo ? { replyTo } : {})
  };

  // Para de digitar ao enviar
  _broadcastStopTyping();

  try {
    const convRef = db.collection('conversations').doc(_currentConvId);
    await convRef.collection('messages').doc(msg.id).set(msg);
    await convRef.update({
      lastMessage: { text: sanitized, timestamp: now, senderId: msg.senderId },
      updatedAt:   now
    });

    if (_currentOtherUser) {
      try {
        const doc   = await db.collection('users').doc(_currentOtherUser.id).get();
        const token = doc.exists ? doc.data().fcmToken : null;
        if (token) sendFCMPush(token, msg.senderName, msg.text);
      } catch (_) {}
    }
  } catch (err) {
    console.error('[Chat] Erro ao enviar:', err);
    const inp = document.getElementById('chatInput');
    if (inp && !inp.value) inp.value = text;
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível enviar a mensagem.', 'error'));
  }
}

// ================================================================
// TYPING INDICATOR
// ================================================================

function _broadcastTyping() {
  if (!_currentConvId || !state.currentUser) return;
  db.collection('conversations').doc(_currentConvId).update({
    [`typing.${state.currentUser.id}`]: new Date().toISOString()
  }).catch(() => {});
}

function _broadcastStopTyping() {
  clearTimeout(_typingTimer);
  _typingTimer = null;
  if (!_currentConvId || !state.currentUser) return;
  db.collection('conversations').doc(_currentConvId).update({
    [`typing.${state.currentUser.id}`]: ''
  }).catch(() => {});
}

// ================================================================
// SCROLL FAB
// ================================================================

function _initScrollFab() {
  const listEl = document.getElementById('chatMessagesList');
  const fabEl  = document.getElementById('chatScrollDownBtn');
  if (!listEl || !fabEl) return;

  if (listEl._scrollBound) return;
  listEl._scrollBound = true;

  listEl.addEventListener('scroll', () => {
    const distFromBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
    _isAtBottom = distFromBottom < 60;
    if (_isAtBottom) {
      _scrollUnread = 0;
      _updateScrollFab();
      if (_currentConvId && _chatOpen) _markSeen(_currentConvId);
    }
    fabEl.style.display = _isAtBottom ? 'none' : 'flex';
  }, { passive: true });

  fabEl.addEventListener('click', () => {
    _scrollToBottom(true);
    _scrollUnread = 0;
    _updateScrollFab();
  });
}

function _updateScrollFab() {
  const badge = document.getElementById('chatScrollDownBadge');
  if (badge) {
    badge.textContent   = _scrollUnread > 9 ? '9+' : String(_scrollUnread);
    badge.style.display = _scrollUnread > 0 ? 'flex' : 'none';
  }
}

// ================================================================
// REPLY
// ================================================================

function _setReply(msg) {
  _replyTo = {
    id:         msg.id || msg.dataset?.msgId || '',
    text:       msg.text || msg.querySelector?.('.chat-bubble-text')?.textContent?.trim() || '',
    senderName: msg.senderName || ''
  };

  const bar    = document.getElementById('chatReplyBar');
  const nameEl = document.getElementById('chatReplyBarName');
  const textEl = document.getElementById('chatReplyBarText');

  if (nameEl) nameEl.textContent = _replyTo.senderName || 'Mensagem';
  if (textEl) textEl.textContent = _truncate(_replyTo.text, 60);
  if (bar)    bar.style.display  = 'flex';

  document.getElementById('chatInput')?.focus();
}

function _clearReply() {
  _replyTo = null;
  const bar = document.getElementById('chatReplyBar');
  if (bar) bar.style.display = 'none';
}

// ================================================================
// CONTEXT MENU
// ================================================================

let _ctxMsgData = null;

function _showCtxMenu(msgEl, x, y) {
  const menu = document.getElementById('chatCtxMenu');
  if (!menu) return;

  _ctxMsgEl   = msgEl;
  const isMine = msgEl.dataset.msgMine === 'true';
  const msgId  = msgEl.dataset.msgId;
  const msgTs  = msgEl.dataset.msgTs;
  const text   = msgEl.querySelector('.chat-bubble-text')?.textContent?.trim() || '';
  const name   = msgEl.querySelector('.chat-sender-name')?.textContent || _currentOtherUser?.name || '';

  _ctxMsgData = { id: msgId, ts: msgTs, text, isMine, senderName: isMine ? (state.currentUser?.fullName || '') : name };

  document.getElementById('ctxEditBtn').style.display   = isMine ? 'flex' : 'none';
  document.getElementById('ctxDeleteBtn').style.display = isMine ? 'flex' : 'none';
  document.getElementById('ctxCopyBtn').style.display   = text   ? 'flex' : 'none';

  // Posicionar menu dentro do painel
  const panel   = document.getElementById('chatViewMessages');
  const rect    = panel ? panel.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const menuW   = 180;
  const menuH   = (isMine ? 4 : 2) * 44 + 8;
  let   left    = x - rect.left;
  let   top     = y - rect.top;

  if (left + menuW > rect.width  - 8) left = rect.width  - menuW - 8;
  if (top  + menuH > rect.height - 8) top  = top - menuH - 12;
  if (top < 4) top = 4;
  if (left < 4) left = 4;

  menu.style.left    = left + 'px';
  menu.style.top     = top  + 'px';
  menu.style.display = 'block';
}

function _hideCtxMenu() {
  const menu = document.getElementById('chatCtxMenu');
  if (menu) menu.style.display = 'none';
  _ctxMsgEl   = null;
  _ctxMsgData = null;
}

// ================================================================
// BINDINGS
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
      _broadcastStopTyping();
      _stopMsgListener();
      _currentConvId = null; _currentOtherUser = null; _lastTimestamp = null;
      document.querySelectorAll('.conv-item.conv-active').forEach(el => el.classList.remove('conv-active'));
      _showView('chatViewList');
    });

  document.getElementById('searchPhoneBtn')
    ?.addEventListener('click', _doSearch);

  document.getElementById('searchPhoneInput')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _doSearch(); } });

  document.getElementById('searchPhoneInput')
    ?.addEventListener('input', _maskPhone);

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

  document.getElementById('chatImageBtn')
    ?.addEventListener('click', () => document.getElementById('chatImageInput')?.click());
  document.getElementById('chatImageInput')
    ?.addEventListener('change', _handleImageUpload);

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
      import('./utils.js').then(({ showAlert }) => showAlert('Funcionalidade em breve.', 'info'));
    });

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

  document.getElementById('convArchivedBtn')
    ?.addEventListener('click', _loadArchivedView);
  document.getElementById('archivedBackBtn')
    ?.addEventListener('click', () => _showView('chatViewList'));

  document.getElementById('chatEditSaveBtn')
    ?.addEventListener('click', _commitEdit);
  document.getElementById('chatEditCancelBtn')
    ?.addEventListener('click', _closeEditModal);
  document.getElementById('chatEditCloseBtn')
    ?.addEventListener('click', _closeEditModal);
  document.getElementById('chatEditMsgModal')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) _closeEditModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _chatOpen) {
      if (document.getElementById('chatCtxMenu')?.style.display !== 'none') { _hideCtxMenu(); return; }
      closeChat();
    }
  });

  // Gate de telefone
  document.getElementById('phoneGateCloseBtn')
    ?.addEventListener('click', closeChat);

  document.getElementById('phoneGateInput')
    ?.addEventListener('input', e => _maskPhone(e));

  document.getElementById('phoneGateForm')
    ?.addEventListener('submit', async e => {
      e.preventDefault();
      const inp   = document.getElementById('phoneGateInput');
      const errEl = document.getElementById('phoneGateError');
      const btn   = document.getElementById('phoneGateSubmit');
      const raw   = inp?.value || '';
      if (errEl) errEl.style.display = 'none';
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }
      try {
        await savePhoneNumber(raw);
        const phoneEl = document.getElementById('settingsUserPhone');
        if (phoneEl) phoneEl.textContent = inp.value;
        if (!_convListListener) _initConvList();
        initFCM().catch(() => {});
        _showView('chatViewList');
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar e entrar no Chat'; }
      }
    });

  // Reply bar — cancelar
  document.getElementById('chatReplyCancelBtn')
    ?.addEventListener('click', _clearReply);

  // Context menu buttons
  document.getElementById('ctxReplyBtn')?.addEventListener('click', () => {
    if (_ctxMsgData) _setReply(_ctxMsgData);
    _hideCtxMenu();
  });
  document.getElementById('ctxCopyBtn')?.addEventListener('click', () => {
    if (_ctxMsgData?.text) navigator.clipboard?.writeText(_ctxMsgData.text).catch(() => {});
    _hideCtxMenu();
  });
  document.getElementById('ctxEditBtn')?.addEventListener('click', () => {
    if (_ctxMsgData) _promptEdit(_ctxMsgData.id, _ctxMsgData.ts, _ctxMsgData.text);
    _hideCtxMenu();
  });
  document.getElementById('ctxDeleteBtn')?.addEventListener('click', () => {
    const data = _ctxMsgData;
    _hideCtxMenu();
    if (data) _deleteMessage(data.id);
  });

  // Fechar ctx menu clicando fora
  document.addEventListener('click', e => {
    const menu = document.getElementById('chatCtxMenu');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
      _hideCtxMenu();
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
  const form    = document.getElementById('chatForm');
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const micBtn  = document.getElementById('chatMicBtn');
  if (!form) return;

  // Morph send ↔ mic
  const _updateSendMic = () => {
    const hasText = input?.value?.trim().length > 0;
    if (sendBtn) sendBtn.style.display = hasText ? 'flex' : 'none';
    if (micBtn)  micBtn.style.display  = hasText ? 'none' : 'flex';
  };
  input?.addEventListener('input', () => {
    _updateSendMic();

    // Typing indicator: debounce 4s
    clearTimeout(_typingTimer);
    _broadcastTyping();
    _typingTimer = setTimeout(_broadcastStopTyping, 4000);
  });
  _updateSendMic();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text  = input?.value?.trim();
    if (!text) return;
    const reply = _replyTo ? { ..._replyTo } : undefined;
    input.value = '';
    _updateSendMic();
    _clearReply();
    sendMessage(text, reply);
    document.getElementById('emojiPicker')?.style && (document.getElementById('emojiPicker').style.display = 'none');
    document.getElementById('emojiToggleBtn')?.classList.remove('active');
  });

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  micBtn?.addEventListener('click', () => {
    if (_recorder && _recorder.state !== 'inactive') {
      _stopRecording(false); // parar e enviar
    } else {
      _startRecording();
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
  animais: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🐢','🐍','🦎','🦂','🦀','🦞','🦐','🦑','🐙','🐠','🐟','🐡','🐬','🐳','🐋','🦈','🐊','🐅','🐆'],
  comida: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🥐','🍞','🥖','🥨','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
  objetos: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🧸','🪄','🎈','🎉','🎊','🎁','🎀','🪅','🪩']
};

function _initEmojiPicker() {
  const picker    = document.getElementById('emojiPicker');
  const grid      = document.getElementById('emojiGrid');
  const toggleBtn = document.getElementById('emojiToggleBtn');
  const input     = document.getElementById('chatInput');
  if (!picker || !grid || !toggleBtn || !input) return;

  function renderCategory(cat) {
    grid.innerHTML = '';
    (EMOJI_DATA[cat] || []).forEach(em => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        const start = input.selectionStart;
        const end   = input.selectionEnd;
        input.value = input.value.slice(0, start) + em + input.value.slice(end);
        const pos   = start + em.length;
        input.setSelectionRange(pos, pos);
        input.focus();
        input.dispatchEvent(new Event('input'));
      });
      grid.appendChild(btn);
    });
  }

  picker.querySelectorAll('.emoji-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      picker.querySelector('.emoji-tab.active')?.classList.remove('active');
      tab.classList.add('active');
      renderCategory(tab.dataset.cat);
    });
  });

  toggleBtn.addEventListener('click', () => {
    const showing = picker.style.display === 'none';
    picker.style.display = showing ? '' : 'none';
    toggleBtn.classList.toggle('active', showing);
    if (showing) renderCategory(picker.querySelector('.emoji-tab.active')?.dataset.cat || 'smileys');
  });

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !toggleBtn.contains(e.target)) {
      picker.style.display = 'none';
      toggleBtn.classList.remove('active');
    }
  });

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
// RENDERIZAÇÃO DE MENSAGENS
// ================================================================

function _renderMessages(messages) {
  const listEl = document.getElementById('chatMessagesList');
  if (!listEl) return;
  if (messages.length === 0) { listEl.innerHTML = ''; _showEmptyState(true); return; }
  _showEmptyState(false);

  const me = state.currentUser;
  let lastDateKey = '';
  let html = '';

  messages.forEach((msg, idx) => {
    const tsDate  = msg.timestamp ? new Date(msg.timestamp) : null;
    const dateKey = tsDate ? tsDate.toLocaleDateString('pt-BR') : '';
    if (dateKey && dateKey !== lastDateKey) {
      html += `<div class="chat-date-sep"><span>${esc(_friendlyDate(tsDate))}</span></div>`;
      lastDateKey = dateKey;
    }

    const isMine   = msg.senderId === me.id;
    const timeStr  = tsDate ? tsDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const initial  = (msg.senderName || '?').charAt(0).toUpperCase();
    const photo    = _resolvePhoto(msg.senderPhoto, msg.senderName);
    const isEdited = !!msg.editedAt;

    // Agrupamento por remetente consecutivo (sem limite de tempo, igual WhatsApp)
    const prev     = messages[idx - 1];
    const next     = messages[idx + 1];
    const prevSame = !!(prev && prev.senderId === msg.senderId);
    const nextSame = !!(next && next.senderId === msg.senderId);
    const isFirst  = !prevSame; // primeira da sequência → mostra cauda e avatar
    const isLast   = !nextSame; // última da sequência → mostra avatar

    // Raio da bolha: remove o canto com cauda apenas na primeira da sequência
    let bubbleClass = 'chat-bubble';
    if (msg.type === 'image') bubbleClass += ' chat-bubble--img';
    if (!isFirst) bubbleClass += isMine ? ' chat-bubble--cont-mine' : ' chat-bubble--cont-theirs';

    // Status tick (apenas para mensagens minhas)
    const isRead = isMine && _otherSeenAt && msg.timestamp <= _otherSeenAt;
    const tickHtml = isMine
      ? `<span class="msg-ticks${isRead ? ' tick-read' : ''}"><i class="fa-solid fa-check-double"></i></span>`
      : '';

    // Avatar — mostra apenas na última mensagem da sequência
    const avatarEl = photo
      ? `<img src="${photo}" alt="${esc(msg.senderName)}" class="chat-avatar-bubble"
              onerror="this.outerHTML='<div class=\\'chat-avatar-bubble chat-initial\\'>${esc(initial)}</div>'">`
      : `<div class="chat-avatar-bubble chat-initial">${esc(initial)}</div>`;
    const avatarHtml = isLast ? avatarEl : `<div class="chat-avatar-bubble chat-avatar-ghost"></div>`;

    const reactionsHtml = _buildReactionsHtml(msg.reactions, me.id);

    // Reply quote dentro da bolha
    let replyHtml = '';
    if (msg.replyTo) {
      replyHtml = `<div class="chat-reply-quote" data-jump-to="${esc(msg.replyTo.id || '')}">
        <div class="chat-reply-quote-bar"></div>
        <div class="chat-reply-quote-body">
          <p class="chat-reply-quote-name">${esc(msg.replyTo.senderName || 'Mensagem')}</p>
          <p class="chat-reply-quote-text">${esc(_truncate(msg.replyTo.text || '', 60))}</p>
        </div>
      </div>`;
    }

    // Conteúdo da bolha
    const bubbleContent = msg.type === 'image' && msg.imageUrl
      ? `<a href="${esc(msg.imageUrl)}" target="_blank" rel="noopener noreferrer" class="chat-img-link">
           <img src="${esc(msg.imageUrl)}" class="chat-bubble-img" alt="Imagem" loading="lazy">
         </a>`
      : msg.type === 'audio' && msg.audioUrl
      ? `<div class="chat-audio-player" data-audio-url="${esc(msg.audioUrl)}">
           <button type="button" class="chat-audio-play-btn" aria-label="Reproduzir">
             <i class="fa-solid fa-play"></i>
           </button>
           <div class="chat-audio-track"><div class="chat-audio-progress-bar"></div></div>
           <span class="chat-audio-time">${_fmtDuration(msg.audioDuration || 0)}</span>
         </div>`
      : `<p class="chat-bubble-text">${_formatText(msg.text)}</p>`;

    // Footer da bolha (hora + ticks + editado)
    const footerHtml = `<div class="chat-bubble-footer">
      ${isEdited ? '<span class="chat-edited">editado</span>' : ''}
      <span class="chat-bubble-time">${timeStr}</span>
      ${tickHtml}
    </div>`;

    // Gap menor entre mensagens agrupadas
    const gapClass = prevSame ? 'chat-msg--grouped' : '';

    html += `
      <div class="chat-msg ${isMine ? 'msg-mine' : 'msg-theirs'} ${gapClass}"
           data-msg-id="${esc(msg.id)}"
           data-msg-ts="${esc(msg.timestamp)}"
           data-msg-mine="${isMine}"
           data-msg-text="${esc(msg.text || '')}"
           data-msg-sender="${esc(msg.senderName || '')}">
        ${!isMine ? `<div class="chat-msg-avatar">${avatarHtml}</div>` : ''}
        <div class="chat-bubble-col">
          ${!isMine && isFirst ? `<span class="chat-sender-name">${esc(msg.senderName)}</span>` : ''}
          <div class="chat-bubble-wrap">
            <div class="${bubbleClass}">
              ${replyHtml}
              ${bubbleContent}
              ${footerHtml}
            </div>
            <button type="button" class="chat-react-trigger" title="Reagir" data-msg-id="${esc(msg.id)}">
              <i class="fa-regular fa-face-smile"></i>
            </button>
          </div>
          ${reactionsHtml}
        </div>
        ${isMine ? `<div class="chat-msg-avatar chat-avatar-mine">${avatarHtml}</div>` : ''}
      </div>`;
  });

  if (_activeAudio) { _activeAudio.pause(); _activeAudio = null; }
  listEl.innerHTML = html;
  _bindMsgLongPress(listEl);
  _bindReactionBadges(listEl);
  _bindReactTriggers(listEl);
  _bindQuoteJump(listEl);
  _bindAudioPlayers(listEl);
  if (_isAtBottom) _scrollToBottom(_chatOpen);
}

function _bindQuoteJump(listEl) {
  listEl.querySelectorAll('.chat-reply-quote[data-jump-to]').forEach(el => {
    el.addEventListener('click', () => {
      const targetId = el.dataset.jumpTo;
      if (!targetId) return;
      const target = listEl.querySelector(`[data-msg-id="${targetId}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('msg-highlight');
      setTimeout(() => target.classList.remove('msg-highlight'), 1500);
    });
  });
}

function _resolvePhoto(photoURL, nameOrLogin) {
  if (photoURL) return photoURL;
  const n = (nameOrLogin || '').toLowerCase();
  if (n.includes('bianca')) return 'assets/images/bianca.jpeg';
  if (n.includes('luan'))   return 'assets/images/luan.jpg';
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
  if (d.toLocaleDateString('pt-BR') === today.toLocaleDateString('pt-BR'))
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
      body:               msg.text?.length > 100 ? msg.text.substring(0, 100) + '...' : (msg.text || ''),
      icon:               'assets/images/icon-any-192.png',
      badge:              'assets/images/icon-any-96.png',
      tag:                'chat-incoming',
      renotify:           true,
      requireInteraction: false,
      vibrate:            [200, 100, 200],
      data:               { type: 'chat' }
    });
  } catch (_) {}
}

// ================================================================
// CONV DOC LISTENER
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
// PERFIS
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

  const user  = _currentOtherUser;
  const photo = _resolvePhoto(user.photoURL, user.name || user.login);

  const avatarEl = document.getElementById('profileAvatar');
  const fallback = document.getElementById('profileAvatarFallback');
  if (avatarEl && photo) {
    avatarEl.src = photo; avatarEl.style.display = '';
    if (fallback) fallback.style.display = 'none';
  } else {
    if (avatarEl) avatarEl.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
  }

  const nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = user.name || 'Contato';

  const phoneEl = document.getElementById('profilePhone');
  if (phoneEl) {
    phoneEl.textContent = '';
    db.collection('users').doc(user.id).get().then(snap => {
      if (snap.exists && snap.data().phone) phoneEl.textContent = _formatPhone(snap.data().phone);
    }).catch(() => {});
  }

  panel.style.display = 'flex';
}

function _closeProfile() {
  const panel = document.getElementById('chatProfilePanel');
  if (panel) panel.style.display = 'none';
}

// ================================================================
// AÇÕES DA CONVERSA
// ================================================================

async function _clearConversation() {
  _closeOptions();
  if (!_currentConvId) return;
  if (!confirm('Apagar todas as mensagens desta conversa? Esta ação não pode ser desfeita.')) return;
  try {
    const msgsRef = db.collection('conversations').doc(_currentConvId).collection('messages');
    const snap    = await msgsRef.get();
    let batch = db.batch(); let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count > 0) await batch.commit();
    await db.collection('conversations').doc(_currentConvId).update({ lastMessage: null, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Chat] Erro ao limpar:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível limpar a conversa.', 'error'));
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
    _stopMsgListener(); _currentConvId = null; _currentOtherUser = null; _lastTimestamp = null;
    _showView('chatViewList');
    import('./utils.js').then(({ showAlert }) =>
      showAlert(isArch ? 'Conversa restaurada.' : 'Conversa arquivada.', 'success')
    );
  } catch (err) {
    console.error('[Chat] Erro ao arquivar:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Erro ao arquivar.', 'error'));
  }
}

async function _deleteConversation() {
  _closeOptions();
  if (!_currentConvId) return;
  if (!confirm('Excluir esta conversa permanentemente?')) return;
  try {
    const convRef = db.collection('conversations').doc(_currentConvId);
    const snap    = await convRef.collection('messages').get();
    let batch = db.batch(); let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count > 0) await batch.commit();
    await convRef.delete();
    _stopMsgListener(); _currentConvId = null; _currentOtherUser = null; _lastTimestamp = null;
    _showView('chatViewList');
    import('./utils.js').then(({ showAlert }) => showAlert('Conversa excluída.', 'success'));
  } catch (err) {
    console.error('[Chat] Erro ao excluir:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível excluir.', 'error'));
  }
}

async function _deleteMessage(msgId) {
  if (!_currentConvId || !state.currentUser) return;
  if (!confirm('Apagar esta mensagem para você?')) return;
  try {
    const convRef = db.collection('conversations').doc(_currentConvId);
    await convRef.collection('messages').doc(msgId).delete();
    // Atualiza lastMessage se necessário
    const msgsSnap = await convRef.collection('messages').orderBy('timestamp', 'desc').limit(1).get();
    if (msgsSnap.empty) {
      await convRef.update({ lastMessage: null, updatedAt: new Date().toISOString() });
    } else {
      const last = msgsSnap.docs[0].data();
      await convRef.update({
        lastMessage: { text: last.text || '', timestamp: last.timestamp, senderId: last.senderId },
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[Chat] Erro ao apagar mensagem:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível apagar a mensagem.', 'error'));
  }
}

// ================================================================
// UPLOAD DE IMAGEM
// ================================================================

async function _handleImageUpload(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    import('./utils.js').then(({ showAlert }) => showAlert('Selecione uma imagem válida.', 'error'));
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
    const msgId = generateId();
    const ext   = file.name.split('.').pop() || 'jpg';
    const path  = `chat-images/${_currentConvId}/${msgId}.${ext}`;
    const ref   = storage.ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();

    const now = new Date().toISOString();
    const me  = state.currentUser;
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
      lastMessage: { text: '📷 Foto', timestamp: now, senderId: me.id },
      updatedAt:   now
    });

    if (_currentOtherUser) {
      try {
        const doc   = await db.collection('users').doc(_currentOtherUser.id).get();
        const token = doc.exists ? doc.data().fcmToken : null;
        if (token) sendFCMPush(token, msg.senderName, '📷 Foto');
      } catch (_) {}
    }
  } catch (err) {
    console.error('[Chat] Erro ao enviar imagem:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível enviar a imagem.', 'error'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paperclip"></i>'; }
  }
}

// ================================================================
// ÁUDIO — GRAVAÇÃO E PLAYER
// ================================================================

function _getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus', 'audio/webm',
    'audio/ogg;codecs=opus',  'audio/ogg',
    'audio/mp4'
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function _fmtDuration(secs) {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

async function _startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    import('./utils.js').then(({ showAlert }) => showAlert('Gravação não suportada neste dispositivo.', 'error'));
    return;
  }
  try {
    _recStream  = await navigator.mediaDevices.getUserMedia({ audio: true });
    _audioChunks = [];
    const mime  = _getSupportedMimeType();
    _recorder   = new MediaRecorder(_recStream, mime ? { mimeType: mime } : {});
    _recorder.ondataavailable = e => { if (e.data?.size > 0) _audioChunks.push(e.data); };
    _recorder.onstop = _handleRecordingStop;
    _recorder.start(200);

    _recSeconds = 0;
    _showRecordingUI();
    _recTimer = setInterval(() => {
      _recSeconds++;
      _updateRecordingTimer();
      if (_recSeconds >= 120) _stopRecording(false); // máximo 2 min
    }, 1000);
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Permissão de microfone negada.'
      : 'Erro ao acessar microfone.';
    import('./utils.js').then(({ showAlert }) => showAlert(msg, 'error'));
  }
}

function _stopRecording(cancel = false) {
  if (!_recorder || _recorder.state === 'inactive') return;
  clearInterval(_recTimer);
  _recTimer = null;
  _hideRecordingUI();
  if (cancel) {
    _recorder.onstop = null;
    _audioChunks     = [];
    _recStream?.getTracks().forEach(t => t.stop());
    _recStream = null;
    _recorder.stop();
    _recorder  = null;
    return;
  }
  _recorder.stop(); // dispara onstop → _handleRecordingStop
}

async function _handleRecordingStop() {
  _recStream?.getTracks().forEach(t => t.stop());
  _recStream = null;
  _recorder  = null;

  const micBtn = document.getElementById('chatMicBtn');
  if (micBtn) { micBtn.disabled = false; micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>'; }

  if (_audioChunks.length === 0 || _recSeconds < 1) {
    _audioChunks = [];
    return;
  }
  const mime = _audioChunks[0]?.type || 'audio/webm';
  const blob = new Blob(_audioChunks, { type: mime });
  const dur  = _recSeconds;
  _audioChunks = [];
  await _sendAudioMessage(blob, mime, dur);
}

async function _sendAudioMessage(blob, mimeType, duration) {
  if (!storage || !_currentConvId || !state.currentUser) {
    import('./utils.js').then(({ showAlert }) => showAlert('Firebase Storage não disponível.', 'error'));
    return;
  }
  const micBtn = document.getElementById('chatMicBtn');
  if (micBtn) { micBtn.disabled = true; micBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
  try {
    const msgId = generateId();
    const ext   = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const ref   = storage.ref(`chat-audio/${_currentConvId}/${msgId}.${ext}`);
    await ref.put(blob, { contentType: mimeType });
    const url = await ref.getDownloadURL();

    const now = new Date().toISOString();
    const me  = state.currentUser;
    const msg = {
      id: msgId, senderId: me.id,
      senderName:  me.fullName || me.login,
      senderPhoto: _resolvePhoto(me.photoURL, me.fullName || me.login),
      text: '', audioUrl: url, audioDuration: duration,
      type: 'audio', timestamp: now
    };
    const convRef = db.collection('conversations').doc(_currentConvId);
    await convRef.collection('messages').doc(msgId).set(msg);
    await convRef.update({
      lastMessage: { text: '🎤 Áudio', timestamp: now, senderId: me.id },
      updatedAt: now
    });
    if (_currentOtherUser) {
      try {
        const doc   = await db.collection('users').doc(_currentOtherUser.id).get();
        const token = doc.exists ? doc.data().fcmToken : null;
        if (token) sendFCMPush(token, msg.senderName, '🎤 Áudio');
      } catch (_) {}
    }
  } catch (err) {
    console.error('[Chat] Erro ao enviar áudio:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível enviar o áudio.', 'error'));
  } finally {
    if (micBtn) { micBtn.disabled = false; micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>'; }
  }
}

function _showRecordingUI() {
  const micBtn = document.getElementById('chatMicBtn');
  if (micBtn) {
    micBtn.classList.add('chat-mic-recording');
    micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    micBtn.title = 'Parar';
  }

  let bar = document.getElementById('chatRecordingBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id        = 'chatRecordingBar';
    bar.className = 'chat-recording-bar';
    bar.innerHTML = `
      <button type="button" id="chatRecCancelBtn" class="chat-rec-cancel" aria-label="Cancelar">
        <i class="fa-solid fa-trash"></i>
      </button>
      <div class="chat-rec-wave">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <span id="chatRecTimer" class="chat-rec-timer">0:00</span>
    `;
    const form = document.getElementById('chatForm');
    if (form) form.parentNode.insertBefore(bar, form);
    document.getElementById('chatRecCancelBtn')
      ?.addEventListener('click', () => _stopRecording(true));
  }
  bar.style.display = 'flex';
}

function _hideRecordingUI() {
  const bar = document.getElementById('chatRecordingBar');
  if (bar) bar.style.display = 'none';
  const micBtn = document.getElementById('chatMicBtn');
  if (micBtn) {
    micBtn.classList.remove('chat-mic-recording');
    micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    micBtn.title     = 'Áudio';
    micBtn.disabled  = false;
  }
}

function _updateRecordingTimer() {
  const el = document.getElementById('chatRecTimer');
  if (el) el.textContent = _fmtDuration(_recSeconds);
}

function _bindAudioPlayers(listEl) {
  listEl.querySelectorAll('.chat-audio-player').forEach(player => {
    const btn    = player.querySelector('.chat-audio-play-btn');
    const progEl = player.querySelector('.chat-audio-progress-bar');
    const timeEl = player.querySelector('.chat-audio-time');
    const url    = player.dataset.audioUrl;
    if (!btn || !url) return;

    btn.addEventListener('click', () => {
      // Se outro áudio está tocando, para
      if (_activeAudio && _activeAudio._url !== url) {
        _activeAudio.pause();
        document.querySelectorAll('.chat-audio-play-btn i').forEach(i => {
          i.className = 'fa-solid fa-play';
        });
        document.querySelectorAll('.chat-audio-progress-bar').forEach(b => {
          b.style.width = '0%';
        });
        _activeAudio = null;
      }

      if (!_activeAudio) {
        const audio  = new Audio(url);
        audio._url   = url;
        _activeAudio = audio;

        audio.addEventListener('timeupdate', () => {
          const pct = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
          if (progEl) progEl.style.width = pct + '%';
          if (timeEl) timeEl.textContent = _fmtDuration(audio.currentTime);
        });
        audio.addEventListener('ended', () => {
          btn.querySelector('i').className = 'fa-solid fa-play';
          if (progEl) progEl.style.width = '0%';
          if (timeEl) timeEl.textContent  = _fmtDuration(audio.duration || 0);
          _activeAudio = null;
        });
        audio.play().catch(() => {});
        btn.querySelector('i').className = 'fa-solid fa-pause';
      } else if (_activeAudio.paused) {
        _activeAudio.play().catch(() => {});
        btn.querySelector('i').className = 'fa-solid fa-pause';
      } else {
        _activeAudio.pause();
        btn.querySelector('i').className = 'fa-solid fa-play';
      }
    });
  });
}

// ================================================================
// ARQUIVADAS
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
    const snap    = await db.collection('conversations')
      .where('participantIds', 'array-contains', state.currentUser.id).get();
    const me       = state.currentUser;
    const archived = snap.docs.map(d => d.data())
      .filter(conv => !!(conv.archived || {})[me.id])
      .sort((a, b) => ((b.updatedAt || b.createdAt || '') > (a.updatedAt || a.createdAt || '') ? 1 : -1));

    document.getElementById('archLoadingEl')?.remove();

    if (archived.length === 0) { if (emptyEl) emptyEl.style.display = 'flex'; return; }
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
        <button class="conv-unarchive-btn" data-conv-id="${esc(conv.id)}" title="Restaurar">
          <i class="fa-solid fa-box-open"></i>
        </button>`;

      item.querySelector('.conv-unarchive-btn')?.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          await db.collection('conversations').doc(e.currentTarget.dataset.convId)
            .update({ [`archived.${me.id}`]: false });
          _loadArchivedView();
        } catch (err) { console.error('[Chat] Erro ao restaurar:', err); }
      });

      item.addEventListener('click', () => _openConversation(conv.id, { id: otherId, name, photoURL: photo }));
      listEl.appendChild(item);
    });
  } catch (err) {
    console.error('[Chat] Erro ao carregar arquivadas:', err);
    document.getElementById('archLoadingEl')?.remove();
    document.getElementById('archivedListEl')?.insertAdjacentHTML('afterbegin',
      '<div class="srm srm-warn">Erro ao carregar arquivadas.</div>'
    );
  }
}

// ================================================================
// REAÇÕES
// ================================================================

const QUICK_REACTIONS = ['❤️','😂','😮','😢','😡','👍'];
const MORE_REACTIONS  = [
  '😍','🥰','😘','🤣','😅','😜','🤭','🤩',
  '🙏','👏','🔥','🎉','💯','✨','💔','😱',
  '😈','😔','😳','🤔','🙄','🥵','🥶','🤢',
  '😴','💀','🤡','👻','👎','✌️','🤞','🤙',
  '💪','🌹','🌟','🌈','🎂','🏆','⚽','🍻'
];

function _buildReactionsHtml(reactions, myId) {
  if (!reactions || typeof reactions !== 'object') return '';
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

  QUICK_REACTIONS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = em;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _toggleReaction(msgEl.dataset.msgId, em);
      _closeReactionBar();
    });
    bar.appendChild(btn);
  });

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button'; plusBtn.className = 'reaction-more-btn';
  plusBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
  plusBtn.addEventListener('click', e => { e.stopPropagation(); _showExpandedReactions(bar, msgEl); });
  bar.appendChild(plusBtn);

  msgEl.style.position = 'relative';
  const isMine = msgEl.dataset.msgMine === 'true';
  bar.style.position    = 'absolute';
  bar.style.bottom      = '100%';
  bar.style.marginBottom = '6px';
  if (isMine) bar.style.right = '40px';
  else         bar.style.left  = '40px';
  msgEl.appendChild(bar);
  _activeReactionBar = bar;
}

function _showExpandedReactions(bar, msgEl) {
  let grid = bar.querySelector('.reaction-expanded-grid');
  if (grid) { grid.remove(); return; }
  grid = document.createElement('div');
  grid.className = 'reaction-expanded-grid';
  MORE_REACTIONS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = em;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _toggleReaction(msgEl.dataset.msgId, em);
      _closeReactionBar();
    });
    grid.appendChild(btn);
  });
  bar.appendChild(grid);
}

function _closeReactionBar() {
  if (_activeReactionBar) { _activeReactionBar.remove(); _activeReactionBar = null; }
}

async function _toggleReaction(msgId, emoji) {
  if (!_currentConvId || !state.currentUser) return;
  const me = state.currentUser.id;
  try {
    const msgRef  = db.collection('conversations').doc(_currentConvId).collection('messages').doc(msgId);
    const snap    = await msgRef.get();
    if (!snap.exists) return;
    const reactions = snap.data().reactions || {};
    if (reactions[me] === emoji) delete reactions[me];
    else reactions[me] = emoji;
    await msgRef.update({ reactions });
  } catch (err) { console.error('[Chat] Erro ao reagir:', err); }
}

function _bindReactionBadges(listEl) {
  listEl.addEventListener('click', e => {
    const badge = e.target.closest('.chat-reaction-badge');
    if (!badge) return;
    const msgEl = badge.closest('.chat-msg');
    if (!msgEl) return;
    _toggleReaction(msgEl.dataset.msgId, badge.dataset.reactEmoji);
  });
}

function _bindReactTriggers(listEl) {
  listEl.querySelectorAll('.chat-react-trigger').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const msgEl = btn.closest('.chat-msg');
      if (msgEl) _showReactionBar(msgEl);
    });
  });
}

document.addEventListener('click', e => {
  if (_activeReactionBar && !_activeReactionBar.contains(e.target) && !e.target.closest('.chat-msg'))
    _closeReactionBar();
});

// ================================================================
// LONG PRESS → CONTEXT MENU (substitui só o edit)
// ================================================================

function _bindMsgLongPress(listEl) {
  if (listEl._lpBound) return;
  listEl._lpBound = true;

  let timer   = null;
  let lastTap = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };

  // Double-tap → reaction bar
  listEl.addEventListener('click', e => {
    if (e.target.closest('.chat-reaction-bar') || e.target.closest('.chat-reaction-badge')
        || e.target.closest('.chat-ctx-menu')) return;
    const msgEl = e.target.closest('.chat-msg');
    if (!msgEl) return;
    const now = Date.now();
    if (now - lastTap < 350) {
      e.preventDefault();
      _showReactionBar(msgEl);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });

  // Long-press → context menu
  listEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.chat-reaction-bar') || e.target.closest('.chat-react-trigger')
        || e.target.closest('.chat-ctx-menu')) return;
    const msgEl = e.target.closest('.chat-msg');
    if (!msgEl) return;
    timer = setTimeout(() => {
      timer = null;
      e.preventDefault();
      _showCtxMenu(msgEl, e.clientX, e.clientY);
    }, 500);
  });

  listEl.addEventListener('pointerup',     cancel);
  listEl.addEventListener('pointercancel', cancel);
  listEl.addEventListener('pointermove',   cancel);
  listEl.addEventListener('contextmenu', e => {
    if (e.target.closest('.chat-msg')) {
      e.preventDefault();
      const msgEl = e.target.closest('.chat-msg');
      _showCtxMenu(msgEl, e.clientX, e.clientY);
    }
  });
}

// ================================================================
// EDITAR MENSAGEM
// ================================================================

function _promptEdit(msgId, msgTs, msgText) {
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
  requestAnimationFrame(() => { input.focus(); input.setSelectionRange(0, input.value.length); });
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
    const msgRef = db.collection('conversations').doc(_currentConvId).collection('messages').doc(msgId);
    const msgSnap = await msgRef.get();
    const msgData = msgSnap.exists ? msgSnap.data() : null;

    await msgRef.update({ text: newText, editedAt: now });

    if (msgData) {
      const convSnap = await db.collection('conversations').doc(_currentConvId).get();
      if (convSnap.exists && convSnap.data().lastMessage?.timestamp === msgData.timestamp) {
        await db.collection('conversations').doc(_currentConvId).update({
          lastMessage: { text: newText, timestamp: msgData.timestamp, senderId: msgData.senderId }
        });
      }
    }
  } catch (err) {
    console.error('[Chat] Erro ao editar:', err);
    import('./utils.js').then(({ showAlert }) => showAlert('Não foi possível editar a mensagem.', 'error'));
  }
}
