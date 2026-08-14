# Sitemap público dinâmico + regra de documentação

Hoje o projeto não tem `sitemap.xml` nem `robots.txt` (verificado: `public/` contém apenas logo e favicons, e não há nenhuma referência a sitemap no código). Todas as páginas públicas dependem de dados do banco, então o sitemap será gerado sob demanda — nunca uma lista fixa a manter à mão.

## 1. Arquivo de sitemap

Nova rota de servidor `src/routes/sitemap[.]xml.ts`, respondendo em `https://venuespace.com.br/sitemap.xml`, com cache de 1 hora.

Páginas estáticas incluídas:
- `/` (home), `/explore`, `/blog`
- `/para-empresas`, `/politica-de-privacidade`, `/politica-de-cookies`, `/termos-e-condicoes`, `/contestacao-de-espacos`

Ficam de fora (não indexáveis): `/auth`, `/auth/callback`, `/lead/$token`, `/me/*`, `/app/*`, `/admin/*` e todas as rotas `/api/public/*`.

Páginas dinâmicas, lidas do banco na hora da requisição:
- `/categoria/{slug}` — uma por categoria de organização
- `/blog/{slug}` — apenas posts com status publicado
- `/public/{slug}` — uma por organização pública
- `/public/{slug}/{tableId}` — uma por tabela pública dessas organizações
- `/public/{slug}/{tableId}/{recordId}` — uma por registro público (limite de segurança para não estourar o tamanho do arquivo; ver detalhes técnicos)

`<lastmod>` usa o `updated_at` real de cada organização, tabela, registro e post; páginas estáticas ficam sem `lastmod` (não há data confiável por página).

## 2. robots.txt

Novo `public/robots.txt` liberando o rastreamento geral, bloqueando as áreas privadas (`/app/`, `/admin/`, `/me/`, `/auth`, `/lead/`, `/api/`) e apontando para `https://venuespace.com.br/sitemap.xml`.

## 3. Inclusão automática das páginas de organização

Como o sitemap é gerado por consulta ao banco a cada requisição, **toda organização, tabela ou registro publicado entra no sitemap automaticamente** assim que a visibilidade pública é marcada — e sai quando é despublicado. Não há passo manual no fluxo de criação de organização.

Complemento: ao publicar/despublicar uma organização ou tabela, o cache do sitemap é invalidado, de modo que a página nova aparece no arquivo em minutos e não em até uma hora.

## 4. Documentação (obrigatoriedade)

Nova seção "Sitemap" no `AGENTS.md` (abaixo do bloco gerenciado pela Lovable), com a regra de governança:
- Toda nova página pública criada em `src/routes/` **deve** ser adicionada ao `sitemap.xml` na mesma iteração; rotas autenticadas, de API e de token não entram.
- Páginas dinâmicas devem ser incluídas por consulta ao banco, espelhando exatamente os filtros do loader da rota (ex.: `is_public = true`, post publicado) — nunca lista fixa.
- Toda página pública precisa também de `head()` próprio (título, descrição, og).
- Entrada correspondente no `CHANGELOG.md`.

## Detalhes técnicos

- `src/routes/sitemap[.]xml.ts` com `createFileRoute("/sitemap.xml")` + `server.handlers.GET`, reaproveitando os helpers já existentes em `src/lib/public.server.ts` (`listPublicOrganizations`, `listPublicTables`, `listPublicRecords`) e a listagem de posts publicados de `src/lib/blog-public.server.ts`; slugs de categoria via o mesmo `categorySlug` usado em `src/routes/categoria.$slug.tsx`.
- Paginação interna das consultas para ultrapassar o limite padrão dos helpers, com teto de 45.000 URLs (limite do protocolo é 50.000); se o volume passar disso no futuro, migra-se para `sitemapindex` — registrado como pendência.
- Cache via `cachedSWR` (`src/lib/server-cache.ts`, já em uso) com TTL de 1h e `Cache-Control: public, max-age=3600`; invalidação disparada nas funções de criação/edição de organização e tabela (`orgs.functions.ts`).
- Sem alteração de schema e sem novas dependências. `src/routeTree.gen.ts` é regenerado automaticamente.
- Governança §0: entrada no `CHANGELOG.md` como "Iteração 38 — sitemap público e robots.txt".
