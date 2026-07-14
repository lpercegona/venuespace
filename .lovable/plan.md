## Escopo (fechado)

Três frentes: (1) verificar o fluxo público (listagem, detalhes, formulário); (2) adicionar edição de formulários públicos; (3) auditar e otimizar performance de carregamento em todo o app.

---

### 1. Verificação do fluxo público

Percorrer com Playwright:
- `/public/:slug/:tableId` (listagem)
- `/public/:slug/:tableId/:recordId` (detalhes)
- `/public/:slug/:tableId/form?view=…&record=…` (submissão)

Checklist:
- Registros aparecem apenas com `status='published'`.
- Detalhes exibem todos os tipos de campo preenchidos (texto, número, data, boolean, currency, computed, select/multiselect, relation, imagem, arquivo) com URLs assinadas em `venue-uploads`.
- Relations mostram o rótulo do registro relacionado, não UUID cru.
- Botão "Manifestar interesse" cria record em `submissions_table_id` + `conversation` + `lead_access_tokens` (anônimo) e redireciona para `/lead/:token`.
- `EmptyState` cobre 404 (sem tela branca).

Correções aplicadas apenas nos pontos onde o teste falhar. Sem alterar RLS, schema, campanhas ou reserva.

---

### 2. Edição de formulários públicos

**Backend** (`src/lib/messages.functions.ts`):
- `getPublicFormView({ id })` — retorna `{ view, submission_fields }` (campos da tabela de destino).
- `updatePublicFormView({ id, name?, auto_relation_field_id?, form_field_ids? }`) — valida propriedade via `organization_id` e atualiza `views.name` + `views.config`. `submissions_table_id` permanece imutável.

**Frontend** (`src/routes/_authenticated.app.$orgSlug.tables.$tableId.index.tsx`):
- Ícone de lápis em cada card de "Formulários públicos" abre `<Dialog>` de edição.
- Modal com: `Input` de nome, `Select` de campo `relation` para auto-relação, lista de `Checkbox` com os campos da tabela de submissões (default: todos exceto auto-relation e `computed`).
- Salvar → invalida `["views", tableId]` + `toast.success`.

UI: apenas shadcn + tokens semânticos. Mobile-first.

---

### 3. Auditoria e otimização de performance

**3.1 Medição (baseline obrigatória antes de qualquer otimização)**

Rodar Playwright + Lighthouse (via CLI headless) e Chrome DevTools performance trace em:
- `/` (landing)
- `/public/:slug/:tableId` (listagem pública)
- `/public/:slug/:tableId/:recordId` (detalhes)
- `/app/:orgSlug` (painel autenticado)
- `/app/:orgSlug/tables/:tableId` (grid dinâmica)

Coletar: LCP, FCP, TBT, CLS, TTFB, tamanho de bundle por rota, requests em waterfall, tempo de cada `createServerFn`/rota `/api/public/*`. Registrar números iniciais em `.lovable/perf-baseline.md`.

**3.2 Otimizações de front-end**

- **Code splitting**: garantir que nenhum route file exporta o `component` (regra do TanStack) e que rotas pesadas (`calendar`, `conversations`, `campaigns`) ficam em chunks separados. Auditar `routeTree.gen.ts` para chunks acima de 100 kB.
- **Loader canonical shape**: migrar rotas que hoje usam `useQuery` + `isLoading` no mount para o padrão `ensureQueryData` no loader + `useSuspenseQuery` na página pública (`public.$slug.$tableId.tsx`, `public.$slug.$tableId.$recordId.tsx`, `public.$slug.campaigns.$recordId.tsx`). Evita loading flash e permite pré-render SSR real.
- **Preload LCP**: em rotas de detalhes com imagem hero, adicionar `head().links` com `rel="preload" as="image" fetchpriority="high"` apontando para a URL assinada da capa.
- **Lazy media**: aplicar `loading="lazy"` + `decoding="async"` em todo `<img>` fora do LCP; adicionar `width`/`height` para evitar CLS.
- **Bundle**: remover imports não usados detectados no baseline; verificar se `lucide-react` está em tree-shaking correto (imports nomeados).
- **Preconnect**: `<link rel="preconnect">` para o domínio do Supabase Storage no `__root.tsx`.
- **React Query**: definir `staleTime` maior (30–60 s) em queries de metadata pouco voláteis (`listTables`, `listMyOrganizations`, `listViews`) para eliminar refetch em navegação.
- **Corrigir hydration mismatch** já visível no console (`__root.tsx` — atributos `data-tsd-source` diferindo entre SSR e client), removendo o gatilho quando identificado.

**3.3 Otimizações de back-end (Lovable Cloud)**

- Rodar `supabase--slow_queries` e `supabase--linter`. Registrar top 10 queries por tempo total.
- Adicionar índices ausentes via migration para os offenders identificados. Candidatos prováveis (só criar quando o EXPLAIN confirmar):
  - `records(table_id, status, created_at desc)` para a listagem pública.
  - `messages(conversation_id, created_at)` para o chat.
  - `conversations(organization_id, updated_at desc)` para o inbox.
  - `memberships(user_id)` para `listMyOrganizations`.
- Reduzir round-trips em `loadPublicRecord`: coletar todos os storage paths e emitir um único `createSignedUrls` em vez de N chamadas sequenciais.
- Em `loadPublicTable`, projetar apenas as colunas realmente usadas na listagem (evitar `data` inteiro quando só 4 campos são exibidos) — retornar `data` filtrado para as chaves visíveis.
- Adicionar `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300` nos handlers `/api/public/*` estáveis (listagem e detalhes) e `no-store` no `submit`.

**3.4 Gate de fechamento perf**

- Rerodar Lighthouse nas mesmas rotas e comparar com baseline. Meta mínima (mobile emulado):
  - LCP ≤ 2.5 s nas páginas públicas
  - TBT ≤ 200 ms
  - CLS ≤ 0.1
  - Nenhuma request `/api/public/*` acima de 400 ms no p95 medido
- Números finais registrados em `.lovable/perf-baseline.md` (seção "após").

---

### Gate geral (Diretriz §0 e §7)

1. Build passa; typecheck limpo.
2. Playwright verifica listagem → detalhes → formulário → submissão OK, e edição de formulário reflete no `/form`.
3. Baseline e resultado de perf registrados.
4. Zero regressão nas iterações 1–8; RLS e GRANTs intactos; nenhum PII em `/api/public/*`.
5. Responsividade validada em 360 / 768 / 1280, light + dark.
6. `CHANGELOG.md` atualizado com entrada datada (America/Sao_Paulo) descrevendo verificação pública, `updatePublicFormView`/UI de edição e otimizações de performance aplicadas.