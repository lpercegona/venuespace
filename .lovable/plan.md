# Iteração 40 — Catálogo global de campos (Estrutura > Campos)

Extensão direta das Iterações 26/27 e 37 (editor "Estrutura > Campos" por categoria). Não é escopo paralelo: usa as mesmas tabelas de cascata (`category_org_fields`, `category_table_fields`, `organization_category_default_fields`), os mesmos blocos (`category_field_groups`) e o mesmo `base_field_config`.

## O que muda para o usuário

Nova aba **"Todos os campos"** dentro de Estrutura > Campos, ao lado de Organização / Tabela / Registro. Ela lista **um card por chave de campo** existente na plataforma, consolidando todas as origens:

1. **Visão consolidada.** Cada chave mostra: rótulo, tipo, obrigatoriedade, tooltip, bloco, ordem, configuração específica (computed / relation / boolean / select), e a lista de **categorias que usam o campo**, com indicação do escopo em cada uma (Organização, Tabela, Registro).
2. **Seleção de categorias.** Interruptores por categoria × escopo. Ligar cria a definição naquela categoria; desligar remove. Ao marcar **"Campo base da plataforma"**, a seleção de categorias é desabilitada e o campo passa a valer para todas as categorias existentes e futuras.
3. **Edição.** Rótulo, tipo, obrigatório, tooltip, ordem, bloco e config são editáveis no catálogo. Regra de propagação confirmada: **campo base propaga para todas as categorias**; campo não-base grava apenas nas categorias marcadas, preservando divergências das demais.
4. **Dependências identificadas.** Cada campo exibe selos de uso quando aplicável: `PDF de orçamento`, `Reserva`, `Filtro público`, `Card público`, `Seção da home`, `Endereço/CEP`, `Formulário público`. Campos com dependência exibem aviso ao tentar renomear chave ou alterar tipo.
5. **Zona de risco.** A área abre com um alerta destacado explicando que alterações aqui atingem todas as categorias e organizações. Ações destrutivas (remover campo de categorias, mudar tipo, desmarcar base) passam por `AlertDialog` de confirmação com a contagem de categorias e organizações afetadas.
6. **"instância" vira "base".** O selo `instância` é renomeado para `base` em toda a interface, e os campos hoje gravados nas tabelas de instância são migrados para o modelo base.
7. **Campos por organização (somente leitura).** Um painel recolhível lista chaves criadas dentro de organizações (tabela `fields`) que não existem no catálogo por categoria, com a contagem de organizações — apenas diagnóstico, sem edição.

## Detalhes técnicos

### Migração (uma migração)

- Migrar `organization_fields` → `category_org_fields`, `table_fields` → `category_table_fields`, `record_fields` → `organization_category_default_fields`, replicando cada linha para **todas** as categorias com `is_base = true`, `source`/`config` preservados, `group_id = null`, sem sobrescrever chave já existente na categoria (`ON CONFLICT (category_id, field_key) DO NOTHING`).
- As três tabelas de instância deixam de ser fonte de verdade. Não são removidas nesta iteração (evita quebrar leituras existentes); passam a não ser mais lidas.
- Sem novas tabelas. Sem alteração de RLS/GRANT (todas as tabelas envolvidas já possuem política de leitura pública e escrita restrita a `is_super_admin`).

### Servidor — novo `src/lib/field-catalog.functions.ts`

- `listFieldCatalog` (super admin): lê as três tabelas de cascata de todas as categorias + `organization_categories.base_field_config` + `category_field_groups`, e agrega por `field_key`, retornando por chave: definição canônica (a do campo base, ou a de maior ocorrência), divergências detectadas, e `usages: { category_id, scope, id, label, required, order_index, group_id, is_base }[]`.
- `listFieldDependencies` (super admin): varre `category_filter_fields.field_key`/`min_field_key`/`max_field_key`, `category_public_layout_fields.field_key`, `home_blocks.rules`, `category_standard_form_fields.field_key`, `config.system_key` (orçamento), `config.booking_role` e as chaves fixas de PDF (`contact_company`, `contact_cnpj`, `contact_address`, `travel_fee`) — retorna os selos por chave.
- `applyFieldCatalogEntry` (super admin): recebe chave, definição e o conjunto alvo `{category_id, scope}[]` + `is_base`. Quando `is_base = true`, expande o alvo para todas as categorias no escopo original do campo. Faz upsert nas linhas alvo e delete nas linhas fora do alvo. Quando `is_base` é desligado, mantém apenas as categorias marcadas.
- `listOrphanOrgFieldKeys` (super admin): chaves distintas em `public.fields` sem correspondente no catálogo, com contagem de organizações.
- `deleteFieldCatalogEntry` (super admin): remove a chave de todas as categorias, bloqueando quando há dependência de PDF/reserva salvo confirmação explícita (`force: true`).

### Interface

- Novo `src/components/admin/field-catalog-section.tsx` com: alerta de zona de risco (`Alert` destrutivo), busca instantânea por chave/rótulo, filtro por escopo e por dependência, lista de cards (`Card` + `Badge`) e diálogo de edição reaproveitando os blocos de configuração por tipo já criados na Iteração 37 (computed, relation, boolean, select), extraídos de `_authenticated.admin.index.tsx` para um componente compartilhado `src/components/admin/field-type-config.tsx` para evitar duplicação.
- `_authenticated.admin.index.tsx`: `DefaultFieldsSection` ganha a aba "Todos os campos"; o selo `instância` do `ScopeEditor` passa a `base` e o rótulo do interruptor vira "Campo base da plataforma".
- Sincronização: após salvar no catálogo, invalidar `admin-defaults`, `admin-field-groups`, `admin-base-field-config` e `category-schema` — as abas Organização/Tabela/Registro e os formulários públicos (`/api/public/category-schema/$categoryId`, consumido por `CategoryFieldsForm` e `DynamicForm`) refletem imediatamente.
- Mobile-first: cards empilhados em `<md`, tabela densa em `md+` dentro de `ScrollArea`; sem cor hardcoded; tooltips via `FieldLabel` já existente.

### Fechamento (§7)

Build e typecheck limpos; tela validada em 360/768/1280 em light e dark; estados loading/empty/error; RLS e GRANTs revisados; nenhuma rota pública nova (sitemap inalterado); entrada correspondente em `CHANGELOG.md` como Iteração 40.
