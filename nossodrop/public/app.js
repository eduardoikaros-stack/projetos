/**
 * NossoDrop — cliente (interface limpa, tipo chat)
 * Arrastar arquivos => envia. Digitar e enviar => texto.
 * Transferência direta entre navegadores via WebRTC (P2P, criptografado);
 * o servidor só apresenta os aparelhos (WebSocket de sinalização).
 */
'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  connDot: $('connDot'), peersBar: $('peersBar'), waitingChip: $('waitingChip'),
  chat: $('chat'), emptyState: $('emptyState'), emptyHint: $('emptyHint'),
  composerInput: $('composerInput'), sendBtn: $('sendBtn'), attachBtn: $('attachBtn'),
  fileInput: $('fileInput'), dropOverlay: $('dropOverlay'), toasts: $('toasts'),
  openRoomBtn: $('openRoomBtn'), roomModal: $('roomModal'),
  myName: $('myName'), saveName: $('saveName'), deviceInfo: $('deviceInfo'),
  roomNetwork: $('roomNetwork'), roomActive: $('roomActive'),
  createRoom: $('createRoom'), joinCode: $('joinCode'), joinRoom: $('joinRoom'),
  roomCodeLabel: $('roomCodeLabel'), copyCode: $('copyCode'), copyLink: $('copyLink'),
  leaveRoom: $('leaveRoom'), qrBox: $('qrBox'),
};

/* ---------------- utilidades ---------------- */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  return { label: `${icon} ${type} · ${browser}` };
}
const myDevice = detectDevice();
els.deviceInfo.textContent = `Este aparelho: ${myDevice.label}`;

/* ---------------- estado ---------------- */
let ws = null;
let myId = null;
let myName = localStorage.getItem('nossodrop-name') || '';
let roomCode = null;
let announced = false;
let joinedFromUrl = false;
let hasMessages = false;

const peers = new Map();       // peerId -> {id, name, device}
const connections = new Map(); // peerId -> wrapper RTC
let selectedPeerId = null;

function targetPeerId() {
  if (selectedPeerId && peers.has(selectedPeerId)) return selectedPeerId;
  return peers.size ? [...peers.keys()][0] : null;
}
function targetName() {
  const id = targetPeerId();
  return id ? peers.get(id).name : null;
}

/* ---------------- chat (bolhas) ---------------- */
function scrollDown() { els.chat.scrollTop = els.chat.scrollHeight; }
function hideEmpty() {
  hasMessages = true;
  els.emptyState.style.display = 'none';
}
function addSystem(text) {
  hideEmpty();
  const d = document.createElement('div');
  d.className = 'system-msg';
  d.textContent = text;
  els.chat.appendChild(d);
  scrollDown();
}
function addTextBubble(direction, text, peerName) {
  hideEmpty();
  const b = document.createElement('div');
  b.className = `bubble ${direction === 'up' ? 'me' : 'them'}`;

  const body = document.createElement('span');
  body.textContent = text;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = nowTime();
  b.append(body, meta);
  b.title = 'Toque para copiar';
  b.style.cursor = 'pointer';
  b.onclick = () => copyText(text, 'Copiado!');

  els.chat.appendChild(b);
  scrollDown();
  return b;
}
function fileIcon(name) {
  return name.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? '🖼️'
    : name.match(/\.(mp4|mov|webm)$/i) ? '🎬'
    : name.match(/\.(mp3|wav|ogg)$/i) ? '🎵'
    : name.match(/\.(zip|rar|7z)$/i) ? '🗜️' : '📄';
}
function addFileBubble(direction, name, size, peerName) {
  hideEmpty();
  const b = document.createElement('div');
  b.className = `bubble file ${direction === 'up' ? 'me' : 'them'}`;
  b.innerHTML = `
    <div class="file-head">
      <span class="file-icon"></span>
      <span><span class="file-name"></span><br><span class="file-size"></span></span>
    </div>
    <div class="bar"><div></div></div>
    <div class="file-status"></div>`;
  b.querySelector('.file-icon').textContent = fileIcon(name);
  b.querySelector('.file-name').textContent = name;
  b.querySelector('.file-size').textContent = formatBytes(size);
  b.querySelector('.file-status').textContent = direction === 'up'
    ? `Enviando para ${peerName || '…'}…` : `Recebendo de ${peerName || '…'}…`;
  els.chat.appendChild(b);
  scrollDown();
  return {
    root: b,
    bar: b.querySelector('.bar'),
    fill: b.querySelector('.bar > div'),
    status: b.querySelector('.file-status'),
    base: formatBytes(size),
  };
}
function bubbleProgress(card, done, total, started) {
  if (!total) return;
  const pct = Math.min(100, Math.round((done / total) * 100));
  card.fill.style.width = `${pct}%`;
  const secs = Math.max((Date.now() - started) / 1000, 0.1);
  card.status.textContent = `${pct}% · ${formatBytes(done / secs)}/s`;
}
function bubbleDone(card, total, started) {
  card.fill.style.width = '100%';
  card.bar.classList.add('done');
  const secs = Math.max((Date.now() - started) / 1000, 0.1);
  card.status.textContent = `✓ Concluído em ${secs.toFixed(1)}s · ${nowTime()}`;
  card.root.classList.add('is-done');
  scrollDown();
}
function bubbleError(card, msg) {
  card.status.textContent = `⚠️ ${msg}`;
}

/* ---------------- WebSocket ---------------- */
function sendWs(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => {
    els.connDot.className = 'dot dot-on';
    announced = false;
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
        roomCode = msg.roomType === 'code' ? msg.room : null;
        renderRoom();
        peers.clear();
        msg.peers.forEach((p) => peers.set(p.id, p));
        if (!selectedPeerId && peers.size) selectedPeerId = [...peers.keys()][0];
        renderPeers();
        if (!announced) {
          announced = true;
          sendWs({ type: 'set-name', name: myName, device: myDevice.label });
        }
        break;
      }
      case 'peer-joined':
        peers.set(msg.peer.id, msg.peer);
        if (!selectedPeerId) selectedPeerId = msg.peer.id;
        renderPeers();
        addSystem(`${msg.peer.name} entrou`);
        break;
      case 'peer-updated':
        peers.set(msg.peer.id, msg.peer);
        renderPeers();
        break;
      case 'peer-left': {
        const peer = peers.get(msg.peerId);
        peers.delete(msg.peerId);
        if (selectedPeerId === msg.peerId) selectedPeerId = null;
        closeConnection(msg.peerId);
        renderPeers();
        if (peer) addSystem(`👋 ${peer.name} saiu`);
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
    peers.clear();
    renderPeers();
    setTimeout(connect, 2000);
  };
}

/* ---------------- aparelhos (chips no topo) ---------------- */
function renderPeers() {
  els.peersBar.innerHTML = '';
  if (!peers.size) {
    const s = document.createElement('span');
    s.className = 'peer-chip muted';
    s.textContent = 'Aguardando…';
    els.peersBar.appendChild(s);
    els.emptyHint.textContent = 'Abra esta página em outro aparelho (mesma Wi-Fi) — ou toque em 🔗 e use uma sala.';
    return;
  }
  els.emptyHint.textContent = `${peers.size === 1 ? 'Aparelho conectado' : 'Aparelhos conectados'}: toque no nome aqui no topo para escolher o destino.`;
  peers.forEach((peer) => {
    const chip = document.createElement('button');
    chip.className = 'peer-chip' + (targetPeerId() === peer.id ? ' active' : '');
    chip.textContent = `${peer.device?.split(' ')[0] || '📟'} ${peer.name}`;
    chip.onclick = () => { selectedPeerId = peer.id; renderPeers(); };
    els.peersBar.appendChild(chip);
  });
}

/* ---------------- sala / nome (modal 🔗) ---------------- */
els.openRoomBtn.onclick = () => els.roomModal.classList.remove('hidden');
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('.modal-backdrop').classList.add('hidden')));
els.roomModal.addEventListener('click', (e) => { if (e.target === els.roomModal) els.roomModal.classList.add('hidden'); });

function roomLink() { return `${location.origin}${location.pathname}?room=${roomCode}`; }
function renderRoom() {
  const active = !!roomCode;
  els.roomNetwork.classList.toggle('hidden', active);
  els.roomActive.classList.toggle('hidden', !active);
  if (active) {
    els.roomCodeLabel.textContent = roomCode;
    history.replaceState(null, '', `?room=${roomCode}`);
    els.qrBox.innerHTML = '';
    const make = () => { if (window.QRCode) new window.QRCode(els.qrBox, { text: roomLink(), width: 150, height: 150 }); };
    window.QRCode ? make() : setTimeout(make, 700);
  } else {
    history.replaceState(null, '', location.pathname);
  }
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('Não consegui copiar automaticamente.', true); }
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
els.copyLink.onclick = () => copyText(roomLink(), 'Link copiado!');
function saveMyName() {
  const name = els.myName.value.trim();
  if (!name) return;
  myName = name.slice(0, 40);
  localStorage.setItem('nossodrop-name', myName);
  sendWs({ type: 'set-name', name: myName, device: myDevice.label });
  toast('Nome salvo!');
}
els.saveName.onclick = saveMyName;

/* ---------------- WebRTC ---------------- */
const RTC_CONFIG = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]};

function getOrCreateConnection(peerId) {
  if (connections.has(peerId)) return connections.get(peerId);
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const conn = { pc, channel: null, makingOffer: false, queue: Promise.resolve(), incoming: null, openWaiters: [] };
  connections.set(peerId, conn);
  pc.onicecandidate = (e) => { if (e.candidate) sendWs({ type: 'signal', to: peerId, data: { candidate: e.candidate } }); };
  pc.ondatachannel = (e) => setupChannel(peerId, e.channel);
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) closeConnection(peerId); };
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
    const polite = myId > peerId;
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
    try { await pc.addIceCandidate(data.candidate); } catch { /* cedo demais: ignora */ }
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
    } finally { conn.makingOffer = false; }
  }
  if (conn.channel.readyState === 'open') return conn.channel;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 20000);
    conn.openWaiters.push(() => { clearTimeout(timer); resolve(conn.channel); });
  });
}
function setupChannel(peerId, channel) {
  const conn = getOrCreateConnection(peerId);
  conn.channel = channel;
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = 256 * 1024;
  channel.onopen = () => conn.openWaiters.splice(0).forEach((fn) => fn());
  channel.onmessage = (e) => handleChannelMessage(peerId, e.data);
  channel.onclose = () => { if (connections.get(peerId)?.channel === channel) connections.get(peerId).channel = null; };
}
function enqueue(peerId, task) {
  const conn = getOrCreateConnection(peerId);
  conn.queue = conn.queue.then(task, task);
  return conn.queue;
}

/* ---------------- envio (arquivo = arrastar/clicar, texto = digitar) ---------------- */
const CHUNK = 64 * 1024;

function sendFiles(files) {
  const peerId = targetPeerId();
  if (!peerId) return toast('Nenhum aparelho conectado ainda. Abra a página em outro aparelho primeiro. 📱', true, 6000);
  const peer = peers.get(peerId);
  files.forEach((file) => {
    const card = addFileBubble('up', file.name, file.size, peer?.name);
    enqueue(peerId, () => sendOneFile(peerId, file, card))
      .catch(() => bubbleError(card, 'Não consegui conectar nesse aparelho.'));
  });
}
async function sendOneFile(peerId, file, card) {
  const channel = await ensureChannel(peerId);
  const transferId = Math.random().toString(36).slice(2, 10);
  channel.send(JSON.stringify({ type: 'file-header', transferId, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }));
  const started = Date.now();
  let offset = 0;
  while (offset < file.size) {
    if (channel.readyState !== 'open') throw new Error('canal fechado');
    if (channel.bufferedAmount > 1024 * 1024) { await new Promise((r) => setTimeout(r, 40)); continue; }
    const buf = await file.slice(offset, offset + CHUNK).arrayBuffer();
    channel.send(buf);
    offset += buf.byteLength;
    bubbleProgress(card, offset, file.size, started);
  }
  channel.send(JSON.stringify({ type: 'file-complete', transferId }));
  bubbleDone(card, offset, started);
}
async function sendComposerText() {
  const text = els.composerInput.value.trim();
  if (!text) return;
  const peerId = targetPeerId();
  if (!peerId) return toast('Nenhum aparelho conectado ainda. Abra a página em outro aparelho primeiro. 📱', true, 6000);
  els.composerInput.value = '';
  autoGrow();
  const peer = peers.get(peerId);
  addTextBubble('up', text, peer?.name);
  try {
    const channel = await ensureChannel(peerId);
    channel.send(JSON.stringify({ type: 'text', text }));
  } catch {
    toast('Não consegui entregar — o aparelho ainda está conectado?', true);
  }
}

/* ---------------- recebimento ---------------- */
function handleChannelMessage(peerId, data) {
  const conn = getOrCreateConnection(peerId);
  const peer = peers.get(peerId);
  if (typeof data === 'string') {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.type === 'file-header') {
      conn.incoming = {
        id: msg.transferId, name: msg.name, size: msg.size, mime: msg.mime,
        received: 0, chunks: [], started: Date.now(),
        card: addFileBubble('down', msg.name, msg.size, peer?.name),
      };
      if (msg.size === 0) finishIncoming(peerId);
    } else if (msg.type === 'file-complete') {
      if (conn.incoming?.id === msg.transferId) finishIncoming(peerId);
    } else if (msg.type === 'text') {
      addTextBubble('down', msg.text, peer?.name);
    }
    return;
  }
  const inc = conn.incoming;
  if (!inc) return;
  inc.chunks.push(data);
  inc.received += data.byteLength;
  bubbleProgress(inc.card, inc.received, inc.size, inc.started);
  if (inc.received >= inc.size) finishIncoming(peerId);
}
function finishIncoming(peerId) {
  const conn = getOrCreateConnection(peerId);
  const inc = conn.incoming;
  if (!inc) return;
  conn.incoming = null;
  const url = URL.createObjectURL(new Blob(inc.chunks, { type: inc.mime }));
  const a = document.createElement('a');
  a.className = 'download-btn';
  a.textContent = '⬇️ Baixar / Salvar';
  a.href = url;
  a.download = inc.name;
  inc.card.root.appendChild(a);
  bubbleDone(inc.card, inc.received, inc.started);
}

/* ---------------- digitar / anexar / arrastar / colar ---------------- */
function autoGrow() {
  els.composerInput.style.height = 'auto';
  els.composerInput.style.height = Math.min(els.composerInput.scrollHeight, 130) + 'px';
}
els.composerInput.addEventListener('input', autoGrow);
els.composerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComposerText(); }
});
els.composerInput.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); sendFiles(files); }
});
els.sendBtn.onclick = sendComposerText;
els.attachBtn.onclick = () => els.fileInput.click();
els.fileInput.onchange = () => {
  const files = [...els.fileInput.files];
  els.fileInput.value = '';
  if (files.length) sendFiles(files);
};

let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; els.dropOverlay.classList.add('show'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; els.dropOverlay.classList.remove('show'); } });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.dropOverlay.classList.remove('show');
  const files = [...(e.dataTransfer?.files || [])];
  // soltou texto puro (ex.: trecho arrastado de outra aba)? vira mensagem de texto
  if (!files.length) {
    const text = e.dataTransfer?.getData('text/plain')?.trim();
    if (text) { els.composerInput.value = text; autoGrow(); sendComposerText(); }
    return;
  }
  sendFiles(files);
});

/* ---------------- início ---------------- */
if (myName) els.myName.value = myName;
connect();
