# Recuperação de senha + remetente naoresponda@venuespace.com.br

Duas frentes: (1) fluxo de "Esqueci minha senha" na tela de login; (2) passar os e-mails automáticos a sair de `naoresponda@venuespace.com.br`.

## 1. Recuperação de senha (nova tela + link)

Verificado: `src/routes/auth.tsx` hoje tem apenas entrar / criar conta / Google / 2FA / confirmação de e-mail. Não existe nenhuma rota de redefinição (`src/routes/` não tem arquivo de reset), e nenhum ponto do código chama a recuperação de senha.

- Na aba "Entrar", adicionar o link **"Esqueci minha senha"** ao lado do campo de senha.
- O link abre um estado dentro do mesmo cartão: campo de e-mail + botão "Enviar link de recuperação", com mensagem de confirmação neutra (não revela se o e-mail existe) e opção "Voltar".
- Criar a página pública **`/redefinir-senha`**: valida que a chegada é de recuperação, pede nova senha + confirmação (mínimo 8 caracteres, iguais), grava e redireciona para `/app` com aviso de sucesso. Erros comuns (link expirado/usado) recebem mensagem clara com atalho para pedir novo link.
- Rota fora da área autenticada, com `head()` próprio e `noindex` (mesmo padrão de `/auth`); **não entra no sitemap** (é rota de autenticação, conforme a regra do projeto) e permanece coberta pelo bloqueio de `robots.txt`.

## 2. Remetente dos e-mails

Verificado: o projeto **não tem domínio de e-mail configurado** — hoje os e-mails de confirmação de cadastro e recuperação saem pelo remetente padrão da plataforma, não por um endereço Venuespace. Por isso a troca não é uma edição de código: exige configurar o domínio de envio.

Passos:
1. Abrir a configuração de domínio de e-mail e registrar **venuespace.com.br** (domínio já usado pelo site), aplicando os registros DNS indicados.
2. Com o domínio registrado, gerar os modelos de e-mail de autenticação (confirmação de cadastro, recuperação de senha, link mágico, convite, troca de e-mail, reautenticação) usando **naoresponda@venuespace.com.br** como remetente.
3. Aplicar a identidade visual Venuespace nos modelos (cores/tokens do site, logo, textos em português).
4. Enquanto o DNS verifica, os e-mails continuam saindo pelo remetente padrão; a troca passa a valer automaticamente após a verificação.

Observação: e-mails só podem sair de um domínio próprio verificado — não existe remetente compartilhado. Se preferir outro domínio (ex.: um subdomínio como `mail.venuespace.com.br`), é só dizer antes da configuração.

## Detalhes técnicos

- `src/routes/auth.tsx`: novo estado `forgot`, chamada `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })`.
- Nova rota `src/routes/redefinir-senha.tsx` (pública, sem gate), tratando o evento `PASSWORD_RECOVERY` / hash `type=recovery` e chamando `supabase.auth.updateUser({ password })`.
- Domínio/remetente: fluxo de configuração de e-mail da plataforma + geração dos modelos de autenticação em `src/lib/email-templates/` e rota de webhook correspondente.
- Registrar tudo em `CHANGELOG.md` como nova iteração (recuperação de senha e remetente de e-mails), referenciando a Iteração 34 (autenticação/verificação de e-mail).
