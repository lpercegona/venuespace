## Objetivo

Iteração 21 — Adicionar toggle "Pública" para tabelas (nível organização) e para tabelas padrão (nível super admin), controlando se a tabela aparece nas listagens/detalhes públicos.

## Escopo

### 1. Banco (migration)

- `ALTER TABLE public.tables ADD COLUMN is_public boolean NOT NULL DEFAULT false;`
- `ALTER TABLE public.category_standard_tables ADD COLUMN is_public boolean NOT NULL DEFAULT false;`
- Atualizar RPC `create_organization` para copiar `is_public` de `category_standard_tables` ao instanciar tabelas.
- Retroativo: manter default `false` (usuário liga manualmente). Não backfill.

### 2. Backend (`src/lib/orgs.functions.ts`)

- `tableCreate` e `tableUpdate` (Zod): incluir `is_public: z.boolean().optional()`.
- `createTable` handler: persistir `is_public` (default false).
- `updateTable` handler: aplicar patch de `is_public`.
- `listTables` / `getTable`: incluir `is_public` no select.

### 3. Backend público (`src/lib/public.server.ts`)

- `listPublicTables`: filtrar apenas tabelas com `tables.is_public = true` (adicionar select do campo e filtro após agregação, ou `.eq("table.is_public", true)` via join).
- `loadPublicTable`: além do check de `organizations.is_public`, exigir `table.is_public === true` — senão "Tabela não encontrada".
- `listPublicRecords` (linha ~439): filtrar `table.is_public !== false`.
- Rotas `api/public/$slug/$tableId*` herdam via `loadPublicTable`; nada extra.

### 4. Super admin — Tabelas padrão (`src/routes/_authenticated.admin.index.tsx`)

- Em `StandardTablesSection`: adicionar toggle "Pública por padrão" no formulário de criação/edição.
- `src/lib/category-standard-tables.functions.ts`: incluir `is_public` no schema Zod, no select do `list` e no payload de `upsert`.

### 5. Organização — CRUD de tabela (`src/routes/_authenticated.app.$orgSlug.index.tsx`)

- Estado `tPublic` + `Switch` "Listar publicamente" no diálogo Nova tabela.
- Componente `TableCard` (edição inline): adicionar `Switch` "Pública" ao lado de "Reservável", enviar em `updateTable`.
- Respeitar `isLocked && !isSA` (mesma regra de estrutura travada — o toggle fica desabilitado quando a tabela é padrão e o usuário não é super admin).
- Badge visual "pública" no card quando `is_public`.

### 6. Esquema de tabela (`src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`)

- Sem mudanças funcionais nesta iteração (toggle vive no card da tabela, não na tela de campos).

### 7. CHANGELOG.md

- Registrar Iteração 21 com resumo e arquivos tocados.

## Fora de escopo

- Alteração no toggle `organizations.is_public` (já existente na Iteração 18).