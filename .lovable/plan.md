# Iteração 12 — Consolidação da administração de campos

## Escopo

1. Remover as abas **Layout público** e **Campos de sistema** de `/admin`.
2. Remover a aba **Cascata** e transferir seu conteúdo para **Campos padrão**, mantendo o mesmo modelo de edição do editor de cascata.
3. Adicionar suporte a **campos padrão de registro** dentro da mesma aba.
4. Exibir os **campos-base fixos** (não editáveis) de cada escopo no topo da listagem, como referência ao super admin.

## Mapeamento de dados (sem migrações novas)

Reaproveita tabelas já existentes:

| Escopo       | Fonte de dados                                | Funções server já disponíveis                                                                 |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Organização  | `category_org_fields`                         | `listCategoryCascadeFields` / `upsertCategoryCascadeField` / `deleteCategoryCascadeField` (scope=`org`)   |
| Tabela       | `category_table_fields`                       | mesmas funções (scope=`table`)                                                                |
| Registro     | `organization_category_default_fields`        | `listCategoryDefaultFields` / `upsertCategoryDefaultField` / `deleteCategoryDefaultField`     |

Reconciliação retroativa continua usando `reconcileCategoryAllOrganizations` (org+tabela) já implementada. Nenhuma tabela nova, nenhuma migration.

## Campos-base fixos exibidos como locked (somente leitura)

- **Organização:** `name`, `slug`, `category_id`
- **Tabela:** `name`, `icon`, `description`
- **Registro:** (nenhum)

Renderizados como linhas no topo da tabela do respectivo escopo, com badge "base" e sem botões de editar/remover.

## Alterações de arquivo

### `src/routes/_authenticated.admin.tsx`
- Remover triggers/contents das abas `layout` e `system`.
- Remover imports de `category-layouts.functions`, `system-fields.functions`, `PublicLayoutSection`, `SystemFieldsSection`.
- Remover a aba `cascade` e o import de `CategoryCascadeSection`.
- Substituir `DefaultFieldsSection` por uma versão unificada com 3 sub-tabs (Organização / Tabela / Registro) + painel de reconciliação retroativa. Cada sub-tab renderiza um editor único parametrizado pelo escopo, mesmo modelo de dialog já usado no editor de cascata (rótulo → geração automática de chave snake_case com sufixo `_2`, tipo, obrigatório, ordem; chave travada em edição).

### `src/components/venue/category-cascade-section.tsx`
- Arquivo removido (conteúdo absorvido pela nova `DefaultFieldsSection`).

## Regras preservadas (Diretriz §0)

- Sem alterações em RLS, GRANTs, migrations, endpoints públicos ou lógica de negócio.
- Sem alteração de comportamento do fluxo de criação/edição de organização, tabela ou registro — apenas consolidação de UI de administração.
- Iterações anteriores permanecem funcionais; typecheck limpo como gate de fechamento.
- Entrada correspondente adicionada ao `CHANGELOG.md`.

## Fora de escopo

- Não recria as funcionalidades removidas (layout público e campos de sistema) em outro lugar.
- Não altera o modelo de dados nem a semântica de reconciliação.
