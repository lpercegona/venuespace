## Iteração 14 — Blog do Super Admin + correção de ícones nos cards

### A. Correção: ícones nos cards de listagem

**Causa raiz.** No admin, ícones são salvos em kebab-case (`users-round`, `layout-grid`, `map-pin`), mas `LucideIcons` só expõe em PascalCase (`UsersRound`, `LayoutGrid`, `MapPin`). O lookup `(LucideIcons as any)[name]` retorna `undefined` e nada renderiza.

**Correção pontual.** Em `src/components/venue/public-card-renderer.tsx`, normalizar o nome antes do lookup: aceitar kebab, snake e PascalCase. Um único helper `resolveLucide(name)` tenta `LucideIcons[name]`, `LucideIcons[pascal(name)]` e retorna `null` silenciosamente se não achar. Sem tocar em schema, backend ou admin.

### B. Blog do Super Admin

Escopo confirmado: apenas super admin cria/edita/publica. Blog global da instância. Editor rich text (Tiptap).

**Migração (uma só, com GRANTs):**
- `blog_posts (id, slug unique, title, subtitle, cover_image_path, cover_image_alt, content_html, content_text, status enum('draft','published'), published_at, author_user_id → auth.users, seo_title, seo_description, created_at, updated_at)`
- GRANTs: `SELECT` a `anon` filtrado por RLS `status='published'`; `SELECT/INSERT/UPDATE/DELETE` a `authenticated` restrito a `is_super_admin(auth.uid())`; `ALL` a `service_role`.
- Trigger `updated_at`.

**Storage.** Reutilizar bucket privado `venue-uploads` com prefixo `blog/covers/`. URLs assinadas server-side (mesma abordagem já usada em galeria).

**Server layer (`src/lib/blog.functions.ts`):**
- `listBlogPostsAdmin` (super admin, todos status)
- `getBlogPostAdmin({ id })` (super admin)
- `upsertBlogPost({ id?, slug, title, subtitle, cover_image_path, cover_image_alt, content_html, content_text, status, seo_title, seo_description })` (super admin)
- `deleteBlogPost({ id })` (super admin)
- `uploadBlogCover` — mesmo padrão dos uploads existentes de gallery/image
Todas com `.middleware([requireSupabaseAuth])` + checagem de `is_super_admin` via RPC.

**Rotas públicas (server routes, `/api/public/blog/*`):**
- `GET /api/public/blog` — lista publicados (id, slug, title, subtitle, cover signed url, published_at). Cache `public, s-maxage=120, swr=300`.
- `GET /api/public/blog/$slug` — post publicado completo com cover assinada.

Ambos com publishable client (§ server-functions-modern), policy `TO anon` `status='published'`.

**Rotas de página:**
- `src/routes/blog.tsx` (layout com `<Outlet />` + `<PublicHeader />`)
- `src/routes/blog.index.tsx` — listagem pública. Grid de cards (capa aspect-video, título display, subtítulo, data formatada com `useFormatContext`). SEO próprio.
- `src/routes/blog.$slug.tsx` — post individual. `head()` derivado do loader (title, description, og:title, og:description, og:image = capa assinada, twitter:card summary_large_image). Renderiza `content_html` sanitizado dentro de container `prose`-like usando tokens semânticos (tipografia via `font-display`/`font-body`, sem cores hardcoded). `BackLink` para `/blog` acima do título.
- Link "Blog" adicionado ao `PublicHeader`.

**Admin (`src/routes/_authenticated.admin.tsx`):**
- Nova aba **"Blog"** ao lado das existentes.
- Listagem: `Table` shadcn com título, status (`Badge`), data de publicação, ações (editar/excluir com `AlertDialog`). Botão "Novo post".
- Formulário de edição em rota dedicada `src/routes/_authenticated.admin.blog.$postId.tsx` (aceita `new` como id):
  - Campos: título, slug (auto-gerado com colisão-safe), subtítulo, capa (uploader single-image reaproveitando padrão do `GalleryField`), alt da capa, editor Tiptap para corpo, SEO title/description, switch draft/published.
  - Editor Tiptap: `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-image` + `@tiptap/extension-link`. Toolbar com Bold, Italic, H2, H3, lista, link, imagem inline (upload para o mesmo bucket), citação. Estilizado com tokens semânticos.
  - `content_html` sanitizado server-side com `sanitize-html` antes de persistir (whitelist de tags/atributos); `content_text` derivado para busca/preview.
- Botões "Ver publicação" (abre `/blog/$slug` em nova aba) quando publicado.

**Navegação completa:**
```
/blog                         → listagem pública
/blog/$slug                   → post individual
/admin (aba Blog)             → listagem + criar
/admin/blog/new               → editor novo post
/admin/blog/$postId           → editor de post existente
```

**Aceite:**
1. Super admin cria post rascunho, edita corpo em Tiptap, faz upload de capa e imagem inline, define slug e SEO, publica.
2. `/blog` mostra o post publicado; rascunhos não aparecem.
3. `/blog/$slug` renderiza o corpo com meta tags corretas (title, og:image = capa).
4. Excluir remove da listagem pública imediatamente.
5. Não-super-admin recebe 401 nas server fns e não vê a aba.
6. Cards de listagem em `/`, `/explore` e `/public/$slug` renderizam ícones do layout público (fix independente do blog).

### Governança (checklist §7)

- Build + typecheck limpos.
- Todas as novas rotas validadas em 360/768/1280, light + dark.
- Estados loading/empty/error cobertos.
- Nenhuma cor hardcoded; novos elementos usam tokens existentes.
- RLS + GRANTs revisados; `/api/public/blog/*` sem PII (só campos publicáveis).
- Meta tags específicas em `/blog` e `/blog/$slug`; og:image apenas em leaf (`/blog/$slug`).
- Propagação verificada: super_admin (cria/edita/publica), owner/editor/viewer (não veem admin), autenticado não-membro (só leitura pública), anônimo (só leitura pública).
- `CHANGELOG.md` com entrada datada cobrindo fix de ícones + iteração blog.
- Auditoria de coerência (iterações 12/13/14) executada.

### Fora de escopo

Comentários, reações, autores múltiplos, categorias/tags de post, RSS, agendamento futuro, revisões/versionamento, i18n de posts, blog por organização (esta última fica registrada como próximo passo caso solicitada).