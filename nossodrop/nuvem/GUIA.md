# ☁️ GUIA: ligar o NossoDrop na nuvem (grátis, 5 minutos)

Você vai apertar uns botões na **Cloudflare** (empresa gigante de
internet). É **grátis pra sempre**, **sem cartão**, e o servidor
**não dorme**. A conta é sua: login só no seu navegador, igual ao
GitHub — nunca cole senha/código pra ninguém.

> Travou em algum passo? Me manda **foto da tela** que eu te falo
> onde clicar.

---

## Passo 1 — Criar sua conta (1 min)

1. Abra **cloudflare.com**
2. Toque em **Sign Up** (cadastrar)
3. Coloque seu **e-mail e crie uma senha** → confirme no e-mail
4. Se perguntar de plano, escolha **Free** (grátis)

## Passo 2 — Criar o "trabalhador" (1 min)

1. No painel, no menu da esquerda: **Workers & Pages**
   (pode aparecer como *Compute (Workers)*)
2. Botão **Create** (Criar) → escolha **Worker**
3. Nome: **nossodrop**
4. Toque em **Deploy** (Implantar) — ele cria um exemplo qualquer,
   a gente troca no próximo passo
5. Se ele pedir pra criar seu endereço `workers.dev`, escolha um
   apelido qualquer (ex.: seu nome) e confirme

## Passo 3 — Colar o NOSSO código (2 min)

1. Na página do seu Worker, toque em **Edit code** (Editar código)
2. Apague **tudo** que estiver lá
3. Abra este arquivo nosso no GitHub (ele já está no projeto):
   `nossodrop/nuvem/worker.js` — copie **tudo** e cole lá
4. Toque em **Deploy** (Implantar)

## Passo 4 — Ligar a "sala" (1 min) ⚠️ não pule!

1. Volte na página do Worker → aba **Settings** (Configurações)
2. Procure **Bindings** → botão **Add** (Adicionar)
3. Escolha **Durable Objects**
4. Preencha:
   - **Variable name** (nome): `SALAO`
   - **Durable Object class** (classe): `Salao`
     (se não aparecer, volte no Passo 3 e confira a colagem)
5. **Save / Deploy**

## Passo 5 — Usar! 🎉

1. O endereço do seu Worker aparece na página dele, algo como:
   **https://nossodrop.seu-apelido.workers.dev**
2. Abra esse endereço em **dois aparelhos** (celular + computador)
3. Eles devem se enxergar sozinhos 📱💻 — arraste um arquivo!

**Me manda esse endereço** na conversa que eu confiro daqui se está
no ar. ✅

---

### Perguntas rápidas

- **Custa algo?** Não. Plano grátis: 100 mil pedidos/dia (nós usamos
  pouquíssimos — arquivo vai direto entre aparelhos).
- **Dorme igual ao Render?** Não. Ele "cochila" sem custo e acorda
  **na hora** que alguém chega.
- **Preciso colar o código de novo quando melhorar?** Não! A página
  vem do nosso GitHub Pages automaticamente. Só se um dia mudar o
  `worker.js` (eu te aviso e é o Passo 3 de novo).
- **E o link antigo do GitHub Pages?** Continua abrindo a página, e
  agora ela aceita apontar pra nuvem: é só abrir o link antigo com
  `?servidor=nossodrop.seu-apelido.workers.dev` no final — fica
  salvo no aparelho.
- **O servidor de casa morreu?** Não! `iniciar-windows.bat` continua
  funcionando do mesmo jeito.
