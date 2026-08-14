# Correções + Iteração 34 (2FA e verificação de e-mail)

Seis frentes solicitadas. As cinco primeiras são **correções** de escopo já entregue (blog, home, auth, texto rico, busca) e serão registradas como `Correção` no `CHANGELOG.md`, referenciando as iterações de origem. Apenas verificação de e-mail + 2FA é escopo novo (**Iteração 34**).

## 1. Formatação do texto rico na plotagem (Correção das Iterações 29 e 30)

Verificado: a página do post aplica a classe `blog-content`, mas **essa classe não existe em `src/styles.css`** — com o reset do Tailwind, `h2/h3/ul/ol/blockquote` do editor renderizam sem estilo. Nos registros públicos, valores `long_text` passam por `String(raw)`, então HTML do editor aparece cru.

- Criar estilo tipográfico único para conteúdo rico em `src/styles.css` (títulos, parágrafos, listas, citação, links, imagens), com tokens semânticos.
- Reaproveitar em `RichTextView` e no post do blog (mesma fonte de estilo, sem duplicar CSS).
- Ampliar o sanitizador de descrição para aceitar o que o editor produz (h2, h3, h4, ol, blockquote, links) mantendo a limpeza.
- Renderizar campos `long_text` de registro via `RichTextView` quando o valor for HTML, na página individual do registro.

## 2. Blog não abre por link direto (Correção da Iteração 30)

Causa confirmada: o `loader` de `/blog/$slug` faz `fetch("/api/public/blog/...")` com **URL relativa**. No acesso direto o loader roda no servidor (SSR), onde URL relativa não resolve — por isso só funciona navegando a partir da lista, quando o fetch acontece no navegador.

- Trocar o loader por uma server function (`createServerFn`) que chama `getPublicBlogPostBySlug` diretamente, mantendo `notFound()` e as metatags atuais.
- Mesma correção preventiva na listagem `/blog`.

## 3. Links "Espaços em" de bairros e cidades (Correção da Iteração 30)

Verificado em `src/routes/index.tsx`: a coleta lê `org.neighborhood` / `org.city`, campos que **não existem** no payload da API (os endereços vêm como `address.neighborhood` / `address.city`), e o endpoint limita a 50 organizações mesmo pedindo 1000.

- Criar endpoint público de localidades que retorna bairros e cidades **distintos, apenas de organizações públicas existentes**, com contagem, direto do banco (sem paginação de cards).
- Home passa a consumir essa lista; sem itens, a seção some.
- Cada link aponta para a listagem já filtrada, usando exatamente o valor gravado.

## 4. Login Google cai na home em vez do app (Correção da Iteração 1)

Verificado: `redirect_uri: window.location.origin` — o provedor devolve o usuário para `/`, que não tem redirecionamento pós-login.

- Passar `redirect_uri` para uma rota de retorno dedicada que aguarda a sessão hidratar e então navega para `/app` (ou para o destino guardado antes do login).

## 5. Barras de busca (Correção da Iteração 33)

- Remover o ícone de lupa de dentro do campo de digitação (home, explorar e listagens por categoria).
- Arredondar o bloco/botão de filtros no mesmo raio da barra.
- Corrigir a centralização do flutuante de filtros no mobile.

Também será corrigido, em silêncio, um erro de hidratação na home (blocos renderizados em ordem diferente entre servidor e cliente).

## 6. Iteração 34 — Verificação de e-mail e 2FA (TOTP)

- **Verificação de e-mail**: desativar confirmação automática de cadastro; após criar conta, exibir tela "confirme seu e-mail" com reenvio; login sem confirmação mostra aviso claro em vez de erro genérico.
- **2FA por aplicativo autenticador**: tela de segurança na conta com ativação (QR + código de 6 dígitos), lista de fatores e remoção; no login, quando houver fator ativo, exigir o código antes de liberar o app; rotas autenticadas bloqueiam sessão pendente de verificação.

## Detalhes técnicos

- Estilo rico: nova utility em `src/styles.css` consumida por `rich-text-view.tsx` e `blog.$slug.tsx`; `sanitizeRichText` ampliado em `src/lib/rich-text.ts`.
- Blog: `src/lib/blog.functions.ts` ganha `getPublicPostBySlug`/`listPublicPosts` via `createServerFn`, usados nos loaders; endpoints `/api/public/blog/*` permanecem para consumo externo.
- Localidades: nova função em `src/lib/public.server.ts` + rota `src/routes/api/public/localidades.ts`, com cache do `server-cache` existente; `src/routes/index.tsx` deixa de fazer o parse manual.
- Auth: nova rota `src/routes/auth.callback.tsx`; `auth.tsx` passa a usar `${origin}/auth/callback`.
- 2FA: `supabase.auth.mfa` (enroll/challenge/verify/unenroll) — sem tabela nova; ajuste de configuração de auth para exigir confirmação de e-mail.
- Busca: `home-search-bar.tsx`, `mobile-filter-dock.tsx` e `public-listing.tsx`.
- `CHANGELOG.md` recebe uma entrada `Correção das Iterações 1/29/30/33` e uma entrada `Iteração 34`.
