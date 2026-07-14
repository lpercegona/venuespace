# Iteração 10 — Configurações estruturais do super admin

Escopo fechado. Governada pela Diretriz §0. Registro obrigatório em `CHANGELOG.md`.

## Decisões consolidadas (respostas do usuário)

1. **Layout público**: global por categoria de organização. Toda tabela publicada de uma categoria herda o layout público definido pelo super admin.
2. **Campos compartilhados**: 3 tabelas independentes (`organization_fields`, `table_fields`, `record_fields`) com o **mesmo motor de tipos** dos `fields` de tabela. Gerenciadas pelo super admin no `/admin`.
3. **Retroatividade — corrigir tudo**: (a) rótulos e formatação em telas ainda com strings fixas, (b) retroinjetar campos padrão da categoria em tabelas antigas (merge, sem apagar), (c) verificar seed quando categoria é atribuída a org existente.
4. **Ícones**: escolhidos ao definir o layout público (não do field, não fixo por tipo).

---

## 1. Modelo de dados (migration única)

```sql
-- Layout público por categoria
organization_category_public_layouts (
  id, category_id fk, field_source enum('org_field'|'table_field'|'record_field'),
  field_ref text,      -- key do campo referenciado
  icon text,           -- lucide icon name (obrigatório)
  order_index int,
  label_override text NULL,
  created_at, updated_at
)

-- Campos de sistema (3 tabelas, mesmo schema, mesmo motor de tipos que public.fields)
organization_fields (id, key, label, type, required, position, config jsonb)
table_fields        (id, key, label, type, required, position, config jsonb)
record_fields       (id, key, label, type, required, position, config jsonb)
-- config jsonb aceita: options, target_table_id, icon, computed spec, etc.
-- type enum já existente em fields é reutilizado.

-- Armazenamento dos valores desses campos de sistema
organizations.system_data jsonb NOT NULL DEFAULT '{}'
tables.system_data        jsonb NOT NULL DEFAULT '{}'
records.system_data       jsonb NOT NULL DEFAULT '{}'
```

Descartada a tabela `system_form_fields` legada (só carregava label/ícone). Migration remove após copiar entries para `organization_fields`/`table_fields`/`record_fields` como campos `type='text'` iniciais quando fizer sentido; caso contrário, apaga.

RLS: SELECT anon+authenticated nas 4 novas tabelas (leitura em telas públicas); INSERT/UPDATE/DELETE somente `is_super_admin`. GRANTs correspondentes.

## 2. Backend

`src/lib/system-fields.functions.ts` (novo):

- `listSystemFields(scope: 'organization'|'table'|'record')`
- `createSystemField`, `updateSystemField`, `deleteSystemField`, `reorderSystemFields` — todos super admin.

`src/lib/category-layouts.functions.ts` (novo):

- `listCategoryPublicLayout(category_id)` — retorna itens ordenados com ícone e label efetivo.
- `upsertCategoryPublicLayoutItem`, `deleteCategoryPublicLayoutItem`, `reorderCategoryPublicLayout`.

`src/lib/orgs.functions.ts` / `records.functions.ts`:

- `createOrganization`/`updateOrganization`, `createTable`, `createRecord`/`updateRecord` passam a validar `system_data` contra o schema de `*_fields` (mesmo `zodForField` reutilizado).
- **Retroinjeção**: `updateOrganization` quando `category_id` muda → server fn dispara `mergeCategoryDefaultsIntoExistingTables(orgId)` que, para cada tabela sem o campo, insere o field da categoria (sem tocar em campos com mesma `key`).
- Nova server fn `backfillCategoryDefaults({ organization_id })` (super admin ou owner) — executa o merge sob demanda; botão no painel da org.

Endpoints públicos:

- `GET /api/public/category-layout/:category_id` — usado em `/public/$slug/$tableId` e `/explore`.
- `GET /api/public/system-fields` — retorna os 3 conjuntos (usado em telas públicas que exibem dados de org/tabela/registro).

`src/lib/public.server.ts`:

- `loadPublicTable` e `loadPublicRecord` passam a incluir `category_layout` da categoria da org, resolvendo cada item para o valor real (percorre `org.system_data`, `table.system_data`, `record.data` + `record.system_data`).

## 3. Frontend

### Painel `/admin`

- **Nova aba "Layout público"**: seletor de categoria → editor drag-and-drop dos itens do layout (fonte do campo, ícone lucide via `IconPicker`, ordem, label override). Preview lateral renderizando um card de exemplo.
- **Nova aba "Campos de sistema"**: sub-abas Organização / Tabela / Registro. Cada sub-aba: lista de campos com CRUD completo (mesmo editor que o schema de tabela já usa em `/tables/$tableId/schema`), reordenação por drag.
- Aba **Campos padrão** existente mantida (campos padrão por categoria aplicados a novas tabelas).
- Botão "Aplicar retroativamente" em cada categoria da aba **Categorias** que chama `backfillCategoryDefaults` para todas as orgs vinculadas.

### Formulários de criação/edição

- `EditOrgDialog` e "Nova organização": renderizam `DynamicForm` a partir de `organization_fields` (além dos campos base: nome, slug, categoria, overrides). Valores em `system_data`.
- `/app/$orgSlug/tables/$tableId/schema` (criar/editar tabela): renderiza `DynamicForm` de `table_fields` para metadados extras da tabela. Valores em `tables.system_data`.
- `DynamicForm` de registro (uso atual): já reflete os `fields` da tabela; adicionar seção "Campos de sistema" ao topo lendo `record_fields`, salvando em `records.system_data`.

### Listagem pública

- `public.$slug.$tableId.index.tsx`: substituir `fields.slice(0,4)` por `category_layout` resolvido. Cada item exibido como par `<ícone lucide> <label>: <valor>`. Fallback quando categoria da org não tem layout: comportamento atual.
- `PublicTablesCarousel` e `/explore`: usar layout da categoria para o preview de cards.

### Refactor de rótulos (bloqueante para fechar a iteração)

Auditar e trocar strings fixas por `useLabels().t(key)` nos arquivos identificados:
`_authenticated.admin.tsx`, `lead.$token.tsx`, `conversations.$conversationId.tsx`, `public.$slug.campaigns.$recordId.tsx`, `routes/index.tsx`, `api/public/lead/$token.ts` e `campaigns/$recordId.ts` (para textos server-rendered, resolver via `listPlatformLabels`), `_authenticated.app.$orgSlug.members.tsx`, `_authenticated.app.index.tsx`, `_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`, `_authenticated.app.$orgSlug.tables.$tableId.index.tsx`, `_authenticated.app.$orgSlug.calendar.tsx`, `conversation-thread.tsx`, `notifications-bell.tsx`, `_authenticated.app.$orgSlug.index.tsx`, `app-shell.tsx`, `edit-org-dialog.tsx`, `conversations.tsx`, `chat-widget.tsx`, `interest-form-modal.tsx`, `public-tables-carousel.tsx`, `public-header.tsx`. Cada arquivo revisado remove ocorrências de "Organização", "Registro", "Tabela", "Campo", "Membro", "Conversa", "Campanha", "Contribuição", "Reserva" (e plurais) — mantidos apenas em constantes de fallback de `useLabels`.

## 4. Aceite

1. Super admin cria layout público para categoria "Locação de espaços" com 3 campos + ícones lucide → toda tabela publicada de org dessa categoria renderiza os cards no formato definido.
2. Super admin adiciona campo `type='select'` em `record_fields` chamado "Prioridade" → formulário de criar/editar registro em qualquer tabela mostra o campo; valor persiste em `records.system_data`; layout público pode referenciá-lo.
3. Super admin renomeia "Registro" para "Item" → todas as rotas listadas acima refletem sem strings fixas remanescentes.
4. Owner atribui categoria "X" a org existente → tabelas antigas recebem os campos padrão faltantes por merge, sem sobrescrever campos existentes; log/toast confirmando N campos adicionados em M tabelas.
5. Botão "Aplicar retroativamente" em `/admin` → itera todas as orgs da categoria e faz o merge.
6. Typecheck limpo, build passa, 360/768/1280 em light+dark, sem regressão nas iterações 1-9, RLS+GRANTs revisados.
7. `CHANGELOG.md` com entrada datada cobrindo migration, endpoints, componentes, refactor de rótulos e backfill.

## 5. Detalhes técnicos (não usuário-facing)

- Reuso de `zodForField` de `records.functions.ts` — extrair para `src/lib/field-schema.ts` e importar nos 3 novos módulos + records para evitar duplicação.
- `IconPicker`: novo componente compartilhado em `src/components/venue/icon-picker.tsx` usando `lucide-react/dynamic` com busca; usado no layout público, `platform_labels` e categorias.
- Backfill idempotente: chave = `key` do field; nunca sobrescreve `config` de campo existente.
- Migration inclui trigger `updated_at` nas 4 novas tabelas.