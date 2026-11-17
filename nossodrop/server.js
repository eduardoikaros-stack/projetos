/**
 * NossoDrop — servidor de sinalização (lógica estudada do PairDrop,
 * implementação nossa, do zero — ver ENGENHARIA-REVERSA-PAIRDROP.md)
 * ------------------------------------------------------------------
 * Este servidor NÃO recebe arquivos. Ele só:
 *  1) serve a página (public/)
 *  2) apresenta dispositivos uns aos outros
 *  3) troca as mensagens de sinalização do WebRTC (offer/answer/ICE)
 *
 * Um aparelho pode estar em VÁRIAS salas ao mesmo tempo:
 *  - net:<hashDoIp>     mesma rede (automática)
 *  - code:<CODIGO>      sala temporária por código (internet)
 *  - secret:<hash>      aparelhos pareados (permanente, via segredo)
 *
 * Arquivos/textos vão direto entre navegadores (WebRTC, criptografado).
 */
'use strict';

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, app: 'NossoDrop', peersOnline: peerCount() }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/* ---------------- nomes amigáveis (animal + cor) ---------------- */
const ANIMAIS = ['Falcão', 'Coruja', 'Lobo', 'Raposa', 'Tucano', 'Onça', 'Golfinho', 'Panda', 'Coala', 'Águia', 'Tigre', 'Urso', 'Cervo', 'Garça', 'Jaguar', 'Lontra', 'Mico', 'Arara', 'Capivara', 'Quati'];
const CORES = ['Azul', 'Verde', 'Laranja', 'Violeta', 'Dourado', 'Prata', 'Coral', 'Turquesa', 'Índigo', 'Carmesim', 'Oliva', 'Âmbar', 'Celeste', 'Rosa'];
const gerarNome = () => `${ANIMAIS[crypto.randomInt(ANIMAIS.length)]} ${CORES[crypto.randomInt(CORES.length)]}`;
const gerarId = () => crypto.randomBytes(6).toString('hex');
function gerarCodigoSala() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alfabeto[crypto.randomInt(alfabeto.length)];
  return code;
}
const hash = (txt) => crypto.createHash('sha256').update(txt).digest('hex').slice(0, 32);

/* ---------------- salas (um aparelho em várias ao mesmo tempo) ---------------- */
const rooms = new Map(); // roomId -> Map(peerId -> ws)
const pairPending = new Map(); // pairKey -> { secret, creatorId, expira }

function peerCount() { let n = 0; for (const r of rooms.values()) n += r.size; return n; }
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'desconhecido';
}
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function peersSharingRoom(a, b) { return [...a.memberships].some((r) => b.memberships.has(r)); }
function isPaired(a, b) {
  return [...a.memberships].some((r) => r.startsWith('secret:') && b.memberships.has(r));
}
function publicPeer(ws, viewer) {
  return { id: ws.peerId, name: ws.displayName, device: ws.device || 'Computador', paired: viewer ? isPaired(viewer, ws) : false };
}
function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  const room = rooms.get(roomId);
  const jaEstava = room.has(ws.peerId);
  room.set(ws.peerId, ws);
  ws.memberships.add(roomId);
  if (!jaEstava) {
    for (const other of room.values()) {
      if (other !== ws) {
        send(other, { type: 'peer-joined', peer: publicPeer(ws, other) });
        send(ws, { type: 'peer-joined', peer: publicPeer(other, ws) });
      }
    }
  }
}
function leaveRoom(ws, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws.peerId);
    for (const other of room.values()) send(other, { type: 'peer-left', peerId: ws.peerId });
    if (room.size === 0) rooms.delete(roomId);
  }
  ws.memberships.delete(roomId);
}
function leaveAllRooms(ws) { for (const roomId of [...ws.memberships]) leaveRoom(ws, roomId); }
function visiblePeers(ws) {
  const vistos = new Map();
  for (const roomId of ws.memberships) {
    const room = rooms.get(roomId);
    if (!room) continue;
    for (const other of room.values()) {
      if (other !== ws) vistos.set(other.peerId, publicPeer(other, ws));
    }
  }
  return [...vistos.values()];
}
function codeRoomOf(ws) {
  for (const r of ws.memberships) if (r.startsWith('code:')) return r.slice(5);
  return null;
}
function sendRoomState(ws) {
  send(ws, {
    type: 'room-state',
    you: publicPeer(ws, null),
    peers: visiblePeers(ws),
    room: codeRoomOf(ws),
    roomType: codeRoomOf(ws) ? 'code' : 'network',
  });
}
/** quando o pareamento de alguém muda, todos que o veem precisam saber */
function refreshViewersOf(ws) {
  const viewers = new Set();
  for (const roomId of ws.memberships) {
    const room = rooms.get(roomId);
    if (room) for (const other of room.values()) if (other !== ws) viewers.add(other);
  }
  for (const v of viewers) send(v, { type: 'peer-updated', peer: publicPeer(ws, v) });
}

/* ---------------- conexões ---------------- */
wss.on('connection', (ws, req) => {
  ws.peerId = gerarId();
  ws.displayName = gerarNome();
  ws.device = 'Computador';
  ws.memberships = new Set();
  ws.isAlive = true;

  joinRoom(ws, `net:${hash(getClientIp(req))}`);
  sendRoomState(ws);

  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'set-name': {
        const name = String(msg.name || '').trim().slice(0, 40);
        if (msg.device) ws.device = String(msg.device).slice(0, 30);
        if (name) ws.displayName = name;
        refreshViewersOf(ws);
        sendRoomState(ws);
        break;
      }

      /* sala temporária por código (continua também na rede local) */
      case 'create-room': {
        joinRoom(ws, `code:${gerarCodigoSala()}`);
        sendRoomState(ws);
        break;
      }
      case 'join-room': {
        const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        if (!code) return send(ws, { type: 'error', message: 'Código inválido.' });
        joinRoom(ws, `code:${code}`);
        sendRoomState(ws);
        break;
      }
      case 'leave-room': {
        const code = codeRoomOf(ws);
        if (code) leaveRoom(ws, `code:${code}`);
        sendRoomState(ws);
        break;
      }

      /* ---- pareamento permanente (lógica do PairDrop) ----
         A pede pra parear -> servidor cria chave de 6 dígitos (vale 10 min)
         B digita a chave -> os dois recebem um SEGREDO guardado no aparelho
         Daí em diante, com o segredo, os dois se acham em qualquer rede. */
      case 'pair-initiate': {
        for (const [k, v] of pairPending) if (v.expira < Date.now() || v.creatorId === ws.peerId) pairPending.delete(k);
        const pairKey = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const secret = crypto.randomBytes(32).toString('hex');
        pairPending.set(pairKey, { secret, creatorId: ws.peerId, expira: Date.now() + 10 * 60 * 1000 });
        ws.pendingPairKey = pairKey;
        send(ws, { type: 'pair-key', pairKey });
        break;
      }
      case 'pair-join': {
        const key = String(msg.pairKey || '').replace(/\D/g, '').slice(0, 6);
        const pending = pairPending.get(key);
        if (!pending || pending.expira < Date.now()) {
          pairPending.delete(key);
          return send(ws, { type: 'error', message: 'Chave de pareamento inválida ou expirada. Peça uma nova.' });
        }
        if (pending.creatorId === ws.peerId) return send(ws, { type: 'error', message: 'Essa é a sua própria chave 😅' });
        pairPending.delete(key);
        const creator = [...wss.clients].find((c) => c.peerId === pending.creatorId);
        joinRoom(ws, `secret:${hash(pending.secret)}`);
        if (creator) joinRoom(creator, `secret:${hash(pending.secret)}`);
        send(ws, { type: 'paired', secret: pending.secret });
        if (creator) {
          send(creator, { type: 'paired', secret: pending.secret });
          refreshViewersOf(creator);
        }
        sendRoomState(ws);
        refreshViewersOf(ws);
        break;
      }
      case 'pair-cancel': {
        if (ws.pendingPairKey) pairPending.delete(ws.pendingPairKey);
        ws.pendingPairKey = null;
        break;
      }
      /* ao abrir, o aparelho apresenta os segredos que já tem guardados */
      case 'join-secrets': {
        const secrets = Array.isArray(msg.secrets) ? msg.secrets.filter((x) => typeof x === 'string' && x.length >= 32) : [];
        for (const secret of secrets.slice(0, 50)) joinRoom(ws, `secret:${hash(secret)}`);
        sendRoomState(ws);
        break;
      }

      /* sinalização WebRTC: só entre quem divide alguma sala */
      case 'signal': {
        let target = null;
        for (const roomId of ws.memberships) {
          const found = rooms.get(roomId)?.get(msg.to);
          if (found) { target = found; break; }
        }
        if (target && target.readyState === 1) send(target, { type: 'signal', from: ws.peerId, data: msg.data });
        break;
      }
      default: break;
    }
  });

  ws.on('close', () => leaveAllRooms(ws));
  ws.on('error', () => leaveAllRooms(ws));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { leaveAllRooms(ws); ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* noop */ }
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`\n  🪂  NossoDrop no ar!`);
  console.log(`  → Local:   http://localhost:${PORT}`);
  console.log(`  → Rede:    http://<seu-ip-na-rede>:${PORT}\n`);
});
