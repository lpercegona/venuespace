Adicione ao Skill Venuespace

Diretriz §0 - Prioridade: ajustar antes de expandir.

No início de cada iteração, antes de implementar os itens novos, verificar se alguma funcionalidade já validada em iteração anterior está quebrada ou divergente do especificado, na área tocada por esta iteração. Se houver, corrigir primeiro — a iteração não fecha com algo existente quebrado, mesmo que a correção não estivesse no pedido original. Só depois de confirmado o funcionamento correto, seguir para as novas funcionalidades do escopo.

&nbsp;

## Iteração 16 — Filtros configuráveis em Explorar

Objetivo: super admin decide, por categoria, quais campos (organização e registro) participam da busca textual e quais aparecem como filtros no `/explore`. Cidade da organização é o caso principal, mas o mecanismo é genérico. Landing e `/explore` passam a usar os rótulos dinâmicos (`useLabels`) para "Organizações" e "Registros".

### 1. Backend / Schema

Nova tabela `category_filter_fields` (migração + GRANT + RLS):

```
category_filter_fields (
  id uuid pk,
  category_id uuid fk organization_categories,
  scope text check in ('organization','record'),
  field_key text,               -- chave do campo (built-in ou de category_*_fields)
  filter_type text check in ('search','select','city'),
  label_override text null,
  order_index int default 0,
  unique(category_id, scope, field_key)
)
```

- `search`: entra apenas na busca textual (`q`).
- `select`: vira dropdown com valores distintos agregados server-side.
- `city`: variante de `select` que lê a chave `address.city` (endereço estruturado das organizações).
- RLS: super admin CRUD; leitura pública (`SELECT TO anon`).

### 2. Server helpers (`src/lib/public.server.ts`)

- `listPublicOrganizations` / `listPublicRecords` aceitam:
  - `q` (já existe) — passa a percorrer também `category_data` das orgs e `data` dos registros, considerando apenas as chaves marcadas como `search` ou `select`/`city` (com fallback para todos os strings quando categoria não tem filtros).
  - `filters: Record<string, string>` — pares `field_key=valor` aplicados como igualdade (case-insensitive) sobre `category_data` (org) ou `data` (record), respeitando `city` como `address.city`.
- Novo helper `listCategoryFilters(scope, categoryIds?)` retornando definições + valores distintos agregados a partir das linhas visíveis publicamente.

### 3. Endpoints públicos

- Atualizar `GET /api/public/organizations` e `GET /api/public/records` para ler `filters` a partir de query string (`filter.<key>=<valor>`) além do `q`/`category` existentes.
- Novo `GET /api/public/explore-filters?scope=organization|record&category=<id?>` devolvendo:
  ```
  { filters: [{ field_key, filter_type, label, options?: string[] }] }
  ```

### 4. Admin (`/admin`)

Dentro da aba **Campos padrão**, adicionar sub-seção "Filtros públicos" com duas colunas (Organização / Registro) por categoria selecionada:

- Lista os campos disponíveis (built-ins relevantes + campos de categoria daquele escopo).
- Para cada campo: switch "Incluir na busca", seletor de tipo (`search` / `select` / `city`), rótulo opcional, ordem.
- Salva via novas server functions em `src/lib/category-filters.functions.ts` (autenticadas + `has_role` super_admin).

### 5. Frontend `/explore`

- Adiciona `filters` ao `searchSchema` (JSON serializável — `Record<string,string>` via `fallback({}, {})`).
- Ao trocar de categoria/aba, busca `/api/public/explore-filters` e renderiza:
  - Campo de busca livre (já existe).
  - `select`/`city` como dropdowns shadcn com "Todos" + opções distintas.
- Paginação continua independente por aba; filtros resetam offset ao mudar.
- URL reflete estado (`?tab=records&filters=...`).
- Rótulos das abas usam `t("organization",…)` / `t("record",…)` no plural (via `useLabels`).

### 6. Landing (`src/routes/index.tsx`)

- Reintroduz o bloco "Registros recentes" (removido na iteração 15), mantendo "Organizações recentes" utilizando as informações dos campos escolhidos no layout público pelo super admin.
- Títulos usam `useLabels` para respeitar terminologia da instância.
- Link "Ver todos" leva a `/explore` com `tab` correspondente.

### 7. Migrações & retroatividade

- Categorias existentes ficam sem filtros até o super admin configurar; comportamento atual (busca livre em name/description) é preservado como fallback quando não há filtros definidos.
- Para o caso "cidade", basta o super admin marcar o campo `city` (dentro do JSON `address`) como filtro `city` — o helper extrai `address.city` automaticamente.

### 8. Verificação

- Playwright:
  1. `/explore` sem categoria configurada → busca funciona (fallback).
  2. Configurar filtro `city` no admin → dropdown de cidades aparece em `/explore` e filtra corretamente.
  3. Landing exibe os dois blocos com rótulos dinâmicos.
- Registro em `CHANGELOG.md` como Iteração 16.

### Detalhes técnicos

- Nada de `.catch()` nos schemas Zod das search params (usar `fallback`).
- `category_filter_fields` recebe `GRANT SELECT TO anon` + `GRANT ALL TO service_role` + policies para super admin (write) e público (read).
- Distinct values agregados em memória a partir do mesmo dataset já lido para paginação (limite 5000 registros/orgs, coerente com o padrão atual).
- Nenhuma mudança em rotas autenticadas além da aba do admin.