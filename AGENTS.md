<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Sitemap (obrigatório)

Regra de governança do projeto — vale para toda iteração:

1. **Toda nova página pública criada em `src/routes/` deve ser adicionada ao sitemap na mesma iteração.** O sitemap é gerado em `src/routes/sitemap[.]xml.ts` a partir de `src/lib/sitemap.server.ts`:
   - páginas estáticas → acrescentar em `STATIC_ENTRIES`;
   - páginas dinâmicas (`$param`) → acrescentar uma consulta ao banco em `buildEntries()`, **espelhando exatamente os filtros do loader da rota** (ex.: `organizations.is_public = true`, `tables.is_public = true`, `records.status = 'published'`, `blog_posts.status = 'published'`). Nunca lista fixa de slugs/ids.
2. **Não entram no sitemap**: rotas autenticadas (`/app/*`, `/admin/*`, `/me/*`), autenticação (`/auth`, `/auth/callback`), rotas por token (`/lead/$token`) e todas as rotas `/api/*`. Elas também estão bloqueadas em `public/robots.txt`.
3. **Páginas públicas de organização, tabela e registro entram automaticamente**: são lidas do banco a cada geração. Ao criar/editar/excluir organização ou tabela, chamar `invalidateSitemapCache()` (já feito em `src/lib/orgs.functions.ts`) para que a URL nova apareça imediatamente.
4. Toda página pública precisa de `head()` próprio (título, descrição, `og:title`, `og:description`) — o sitemap não substitui a metatag.
5. Registrar a alteração no `CHANGELOG.md`.
