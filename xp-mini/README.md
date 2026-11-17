# Mini XP

Um Windows XP de mentirinha no navegador: área de trabalho, janelas que
arrastam, Explorador de arquivos e Bloco de notas — fiel ao XP
(sem textos que o XP não tem).

**Endereço depois de aceitar a junção (Merge):**
https://eduardoikaros-stack.github.io/projetos/xp-mini/

## O que dá pra fazer

- **Arrastar** ícones e janelas; **arrastar arquivo/pasta pra dentro
  de outra pasta** (no celular: botão direito → **Recortar**, depois
  **Colar** no destino)
- **Botão direito** (ou **segurar 2 segundos**) numa área vazia do
  Explorador → **Novo texto**, **Nova pasta**, **Colar**, **Atualizar**
- **Renomear**, **Excluir**, **Baixar** no menu de cada arquivo/pasta
- Bloco de notas **salva sozinho enquanto você digita** (neste navegador)

## Textos de fora ↔ dentro (a “conexão com o sistema”)

Os arquivos da pasta **`textos/`** moram **fora** do Mini XP:

1. Edite `textos/bem-vindo.txt` (ou crie outro `.txt` e cadastre o nome
   em `textos/index.json`) aqui no GitHub mesmo
2. No Mini XP, abra **Meus documentos** e clique **↻ Atualizar**
3. O texto novo aparece dentro do sistema (ícone 🌐)

Salvar **para fora** tem 3 jeitos:
- **⬇ Baixar** no Bloco de notas (gera o `.txt` no aparelho)
- **🔗 Conectar arquivo** no Explorador (Chrome/Edge: abre um `.txt`
  de verdade do seu computador e o botão Salvar escreve direto nele)
- Editar os arquivos de `textos/` aqui no repositório

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O Mini XP inteiro (página única) |
| `textos/index.json` | Lista dos textos de fora |
| `textos/*.txt` | Textos que aparecem dentro do sistema |

## Ligado no servidor Git

Os textos de fora são lidos **direto do repositório** (GitHub, branch
`main`, pasta `xp-mini/textos/`) toda vez que o Explorador abre/atualiza —
editou lá, apareceu aqui, sem esperar o site remontar. Se o GitHub estiver
indisponível, ele usa a cópia que veio junto com o site.

O arquivo `.nojekyll` na raiz do repositório impede o GitHub Pages de
"processar" o site (causa comum de 404 em subpastas).

## Onde o texto fica salvo?

- **Neste navegador** (automático enquanto digita): cofre do navegador
  (IndexedDB) com **reserva** (localStorage) se o cofre estiver bloqueado.
  Ao salvar, ele confere se gravou antes de mostrar "Salvo".
- **No servidor (GitHub)** — igual ao nosso caderno: botão
  **🐙 Salvar no GitHub** no Bloco de notas. Abre o GitHub já com o texto
  preenchido em `xp-mini/textos/`; é só clicar **Commit changes**.
  Depois, Atualizar no Explorador traz o texto de volta pra dentro.
- **Num arquivo de verdade no aparelho**: ⬇ Baixar, ou 🔗 Conectar
  arquivo (Chrome/Edge).
