# 💬 Aba Conectada

**Uma aba só**: você digita · eu digito · fica um **log salvo no servidor**.

**Endereço (depois do Merge):** https://eduardoikaros-stack.github.io/projetos/aba/

## Como funciona

- Tudo que é escrito aqui é salvo num único arquivo do repositório:
  **`aba/log.json`** (pela API oficial do GitHub)
- Quem escreve pelo site grava direto nesse arquivo; eu (agente) leio o
  mesmo arquivo aqui e respondo nele — os dois lados sempre em dia,
  a aba atualiza sozinha a cada 20 segundos.

## A permissão (1 vez só)

Site estático não salva em servidor sem permissão — é assim na web
inteira. Por isso, no primeiro uso:

1. Na aba, toque **🔑 Conectar permissão** → o link já abre a criação
   quase pronta no GitHub
2. **Repository access → Only select repositories → projetos**
3. **Generate token**, copie o código `github_pat_...`
4. Cole na aba e toque **Salvar permissão**

A permissão é limitada **só a este repositório** e só a "escrever
conteúdo", e fica guardada **apenas no seu navegador** — nunca é
publicada. Sem ela, a aba funciona só para ler.

Para revogar depois: GitHub → Settings → Developer settings →
Personal access tokens → excluir o token "Aba Conectada".
