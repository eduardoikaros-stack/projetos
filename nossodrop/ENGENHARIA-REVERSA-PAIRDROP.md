# 🔍 Engenharia reversa do PairDrop (estudo, 17/nov madrugada)

Estudei o projeto público **PairDrop** (github.com/schlagmichdoch/PairDrop,
~11,8 mil ⭐, licença **GPL-3.0**) para entender a lógica — **sem copiar
código**: a licença dele (GPL) obrigaria nosso projeto a ser GPL também.
Seguimos as **ideias/protocolos** (que são conceitos) com implementação
nossa, escrita do zero, como já era o NossoDrop.

## Como o PairDrop funciona de verdade

**1. O servidor não carrega arquivos.** É Express + WebSocket e só faz
*sinalização*: apresenta os aparelhos e repassa as "ofertas" do WebRTC.
Arquivo vai direto navegador↔navegador (DTLS, criptografado).

**2. Um aparelho fica em várias "salas" ao mesmo tempo:**
| Sala dele | Pra quê | Nossa versão |
|---|---|---|
| por IP (hash) | mesma rede se acha sozinha | `net:<hash>` ✅ já tínhamos |
| pública (código de 5 letras) | conectar de longe, temporária | `code:<CODIGO>` ✅ já tínhamos (6) |
| **secreta (pareamento)** | aparelhos pareados se acham **pra sempre** | `secret:<hash>` 🆕 **feito agora** |

**3. Pareamento (a sacada principal):** um aparelho pede pra parear →
o servidor gera uma **chave de 6 números** (temporária) → o outro digita
→ o servidor entrega aos dois um **segredo longo** que fica guardado
**no aparelho**. Da próxima vez, o aparelho apresenta o segredo e entra
na sala secreta na hora — sem código, em qualquer rede, pra sempre.

**4. Nome automático** de cada aparelho: cor + animal (ex.: "Coruja
Azul") gerado por biblioteca; tipo do aparelho lido do navegador.
(Nós já fazíamos igual, com nossa própria lista PT-BR.)

**5. Protocolo de envio (cliente WebRTC):**
- Antes de enviar: uma mensagem **`request`** com a lista de arquivos e
  tamanho total → o outro **aceita ou recusa** (pareados podem aceitar
  automaticamente)
- Para cada arquivo: **`header`** (nome/tamanho/tipo) → o conteúdo em
  **pedaços binários de 64 KB** (64.000 bytes)
- O recebedor avisa o **progresso** de volta e, ao terminar, o remetente
  recebe a confirmação de **arquivo recebido**
- Fila: um envio por vez. Se WebRTC não existir, ele cai pra um modo
  reserva via WebSocket (base64) — nós não implementamos esse reserva.

**6. Descoberta de caminho:** WebRTC com STUN público (e TURN opcional
configurável pra redes difíceis). Nós usamos STUN público do Google —
é um serviço-padrão de "achar o caminho", não vê arquivos.

## O que mudou no NossoDrop seguindo essa lógica

1. **Multi-sala de verdade:** agora dá pra estar na rede local **e**
   numa sala por código **e** com os pareados — tudo ao mesmo tempo
   (antes entrar numa sala tirava da outra).
2. **⭐ Pareamento permanente:** botão "Parear aparelho" no 🔗 — chave
   de 6 números, segredo guardado no aparelho, reencontro automático.
   Aparelho pareado aparece com ⭐ e **aceita envios sem perguntar**.
3. **Pedido antes de enviar:** quem recebe vê "Fulano quer enviar X —
   aceitar?" (pareado aceita direto).
4. **Confirmação de recebimento:** sua bolha só vira
   *"✓ Recebido pelo outro aparelho"* quando o outro confirma.

Tudo testado com duas abas contra o servidor novo (ver BOM-DIA.md).
