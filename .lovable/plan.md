# Iterações do Venuespace

Conforme o plano soberano definido em `skill/venuespace`. Escopo fechado por iteração (§0). Status atual: **Iterações 1 e 2 concluídas**; restam 6.

## Concluídas

### Iteração 1 — Fundação [CONCLUÍDA]
Lovable Cloud, migrations base (enums, `organizations`, `memberships`, `tables`, `fields`, RLS, GRANTs, `has_role`), auth email+Google, trigger `profiles`, layout `_authenticated`, painéis `/app`, `/app/$orgSlug`, schema builder. Tokens Venuespace (light+dark, marca, estados, status) em `src/styles.css`. Par tipográfico Fraunces + Inter Tight via `<link>` em `__root.tsx`. Metas globais.
**Aceite:** criar org, tabela "Imóveis", convidar editor.

### Iteração 2 — Records + Grid Dinâmico [CONCLUÍDA]
Migrations de `records`, `views`, `permissions` (+ `views.submissions_table_id`, `tables.bookable`). Server fns com validação Zod dinâmica de `data` jsonb, resolver de `computed` (soma, contagem, soma qty×valor) e `relation` na leitura. `DynamicGrid` e `DynamicForm`. CRUD `views` (grid interna) e `permissions`. Publicar/despublicar. `EmptyState`.
**Aceite (A + D):** catálogos + orçamento com computed qty×valor.

## Pendentes

### Iteração 3 — Publicação pública + public_form
- `GET /api/public/$slug/$tableId` (server publishable client, política `TO anon` restrita a `status='published'`, projeção via `views.config`).
- `POST /api/public/$slug/$tableId/submit` — grava em `submissions_table_id`, preenche `auto_relation_field_id`, rate-limit best-effort por IP.
- Submissão anônima (gera `lead_access_tokens`, exige `contact_email`) e autenticada (`applicant_user_id`).
- `conversation` criada vinculada ao record de submissão.
- Rotas `/public/$slug/$tableId` e `/public/$slug/$tableId/form`.
**Aceite (B):** dois interessados → dois records + duas conversas.

### Iteração 4 — Chat + propostas + deal_status
- CRUD `messages` (acesso por membership, token ou sessão).
- UI com `type='proposal'` + `proposed_value`.
- `PATCH /records/$id/deal_status` (`negotiating → accepted/declined → closed`; ao fechar copia `agreed_value` da última proposta aceita).
- Rota `/lead/$token`, inbox `/app/$orgSlug/conversations`, polling 5s.
**Aceite (C).**

### Iteração 5 — Candidatura autenticada + `/me/applications`
- Submissão preenche `applicant_user_id` sem tornar o usuário membro.
- Server fn `getMyApplications` cross-org.
- Rota `/me/applications` sob `_authenticated/`.
**Aceite (E).**

### Iteração 6 — Campanhas de arrecadação
- Convenção "Campanhas" + "Contribuições" (relacionadas).
- `computed` na campanha soma apenas `contribution_status='confirmed'`.
- Página pública `/public/$slug/campaigns/$recordId` (meta, barra de progresso, chave PIX, formulário via `public_form`).
- `PATCH /records/$id/contribution_status` restrito a owner/editor.
- Painel do organizador para confirmar recebimentos.
**Aceite (F).**

### Iteração 7 — Motor de reserva
- Detecção via `fields.config.booking_role` + `resource_relation_field_id` em tabela `bookable`.
- Query de conflito, rejeição também na transição para `accepted`.
- Calendário simples de ocupação.
**Aceite extra:** locação entre datas rejeita segunda reserva sobreposta.

### Iteração 8 — Membros + polimento
- `/app/$orgSlug/members` (convite por e-mail, alterar role, remover).
- Notificações in-app (sino) via `messages.read_at`.
- SEO/OG por rota pública (title/description/og por org + record; og:image apenas em leaf routes com imagem real).
- Landing `/` explicando Venuespace, meta tags globais confirmadas.

## Governança (aplica a todas as pendentes)
- Diretriz §0 soberana: escopo fechado, ambiguidade = parada, sem melhorias implícitas.
- Checklist §7 antes de fechar cada iteração (build, 360/768/1280 em light+dark, estados, sem regressão, RLS + GRANTs, sem PII em `/api/public/*`, `CHANGELOG.md` atualizado).

## Próximo passo sugerido
Aprovar execução da **Iteração 3 — Publicação pública + public_form**.
