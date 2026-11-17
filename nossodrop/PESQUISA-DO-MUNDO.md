# 🌍 Pesquisa do mundo: "onde ligo meu servidor grátis, sem dormir?"

**Pedido seu (18/nov de manhã):** pesquisar no planeta inteiro como o
pessoal resolveu esse problema — alguém já deve ter sofrido igual.

## O problema, em uma frase

A página do NossoDrop já abre no GitHub Pages, mas o **servidor que
apresenta os aparelhos** precisa de um lugar que **rode um programa
sem parar** — e o GitHub Pages não roda programas (só mostra páginas).

## O que o mundo faz (resumo da pesquisa)

| Lugar | Grátis? | O porém |
|---|---|---|
| **Render** | sim, sem cartão | **dorme** após 15 min parado → primeiro clique espera ~1 min 😴 |
| **Koyeb / Northflank** | sim | pedem **cartão** só pra confirmar identidade 💳 |
| **Railway / Zeabur** | crédito de teste | o crédito **acaba** ⏳ |
| **Oracle Cloud** | sim, pra sempre | cadastro com cartão e bem complicado 🧱 |
| **☁️ Cloudflare Workers** | **sim, pra sempre** | precisa adaptar o servidor pro formato deles |

## Quem sofreu igual a gente (e como resolveu)

- 🇨🇳 Um desenvolvedor **chinês** pegou o PairDrop e **migrou a
  apresentação dele pra Cloudflare Workers + Durable Objects**
  (projeto `PairDrop-cfw`) — palavras dele: *"um único Durable Object
  no lugar do processo sempre ligado; o plano grátis aguenta rodar
  pra sempre"*. Você tinha razão: chinês é bom nisso. 😉
  (O código dele é GPL e é do PairDrop — **não copiei**; segui a ideia
  com o nosso código, como sempre.)
- Outro projeto independente (`drop-anything`) fez igual e explica:
  *"roda no plano grátis, ganha endereço https workers.dev e **nunca
  dorme**."*
- A Cloudflare liberou os Durable Objects no plano grátis em 2025:
  **100 mil pedidos por dia**. Pra nós sobra: o servidor só *apresenta*
  (arquivo vai direto entre os aparelhos, sem passar por ele).

## O que eu fiz hoje com essa lição

1. Traduzi **nosso** servidor pra nuvem: `nuvem/worker.js` — mesma
   lógica do servidor de casa (salas: rede · código · pareamento ⭐),
   agora na Cloudflare, grátis e sem dormir.
2. A página continua sendo buscada do nosso GitHub Pages — quando a
   gente melhora a página, o link da nuvem atualiza sozinho.
3. **Testei de verdade** com a própria Ferramenta da Cloudflare aqui
   dentro, simulando dois aparelhos: **8 de 8 testes verdes** ✅
   (se acharam, chave de 6 dígitos, mesmo segredo pros dois, ⭐
   pareado, sinal, reconectou só pelo segredo, sala por código,
   multi-sala).
4. Continua valendo o servidor de casa (`iniciar-windows.bat`) — a
   nuvem é um caminho a mais, não trocou nada.

## Falta só você apertar uns botões (5 minutos)

A conta da Cloudflare é **sua** (login só no seu navegador, como o
GitHub). O passo a passo de cliques está em **`nuvem/GUIA.md`**.
No fim sai o link definitivo, tipo:
`https://nossodrop.seu-nome.workers.dev` — esse abre e **funciona**.

Fontes: github.com/Xiyinnnnnn/PairDrop-cfw ·
github.com/WubLubDubb/drop-anything ·
developers.cloudflare.com/durable-objects/platform/limits ·
comparativos de hospedagem grátis 2026 (Render dorme, Koyeb sem
dormir pede cartão etc.).
