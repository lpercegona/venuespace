## Iteração 20 — Tabelas Padrão por Categoria (bloqueadas)

Mecanismo paralelo a `organization_category_default_fields` (Iteração 9/11), sem substituí-lo. Super admin define tabelas-modelo por categoria; toda nova organização recebe cópias instanciadas travadas para edição de estrutura.

### 1. Migração de banco

Novas tabelas (com GRANTs + RLS):

- `category_standard_tables` (id, category_id FK, name, icon, description, order_index, timestamps).
  - RLS: SELECT anon+authenticated (leitura pública, igual a `organization_categories`); INSERT/UPDATE/DELETE apenas `is_super_admin(auth.uid())`.
- `category_standard_table_fields` (id, standard_table_id FK, field_key, label, type, config jsonb, order_index, required boolean, timestamps).
  - Enum `type` alinhado ao usado em `fields.type` (17 tipos, incluindo `gallery`).
  - RLS idêntica.

Alterações em `public.tables`:

- `origin_standard_table_id uuid null` FK → `category_standard_tables(id) ON DELETE SET NULL`.
- `is_locked boolean not null default false`.
- Novas policies de UPDATE/DELETE em `tables` e de INSERT/UPDATE/DELETE em `fields`: bloqueiam quando `tables.is_locked = true` para quem não for super admin. Registros (`records`) permanecem inalterados.

### 2. Instanciação na criação de organização

Atualizar `public.create_organization` (RPC SECURITY DEFINER): após inserir a organização, iterar `category_standard_tables` da categoria e:

- inserir uma linha em `tables` copiando `name/icon/description`, com `origin_standard_table_id` preenchido e `is_locked = true`;
- inserir linhas em `fields` copiadas de `category_standard_table_fields` (com `source = 'category'`).

Sem reconciliação retroativa — vale só para organizações criadas depois desta iteração.

### 3. Server functions (`src/lib/category-standard-tables.functions.ts`)

- `listStandardTables({ category_id })` — público (SELECT via publishable client não necessário; usa `requireSupabaseAuth` + policy anon-friendly, ou server publishable). Usar `requireSupabaseAuth` para o painel admin.
- `createStandardTable`, `updateStandardTable`, `deleteStandardTable` — checam `is_super_admin`.
- `listStandardTableFields({ standard_table_id })`, `upsertStandardTableField`, `deleteStandardTableField`, `reorderStandardTableFields` — checam `is_super_admin`.

Em `src/lib/orgs.functions.ts`:

- `updateTable` / `deleteTable` / `createField` / `updateField` / `deleteField`: adicionar verificação — se `tables.is_locked` e usuário não é super admin, lançar erro claro ("Tabela padrão da categoria; estrutura só pode ser alterada pelo super admin.").
- `listTables` retorna `is_locked` e `origin_standard_table_id`.

### 4. Painel admin (`src/routes/_authenticated.admin.index.tsx`)

Nova sub-aba "Tabelas Padrão" dentro do editor de categoria (ao lado de "Campos padrão", "Layout público", etc.):

- Lista tabelas-modelo da categoria com nome/ícone/descrição/ordem, botões editar/excluir/nova.
- Editor por tabela reaproveita o mesmo componente de definição de campos usado em Campos Padrão (extraído como componente reutilizável se ainda estiver acoplado — ex.: `<CategoryFieldEditor scope="standard-table" parentId={standardTableId} />`).

### 5. UI da organização

- `src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`: quando `is_locked === true` e usuário não é super admin, esconder botões "Novo campo / editar / excluir / renomear tabela / excluir tabela" e exibir aviso com ícone de cadeado (`Lock` do lucide) + texto "Estrutura definida pela categoria".
- `src/routes/_authenticated.app.$orgSlug.index.tsx` e listagens de tabelas: exibir ícone de cadeado ao lado do nome quando `is_locked`.
- Grid e formulário de registros continuam funcionando por role normal.  


### 6. Funcionamento galeria registros

- `Verificar e corrigir o que impede que usuários admins normais consigam publicar galerias de imagens para registros.` 

### 7. CHANGELOG

Adicionar Iteração 20 referenciando explicitamente Iterações 9 e 11 (mecanismo paralelo, não substitui).

### Fora de escopo (confirmado no pedido)

- Relações pré-definidas entre tabelas padrão.
- Marcação padrão pública/interna.
- Comportamento automático por tipo de tabela.
- Reconciliação retroativa.

### Pontos a confirmar antes de codar

1. Nome exato da sub-aba no painel — proponho **"Tabelas Padrão"** dentro do editor de categoria (mesmo nível de "Campos padrão"). OK? A princípio sim, deixe para organizarmos depois a estrutura de menus. 
2. Ícone de cadeado usando `Lock` do lucide-react com tooltip "Tabela padrão da categoria" — OK? Não precisa de ícone, apenas desabilite as funções de edição. 