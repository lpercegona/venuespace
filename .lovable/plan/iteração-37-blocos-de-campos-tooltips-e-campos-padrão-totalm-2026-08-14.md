# Iteração 37 — Blocos de campos, tooltips e campos padrão totalmente editáveis

Extensão do editor "Estrutura > Campos" (campos padrão por categoria, entregue nas Iterações 1/2 e ajustado nas Iterações 26/27). Não é iteração paralela: altera as mesmas tabelas de cascata de campos e os formulários que as consomem.

## O que muda para o usuário

1. **Blocos de campos editáveis.** Hoje "Endereço" e "Orçamento" são blocos fixos no código. Passam a ser registros criados e editados pelo super admin, por categoria, com abas Organização / Tabela / Registro. Cada bloco tem título, descrição e ordem; cada campo escolhe a qual bloco pertence. Campos sem bloco aparecem no fim, sem cabeçalho.
2. **Tooltips por campo.** Todo campo ganha um texto opcional de ajuda. Quando preenchido, o formulário exibe um ícone "i" ao lado do rótulo com o texto em tooltip (hover no desktop, toque no mobile). Campos sem texto não exibem ícone.
3. **Campos base editáveis (apresentação).** Nome, Slug, Categoria, CEP/Logradouro/Número/Complemento/Bairro/Cidade/UF, Ícone e Descrição deixam de ser somente leitura no painel: rótulo, tooltip, obrigatoriedade, ordem, bloco e visibilidade passam a ser editáveis. Chave e tipo continuam fixos, porque apontam para colunas reais do banco (mexer nelas quebraria endereço, slug e publicação).
4. **Marcar um campo como base.** Novo interruptor "Campo base da instância". Quando ligado, o campo é semeado automaticamente em todas as categorias (existentes e novas). Quando desligado, vale apenas para a categoria atual.
5. **Orçamento vira campo padrão.** CNPJ, Site, Validade do orçamento e Condições de pagamento saem do código e passam a ser campos padrão dentro do bloco "Orçamento", editáveis pelo super admin. Os dados já salvos continuam válidos e o PDF de orçamento continua lendo os mesmos valores.
6. **Configuração assistida de computed, relation e boolean.** O diálogo de campo passa a mostrar formulários específicos por tipo, com tooltips explicativos: fórmula/base do computed, tabela e campo de exibição do relation, rótulos e valor padrão do boolean.

## Detalhes técnicos

### Banco (uma migração)

- Nova tabela `public.category_field_groups`: `category_id`, `scope` (`org` | `table` | `record`), `key`, `title`, `description`, `order_index`, timestamps. Único por (`category_id`, `scope`, `key`). GRANTs: `SELECT` para `anon` e `authenticated`, `ALL` para `service_role`; RLS com leitura pública e escrita restrita a super admin (`is_super_admin(auth.uid())`), padrão já usado em `category_labels`.
- Colunas novas em `category_org_fields`, `category_table_fields` e `organization_category_default_fields`: `group_id uuid null references category_field_groups(id) on delete set null` e `is_base boolean not null default false`.
- `organization_categories.base_field_config` passa a aceitar, por chave de campo base, além de `visible`/`required`: `label`, `tooltip`, `group_id`, `order_index` (retrocompatível — chaves ausentes usam o padrão atual).
- Seed por categoria existente: blocos "Endereço" (escopo org) e "Orçamento" (escopo org); campos base de endereço vinculados ao bloco Endereço; quatro campos padrão de orçamento (`cnpj`, `site`, `validity_days`, `payment_terms`) criados em `category_org_fields` com `config.system_key = 'quote.<chave>'`, preservando o local de gravação atual (`organizations.system_data.quote`).

### Servidor

- Novo `src/lib/category-field-groups.functions.ts`: `listCategoryFieldGroups` (público), `upsertCategoryFieldGroup`, `deleteCategoryFieldGroup` (super admin, mesmo `requireSA` de `category-cascade.functions.ts`).
- `category-cascade.functions.ts` e `organization-categories.functions.ts`: schemas de upsert aceitam `group_id`, `is_base` e `config.tooltip`; quando `is_base = true`, replica o campo (mesma chave, rótulo, tipo, config) para todas as categorias do escopo.
- `getCategorySchemaPublic` retorna `groups` por escopo e os campos com `group_id`, além do `base_field_config` estendido; `/api/public/category-schema/$categoryId` repassa sem alteração de contrato quebrada (só campos novos).
- `bookings.server.ts`/`bookings.functions.ts` continuam lendo `system_data.quote.*` — a leitura passa a resolver a chave via `config.system_key`, sem migração de dados.

### Interface

- Novo `src/components/venue/field-label.tsx`: rótulo + asterisco de obrigatório + ícone `Info` (lucide) dentro de `Tooltip` shadcn, renderizado apenas quando há tooltip. Usado em `dynamic-form.tsx`, `category-fields-form.tsx`, `edit-org-dialog.tsx` e `_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`.
- `category-fields-form.tsx`: agrupa os campos por bloco, renderizando título e descrição do bloco; substitui o cabeçalho fixo "Campos da categoria".
- `edit-org-dialog.tsx`: remove o bloco "Orçamento" fixo; `AddressFields` passa a ser renderizado dentro do bloco "Endereço" quando ele existir.
- `_authenticated.admin.index.tsx` (`ScopeEditor`): gerenciador de blocos (criar/editar/remover, título, descrição, ordem), listagem de campos agrupada por bloco, e no diálogo de campo — seletor de bloco, campo "Texto de ajuda (tooltip)", interruptor "Campo base da instância" e blocos condicionais por tipo:
  - `computed`: modo (soma / contagem / soma quantidade × valor), tabela e campos de origem, filtro opcional por status;
  - `relation`: tabela padrão de destino, campo de exibição, seleção múltipla;
  - `boolean`: rótulo para verdadeiro/falso e valor padrão.
  Os campos base (`BASE_FIELDS`) deixam de ser linhas somente leitura e passam a abrir o mesmo diálogo com chave e tipo bloqueados, gravando em `base_field_config`.

### Fechamento (§7)

Build e typecheck limpos; telas novas validadas em 360/768/1280 em light e dark; estados loading/empty/error; RLS e GRANTs revisados na tabela nova; nenhum token novo fora de `src/styles.css`; entrada correspondente em `CHANGELOG.md` como Iteração 37.
