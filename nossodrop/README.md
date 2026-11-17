# 🪂 NossoDrop

**Nosso AirDrop, no navegador** — compartilhe arquivos e textos entre celular, tablet e computador, estilo [PairDrop](https://pairdrop.net), mas nosso.

- 📶 **Na mesma Wi-Fi:** os dispositivos se descobrem sozinhos (radar na tela)
- 🚪 **Longe:** crie uma **sala com código** de 6 letras (ou link/QR Code) e qualquer pessoa entra
- 📁 **Arquivos** (vários de uma vez, arrastar-e-soltar) com barra de progresso e velocidade
- 💬 **Texto/links** (senha, link, trecho de código) com botão de copiar
- 🔒 **Privado:** transferência **direta entre navegadores** via WebRTC (criptografado). O servidor só apresenta os dispositivos — **nunca vê seus arquivos**. Sem cadastro, sem nuvem, sem limite do servidor.

## Como rodar

```bash
cd nossodrop
npm install
npm start
```

Abra **http://localhost:3000** neste aparelho e, no outro aparelho (mesma Wi-Fi), abra `http://<IP-deste-computador>:3000` — os dois se enxergam automaticamente no radar.

Para acessar de onde quiser (internet), suba em qualquer hospedagem Node (Render, Railway, Fly.io, uma VPS…) — o `server.js` escuta na porta da variável `PORT`.

## Como usar

1. Abra a página nos dois dispositivos
2. Toque na bolha do outro dispositivo no radar
3. Escolha **Enviar arquivo(s)** ou **Enviar texto**
4. Quem recebe vê o progresso e clica em **Baixar/Salvar** (textos têm botão **Copiar**)

Dá também para **arrastar arquivos** para qualquer lugar da tela.

## Como funciona (arquitetura)

```
Navegador A ──WebSocket──┐
                          ├─► server.js (sinalização: descoberta + "apresentação")
Navegador B ──WebSocket──┘
Navegador A ══WebRTC DataChannel (P2P, criptografado)══ Navegador B
                    ▲ arquivos e textos passam SÓ aqui
```

| Peça | Arquivo |
|---|---|
| Servidor de sinalização (Express + `ws`, salas por rede/código, nomes automáticos) | `server.js` |
| Página | `public/index.html` |
| Interface (radar, salas com QR, progresso, drag-and-drop) | `public/styles.css` · `public/index.html` |
| WebRTC: conexão, envio em pedaços de 64 KB com controle de fluxo, recebimento e remontagem | `public/app.js` |

Descoberta na rede local: o servidor agrupa conexões pelo hash do IP público (quem está atrás do mesmo roteador cai na mesma sala). Salas remotas usam código (`code:<CODIGO>` no servidor).
