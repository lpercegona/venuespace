# CHANGELOG — Venuespace

Registro cronológico de todas as implementações do projeto. Norma soberana da skill `venuespace` (§0 e §7): nenhuma iteração fecha sem entrada correspondente.

**Formato de cada entrada:**

- Cabeçalho: `## YYYY-MM-DD HH:MM (America/Sao_Paulo) — <escopo>`
- Bullets objetivos do que foi implementado (migrations, rotas, componentes, tokens, correções).
- Sem justificativas subjetivas, sem chain-of-thought — apenas o que foi feito.
- Ordem cronológica **decrescente** (mais recente no topo).

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
