/**
 * NossoDrop — servidor de sinalização
 * ------------------------------------------------------------------
 * Este servidor NÃO recebe arquivos. Ele só:
 *  1) serve a página (public/)
 *  2) apresenta dispositivos que estão na mesma rede / mesma sala
 *  3) troca as mensagens de sinalização do WebRTC (offer/answer/ICE)
 *
 * Os arquivos e textos trafegam direto entre os navegadores (P2P),
 * criptografados pelo próprio WebRTC (DTLS/SRTP).
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

/* ------------------------------------------------------------------ */
/* Nomes amigáveis (estilo PairDrop: "animal + cor")                   */
/* ------------------------------------------------------------------ */
const ANIMAIS = [
  'Falcão', 'Coruja', 'Lobo', 'Raposa', 'Tucano', 'Onça', 'Golfinho',
  'Panda', 'Coala', 'Águia', 'Tigre', 'Urso', 'Cervo', 'Garça',
  'Jaguar', 'Lontra', 'Mico', 'Arara', 'Capivara', 'Quati',
];
const CORES = [
  'Azul', 'Verde', 'Laranja', 'Violeta', 'Dourado', 'Prata', 'Coral',
  'Turquesa', 'Índigo', 'Carmesim', 'Oliva', 'Âmbar', 'Celeste', 'Rosa',
];

function gerarNome() {
  const a = ANIMAIS[crypto.randomInt(ANIMAIS.length)];
  const c = CORES[crypto.randomInt(CORES.length)];
  return `${a} ${c}`;
}

function gerarId() {
  return crypto.randomBytes(6).toString('hex'); // 12 chars
}

function gerarCodigoSala() {
  // Código curto, sem caracteres confusos (0/O, 1/I)
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alfabeto[crypto.randomInt(alfabeto.length)];
  return code;
}

/* ------------------------------------------------------------------ */
/* Salas:  net:<hashDoIp>  (rede local)  |  code:<CODIGO>  (remota)    */
/* ------------------------------------------------------------------ */
const rooms = new Map(); // roomId -> Map(peerId -> ws)

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'desconhecido';
}

function peerCount() {
  let n = 0;
  for (const room of rooms.values()) n += room.size;
  return n;
}

function publicPeer(ws) {
  return {
    id: ws.peerId,
    name: ws.displayName,
    device: ws.device || 'Computador',
  };
}

function joinRoom(ws, roomId) {
  leaveRoom(ws, true);
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  rooms.get(roomId).set(ws.peerId, ws);
  ws.roomId = roomId;
}

function leaveRoom(ws, silent = false) {
  if (!ws.roomId) return;
  const room = rooms.get(ws.roomId);
  if (room) {
    room.delete(ws.peerId);
    if (!silent) broadcast(room, { type: 'peer-left', peerId: ws.peerId }, ws);
    if (room.size === 0) rooms.delete(ws.roomId);
  }
  ws.roomId = null;
}

function roomPeers(ws) {
  const room = rooms.get(ws.roomId);
  if (!room) return [];
  return [...room.values()].filter((p) => p !== ws).map(publicPeer);
}

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const client of room.values()) {
    if (client !== except && client.readyState === 1) client.send(data);
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function sendRoomState(ws) {
  const isCode = ws.roomId && ws.roomId.startsWith('code:');
  send(ws, {
    type: 'room-state',
    you: publicPeer(ws),
    peers: roomPeers(ws),
    room: isCode ? ws.roomId.slice(5) : null, // código visível (se sala remota)
    roomType: isCode ? 'code' : 'network',
  });
}

/* ------------------------------------------------------------------ */
/* WebSocket                                                           */
/* ------------------------------------------------------------------ */
wss.on('connection', (ws, req) => {
  ws.peerId = gerarId();
  ws.displayName = gerarNome();
  ws.device = 'Computador';
  ws.isAlive = true;

  const ip = getClientIp(req);
  joinRoom(ws, `net:${hashIp(ip)}`);
  sendRoomState(ws);

  // avisa os outros da sala
  const room = rooms.get(ws.roomId);
  if (room) broadcast(room, { type: 'peer-joined', peer: publicPeer(ws) }, ws);

  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'set-name': {
        const name = String(msg.name || '').trim().slice(0, 40);
        if (name) {
          ws.displayName = name;
          const r = rooms.get(ws.roomId);
          if (r) broadcast(r, { type: 'peer-updated', peer: publicPeer(ws) }, ws);
          sendRoomState(ws);
        }
        if (msg.device) ws.device = String(msg.device).slice(0, 30);
        break;
      }

      case 'create-room': {
        const code = gerarCodigoSala();
        joinRoom(ws, `code:${code}`);
        sendRoomState(ws);
        break;
      }

      case 'join-room': {
        const code = String(msg.code || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 12);
        if (!code) return send(ws, { type: 'error', message: 'Código inválido.' });
        joinRoom(ws, `code:${code}`);
        sendRoomState(ws);
        // quem já estava na sala precisa conhecer o novo peer
        const r = rooms.get(ws.roomId);
        if (r) broadcast(r, { type: 'peer-joined', peer: publicPeer(ws) }, ws);
        break;
      }

      case 'leave-room': {
        joinRoom(ws, `net:${hashIp(getClientIp(req))}`);
        sendRoomState(ws);
        const r = rooms.get(ws.roomId);
        if (r) broadcast(r, { type: 'peer-joined', peer: publicPeer(ws) }, ws);
        break;
      }

      // Sinalização WebRTC: só repassa para o destinatário da mesma sala
      case 'signal': {
        const r = rooms.get(ws.roomId);
        const target = r && r.get(msg.to);
        if (target && target.readyState === 1) {
          send(target, { type: 'signal', from: ws.peerId, data: msg.data });
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

// heartbeat: derruba conexões mortas
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      leaveRoom(ws);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* noop */ }
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`\n  🪂  NossoDrop no ar!`);
  console.log(`  → Local:   http://localhost:${PORT}`);
  console.log(`  → Rede:    http://<seu-ip-na-rede>:${PORT}  (mesma rede Wi-Fi descobre sozinho)\n`);
});
