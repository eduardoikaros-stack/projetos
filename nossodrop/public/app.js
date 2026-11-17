/**
 * NossoDrop — cliente
 * Descoberta via WebSocket (servidor de sinalização) e transferência
 * direta entre navegadores via WebRTC DataChannel (P2P, criptografado).
 */
'use strict';

/* ============================== utilidades ============================== */
const $ = (id) => document.getElementById(id);

const els = {
  connDot: $('connDot'), connText: $('connText'),
  radar: $('radar'), peersLayer: $('peersLayer'), emptyState: $('emptyState'),
  meAvatar: $('meAvatar'), myAvatarPreview: $('myAvatarPreview'),
  myName: $('myName'), saveName: $('saveName'), deviceInfo: $('deviceInfo'),
  roomNetwork: $('roomNetwork'), roomActive: $('roomActive'),
  createRoom: $('createRoom'), joinCode: $('joinCode'), joinRoom: $('joinRoom'),
  roomCodeLabel: $('roomCodeLabel'), copyCode: $('copyCode'), copyLink: $('copyLink'),
  leaveRoom: $('leaveRoom'), qrBox: $('qrBox'),
  transfers: $('transfers'), noTransfers: $('noTransfers'), clearHistory: $('clearHistory'),
  peerModal: $('peerModal'), modalAvatar: $('modalAvatar'), modalPeerName: $('modalPeerName'),
  modalPeerMeta: $('modalPeerMeta'), modalSendFile: $('modalSendFile'), modalSendText: $('modalSendText'),
  textModal: $('textModal'), textModalTo: $('textModalTo'), textInput: $('textInput'), sendTextBtn: $('sendTextBtn'),
  fileInput: $('fileInput'), dropOverlay: $('dropOverlay'), dropHint: $('dropHint'),
  toasts: $('toasts'),
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

function avatarStyle(el, name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  el.style.background = `linear-gradient(135deg, hsl(${hash} 75% 55%), hsl(${(hash + 60) % 360} 80% 45%))`;
  el.textContent = initials(name);
}

function toast(msg, isError = false, ms = 4200) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.textContent = msg;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function detectDevice() {
  const ua = navigator.userAgent;
  const type = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'Celular' : 'Computador';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const icon = type === 'Celular' ? '📱' : type === 'Tablet' ? '📲' : '💻';
  return { type, browser, icon, label: `${icon} ${type} · ${browser}` };
}
const myDevice = detectDevice();
els.deviceInfo.textContent = `Este aparelho: ${myDevice.label} — arquivos vão direto ao destino, sem passar por nuvem.`;

/* ============================== estado ============================== */
let ws = null;
let myId = null;
let myName = localStorage.getItem('nossodrop-name') || '';
let roomCode = null;
let announced = false; // já enviou nome+dispositivo ao servidor
let joinedFromUrl = false;

const peers = new Map();       // peerId -> {id, name, device}
const connections = new Map(); // peerId -> RTC wrapper
let selectedPeerId = null;
let pendingDropFiles = null;

/* ============================== WebSocket ============================== */
function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function connect() {
  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    els.connDot.className = 'dot dot-on';
    els.connText.textContent = 'Conectado';
    announced = false;
    // sala vinda do link (?room=CODIGO)
    const fromUrl = new URLSearchParams(location.search).get('room');
    if (fromUrl && !joinedFromUrl) {
      joinedFromUrl = true;
      sendWs({ type: 'join-room', code: fromUrl });
    }
  };

  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    switch (msg.type) {
      case 'room-state': {
        myId = msg.you.id;
        if (!myName) myName = msg.you.name;
        els.myName.value = myName;
        avatarStyle(els.meAvatar, myName);
        avatarStyle(els.myAvatarPreview, myName);
        roomCode = msg.roomType === 'code' ? msg.room : null;
        renderRoom();
        peers.clear();
        msg.peers.forEach((p) => peers.set(p.id, p));
        renderPeers();
        if (!announced) {
          announced = true;
          sendWs({ type: 'set-name', name: myName, device: myDevice.label });
        }
        break;
      }
      case 'peer-joined':
        peers.set(msg.peer.id, msg.peer);
        renderPeers();
        toast(`👋 ${msg.peer.name} entrou`);
        break;
      case 'peer-updated':
        peers.set(msg.peer.id, msg.peer);
        renderPeers();
        break;
      case 'peer-left': {
        const peer = peers.get(msg.peerId);
        peers.delete(msg.peerId);
        closeConnection(msg.peerId);
        renderPeers();
        if (peer) toast(`👋 ${peer.name} saiu`);
        break;
      }
      case 'signal':
        handleSignal(msg.from, msg.data).catch((e) => console.error(e));
        break;
      case 'error':
        toast(msg.message || 'Algo deu errado.', true);
        break;
    }
  };

  ws.onclose = () => {
    els.connDot.className = 'dot dot-off';
    els.connText.textContent = 'Reconectando…';
    peers.clear();
    renderPeers();
    setTimeout(connect, 2000);
  };
}

function sendWs(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/* ============================== sala ============================== */
function roomLink() {
  return `${location.origin}${location.pathname}?room=${roomCode}`;
}

function renderRoom() {
  const active = !!roomCode;
  els.roomNetwork.classList.toggle('hidden', active);
  els.roomActive.classList.toggle('hidden', !active);
  if (active) {
    els.roomCodeLabel.textContent = roomCode;
    history.replaceState(null, '', `?room=${roomCode}`);
    renderQr();
  } else {
    history.replaceState(null, '', location.pathname);
  }
}

function renderQr() {
  els.qrBox.innerHTML = '';
  const make = () => {
    if (window.QRCode) {
      // eslint-disable-next-line no-new
      new window.QRCode(els.qrBox, { text: roomLink(), width: 160, height: 160 });
    }
  };
  if (window.QRCode) make();
  else setTimeout(make, 700); // aguarda o script defer carregar
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    toast('Não consegui copiar automaticamente — copie manualmente.', true);
  }
}

els.createRoom.onclick = () => sendWs({ type: 'create-room' });
els.joinRoom.onclick = () => {
  const code = els.joinCode.value.trim();
  if (!code) return toast('Digite o código da sala primeiro.', true);
  sendWs({ type: 'join-room', code });
};
els.joinCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.joinRoom.click(); });
els.leaveRoom.onclick = () => sendWs({ type: 'leave-room' });
els.copyCode.onclick = () => copyText(roomCode, 'Código copiado!');
els.copyLink.onclick = () => copyText(roomLink(), 'Link da sala copiado!');

/* ============================== nome ============================== */
function saveMyName() {
  const name = els.myName.value.trim();
  if (!name) return;
  myName = name.slice(0, 40);
  localStorage.setItem('nossodrop-name', myName);
  avatarStyle(els.meAvatar, myName);
  avatarStyle(els.myAvatarPreview, myName);
  sendWs({ type: 'set-name', name: myName, device: myDevice.label });
  toast('Nome atualizado!');
}
els.saveName.onclick = saveMyName;
els.myName.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveMyName(); });

/* ============================== lista de dispositivos ============================== */
function renderPeers() {
  els.peersLayer.innerHTML = '';
  els.emptyState.style.display = peers.size ? 'none' : 'block';

  const list = [...peers.values()];
  list.forEach((peer, i) => {
    // distribui os dispositivos em volta do centro, no anel externo do radar
    const angle = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radiusPct = 34;
    const x = 50 + radiusPct * Math.cos(angle);
    const y = 50 + radiusPct * Math.sin(angle);

    const btn = document.createElement('button');
    btn.className = 'peer-bubble';
    btn.style.left = `${x}%`;
    btn.style.top = `${y}%`;
    btn.title = `Enviar para ${peer.name}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatarStyle(avatar, peer.name);
    const name = document.createElement('span');
    name.className = 'peer-name';
    name.textContent = peer.name;
    const device = document.createElement('span');
    device.className = 'peer-device';
    device.textContent = peer.device || '';

    btn.append(avatar, name, device);
    btn.onclick = () => onPeerClick(peer.id);
    els.peersLayer.appendChild(btn);
  });
}

function onPeerClick(peerId) {
  if (pendingDropFiles?.length) {
    const files = pendingDropFiles;
    pendingDropFiles = null;
    sendFilesTo(peerId, files);
    return;
  }
  openPeerModal(peerId);
}

/* ============================== modais ============================== */
function openModal(el) { el.classList.remove('hidden'); }
function closeModal(el) { el.classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('.modal-backdrop').classList.add('hidden')));
[els.peerModal, els.textModal].forEach((m) =>
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));

function openPeerModal(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  selectedPeerId = peerId;
  avatarStyle(els.modalAvatar, peer.name);
  els.modalPeerName.textContent = peer.name;
  els.modalPeerMeta.textContent = peer.device || '';
  openModal(els.peerModal);
}

els.modalSendFile.onclick = () => {
  closeModal(els.peerModal);
  els.fileInput.click();
};

els.modalSendText.onclick = () => {
  closeModal(els.peerModal);
  const peer = peers.get(selectedPeerId);
  els.textModalTo.textContent = peer ? `Para: ${peer.name}` : '';
  els.textInput.value = '';
  openModal(els.textModal);
  els.textInput.focus();
};

els.fileInput.onchange = () => {
  const files = [...els.fileInput.files];
  els.fileInput.value = '';
  if (files.length && selectedPeerId) sendFilesTo(selectedPeerId, files);
};

els.sendTextBtn.onclick = async () => {
  const text = els.textInput.value.trim();
  if (!text || !selectedPeerId) return;
  closeModal(els.textModal);
  try {
    await sendTextTo(selectedPeerId, text);
    toast(`💬 Texto enviado para ${peers.get(selectedPeerId)?.name || 'dispositivo'}`);
  } catch {
    toast('Não consegui conectar nesse dispositivo. Ele ainda está na sala?', true);
  }
};

/* ============================== WebRTC ============================== */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function getOrCreateConnection(peerId) {
  if (connections.has(peerId)) return connections.get(peerId);

  const pc = new RTCPeerConnection(RTC_CONFIG);
  const conn = {
    pc,
    channel: null,
    makingOffer: false,
    queue: Promise.resolve(), // fila serial de envios por dispositivo
    incoming: null,            // transferência recebida em andamento
    openWaiters: [],
  };
  connections.set(peerId, conn);

  pc.onicecandidate = (e) => {
    if (e.candidate) sendWs({ type: 'signal', to: peerId, data: { candidate: e.candidate } });
  };
  pc.ondatachannel = (e) => setupChannel(peerId, e.channel);
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(pc.connectionState)) closeConnection(peerId);
  };
  return conn;
}

function closeConnection(peerId) {
  const conn = connections.get(peerId);
  if (!conn) return;
  try { conn.channel?.close(); } catch { /* noop */ }
  try { conn.pc.close(); } catch { /* noop */ }
  connections.delete(peerId);
}

async function handleSignal(peerId, data) {
  const conn = getOrCreateConnection(peerId);
  const pc = conn.pc;

  if (data.sdp) {
    const desc = data.sdp;
    const polite = myId > peerId; // desempate quando os dois oferecem ao mesmo tempo
    const collision = desc.type === 'offer' && (conn.makingOffer || pc.signalingState !== 'stable');
    if (collision && !polite) return;
    if (collision) await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});

    await pc.setRemoteDescription(desc);
    if (desc.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWs({ type: 'signal', to: peerId, data: { sdp: pc.localDescription } });
    }
  } else if (data.candidate) {
    try { await pc.addIceCandidate(data.candidate); }
    catch { /* candidato chegou antes da descrição remota: ignora */ }
  }
}

async function ensureChannel(peerId) {
  const conn = getOrCreateConnection(peerId);
  if (!conn.channel) {
    setupChannel(peerId, conn.pc.createDataChannel('nossodrop', { ordered: true }));
    conn.makingOffer = true;
    try {
      const offer = await conn.pc.createOffer();
      await conn.pc.setLocalDescription(offer);
      sendWs({ type: 'signal', to: peerId, data: { sdp: conn.pc.localDescription } });
    } finally {
      conn.makingOffer = false;
    }
  }
  if (conn.channel.readyState === 'open') return conn.channel;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout ao conectar')), 20000);
    conn.openWaiters.push(() => { clearTimeout(timer); resolve(conn.channel); });
  });
}

function setupChannel(peerId, channel) {
  const conn = getOrCreateConnection(peerId);
  conn.channel = channel;
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = 256 * 1024;

  channel.onopen = () => {
    conn.openWaiters.splice(0).forEach((fn) => fn());
  };
  channel.onmessage = (e) => handleChannelMessage(peerId, e.data);
  channel.onclose = () => {
    if (connections.get(peerId)?.channel === channel) connections.get(peerId).channel = null;
  };
}

function enqueue(peerId, task) {
  const conn = getOrCreateConnection(peerId);
  conn.queue = conn.queue.then(task, task);
  return conn.queue;
}

/* ============================== envio ============================== */
const CHUNK = 64 * 1024; // 64 KB por pedaço

function sendFilesTo(peerId, files) {
  const peer = peers.get(peerId);
  files.forEach((file) => {
    const card = createTransferCard({ direction: 'up', name: file.name, size: file.size, peerName: peer?.name });
    enqueue(peerId, () => sendOneFile(peerId, file, card)).catch(() => {
      markError(card, 'Não foi possível conectar nesse dispositivo.');
    });
  });
}

async function sendOneFile(peerId, file, card) {
  const channel = await ensureChannel(peerId);
  const transferId = Math.random().toString(36).slice(2, 10);

  channel.send(JSON.stringify({
    type: 'file-header', transferId, name: file.name, size: file.size,
    mime: file.type || 'application/octet-stream',
  }));

  const started = Date.now();
  let offset = 0;
  while (offset < file.size) {
    if (channel.readyState !== 'open') throw new Error('canal fechado');
    if (channel.bufferedAmount > 1024 * 1024) {
      await new Promise((r) => setTimeout(r, 40));
      continue;
    }
    const slice = file.slice(offset, offset + CHUNK);
    const buf = await slice.arrayBuffer();
    channel.send(buf);
    offset += buf.byteLength;
    updateProgress(card, offset, file.size, started);
  }
  // arquivo vazio também entra no fluxo acima sem enviar pedaços: ok

  channel.send(JSON.stringify({ type: 'file-complete', transferId }));
  markDone(card, offset, started);
}

async function sendTextTo(peerId, text) {
  const channel = await ensureChannel(peerId);
  channel.send(JSON.stringify({ type: 'text', text }));
  const peer = peers.get(peerId);
  createTextCard({ direction: 'up', text, peerName: peer?.name, done: true });
}

/* ============================== recebimento ============================== */
function handleChannelMessage(peerId, data) {
  const conn = getOrCreateConnection(peerId);
  const peer = peers.get(peerId);

  if (typeof data === 'string') {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'file-header') {
      conn.incoming = {
        id: msg.transferId, name: msg.name, size: msg.size,
        mime: msg.mime, received: 0, chunks: [], started: Date.now(),
        card: createTransferCard({ direction: 'down', name: msg.name, size: msg.size, peerName: peer?.name }),
      };
      if (msg.size === 0) finishIncoming(peerId);
    } else if (msg.type === 'file-complete') {
      if (conn.incoming && conn.incoming.id === msg.transferId) finishIncoming(peerId);
    } else if (msg.type === 'text') {
      createTextCard({ direction: 'down', text: msg.text, peerName: peer?.name });
      toast(`💬 ${peer?.name || 'Um dispositivo'} te enviou um texto`);
    }
    return;
  }

  // dados binários = próximo pedaço do arquivo em andamento
  const inc = conn.incoming;
  if (!inc) return;
  inc.chunks.push(data);
  inc.received += data.byteLength;
  updateProgress(inc.card, inc.received, inc.size, inc.started);
  if (inc.received >= inc.size) finishIncoming(peerId);
}

function finishIncoming(peerId) {
  const conn = getOrCreateConnection(peerId);
  const inc = conn.incoming;
  if (!inc) return;
  conn.incoming = null;

  const blob = new Blob(inc.chunks, { type: inc.mime });
  const url = URL.createObjectURL(blob);
  attachDownload(inc.card, url, inc.name);
  markDone(inc.card, inc.received, inc.started);
  toast(`📥 Você recebeu "${inc.name}"`);
}

/* ============================== cartões de transferência ============================== */
function ensureTransfersVisible() { els.noTransfers?.remove(); }

function cardShell({ icon, name, meta }) {
  ensureTransfersVisible();
  const root = document.createElement('div');
  root.className = 'transfer';
  root.innerHTML = `
    <div class="t-icon"></div>
    <div>
      <div class="t-name"></div>
      <div class="t-meta"></div>
      <div class="bar"><div></div></div>
    </div>
    <div class="t-actions"></div>`;
  root.querySelector('.t-icon').textContent = icon;
  root.querySelector('.t-name').textContent = name;
  root.querySelector('.t-meta').textContent = meta;
  els.transfers.prepend(root);
  return {
    root,
    bar: root.querySelector('.bar'),
    fill: root.querySelector('.bar > div'),
    meta: root.querySelector('.t-meta'),
    actions: root.querySelector('.t-actions'),
  };
}

function createTransferCard({ direction, name, size, peerName }) {
  const icon = name.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? '🖼️'
    : name.match(/\.(mp4|mov|webm)$/i) ? '🎬'
    : name.match(/\.(mp3|wav|ogg)$/i) ? '🎵'
    : name.match(/\.(zip|rar|7z)$/i) ? '🗜️' : '📄';
  const who = direction === 'up' ? `para ${peerName || 'dispositivo'}` : `de ${peerName || 'dispositivo'}`;
  const card = cardShell({ icon, name, meta: `${who} · ${formatBytes(size)} · ${direction === 'up' ? 'enviando…' : 'recebendo…'}` });
  card.baseMeta = `${who} · ${formatBytes(size)}`;
  return card;
}

function createTextCard({ direction, text, peerName }) {
  const card = cardShell({
    icon: '💬',
    name: direction === 'up' ? `Texto para ${peerName || ''}` : `Texto de ${peerName || ''}`,
    meta: direction === 'up' ? 'texto enviado' : 'texto recebido',
  });
  card.bar.remove();
  const body = document.createElement('div');
  body.className = 't-text';
  body.textContent = text;
  card.root.appendChild(body);

  const copy = document.createElement('button');
  copy.className = 'btn btn-ghost btn-sm';
  copy.textContent = 'Copiar';
  copy.onclick = () => copyText(text, 'Texto copiado!');
  card.actions.appendChild(copy);
  if (/^https?:\/\//i.test(text.trim())) {
    const open = document.createElement('button');
    open.className = 'btn btn-ghost btn-sm';
    open.textContent = 'Abrir link';
    open.onclick = () => window.open(text.trim(), '_blank', 'noopener');
    card.actions.appendChild(open);
  }
  card.root.classList.add('is-done');
  return card;
}

function updateProgress(card, done, total, started) {
  if (!total) return;
  const pct = Math.min(100, Math.round((done / total) * 100));
  card.fill.style.width = `${pct}%`;
  const secs = Math.max((Date.now() - started) / 1000, 0.1);
  const speed = formatBytes(done / secs);
  card.meta.textContent = `${card.baseMeta} · ${pct}% · ${speed}/s`;
}

function markDone(card, total, started) {
  card.fill.style.width = '100%';
  card.bar.classList.add('done');
  const secs = Math.max((Date.now() - started) / 1000, 0.1);
  card.meta.textContent = `${card.baseMeta} · concluído em ${secs.toFixed(1)}s`;
  card.root.classList.add('is-done');
}

function markError(card, msg) {
  card.meta.textContent = `⚠️ ${msg}`;
  toast(msg, true);
}

function attachDownload(card, url, filename) {
  const a = document.createElement('a');
  a.className = 'btn btn-primary btn-sm';
  a.textContent = '⬇️ Baixar / Salvar';
  a.href = url;
  a.download = filename;
  card.actions.appendChild(a);
}

els.clearHistory.onclick = () => {
  els.transfers.querySelectorAll('.is-done').forEach((el) => el.remove());
  if (!els.transfers.children.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.id = 'noTransfers';
    p.textContent = 'Nada por aqui ainda. Envie ou receba um arquivo para ver o progresso.';
    els.transfers.appendChild(p);
    els.noTransfers = p;
  }
};

/* ============================== arrastar e soltar ============================== */
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  els.dropOverlay.classList.add('show');
  els.dropHint.textContent = peers.size === 1
    ? `soltar envia para ${[...peers.values()][0].name}`
    : peers.size > 1 ? 'depois toque no dispositivo de destino' : 'nenhum dispositivo conectado ainda';
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  if (--dragDepth <= 0) { dragDepth = 0; els.dropOverlay.classList.remove('show'); }
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.dropOverlay.classList.remove('show');
  const files = [...(e.dataTransfer?.files || [])];
  if (!files.length) return;
  if (peers.size === 0) return toast('Nenhum dispositivo conectado para receber. 😕', true);
  if (peers.size === 1) return sendFilesTo([...peers.keys()][0], files);
  pendingDropFiles = files;
  toast(`📁 ${files.length} arquivo(s) pronto(s) — agora toque no dispositivo de destino.`);
});

/* ============================== início ============================== */
if (myName) els.myName.value = myName;
connect();
