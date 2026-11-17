/**
 * NossoDrop na NUVEM (Cloudflare Workers + Durable Objects)
 * ------------------------------------------------------------------
 * Por que este arquivo existe:
 * O GitHub Pages só mostra a página parada — não roda servidor.
 * O Render/outros grátis DORMEM. Pesquisando o mundo (ver
 * ../PESQUISA-DO-MUNDO.md), quem resolveu igual (ex.: o projeto
 * chinês PairDrop-cfw) colocou a sinalização num Durable Object da
 * Cloudflare: grátis, não dorme, sem cartão, endereço https próprio.
 *
 * Esta é a MESMA lógica do nosso server.js (que roda no computador
 * de casa), traduzida para a nuvem — implementação nossa, do zero.
 *
 * O que este servidor faz (e NÃO faz):
 *  - FAz: apresenta os aparelhos uns aos outros (salas: rede local,
 *    código temporário e pareamento permanente) e repassa os sinais
 *    do WebRTC.
 *  - NÃO faz: receber arquivos. Arquivo/texto vai DIRETO entre os
 *    navegadores (WebRTC criptografado), como sempre.
 *
 * A página (index.html/styles.css/app.js) é buscada do nosso próprio
 * GitHub Pages a cada visita — assim, quando a gente melhora a página,
 * o link da nuvem atualiza sozinho, sem precisar colar código de novo.
 */
'use strict';

/* ---------------- utilidades ---------------- */
const ANIMAIS = ['Falcão', 'Coruja', 'Lobo', 'Raposa', 'Tucano', 'Onça', 'Golfinho', 'Panda', 'Coala', 'Águia', 'Tigre', 'Urso', 'Cervo', 'Garça', 'Jaguar', 'Lontra', 'Mico', 'Arara', 'Capivara', 'Quati'];
const CORES = ['Azul', 'Verde', 'Laranja', 'Violeta', 'Dourado', 'Prata', 'Coral', 'Turquesa', 'Índigo', 'Carmesim', 'Oliva', 'Âmbar', 'Celeste', 'Rosa'];

function aleatorio(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
const gerarNome = () => `${ANIMAIS[aleatorio(ANIMAIS.length)]} ${CORES[aleatorio(CORES.length)]}`;
function gerarHex(bytes) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const gerarId = () => gerarHex(6);
const gerarSegredo = () => gerarHex(32);
function gerarCodigoSala() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alfabeto[aleatorio(alfabeto.length)];
  return code;
}
async function hash(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/* ================= SALA GLOBAL (Durable Object) =================
   Um único "salão" guarda todas as conexões — igual ao nosso
   servidor de casa. Usa hibernação: quando ninguém fala, ele
   "cochila" sem custo e acorda na hora que alguém chega (não é o
   "dormir" do Render: aqui ninguém espera 1 minuto).            */
export class Salao {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  /* ---------- anatomia básica ---------- */
  soquetes() { return this.ctx.getWebSockets(); }
  dados(ws) { try { return ws.deserializeAttachment() || {}; } catch { return {}; } }
  guardarDados(ws, d) { try { ws.serializeAttachment(d); } catch { /* socket morrendo */ } }
  enviar(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* idem */ } }
  visaoDe(ws) { const d = this.dados(ws); return { id: d.peerId, name: d.displayName || 'Aparelho', device: d.device || 'Computador', paired: false }; }

  publicPeer(dono, visorDados) {
    const p = { id: dono.peerId, name: dono.displayName || 'Aparelho', device: dono.device || 'Computador', paired: false };
    if (visorDados) {
      p.paired = dono.memberships.some((r) => r.startsWith('secret:') && visorDados.memberships.includes(r));
    }
    return p;
  }
  companheirosDeSala(d, sala) {
    const lista = [];
    for (const ws of this.soquetes()) {
      const o = this.dados(ws);
      if (o.peerId !== d.peerId && o.memberships && o.memberships.includes(sala)) lista.push([ws, o]);
    }
    return lista;
  }
  visiveis(d) {
    const vistos = new Map();
    for (const ws of this.soquetes()) {
      const o = this.dados(ws);
      if (o.peerId === d.peerId || !o.memberships) continue;
      if (o.memberships.some((r) => d.memberships.includes(r))) vistos.set(o.peerId, this.publicPeer(o, d));
    }
    return [...vistos.values()];
  }
  codeRoomOf(d) {
    const sala = (d.memberships || []).find((r) => r.startsWith('code:'));
    return sala ? sala.slice(5) : null;
  }
  sendRoomState(ws, d) {
    const code = this.codeRoomOf(d);
    this.enviar(ws, { type: 'room-state', you: this.publicPeer(d, null), peers: this.visiveis(d), room: code, roomType: code ? 'code' : 'network' });
  }
  refreshViewersOf(d) {
    const jaAvisados = new Set();
    for (const sala of d.memberships) {
      for (const [ws, o] of this.companheirosDeSala(d, sala)) {
        if (jaAvisados.has(o.peerId)) continue;
        jaAvisados.add(o.peerId);
        this.enviar(ws, { type: 'peer-updated', peer: this.publicPeer(d, o) });
      }
    }
  }
  joinRoom(ws, d, sala) {
    if (d.memberships.includes(sala)) return;
    d.memberships.push(sala);
    this.guardarDados(ws, d);
    for (const [outro, o] of this.companheirosDeSala(d, sala)) {
      this.enviar(outro, { type: 'peer-joined', peer: this.publicPeer(d, o) });
      this.enviar(ws, { type: 'peer-joined', peer: this.publicPeer(o, d) });
    }
  }
  leaveRoom(ws, d, sala) {
    d.memberships = d.memberships.filter((r) => r !== sala);
    this.guardarDados(ws, d);
    for (const [outro, o] of this.companheirosDeSala(d, sala)) {
      this.enviar(outro, { type: 'peer-left', peerId: d.peerId });
    }
  }

  /* ---------- entrada (upgrade p/ WebSocket) ---------- */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, app: 'NossoDrop-nuvem', peersOnline: this.soquetes().length });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Este endereço é só para aparelhos do NossoDrop.', { status: 426 });
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'rede-local';
    const par = new WebSocketPair();
    const cliente = par[0];
    const servidor = par[1];
    this.ctx.acceptWebSocket(servidor);
    const d = {
      peerId: gerarId(),
      displayName: gerarNome(),
      device: 'Computador',
      memberships: [`net:${await hash(ip)}`],
      pendingPairKey: null,
    };
    this.guardarDados(servidor, d);
    this.sendRoomState(servidor, d);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  /* ---------- mensagens (mesmo protocolo do servidor de casa) ---------- */
  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
    const d = this.dados(ws);
    if (!d.peerId) return;

    switch (msg.type) {
      case 'set-name': {
        const name = String(msg.name || '').trim().slice(0, 40);
        if (msg.device) d.device = String(msg.device).slice(0, 30);
        if (name) d.displayName = name;
        this.guardarDados(ws, d);
        this.refreshViewersOf(d);
        this.sendRoomState(ws, d);
        break;
      }

      /* sala temporária por código (continua também na rede local) */
      case 'create-room': {
        this.joinRoom(ws, d, `code:${gerarCodigoSala()}`);
        this.sendRoomState(ws, d);
        break;
      }
      case 'join-room': {
        const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        if (!code) return this.enviar(ws, { type: 'error', message: 'Código inválido.' });
        this.joinRoom(ws, d, `code:${code}`);
        this.sendRoomState(ws, d);
        break;
      }
      case 'leave-room': {
        const code = this.codeRoomOf(d);
        if (code) this.leaveRoom(ws, d, `code:${code}`);
        this.sendRoomState(ws, d);
        break;
      }

      /* ---- pareamento permanente (lógica do PairDrop, nosso código) ---- */
      case 'pair-initiate': {
        const pendentes = await this.ctx.storage.list({ prefix: 'par:' });
        for (const [k, v] of pendentes) {
          if (!v || v.expira < Date.now() || v.creatorId === d.peerId) await this.ctx.storage.delete(k);
        }
        let pairKey = null;
        for (let i = 0; i < 8 && !pairKey; i++) {
          const tentativa = String(aleatorio(1000000)).padStart(6, '0');
          if (!(await this.ctx.storage.get(`par:${tentativa}`))) pairKey = tentativa;
        }
        if (!pairKey) return this.enviar(ws, { type: 'error', message: 'Tente de novo em alguns segundos.' });
        await this.ctx.storage.put(`par:${pairKey}`, { secret: gerarSegredo(), creatorId: d.peerId, expira: Date.now() + 10 * 60 * 1000 });
        d.pendingPairKey = pairKey;
        this.guardarDados(ws, d);
        this.enviar(ws, { type: 'pair-key', pairKey });
        break;
      }
      case 'pair-join': {
        const key = String(msg.pairKey || '').replace(/\D/g, '').slice(0, 6);
        const pending = await this.ctx.storage.get(`par:${key}`);
        if (!pending || pending.expira < Date.now()) {
          if (pending) await this.ctx.storage.delete(`par:${key}`);
          return this.enviar(ws, { type: 'error', message: 'Chave de pareamento inválida ou expirada. Peça uma nova.' });
        }
        if (pending.creatorId === d.peerId) return this.enviar(ws, { type: 'error', message: 'Essa é a sua própria chave 😅' });
        await this.ctx.storage.delete(`par:${key}`);
        let criador = null;
        let criadorDados = null;
        for (const s of this.soquetes()) {
          const o = this.dados(s);
          if (o.peerId === pending.creatorId) { criador = s; criadorDados = o; }
        }
        const salaSegredo = `secret:${await hash(pending.secret)}`;
        this.joinRoom(ws, d, salaSegredo);
        if (criador) this.joinRoom(criador, criadorDados, salaSegredo);
        this.enviar(ws, { type: 'paired', secret: pending.secret });
        if (criador) {
          this.enviar(criador, { type: 'paired', secret: pending.secret });
          this.refreshViewersOf(criadorDados);
        }
        this.sendRoomState(ws, d);
        this.refreshViewersOf(d);
        break;
      }
      case 'pair-cancel': {
        if (d.pendingPairKey) {
          await this.ctx.storage.delete(`par:${d.pendingPairKey}`);
          d.pendingPairKey = null;
          this.guardarDados(ws, d);
        }
        break;
      }
      /* ao abrir, o aparelho apresenta os segredos que já tem guardados */
      case 'join-secrets': {
        const secrets = Array.isArray(msg.secrets) ? msg.secrets.filter((x) => typeof x === 'string' && x.length >= 32) : [];
        for (const secret of secrets.slice(0, 50)) this.joinRoom(ws, d, `secret:${await hash(secret)}`);
        this.sendRoomState(ws, d);
        break;
      }

      /* sinalização WebRTC: só entre quem divide alguma sala */
      case 'signal': {
        for (const s of this.soquetes()) {
          const o = this.dados(s);
          if (!o.memberships || o.peerId !== msg.to) continue;
          if (o.memberships.some((r) => d.memberships.includes(r))) {
            this.enviar(s, { type: 'signal', from: d.peerId, data: msg.data });
          }
          break;
        }
        break;
      }
      default: break;
    }
  }

  async webSocketClose(ws) {
    const d = this.dados(ws);
    if (!d.peerId) return;
    const avisados = new Set();
    for (const s of this.soquetes()) {
      if (s === ws) continue;
      const o = this.dados(s);
      if (!o.memberships || avisados.has(o.peerId)) continue;
      if (o.memberships.some((r) => d.memberships.includes(r))) {
        avisados.add(o.peerId);
        this.enviar(s, { type: 'peer-left', peerId: d.peerId });
      }
    }
    if (d.pendingPairKey) await this.ctx.storage.delete(`par:${d.pendingPairKey}`);
  }

  async webSocketError(ws) { return this.webSocketClose(ws); }
}

/* ================= página (buscada do nosso GitHub Pages) ================= */
const ORIGEM_PAGINA = 'https://eduardoikaros-stack.github.io/projetos/nossodrop/public';
const PAGINA_EMERGENCIA = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NossoDrop</title><body style="font-family:system-ui;text-align:center;padding:48px 20px;background:#0f1115;color:#e8eaf0"><div style="font-size:56px">🪂</div><h1>NossoDrop</h1><p>O servidor está ligado ✅ — só a página principal demorou a chegar.<br>Toque abaixo para tentar de novo.</p><button onclick="location.reload()" style="font-size:18px;padding:12px 22px;border-radius:12px;border:0;background:#4f8cff;color:#fff">Tentar de novo</button><script>setTimeout(()=>location.reload(),5000)</script></body></html>`;

async function servirPagina(url) {
  const caminho = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const ehHtml = caminho.endsWith('.html');
    const res = await fetch(ORIGEM_PAGINA + caminho, {
      cf: ehHtml ? { cacheEverything: false } : { cacheEverything: true, cacheTtl: 120 },
    });
    if (res.ok) return res;
  } catch { /* cai pra emergência abaixo */ }
  if (caminho === '/index.html' || caminho === '/') {
    return new Response(PAGINA_EMERGENCIA, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return new Response('Não encontrado', { status: 404 });
}

/* ================= entrada ================= */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws' || url.pathname === '/health') {
      const id = env.SALAO.idFromName('salao-global');
      return env.SALAO.get(id).fetch(request);
    }
    return servirPagina(url);
  },
};
