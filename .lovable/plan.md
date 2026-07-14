## Iteração 9 — Configurações Gerais da Instância (Super Admin)

Escopo fechado. Governada pela Diretriz §0. Sem White Label. Registro obrigatório em `CHANGELOG.md`.

### Decisões (respostas do usuário)
1. **Fuso/moeda**: padrão da instância + override por organização.
2. **Permissão de campos**: toggle **global** em `instance_settings` (não por categoria). Descarta `organization_category_policies`.
3. **Campos padrão da categoria**: aplicados a **toda tabela nova** de organização daquela categoria.
4. **Retroatividade**: tudo retroativo. Rótulos refletem em toda UI. Política global de campos vale para orgs existentes. Categoria atribuída a org já existente altera comportamento a partir dali. Campos padrão **não** são retroinjetados em tabelas existentes — só em novas (evita corromper dados).
5. **Confirmação adicional**: super admin tem CRUD explícito de `organization_categories` (adicionar, editar, remover) no painel — item de primeira classe da iteração.

### Modelo de dados

Migration única (com GRANTs, RLS e políticas):

```
instance_settings              -- singleton (id smallint PK check id=1)
  default_timezone text NOT NULL DEFAULT 'America/Sao_Paulo'
  default_currency text NOT NULL DEFAULT 'BRL'
  currency_display jsonb NOT NULL DEFAULT
    '{"symbol":"R$","position":"before","decimal":",","thousand":"."}'
  allow_user_field_management boolean NOT NULL DEFAULT true
  updated_at timestamptz

platform_labels (key text PK, label text, icon text, updated_at)
  -- seed: organization, table, record, view, field, membership,
  --       conversation, message, campaign, contribution, booking

system_form_fields (id, form_key, field_key, label, icon, order_index)
  -- form_key ∈ {create_organization, create_table, create_record}
  -- seed com os campos atuais dos formulários internos

organization_categories (id, name, icon, description, created_at, updated_at)

organizations
  + category_id uuid NULL REFERENCES organization_categories(id) ON DELETE SET NULL
  + timezone text NULL              -- override; NULL = usa instance_settings
  + currency text NULL              -- override
  + currency_display jsonb NULL     -- override

organization_category_default_fields
  (id, category_id, field_name, field_type, config jsonb, order_index, created_at)
```

**Descartado desta iteração:** `organization_category_policies` (resposta 2 tornou o toggle global).

### RLS / permissões
- `instance_settings`, `platform_labels`: `SELECT` para `anon` + `authenticated` (necessário em telas públicas para formatação/rotulagem). `INSERT/UPDATE/DELETE` restrito a `is_super_admin(auth.uid())`.
- `system_form_fields`, `organization_category_default_fields`: `SELECT` a `authenticated`; escrita: super admin apenas.
- `organization_categories`: `SELECT` a `anon` + `authenticated` (usado em filtro público `/explore` e seletor de categoria na criação/edição de org); `INSERT/UPDATE/DELETE` restrito a `is_super_admin(auth.uid())`. `ON DELETE SET NULL` em `organizations.category_id` protege orgs de "sumir" quando categoria é removida.
- `organizations.category_id`/overrides: editável por `owner` da org (categoria e overrides próprios) e por super admin.
- Verificação global `allow_user_field_management` aplicada nos server fns de criação/edição/remoção de fields — super admin sempre passa.

### Backend (server fns)

Novos módulos, com `requireSupabaseAuth` + verificação `is_super_admin` onde aplicável:

- `src/lib/instance-settings.functions.ts`: `getInstanceSettings` (leitura pública via `/api/public/instance-settings`), `updateInstanceSettings` (super admin).
- `src/lib/platform-labels.functions.ts`: `listPlatformLabels` (pública via `/api/public/platform-labels`), `upsertPlatformLabel`, `listSystemFormFields`, `upsertSystemFormField`.
- `src/lib/organization-categories.functions.ts`:
  - `listOrganizationCategories` (pública via `/api/public/organization-categories`).
  - `createOrganizationCategory` (super admin) — nome, ícone lucide, descrição.
  - `updateOrganizationCategory` (super admin).
  - `deleteOrganizationCategory` (super admin) — `ON DELETE SET NULL` já protege orgs vinculadas; UI confirma "N organizações ficarão sem categoria".
  - `listCategoryDefaultFields`, `upsertCategoryDefaultField`, `deleteCategoryDefaultField`, `reorderCategoryDefaultFields` (super admin).
- `src/lib/orgs.functions.ts` (extensão): aceitar `category_id`, `timezone`, `currency`, `currency_display` em `createOrganization`/`updateOrganization`.
- `src/lib/records.functions.ts` (ajuste): ao criar tabela, se org tiver `category_id`, semear `fields` a partir de `organization_category_default_fields` (não retroativo em tabelas existentes). Nas fns de mutação de `fields`, bloquear quando `allow_user_field_management=false` e caller não for super admin.

Endpoints públicos:
- `GET /api/public/instance-settings`
- `GET /api/public/platform-labels`
- `GET /api/public/organization-categories`
- `/api/public/tables` passa a aceitar `?category=` para filtro em `/explore`.

### Formatação central (utilitário)

`src/lib/formatting.ts`:
- `resolveTimezone(orgOverride?)`, `resolveCurrency(orgOverride?)`, `resolveCurrencyDisplay(orgOverride?)` — merge override da org com instance_settings.
- `formatDateTime(iso, ctx)`, `formatDate(iso, ctx)`, `formatCurrency(number, ctx)`.
- `ctx` recebe overrides da org quando disponível (contexto autenticado sabe qual org), ou só instance para telas públicas cross-tenant.

Hooks `useLabels()` e `useInstanceContext()` (React Query, `staleTime: 5min`) — consumidos em `AppShell`, `PublicHeader`, formulários dinâmicos, chat (timestamps), campanhas (moeda), propostas (moeda), calendário (fuso).

### Frontend

**Painel Super Admin** — nova rota `/_authenticated/admin` (gated por `is_super_admin`, redireciona se não for):
- Aba **Geral**: fuso, moeda, `currency_display` (símbolo, posição antes/depois, separador decimal/milhar), toggle `allow_user_field_management`.
- Aba **Rótulos**: tabela editável de `platform_labels` (label + ícone lucide) e `system_form_fields`, com preview lateral do formulário afetado.
- Aba **Categorias** (item explícito da iteração):
  - Listagem de todas as `organization_categories` (nome, ícone, descrição, contagem de orgs vinculadas).
  - **Adicionar** categoria via modal (nome, ícone lucide via seletor, descrição).
  - **Editar** categoria (mesmo modal, pré-preenchido).
  - **Remover** categoria com `AlertDialog` de confirmação, informando quantas organizações ficarão sem categoria (não bloqueia — `SET NULL`).
- Aba **Campos padrão**: seletor de categoria → sub-editor de `organization_category_default_fields` (adicionar/editar/reordenar/remover; nome, tipo, config, ordem).
- Entrada: link no `SettingsModal` (visível só quando `is_super_admin`) e no dropdown do avatar em `AppShell`.

**Refactor transversal (obrigatório para fechar a iteração):**
- Substituir strings fixas ("Organização", "Tabela", "Registro", "View", "Campo", "Membro", "Conversa", "Mensagem", "Campanha", "Contribuição", "Reserva") em toda a UI (autenticada e pública) por `useLabels()`. Levantamento: `AppShell`, `PublicHeader`, `EmptyState`, `DynamicGrid`, `DynamicForm`, telas `/app/*`, `/public/*`, `/explore`, `/me/applications`, `EditOrgDialog`, formulários de criação.
- Substituir toda formatação local de data (`toLocaleString`, `format`, etc.) e valor (`R$ ${n}`, `Intl.NumberFormat` inline) por `formatDateTime`/`formatCurrency` do utilitário central. Pontos conhecidos: chat, propostas, campanhas, calendário, listagens com `computed` monetário, `/me/applications`.
- `EditOrgDialog` ganha: seleção de categoria + overrides opcionais de fuso/moeda/display.
- Criação de org: campo opcional de categoria (dropdown das categorias existentes).
- `/explore` e `PublicTablesCarousel`: filtro por categoria (chips ou select).

### Aceite

1. Super admin altera moeda para USD e todo valor monetário da instância (autenticado + público) reflete após revalidação de cache.
2. Org override de fuso: timestamps de mensagens/registros da org X exibem no fuso Y sem afetar org Z.
3. Super admin renomeia "Registro" → "Item"; todas as telas (grid, form, empty states, public) refletem.
4. Super admin desliga `allow_user_field_management`: owner de org não-super-admin recebe erro ao tentar criar/editar/apagar `field`; super admin continua passando.
5. Super admin **adiciona** categoria "Locação de espaços", **edita** seu ícone, e depois **remove** — orgs vinculadas ficam com `category_id=NULL` sem quebrar.
6. Categoria com 3 campos padrão: nova tabela criada em org dessa categoria nasce com esses 3 campos; tabela pré-existente permanece intacta.
7. `/explore` filtra por categoria.
8. Registro no `CHANGELOG.md` cobrindo migration, endpoints, componentes tocados e refactor de strings/formatação.

### Fora de escopo (reafirmado)

- White Label (domínio próprio, logo/cores por org).
- i18n multi-idioma.
- Retroinjeção de campos padrão em tabelas existentes.
- Políticas de campo por categoria (substituído por toggle global).

### Nota documental
Ao aprovar, atualizar a seção "Fora de escopo" do documento de estado atual: `organization_categories` resolve a taxonomia cross-tenant que faltava para `/explore` e `GET /api/public/tables`, eliminando a tensão com "sem marketplace cross-tenant".