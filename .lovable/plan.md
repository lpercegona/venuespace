## Iteração 13 — Layout Público + Explorar (Perfis & Registros) + Galeria + Endereço via CEP + Auditoria de Field Types

Escopo fechado (Diretriz §0). Consolida os dois blocos enviados numa única iteração de ponta a ponta para minimizar rodadas. Nada fora desta lista entra.

Premissa de termos dinâmicos: todo rótulo público ("organização/registro/tabela" + plurais) vem de `useLabels()`. Zero hardcode.

---

### 1. Banco (migration única)

1. **Recriar layouts públicos** (removidos na Iteração 12):
   - `category_public_layouts (id, category_id fk, scope enum('organization_card','record_card'), updated_at)` — único por `(category_id, scope)`.
   - `category_public_layout_fields (id, layout_id fk, field_key text, width_percent smallint check in (25,50,75,100), order_index int, config jsonb)`.
2. **Enum `field_type`**: adicionar valor `'gallery'` (armazena `string[]` de paths do bucket `venue-uploads`).
3. **Endereço**: nenhuma coluna nova em `organizations`. Persistido em `category_data` via campos cascata da categoria, com `config.role ∈ {cep,logradouro,bairro,cidade,uf,complemento,numero}`.
4. GRANTs: `SELECT` a `anon`+`authenticated`; escrita `service_role`; RLS de escrita `is_super_admin(auth.uid())`.
5. Descarta `organization_category_public_layouts` (Iteração 10) — modelagem antiga.

### 2. Backend — server functions e rotas

**`src/lib/category-layouts.functions.ts`** (recriado, super admin only):
- `getCategoryLayout({category_id, scope})` — resolve cada `field_key` com metadados completos (`label, type, config`) do campo real (cascata org/tabela, default fields, ou campo-base).
- `upsertCategoryLayout(...)`, `deleteLayoutField(...)`.
- Validação: `width_percent ∈ {25,50,75,100}`; soma por linha (agrupamento sequencial até fechar 100) ≤ 100; rejeita `field_key` inexistente no escopo.

**`src/lib/category-cascade.functions.ts`** — adicionar `updateFieldOptions({field_id, scope, options: string[]})` para `select/multiselect` em `category_org_fields | category_table_fields | organization_category_default_fields` (grava `config.options`).

**`src/lib/public.server.ts`** — dois novos:
- `listPublicOrganizations({limit, offset, q, category_id})` → `{items: PublicOrgSummary[], total}` com `{id, slug, name, description, logo_url, category_id, category_data, published_records_count, latest_published_at, layout: organization_card_layout_resolved}`. **Só organizações com ≥1 registro publicado** (assunção 1 da ambiguidade — confirmada aqui). Busca ILIKE unaccent em `name` + `description`.
- `listPublicRecords({limit, offset, q, category_id})` → `{items: PublicRecordSummary[], total}` com `{record_id, table_id, table_name, org_slug, org_name, org_category_id, data, created_at, layout: record_card_layout_resolved}`. Só `status='published'`, `order by created_at desc`. Busca casa em `table.name`, `org.name` e apenas campos `text`/`long_text` do `data` (assunção 3 — mantém sem GIN).
- `listPublicTables` **permanece** para `/public/$slug/$tableId` mas não é mais consumido pela landing/explore.

**Novas rotas HTTP em `src/routes/api/public/`:**
- `organizations.ts` → `GET /api/public/organizations` (query: `limit, offset, q, category`).
- `records.ts` → `GET /api/public/records` (query: `limit, offset, q, category`).
- `category-layout.$categoryId.ts` → `GET` retorna `{organization_card, record_card}` resolvidos.
- `viacep.$cep.ts` → valida `^\d{8}$`, `fetch("https://viacep.com.br/ws/{cep}/json/")` com `AbortController` (timeout 4s). Rejeita `data.erro === true`. Retorna JSON normalizado `{cep, logradouro, bairro, cidade, uf, complemento}` com `cache-control: public, max-age=86400`. Rate-limit best-effort por IP (mesmo padrão de `/submit`).

### 3. `PublicCardRenderer` (novo)

`src/components/venue/public-card-renderer.tsx`.
- Props: `{ scope: 'organization_card'|'record_card', layout: LayoutField[], data: Record<string,any>, fields: FieldMeta[] }`.
- CSS Grid `repeat(4, minmax(0,1fr))`, cada célula `grid-column: span (width_percent/25)`, `gap` via tokens existentes.
- Delega renderização por célula a um helper novo em `field-schema.ts` (`renderFieldCell`) respeitando todos os `field_type`s (incluindo `gallery` → primeira thumb + `+N`).
- Fallback quando `layout` vazio:
  - `organization_card`: apenas `name` (100%).
  - `record_card`: primeiro campo `text` do schema (100%).
- Usado em: landing (dois blocos), `/explore` (duas abas), `/public/$slug/$tableId` (cards de registro).

### 4. Landing (`src/routes/index.tsx`)

Substitui o carrossel único por **dois carrosséis**:
- `<PublicOrganizationsCarousel />` — título `"{Organizações} recentes"`, CTA "Ver todas" → `/explore?tab=organizations`.
- `<PublicRecordsCarousel />` — título `"{Registros} recentes"`, CTA "Ver todos" → `/explore?tab=records`.
- Renomeia `public-tables-carousel.tsx` → `public-records-carousel.tsx`; cria `public-organizations-carousel.tsx`. Ambos consomem os novos endpoints e renderizam via `PublicCardRenderer`.

### 5. `/explore` (`src/routes/explore.tsx`)

- Duas abas via shadcn `Tabs`: `{Organizações}` | `{Registros}`. Aba default: **`records`** (assunção 2 — mantém familiaridade).
- Search param `tab` validado com `zodValidator({tab: fallback(z.enum(['organizations','records']),'records')})`. Paginação `offset` também no search param, independente por aba.
- Busca única topo:
  - Aba organizações → `q` casa `name/description` da org.
  - Aba registros → `q` casa `table.name + org.name + campos text/long_text`.
- Filtro por categoria (dropdown) reaplicado às duas abas.
- 24 itens/página, server-side.
- Rendering via `PublicCardRenderer` com o layout embutido em cada item da resposta (economiza round-trip).

### 6. `/admin` — reintroduz "Layout público"

Nova aba com sub-abas `Perfil de {organização}` e `Card de {registro}` (labels dinâmicos):
- Lista campos disponíveis do escopo (cascata + campos-base para org; default fields para registro) com botão "Adicionar".
- Linha do layout: drag para reordenar, `Select` largura (25/50/75/100), remover.
- Pré-visualização à direita usando o `PublicCardRenderer` real com dados-exemplo (`name = "Exemplo"` etc.).
- Aviso visual quando soma de largura na linha excede 100.

Aba "Campos padrão" ganha:
- Editor inline de `config.options` para `select`/`multiselect` (add/remove/reorder), persistido via `updateFieldOptions`.
- Escopo Organização: dropdown opcional "Função do campo" (`cep|logradouro|bairro|cidade|uf|complemento|numero`) em campos `text`. Grava em `config.role` (assunção 3 confirmada — sem novo field_type).

### 7. `CategoryFieldsForm`

- **gallery**: reutiliza um novo `UploadField` sobre `venue-uploads` com múltiplos arquivos, thumbs, remoção, limite 20.
- **CEP**: quando existe campo com `config.role='cep'` no escopo, debounce 500ms ao atingir 8 dígitos → `GET /api/public/viacep/{cep}` → preenche os demais campos cujo `config.role` bate, **apenas se estiverem vazios**. Todos permanecem editáveis. Erro → `sonner` toast, não bloqueia submit. Estado de loading no campo CEP.

### 8. `DynamicForm` + `DynamicGrid`

- Branch `gallery`:
  - Form: mesmo `UploadField` múltiplo.
  - Grid/card: primeira thumb + contador `+N`; fallback ícone quando vazio.
- Signed URLs via `createSignedUrls` (já usado em `loadPublicRecord`).

### 9. Auditoria obrigatória de `fields.type` (Diretriz §0)

Verificar cada tipo em 5 superfícies e registrar tabela no CHANGELOG:

Tipos: `text, long_text, number, currency, boolean, date, datetime, email, url, phone, select, multiselect, relation, image, file, gallery, computed`.

Superfícies: `DynamicForm`, `DynamicGrid`, `CategoryFieldsForm`, `PublicCardRenderer` (org + registro), `Editor de Campos Padrão em /admin`.

Cada célula da tabela: ✅ suportado | ⚠️ fallback (descrição) | n/a com justificativa.

### 10. Termos dinâmicos — sweep

`index.tsx`, `explore.tsx`, `public.$slug.$tableId.index.tsx`, `public.$slug.$tableId.tsx`, `public-header.tsx`, e os dois carrosséis novos: qualquer "tabela/organização/registro" hardcoded → `useLabels()`. Inclui placeholders de busca, títulos, empty states, paginação, textos de CTA.

### 11. Permissões / RLS

- `category_public_layouts*`: leitura pública; escrita super admin.
- Endpoints de opções e roles: já sob super admin.
- `/api/public/viacep/*` público (dado público, sem PII).
- `/api/public/organizations` e `/records` públicos, projeção sem PII, respeitam `status='published'`.

### 12. Detalhes técnicos

- Grid: `repeat(4, minmax(0,1fr))`, `span = width_percent/25`, `gap` via tokens.
- `gallery` guarda `string[]`; leitura pública assina via `createSignedUrls`.
- ViaCEP: `data.erro===true` → 404; mapeia `localidade→cidade`.
- Sem tokens novos, exceto — se necessário — `--gallery-thumb-border` em `styles.css` (light+dark+`@theme inline`).

### 13. Aceite (bloqueante)

1. Landing tem 2 carrosséis: `{Organizações} recentes` e `{Registros} recentes`, termos dinâmicos.
2. `/explore` com abas `{Organizações}/{Registros}`, `tab` no URL, busca e paginação independentes por aba, filtro de categoria funcionando.
3. Super admin edita `organization_card` e `record_card` por categoria em `/admin`; listagens públicas refletem imediatamente.
4. Cards em landing, `/explore` e `/public/$slug/$tableId` respeitam o layout configurado; fallback funcional quando ausente.
5. `gallery` funciona em criação/edição de registro; grid mostra thumb + `+N`.
6. Editor de opções em Campos Padrão persiste e reflete downstream em `CategoryFieldsForm`/`DynamicForm`.
7. Campo `text` marcado `role='cep'` dispara autopreenchimento; falha não bloqueia; campos editáveis após preenchimento.
8. Nenhum texto público hardcoded.
9. Tabela `tipo × superfície` publicada em `CHANGELOG.md`.
10. Typecheck limpo; 360/768/1280 em light+dark; RLS/GRANTs revisados; iterações anteriores continuam funcionais.

### 14. Ambiguidades resolvidas (confirmar antes de iniciar build)

1. **Landing "Organizações recentes"** exibe apenas organizações com ≥1 registro publicado.
2. **Aba default em `/explore`**: `records`.
3. **Busca em registros**: casa `table.name + org.name + campos text/long_text` do `data`.
4. **Layout de perfis de organização** vai em `/explore` como aba dedicada (opção **b/c híbrida**: abas dedicadas, não seção auxiliar) — decisão consolidada aqui para evitar (a) fragmentação em rota nova.
5. **Campos-base no `organization_card`**: se o layout está vazio, fallback mostra `name`; quando o super admin adiciona qualquer campo, o layout passa a ser 100% dele (sem inclusão implícita de `name`) — controle total explícito.
6. **CEP** usa `config.role='cep'` em campo `text` da cascata (sem novo `field_type`); editor de role aparece apenas no escopo Organização de "Campos padrão".

Se qualquer confirmação divergir, paro e ajusto antes de codar (§0).
