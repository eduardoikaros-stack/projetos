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
