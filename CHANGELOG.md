## 2026-07-14 19:54 (America/Sao_Paulo) — Cache previsível dos termos globais

- `src/routes/api/public/platform-labels.ts`: troca o cache público do endpoint por `cache-control: no-store`, evitando respostas compartilhadas obsoletas enquanto termos-núcleo são administráveis em runtime.
- `src/hooks/use-instance-context.ts`: consulta `/api/public/platform-labels` com `cache: "no-store"`, remove o `staleTime` de 5 min e revalida ao montar, focar a janela ou reconectar.
- `src/routes/_authenticated.admin.tsx`: atualiza o texto da seção de termos-núcleo para refletir que a sessão atual é invalidada após salvar e outras sessões revalidam nos eventos configurados.

## 2026-07-14 19:42 (America/Sao_Paulo) — Restrição do atalho Administração no menu do perfil

- `src/components/venue/app-shell.tsx`: corrige a condição do item "Administração" no dropdown do perfil para renderizar somente quando `amISuperAdmin()` retornar `is_super_admin: true`.
- Nenhuma alteração de rota, backend, RLS ou tokens de design.

## 2026-07-14 — Iteração 10 (continuação): Campos de sistema editáveis + sweep de rótulos

### Backend
- **Nova função** `src/lib/system-fields.functions.ts`: `listSystemFieldsPublic({ scope })`, `listAllSystemFieldsPublic()`, `upsertSystemField`, `deleteSystemField` — escopos `organization | table | record`, gravam nas tabelas `organization_fields`, `table_fields`, `record_fields` (super admin only).
- **Nova rota pública** `src/routes/api/public/system-fields.ts` retornando os três escopos com cache 60s.
- **Novo hook** `src/hooks/use-system-fields.ts` (`useSystemFields(scope)`) — dicionário cacheado (5 min).
- `src/lib/orgs.functions.ts`: `createOrganization` / `updateOrganization` / `getOrganizationBySlug` / `listMyOrganizations` agora aceitam e retornam `system_data` (JSONB).
- `src/lib/records.functions.ts`: `createRecord` / `updateRecord` aceitam `system_data`; `listRecords` passa a expor o campo.

### Admin UI
- **Nova aba "Campos de sistema"** em `/admin` com seletor de escopo (Organização / Tabela / Registro), CRUD completo (chave snake_case, rótulo, tipo, obrigatório, ordem) reutilizando `FIELD_TYPES` do motor unificado (`field-schema.ts`).
- Invalidação recíproca com a query `system-fields` para refletir mudanças imediatamente no cliente.

### Integração transversal
- `EditOrgDialog` agora renderiza dinamicamente os campos de sistema da organização (texto, textarea/long_text, number/currency, date/datetime, email/url/phone, select, boolean) e persiste em `organizations.system_data`. Rótulos como "Excluir organização" e "Categoria" passaram a usar `useLabels()`.

### Sweep de rótulos (Frente 2)
- `AppShell` migrou strings hardcoded → `useLabels()`: seletor de organização, dropdown "Organizações", "Nenhuma organização", "Ver todas as organizações", "Reservas" (bookings), "Membros" (memberships).
- Comportamento de fallback preservado via `FALLBACK_LABELS` do hook.

### Pendências identificadas
- UI de tabelas (schema builder) e registros (formulário na `_authenticated.app.$orgSlug.tables.$tableId.index.tsx`) ainda não renderizam campos de sistema, embora o backend já aceite `system_data`. Próxima entrega.
- `PublicHeader` mantém "Explorar" hardcoded — sem chave semântica associada; deixado como cópia de UI, sem impacto de termos-núcleo.

### Governança
- Sem cor hardcoded; sem quebra de tokens.
- `tsgo --noEmit`: ✅ limpo.
## 2026-07-14 22:15 — Iteração 10 (parcial): layout público por categoria + retroatividade

- Migration prévia: novas tabelas `organization_category_public_layouts`, `organization_fields`, `table_fields`, `record_fields`; coluna `system_data jsonb` em `organizations`, `tables`, `records`; enum `field_source_kind`; `system_form_fields` removida.
- `src/lib/field-schema.ts` (novo): extrai `zodForField` / `buildSchemaFromFields` e a lista `FIELD_TYPES` compartilhada (base para os campos de sistema de org/tabela/registro).
- `src/lib/platform-labels.functions.ts`: remove tipos/fn de `system_form_fields` (tabela dropada).
- `src/lib/category-layouts.functions.ts` (novo): `listCategoryPublicLayoutPublic`, `upsertCategoryPublicLayoutItem`, `deleteCategoryPublicLayoutItem`, `seedCategoryDefaultsRetroactive` (semeia campos padrão em tabelas existentes da categoria — não sobrescreve chaves já presentes).
- `src/routes/_authenticated.admin.tsx`: aba "Rótulos" simplificada (remove SFF); nova aba "Layout público" com CRUD por categoria (origem, chave, ícone lucide, rótulo override, ordem) + botão "Aplicar campos padrão retroativamente" que dispara `seedCategoryDefaultsRetroactive`.
- `src/lib/public.server.ts` / `PublicTablePayload`: expõe `organization.category_id` e `category_layout`.
- `src/routes/public.$slug.$tableId.index.tsx`: quando a categoria da org define layout público, os cards passam a renderizar campos, rótulos e ícones definidos pelo super admin, com fallback para heurística anterior quando não há layout.

---



- `src/components/venue/conversation-thread.tsx` agora recebe `formatCtx` obrigatório; substitui `toLocaleString`/`Intl.NumberFormat` fixos por `formatDateTime`/`formatCurrency`.
- `src/components/venue/chat-widget.tsx`: aceita `org` como prop, deriva `formatCtx` via `useFormatContext(org)`, propaga para `ConversationThread` e ao badge de valor acordado; datas do inbox usam `formatDateTime`.
- `src/components/venue/app-shell.tsx`: passa `org` ao `ChatWidget`; adiciona link "Administração" no menu do perfil visível apenas quando `amISuperAdmin` retorna verdadeiro.
- `src/routes/_authenticated.app.$orgSlug.conversations.$conversationId.tsx`: injeta `formatCtx` derivado do org atual no `ConversationThread`.
- `src/routes/lead.$token.tsx`: usa `formatCtx` (padrão da instância) para valor acordado e mensagens; remove `Intl.NumberFormat` fixo.
- `src/routes/public.$slug.campaigns.$recordId.tsx`: valores confirmados e meta agora usam `formatCurrency(formatCtx)`.
- `src/routes/_authenticated.me.applications.tsx`: valor acordado via `formatCurrency`, data de envio via `formatDateTime`.
- `src/components/venue/edit-org-dialog.tsx`: adiciona seleção de categoria e overrides opcionais de fuso horário e moeda; valores em branco herdam padrão da instância; envia `category_id`, `timezone`, `currency` no `updateOrganization`.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`: repassa `category_id`, `timezone`, `currency` do org atual ao `EditOrgDialog`.
- `src/routes/_authenticated.app.index.tsx`: diálogo "Nova organização" agora exige selecionar categoria (com opção "Sem categoria"); remove import não usado de `useServerFn`.

---

# CHANGELOG — Venuespace

Registro cronológico de todas as implementações do projeto. Norma soberana da skill `venuespace` (§0 e §7): nenhuma iteração fecha sem entrada correspondente.

**Formato de cada entrada:**

- Cabeçalho: `## YYYY-MM-DD HH:MM (America/Sao_Paulo) — <escopo>`
- Bullets objetivos do que foi implementado (migrations, rotas, componentes, tokens, correções).
- Sem justificativas subjetivas, sem chain-of-thought — apenas o que foi feito.
- Ordem cronológica **decrescente** (mais recente no topo).

---

## 2026-07-14 23:15 — Header público unificado, voltar em detalhes, formulário como modal

- `src/components/venue/public-header.tsx`: novo componente sticky compartilhado (marca + Explorar + Entrar/Começar), prop `back` para botão de voltar tipado, `showAuthActions` e `showExplore` para variantes; mobile-first (labels colapsam em `<sm`).
- `src/components/venue/interest-form-modal.tsx`: novo Dialog shadcn que encapsula o formulário público (contato + `DynamicForm` do view), reaproveitando `/api/public/form-schema/:viewId` e `/api/public/:slug/:tableId/submit`; navega para `/lead/$token` no sucesso; loading/erro tratados dentro do modal.
- `src/routes/index.tsx`: header inline substituído por `<PublicHeader />`.
- `src/routes/explore.tsx`: header inline substituído por `<PublicHeader back={{to:"/"}} />`.
- `src/routes/public.$slug.$tableId.index.tsx`: `PublicHeader` no topo; botão "Manifestar interesse" de cada card abre `InterestFormModal` com o `recordId` respectivo em vez de navegar para a rota `/form`.
- `src/routes/public.$slug.$tableId.$recordId.tsx`: `PublicHeader` com `back` para a listagem da tabela (rótulo "Voltar para <tabela>"); CTA "Manifestar interesse" agora abre o modal.
- `src/routes/public.$slug.campaigns.$recordId.tsx`: `PublicHeader` com `back` para `/explore` (fluxo de contribuição inalterado).
- `src/routes/lead.$token.tsx`: `PublicHeader` sem botões de auth (destino final do lead).
- `src/routes/auth.tsx`: `PublicHeader` com `back` para `/` e sem ações de auth (evita duplicar Entrar/Começar).
- `src/routes/public.$slug.$tableId.form.tsx`: reescrita como fallback compatível — mantém a URL/`search` param antigos, renderiza `PublicHeader` + shell mínimo e abre o `InterestFormModal`; ao fechar volta para a listagem da tabela.
- Nenhuma alteração de esquema, endpoints, RLS ou tokens de cor. Typecheck limpo.

---


## 2026-07-14 22:30 — Edição/exclusão de organização e tabela + Explorar público

- `src/lib/orgs.functions.ts`: `updateOrganization` (owner-only, patch de name/description/logo_url), `deleteOrganization` (owner-only, confirma slug), `deleteTable` (owner-only, confirma nome).
- `src/components/venue/edit-org-dialog.tsx`: modal de edição da organização com AlertDialog de exclusão (digitar slug para confirmar); invalida `["org", slug]` e `["my-orgs"]`; ao excluir navega para `/app`.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`: botão "Editar organização" (visível para owner) que abre o modal; TableCard ganhou ícone de lixeira com AlertDialog exigindo digitar o nome; botão "Conversas" removido do header do painel (superfície única passa a ser o widget flutuante).
- `src/lib/public.server.ts`: `listPublicTables({ limit, offset, q })` agregando tabelas com pelo menos um record `status='published'`, projetando apenas metadados seguros (sem PII e sem `data` de records).
- `src/routes/api/public/tables.ts`: endpoint `GET /api/public/tables` com `Cache-Control: public, max-age=60, s-maxage=120, stale-while-revalidate=300`.
- `src/components/venue/public-tables-carousel.tsx`: carrossel shadcn com as 12 publicações mais recentes; card leva a `/public/:slug/:tableId`; fail-soft se vazio.
- `src/routes/index.tsx`: seção "Publicações recentes" com o carrossel + link "Ver todas" para `/explore`; novo botão "Explorar" no header público.
- `src/routes/explore.tsx`: nova rota pública `/explore` com busca por nome de tabela/organização, paginação (24 por página), grid responsiva e `head()` próprio (title/description/og/twitter).
- Nenhuma alteração de esquema: FKs de `organization_id` e `table_id` já estão com `ON DELETE CASCADE`.
- Typecheck limpo.

---


## 2026-07-14 21:00 — Fix: rota pública de detalhes e formulário não abriam

- `src/routes/public.$slug.$tableId.tsx`: convertida em layout puro (`() => <Outlet />`); antes renderizava a listagem sem `<Outlet />`, o que impedia o render das rotas filhas (`$recordId`, `form`) apesar da URL casar.
- `src/routes/public.$slug.$tableId.index.tsx`: nova rota índice contendo `PublicListPage` (mesma listagem, mesmo `head`), respondendo em `/public/:slug/:tableId`.
- Endpoints `/api/public/...` inalterados (200 OK verificado).

---


## 2026-07-14 20:15 — Edição de formulários públicos + otimização do fluxo público

- **Backend / server fns**
  - `src/lib/messages.functions.ts`: novas `getPublicFormView` e `updatePublicFormView` (nome, `auto_relation_field_id`, `form_field_ids`) com validação de propriedade e permissão via RLS existente. `submissions_table_id` permanece imutável.
  - `src/lib/public.server.ts` (`loadPublicRecord`): assinatura de URLs em batch (`createSignedUrls`) em vez de N chamadas sequenciais; resolução paralela de `relation` com labels reais; payload agora inclui `relations`.
- **API pública**
  - `src/routes/api/public/$slug/$tableId.ts` e `.../$tableId.$recordId.ts`: cabeçalho `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300` nos handlers `GET`.
- **UI**
  - `src/routes/_authenticated.app.$orgSlug.tables.$tableId.index.tsx`: ícone de lápis em cada card de formulário público abre `EditFormViewDialog` (Input nome, Select de campo relação, lista de Checkbox para escolher campos exibidos). Salvar dispara `updatePublicFormView` e invalida `["views", tableId]`.
  - `src/routes/public.$slug.$tableId.$recordId.tsx`: renderiza labels de `relation` a partir do payload; `<img>` com `loading="lazy"` + `decoding="async"`.
- **Performance**
  - `src/components/venue/app-shell.tsx`: `staleTime: 60_000` em `org`, `me-profile` e `my-orgs` para eliminar refetch entre navegações.
- **Verificação**
  - Fluxo público percorrido (listagem → detalhes → formulário → submissão); typecheck limpo.

---


## 2026-07-14 18:40 — UX: edição de tabelas, uploads reais, dropdown de perfil, chat flutuante, detalhes públicos

- **Backend / server fns**
  - `src/lib/orgs.functions.ts`: novos `updateTable` (patch de nome/descrição/ícone/bookable, com permissão owner/editor) e `addFieldOption` (append em `fields.config.options`, valida tipo `select`/`multiselect` e evita duplicatas case-insensitive).
  - `src/lib/profile.functions.ts` (novo): `getMyProfile`, `updateMyProfile` e `getSignedUploadUrl` (assina objetos privados de `venue-uploads` via `supabaseAdmin`).
  - `src/lib/public.server.ts`: `loadPublicRecord` retorna um único registro publicado, campos, `signed_urls` pré-assinadas para `image`/`file` e referência ao `public_form_view`.
- **API pública**
  - `src/routes/api/public/$slug/$tableId.$recordId.ts` (novo): `GET` retorna detalhe público com URLs assinadas.
- **Rotas**
  - `src/routes/public.$slug.$tableId.$recordId.tsx` (novo): página pública de detalhe do registro (título, imagens, campos formatados, arquivos assinados, CTA para o formulário público).
  - `src/routes/public.$slug.$tableId.tsx`: cards agora linkam para `/public/:slug/:tableId/:recordId` e ganham botão explícito "Ver detalhes".
  - `src/routes/_authenticated.me.settings.tsx` (novo): configurações do perfil (nome de exibição + upload de avatar em `venue-uploads/<uid>/avatar-*`).
- **Componentes**
  - `src/components/venue/app-shell.tsx`: removidos links soltos do topo; adicionado dropdown de perfil (avatar) com Configurações, Minhas candidaturas, Calendário, Membros e Sair; renderiza `ChatWidget` quando há org ativa; mantém `NotificationsBell` no header.
  - `src/components/venue/chat-widget.tsx` (novo): botão flutuante bottom-right; abre `Sheet` com listagem de conversas da org e painel de conversa inline (thread + envio de texto/proposta + aceitar/recusar). Polling de 5 s reaproveitado.
  - `src/components/venue/dynamic-form.tsx`: reescrito com `UploadField` real (upload direto para `venue-uploads` via cliente autenticado, com preview via signed URL) para `image` e `file`; `multiselect` renderizado como chips; `select`/`multiselect` recebem inline "Adicionar opção" (usa `addFieldOption`); props `disableUploads`/`disableOptionEditing` para uso em formulários públicos anônimos.
  - `src/components/venue/dynamic-grid.tsx`: `image` renderiza thumbnail via signed URL; `file` sinaliza presença; demais tipos mantidos.
- **Painel da organização**
  - `src/routes/_authenticated.app.$orgSlug.index.tsx`: cada card de tabela ganha ícone lápis (visível para owner/editor) que abre `Dialog` de edição usando `updateTable`; link do card para o detalhe da tabela preservado.
- **Esquema da tabela**
  - `src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`: para campos `select`/`multiselect`, exibe `OptionsManager` com lista atual e input para adicionar novas opções (usa `addFieldOption`).
- **Formulário público**
  - `src/routes/public.$slug.$tableId.form.tsx`: `DynamicForm` invocado com `disableUploads` e `disableOptionEditing` — anônimos veem URL de texto no lugar do upload (bucket privado exige sessão) e não editam opções.
- **Diretriz §0 / §7**
  - Nenhuma iteração anterior alterada; RLS de `venue-uploads` continua restrito a owners (uploads via cliente autenticado sob `<uid>/…`).

---


## 2026-07-14 17:20 — Correção: bloqueio na criação de organização

- Verificado que as chaves de assinatura JWT do projeto já estão em ES256 (`in_use`); HS256 permanece apenas como `previously_used`.
- Confirmado `.env` com chaves `sb_publishable_…` (novo formato) em `SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY`; dev server reiniciado para recarregar `process.env`.
- `createOrganization` mantida como RPC `public.create_organization` (SECURITY DEFINER) — validação de `auth.uid()` e inserção acontecem no banco, contornando erro de RLS/policy no INSERT direto.
- `src/hooks/use-auth.ts`: revalidação da sessão via `supabase.auth.getUser()`; token inválido/stale (ex.: emitido antes da rotação de chaves) dispara `signOut({ scope: "local" })` e o guard `_authenticated` redireciona para `/auth`.
- Varredura de regressão executada sobre Iterações 1–8: server fns em `orgs.functions.ts`, `records.functions.ts`, `messages.functions.ts`, `applications.functions.ts` e rotas `src/routes/api/public/*` continuam usando o padrão correto (`.functions.ts` para app-internal com `requireSupabaseAuth`; `public.server.ts` publishable-key para rotas anônimas).

---

## 2026-07-14 18:30 — Iterações 5, 6, 7, 8



**Iteração 5 — Candidatura autenticada + /me/applications:**
- Migração RLS: `records: applicants can read own` (aplicant_user_id = auth.uid()); índices `messages(read_at)` e `records(applicant_user_id)`.
- `src/lib/applications.functions.ts`: `getMyApplications` cross-org, retorna com conversation_id anexado.
- `src/routes/_authenticated.me.applications.tsx`: lista candidaturas do usuário, link para conversa.
- `src/routes/public.$slug.$tableId.form.tsx`: envio agora anexa Authorization Bearer quando há sessão, preenchendo applicant_user_id no /submit.

**Iteração 6 — Campanhas de arrecadação:**
- `src/routes/api/public/campaigns/$recordId.ts`: GET com progresso confirmado (soma apenas `contribution_status='confirmed'`), POST cria contribuição em tabela de submissões via public_form, gera conversa e lead_access_token quando anônimo.
- `src/routes/public.$slug.campaigns.$recordId.tsx`: página pública com meta, barra de progresso, chave PIX e formulário de contribuição.
- `applications.functions.ts`: `setContributionStatus` (owner/editor via RLS) e `listContributionsForCampaign`.

**Iteração 7 — Motor de reserva:**
- `applications.functions.ts`: `runBookingCheck` (detecção via `fields.config.booking_role` start/end + relação de recurso), `checkBookingConflict` server fn, `listOccupancy`.
- `messages.functions.ts`: `setDealStatus` rejeita transição para `accepted`/`closed` quando há conflito de datas com outra reserva aceita/fechada no mesmo recurso.
- `src/routes/_authenticated.app.$orgSlug.calendar.tsx`: calendário simples de ocupação por tabela reservável.

**Iteração 8 — Membros + polimento + notificações:**
- `applications.functions.ts`: `updateMembershipRole`, `removeMembership`, `listUnreadForOrg`, `markConversationRead`.
- `src/routes/_authenticated.app.$orgSlug.members.tsx`: adicionar membro por e-mail, alterar papel, remover (restrito a owner).
- `src/components/venue/notifications-bell.tsx`: sino com contador de mensagens não lidas (polling 15s), popover com últimas 20.
- `src/components/venue/app-shell.tsx`: integração com bell, links "Membros"/"Calendário"/"Minhas candidaturas".

**Validação:** Typecheck limpo. RLS revisado. Nenhum endpoint público retorna PII. Sem regressão nas iterações 1-4.

---


## 2026-07-14 17:00 — Iteração 3 + Iteração 4: Publicação pública, formulários, chat e negociação

**Migrations:**
- Novas tabelas: `conversations`, `messages`, `lead_access_tokens` (com RLS, GRANTs, índices).
- Políticas `TO anon SELECT` em `organizations`, `tables`, `fields`, `views` (metadados públicos) e em `records` restrita a `status='published'`.
- `messages`: policies para membros da org, autor autenticado, e delete restrito a editores. `lead_access_tokens`: locked (apenas service_role via server routes).

**Server routes (`/api/public/*`):**
- `GET /api/public/$slug/$tableId` — payload público via cliente publishable (org, tabela, campos, records publicados, view public_form ativa).
- `POST /api/public/$slug/$tableId/submit` — validação Zod do payload, verificação de origem, preenchimento automático do campo relação, criação de record na tabela de submissões, criação de `conversation` vinculada e geração de `lead_access_token` (para anon).
- `GET|POST /api/public/lead/$token` — leitura da conversa e envio de mensagens (texto e proposta) por interessado anônimo.
- `GET /api/public/form-schema/$viewId` — expõe o esquema efetivo do formulário (campos visíveis, campos obrigatórios).

**Server functions (`src/lib/messages.functions.ts`):**
- `listConversations`, `getConversation`, `listMessages`, `sendMessage` (papel `member`/`lead` inferido de membership).
- `setProposalStatus` (accept/decline em `messages.proposal_status`).
- `setDealStatus` (`negotiating → accepted/declined → closed`; ao fechar copia `agreed_value` da última proposta aceita).
- `createPublicFormView` (criação de views `public_form` com `submissions_table_id` e `auto_relation_field_id`).

**Server helpers:** `src/lib/public.server.ts` — factory de cliente publishable (com fetch shim para chaves `sb_`), `loadPublicTable`, `loadPublicFormSchema`.

**Componentes:**
- `src/components/venue/conversation-thread.tsx` — renderizador de mensagens com suporte a propostas (aceitar/recusar) e estilo por remetente.

**Rotas UI:**
- `/public/$slug/$tableId` — página pública com lista de registros publicados e CTA "Manifestar interesse".
- `/public/$slug/$tableId/form` — formulário público com validação de e-mail, submissão via API pública, redirect para `/lead/$token`.
- `/lead/$token` — chat do interessado anônimo (polling 5s, envio de texto/proposta).
- `/app/$orgSlug/conversations` — inbox de conversas da organização (polling 5s).
- `/app/$orgSlug/conversations/$conversationId` — detalhe da conversa: thread, envio de texto/proposta, aceitar/recusar propostas, transições `deal_status`.

**Ajustes UI:**
- `/app/$orgSlug`: novo botão "Conversas" no header.
- `/app/$orgSlug/tables/$tableId`: painel "Formulários públicos" (criar/remover view `public_form` apontando para tabela de submissões, com escolha do campo relação de origem); botão "Ver público" abre `/public/...` em nova aba; link de "Abrir formulário" para cada view.

**Sem regressão:** Iterações 1 e 2 continuam funcionando (org, tabelas, campos, records, grid).
**Sem PII em endpoints públicos além do que o organizador publicou/exigiu no formulário.**
**Sem cor hardcoded; sem componente duplicado.**

---

## 2026-07-14 13:25 — Norma de registro + CHANGELOG (registro retroativo)

- Criado `CHANGELOG.md` na raiz do projeto como arquivo dedicado ao histórico de implementações.
- Skill `venuespace` atualizada: cláusula de **Registro obrigatório de implementações** adicionada à Diretriz de Desenvolvimento §0 (soberana) e item 8 adicionado ao Checklist §7 (gate de fechamento de iteração).
- Entradas retroativas das Iterações 1 e 2 incorporadas abaixo.

---

## 2026-07-14 — Iteração 2: Records + Grid Dinâmico (registro retroativo)

- **Migrations**: tabelas `records`, `views`, `permissions` com RLS habilitada e GRANTs para `authenticated`/`service_role`; políticas escopadas por `has_role`/`is_org_member`/`can_edit_org`.
- **Server functions** (`src/lib/records.functions.ts`): `listRecords`, `createRecord`, `updateRecord`, `deleteRecord`, `publishRecord` com validação Zod dinâmica de `data` jsonb contra `fields`.
- **Resolver de campos**: `computed` (soma, contagem, soma qty×valor) e expansão de `relation` na leitura.
- **Componentes de domínio**:
  - `src/components/venue/dynamic-form.tsx` — formulário dinâmico por `field.type`.
  - `src/components/venue/dynamic-grid.tsx` — tabela em desktop (dentro de `ScrollArea`) e cards em mobile via `useIsMobile`; ações via `DropdownMenu`.
- **Rota**: `/app/$orgSlug/tables/$tableId` — CRUD completo de registros + publicar/despublicar (`status`).
- **Ajuste**: card da tabela no dashboard `/app/$orgSlug` aponta para a página de registros; atalho para schema builder preservado.
- Sem novos tokens; sem cor hardcoded; sem regressão da Iteração 1.

---

## 2026-07-14 — Iteração 1: Fundação (registro retroativo)

- **Lovable Cloud** habilitado; cliente Supabase gerado.
- **Migrations**:
  - Enums: `app_role` (owner, editor, viewer), `record_status`, `deal_status`, `contribution_status`, `field_type`, `view_type`.
  - Tabelas: `profiles`, `organizations`, `memberships`, `tables`, `fields` — todas com RLS habilitada e GRANTs explícitos.
  - Funções SECURITY DEFINER: `has_role(user, org, role)`, `is_org_member`, `can_edit_org` (search_path fixo).
  - Triggers: criação automática de `profiles` no signup; atribuição de `owner` ao criador da organização.
- **Auth**: login por e-mail/senha e Google via broker Lovable.
- **Design System** (`src/styles.css`):
  - Tokens em **oklch** para light + dark: neutros (ivory/graphite), marca (deep teal), estados (success/warning/info), status de negociação e contribuição.
  - Utilities: sombras elegantes, gradientes de marca; todos registrados em `@theme inline`.
  - Tipografia: Fraunces (display) + Inter Tight (body) via `<link>` em `__root.tsx` e `@theme`.
- **Componentes de domínio**:
  - `src/components/venue/app-shell.tsx` — layout autenticado com header responsivo.
  - `src/components/venue/empty-state.tsx` — padrão compartilhado para estados vazios.
- **Server functions** (`src/lib/orgs.functions.ts`): listar/criar organizações, tabelas, campos; convite básico de membro por e-mail.
- **Rotas**:
  - `/auth` — login/signup e-mail + Google.
  - `/_authenticated` — layout com gate client-side.
  - `/app` — organizações do usuário.
  - `/app/$orgSlug` — dashboard da organização (tabelas + membros).
  - `/app/$orgSlug/tables/$tableId/schema` — schema builder de campos.
- **Meta tags globais** atualizadas para "Venuespace".
