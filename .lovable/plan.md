Escopo confirmado; nada fora dele. Diretriz §0 aplicada — sem refactors implícitos, sem regressão nas iterações 1–8, RLS e endpoints públicos preservados. `CHANGELOG.md` recebe entrada datada ao final.

## 1. Editar tabelas existentes

- Adicionar server fn `updateTable` em `src/lib/orgs.functions.ts` (patch de `name`, `description`, `bookable`, `icon`; slug preservado). Requer owner/editor via RLS existente.
- Na dashboard da org (`_authenticated.app.$orgSlug.index.tsx`), cada `Card` de tabela ganha botão-ícone `Pencil` (canto superior direito, `stopPropagation` para não navegar) que abre o mesmo `Dialog` de criação em modo "editar".
- Refatorar o `Dialog` para aceitar `mode: "create" | "edit"` + `initial`; título muda para "Editar tabela"; ao salvar chama `updateTable` e faz `refetch`.

## 2. Campos com comportamento real por tipo

- Criar bucket público **`venue-uploads`** via `storage_create_bucket`, com policies em `storage.objects`: INSERT `authenticated`, SELECT `anon` (bucket público).
- `src/components/venue/dynamic-form.tsx`:
  - `type=image`: `<input type="file" accept="image/*">` → upload em `venue-uploads/records/{uuid}-{filename}`, grava `publicUrl` no valor; preview `<img>` quando houver.
  - `type=file`: `<input type="file">` idem; exibe nome do arquivo + link "abrir".
  - `type=currency`: `Input type=number` com adorno visual "R$".
  - `type=email/phone/url` mantêm inputs nativos correspondentes.
  - `type=relation` continua UUID (fora do pedido).
- `DynamicGrid`: renderizar `image` como thumbnail e `file` como link.

## 3. Editor de opções de `select` e `multiselect` (novo)

- **Schema (`src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`)**:
  - Quando `fType ∈ {select, multiselect}` no dialog de criação/edição de campo, exibir gerenciador de opções: `Input` + botão `Adicionar`, `Badge` com `x` para remover, `drag`-less (ordem por inserção). Persiste em `fields.config.options: string[]` via `createField`/`updateField` (schema Zod já aceita `config`).
  - Cada linha de campo na listagem ganha botão-ícone `Pencil` que reabre o mesmo dialog em modo "editar campo" (label/tipo/required/opções). Ao trocar o tipo para/entre select/multiselect, options são preservadas; ao sair de select/multiselect, options são descartadas com confirmação.
- **DynamicForm**:
  - `select`: `Select` shadcn já existente, alimentado por `f.config.options`; adicionar item final "➕ Adicionar opção" que abre inline `Input` — ao confirmar chama nova server fn `addFieldOption({ field_id, option })` (owner/editor) que faz append idempotente em `config.options` e retorna a lista atualizada; a UI invalida `["fields", tableId]` e seleciona a nova opção.
  - `multiselect`: grupo de `Checkbox` sobre `config.options`, valor `string[]`; abaixo, mesmo input inline "Adicionar opção" com a mesma server fn.
  - No formulário público (`public.$slug.$tableId.form.tsx`) o "Adicionar opção" **não** aparece — apenas usuários autenticados com permissão de edição sobre a tabela podem estender opções. Detecção via prop `canEditSchema` passada pelo caller; público sempre `false`.
- Server fn `addFieldOption` em `src/lib/orgs.functions.ts`:
  - `requireSupabaseAuth` + Zod (`field_id: uuid`, `option: string 1..80`).
  - Verifica papel do usuário na org do campo (join `fields → tables → organization_id` + `has_role owner|editor`).
  - `SELECT ... FOR UPDATE` em `fields.config`; append único (case-insensitive) e `UPDATE`. Retorna `options` atualizado.

## 4. Cabeçalho: dropdown de perfil (remove "Minhas candidaturas" solto)

- Em `src/components/venue/app-shell.tsx`:
  - Remover botão "Minhas candidaturas" e links soltos "Membros"/"Calendário" do topo.
  - `DropdownMenu` disparado por `Avatar` (usa `profiles.avatar_url`/`display_name`; fallback iniciais):
    - **Configurações** → `/me/settings` (nova rota).
    - **Minhas candidaturas** → `/me/applications`.
    - **Calendário** → `/app/$orgSlug/calendar` (só quando `orgSlug` presente).
    - **Membros** → `/app/$orgSlug/members` (só quando `orgSlug` presente).
    - Separator + **Sair**.
  - `NotificationsBell` permanece.
- Nova rota `src/routes/_authenticated.me.settings.tsx`: form com `display_name` e upload de `avatar_url` (mesmo bucket). Nova server fn `updateMyProfile` em `src/lib/profile.functions.ts` (update em `public.profiles` do próprio usuário).

## 5. Chat flutuante

- Novo `src/components/venue/chat-widget.tsx`: botão `MessageCircle` fixo em `fixed bottom-4 right-4 z-50`. Ao abrir, `Sheet` (mobile) / `Dialog` (desktop, via `useIsMobile`) com duas views:
  1. Lista de conversas do usuário no escopo da org atual (reaproveita queries de `_authenticated.app.$orgSlug.conversations.tsx`).
  2. Ao selecionar, embute `ConversationThread` existente com polling.
- Montado no `AppShell` apenas quando há `orgSlug`.
- Rotas atuais `/app/$orgSlug/conversations*` permanecem intactas (deep-link). Remove-se o botão "Conversas" da dashboard da org.

## 6. Detalhe público de registro

- Nova rota `src/routes/public.$slug.$tableId.$recordId.tsx`:
  - `head()` com `title`/`description` derivados do registro.
  - Busca via novo `GET /api/public/$slug/$tableId/$recordId` (arquivo em `src/routes/api/public/$slug/$tableId.$recordId.ts`) + helper novo em `public.server.ts` validando `status='published'` do record e da tabela/view pública; usa `supabaseAdmin` como as outras públicas; projeta somente campos da view pública (sem PII).
  - UI mostra **todos** os campos projetados (image como `<img>`, file como link, computed renderizado). Botão "Manifestar interesse" reaproveita `/public/$slug/$tableId/form?record=...&view=...` quando `public_form_view` existir.
- Em `public.$slug.$tableId.tsx`: cada `Card` da lista vira `Link` para a rota de detalhe; botão "Manifestar interesse" continua como ação secundária.

## Detalhes técnicos

- Migração Supabase: bucket + policies em `storage.objects`; nenhuma alteração nas tabelas de domínio (opções vivem em `fields.config.options`).
- Server fns novos usam `requireSupabaseAuth` + Zod; `/api/public/*` continua com `supabaseAdmin` + filtros de `status='published'`.
- Design System: apenas primitives shadcn já presentes (`DropdownMenu`, `Avatar`, `Sheet`, `Dialog`, `Checkbox`, `Badge`, `Select`).
- Responsivo validado em 360/768/1280, light+dark, estados loading/empty/error.
- `CHANGELOG.md` recebe entrada datada cobrindo todos os itens.

## Fora do escopo

Reordenar opções por drag, remover opção já usada por registros, editor visual de `relation`, exclusão de tabelas, permissões finas no widget de chat (usa RLS existente).
