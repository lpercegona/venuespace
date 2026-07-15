# Iteração 11 — Cascata de campos por categoria (Organização → Tabela → Registro)

Extensão da Iteração 9/10. Governada pela Diretriz §0. Registro obrigatório em `CHANGELOG.md`.

## Decisões consolidadas (respostas do usuário)

1. **Categoria obrigatória sempre** na criação de organização — elimina fluxo sem categoria.
2. **Trava só quando `allow_user_field_management = false`.** Com `true`, admin comum pode adicionar campos extras aos herdados, mas nunca remover/editar os que vieram da categoria.
3. **Reconciliação total retroativa** ao mudar/associar categoria: merge de todos os campos da categoria nos três níveis; `category_data` revalidado; campos órfãos preservados como legacy read-only.
4. **Campos-base fixos por nível, editáveis pelo super admin** (o super admin pode marcar cada base como visível/oculto/obrigatório na categoria):
   - Organização: `name`, `slug`, `category_id` (sempre presentes) + description, logo, timezone, currency toggláveis pelo super admin.
   - Tabela: `name`, `icon`, `description` (sempre presentes).
   - Registro: nenhum campo-base — 100% definido por `organization_category_default_fields`.

## 1. Modelo de dados (migration única)

```sql
-- Novos: campos de categoria nos níveis Organização e Tabela
category_org_fields (
  id, category_id fk, field_key, label, field_type,
  required boolean, config jsonb, order_index int,
  created_at, updated_at,
  UNIQUE(category_id, field_key)
)

category_table_fields (
  id, category_id fk, field_key, label, field_type,
  required boolean, config jsonb, order_index int,
  created_at, updated_at,
  UNIQUE(category_id, field_key)
)

-- Reaproveitado: organization_category_default_fields (Iteração 9)
-- Passa a ser schema exclusivo quando allow_user_field_management=false.

-- Payloads validados contra as definições da categoria
ALTER TABLE public.organizations ADD COLUMN category_data jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.tables        ADD COLUMN category_data jsonb NOT NULL DEFAULT '{}';

-- Toggle de bases por categoria (visibilidade/obrigatoriedade dos campos-base)
ALTER TABLE public.organization_categories
  ADD COLUMN base_field_config jsonb NOT NULL DEFAULT
    '{"organization":{"description":{"visible":true,"required":false},
                      "logo":{"visible":true,"required":false},
                      "timezone":{"visible":true,"required":false},
                      "currency":{"visible":true,"required":false}},
      "table":{"icon":{"visible":true,"required":false},
               "description":{"visible":true,"required":false}}}';

-- Marca de origem em fields para preservar campos herdados vs livres
ALTER TABLE public.fields
  ADD COLUMN source text NOT NULL DEFAULT 'user',   -- 'category' | 'user' | 'legacy'
  ADD COLUMN category_field_key text NULL;

-- category_id passa a ser NOT NULL em organizations
-- (após backfill: orgs sem categoria recebem uma categoria padrão "Sem categoria")
```

RLS: SELECT anon+authenticated nas duas novas tabelas de campos de categoria; INSERT/UPDATE/DELETE somente super admin. GRANTs coerentes.

## 2. Backend

**Novos módulos**
- `src/lib/category-org-fields.functions.ts` — CRUD super admin + `listByCategory(category_id)`.
- `src/lib/category-table-fields.functions.ts` — idem para tabelas.
- `src/lib/category-cascade.server.ts` — helper compartilhado:
  - `resolveOrgSchema(category_id) → { base, extras }`
  - `resolveTableSchema(category_id) → { base, extras }`
  - `resolveRecordSchema(table_id, category_id) → fields[]` (exclusivo ou merge conforme toggle)
  - `reconcileOrganization(org_id)` / `reconcileTables(org_id)` — merge retroativo idempotente.

**Alterações**
- `orgs.functions.ts` — `createOrganization`/`updateOrganization` exigem `category_id`, validam `category_data` com `zodForField` sobre `category_org_fields`. Ao mudar categoria: dispara reconciliação total.
- `tables.functions.ts` — `createTable`/`updateTable` validam `category_data` contra `category_table_fields`. Ao criar tabela: copia `organization_category_default_fields` para `public.fields` com `source='category'`; quando toggle=false, bloqueia endpoints de criar/editar/apagar `fields` para não-super-admin (apenas campos `source='user'` são editáveis, e mesmo assim só com toggle=true).
- `fields.functions.ts` (ou equivalente) — enforce: `source='category'` só o super admin altera/remove; se toggle=false, admin comum não cria field algum.
- `records.functions.ts` — `zodForField` já genérico; nada a mudar além de garantir uso da lista resolvida.

**Endpoints públicos** (necessários para /explore cross-tenant coerente)
- `GET /api/public/category-schema/:category_id` — retorna `{ org_fields, table_fields, record_fields, base_field_config }`.

**Backfill (dentro da migration)**
- Cria categoria "Sem categoria" e associa a todas as orgs com `category_id IS NULL`.
- Marca todos os `fields` existentes com `source='legacy'`.
- Executa `reconcileTables` para todas as orgs.

## 3. Frontend

### Painel `/admin` → aba Categorias (estende Iteração 9)

Cada linha de categoria expande em **acordeão sequencial** de 4 seções, cada uma habilitada só após a anterior ter ≥1 item (ou explicitamente marcada como "sem campos extras"):

1. **Bases** — matriz dos campos-base (organização + tabela) com toggles `visível`/`obrigatório`.
2. **Campos da Organização** — CRUD de `category_org_fields` (mesmo editor de campo já existente).
3. **Campos da Tabela** — CRUD de `category_table_fields`.
4. **Campos do Registro** — CRUD de `organization_category_default_fields` (renomeia visualmente para "Campos do Registro").

Toggle `allow_user_field_management` da categoria fica na header do acordeão, com aviso explicando o modo.

Botão "Reconciliar retroativamente" na header executa `reconcileOrganization` para todas as orgs da categoria.

### Fluxos do admin comum

- **Nova organização** (`_authenticated.app.index.tsx`):
  1. Passo 1: seletor obrigatório de categoria.
  2. Passo 2: formulário renderizado a partir de bases visíveis + `category_org_fields`. Sem botão "adicionar campo".
- **Edit org dialog**: mesma renderização dinâmica; categoria só é alterável por owner; ao mudar avisa "isso reconcilia campos de todas as tabelas".
- **Nova tabela** (`_authenticated.app.$orgSlug.index.tsx` / schema route): formulário = bases visíveis + `category_table_fields`. Após criar, redireciona para `schema.tsx`.
- **Schema da tabela** (`_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`):
  - Lista fields com badge `source` (herdado/livre/legacy).
  - Campos `category` e `legacy` read-only para não-super-admin.
  - Botão "Adicionar campo" só aparece quando toggle=true.
- **Formulário de registro** (`DynamicForm` existente): já é dinâmico; recebe lista resolvida pelo backend — nenhuma UI de "adicionar campo".

### /explore

Passa a exibir filtro por categoria e (dado que orgs da mesma categoria têm mesmo schema de registro) filtros por campos comuns do registro. Fora deste escopo aprofundar UI — apenas garantir que a mudança de schema não quebra a listagem atual.

## 4. Aceite

1. Super admin cria categoria "Locação", define bases, `category_org_fields`, `category_table_fields`, `organization_category_default_fields` — nessa ordem, com bloqueio sequencial na UI.
2. Admin comum cria org escolhendo "Locação" → formulário mostra apenas campos definidos, sem botão de adicionar.
3. Admin comum cria tabela nessa org → schema herda `organization_category_default_fields` automaticamente, marcados `source='category'`, read-only.
4. Toggle `allow_user_field_management=true` na categoria → admin comum ganha botão "Adicionar campo" na tabela, mas não consegue editar/apagar campos `source='category'`.
5. Super admin muda a categoria de uma org existente → tabelas antigas recebem os campos faltantes; `category_data` de org e tabelas revalidado; campos antigos fora do schema ficam como `legacy` read-only; toast confirma N campos adicionados em M tabelas.
6. Botão "Reconciliar retroativamente" na categoria itera todas as orgs vinculadas.
7. Typecheck limpo, build passa, 360/768/1280 em light+dark, sem regressão nas iterações 1-10, RLS+GRANTs revisados.
8. `CHANGELOG.md` com entrada datada cobrindo migration, backfill, endpoints, componentes e regras de permissão.

## 5. Detalhes técnicos

- Reuso de `zodForField` de `src/lib/field-schema.ts` em todos os três níveis.
- `source='legacy'` nunca é removido automaticamente; apenas marcação para UI diferenciada.
- Reconciliação é idempotente: chave = `field_key` da categoria; nunca sobrescreve config/valores de campo existente com mesmo key.
- Migration inclui trigger `updated_at` nas duas novas tabelas.
- Enforcement de `source='category'` acontece no server fn de fields — nunca só na UI.
