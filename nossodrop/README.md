# 🪂 NossoDrop

**Nosso AirDrop, no navegador** — compartilhe arquivos e textos entre celular, tablet e computador, estilo [PairDrop](https://pairdrop.net), mas nosso.

Interface **limpa, tipo chat**: arrastou arquivo → envia como bolha de arquivo; digitou embaixo e enviou → bolha de texto. Sem radar, sem painéis.

- 📶 **Na mesma Wi-Fi:** os dispositivos se descobrem sozinhos (nome aparece no topo)
- 🚪 **Longe:** crie uma **sala com código** de 6 letras (ou link/QR Code) no botão 🔗
- 📁 **Arquivos** (vários de uma vez, arrastar-e-soltar ou colar) com barra de progresso e velocidade
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

## Abrir e editar junto (sem depender de preview)

- **Editar junto no navegador (nós dois escrevemos no mesmo projeto):**
  abra https://github.dev/eduardoikaros-stack/projetos — é o editor do GitHub.
  Tudo que você salvar lá cai no mesmo repositório que eu edito aqui.
- **Rodar de verdade em casa (funciona tudo, inclusive enviar):**
  Windows: dois cliques em `iniciar-windows.bat` · Linux/Mac: `./iniciar.sh`
  Depois abra outro aparelho na mesma Wi-Fi em `http://<IP-do-PC>:3000`.
- **Só olhar a página:** pelo GitHub Pages do repositório (após juntar o branch na `main`).
  No Pages é só visualização — o envio precisa do servidor rodando (item acima).

## Sala com código (só nosso servidor) 🔗

Quem apresenta os aparelhos é **apenas o nosso `server.js`** (nada de
PeerJS ou central de terceiros). Na página: **Criar sala** gera um código,
o outro aparelho digita e conecta. Na mesma rede nem precisa de código.
Os dados vão **direto aparelho↔aparelho**; o servidor só apresenta.
(Para atravessar redes diferentes, os navegadores usam STUN público —
um serviço padrão de "descoberta de caminho", que não vê os arquivos.)
