## Escopo (Iteração 23)

Seis itens, todos solicitados. Sem escopo adicional.

### 1. Encaixe do padding p-4 nos cards públicos

`PublicCardBody` ainda calcula o "sem margens" (bleed) com `-mx-6/-mt-6/-mb-6`, herança do padding antigo `p-6`. Como os cards públicos passaram a usar `p-4`:

- Trocar as classes de bleed para `-mx-4`, `-mt-4`, `-mb-4`.
- Aplicar o mesmo tratamento ao carrossel de galeria (`GalleryCarousel`), hoje com `rounded-md` fixo: quando em bleed a 100%, ele perde o arredondamento lateral e ocupa a largura total; quando não estiver em bleed, mantém o recuo/arredondamento igual ao restante do conteúdo.
- Cantos: primeira linha em bleed recebe `rounded-t-xl`, última recebe `rounded-b-xl`, intermediárias ficam retas.
- Para não repetir números mágicos, `PublicCardBody` recebe uma prop opcional `padding` (`"4" | "6"`, padrão `4`) usada para montar as classes negativas — assim os três locais (`/`, `/explore`, `/public/:slug`) ficam consistentes.

### 2. Título e subtítulo como escolha do super admin (cards de registro e de organização)

Hoje `/`, `/explore`, `/public/:slug` e `/public/:slug/:tableId` renderizam `CardHeader` hardcoded para registros (título via `getPublicCardTitle` e subtítulo `org_name · table_name`).

- No editor de layout (`LayoutEditor`), adicionar uma coluna **Estilo** por item, com opções: `Título (H3)`, `Subtítulo`, `Normal (rótulo + valor)`. Persistida em `config.style`, sem migração.
- Isso vale para **os dois escopos**: card de organização e card de registro (conforme sua resposta). O tratamento especial atual do `name` como H3 passa a ser apenas o valor padrão de `style` para esse campo — qualquer campo pode virar título ou subtítulo.
- `PublicCardBody` passa a renderizar conforme `config.style`:
  - `title` → `<h3 class="font-display text-lg font-semibold line-clamp-2">`
  - `subtitle` → texto pequeno em `text-muted-foreground`, sem rótulo
  - `normal` (padrão) → rótulo + ícone + valor, como hoje
- Campos-base para o escopo **card de registro** passam a incluir os pseudo-campos hoje hardcoded: `org_name` (Organização), `table_name` (Tabela) e `deal_status` (Status). Para isso, `src/lib/public.server.ts` passa a incluir esses valores dentro de `data` (e nos `fields` do renderer) dos itens de registro; os campos de topo continuam existindo para compatibilidade.
- Removidos os `CardHeader` hardcoded dos cards de registro nas três rotas de listagem, substituídos pelo `PublicCardBody` em contêiner `p-4` — igual ao que já foi feito para organizações. O fallback (categoria sem layout) permanece para não quebrar.

### 3. Correção do agrupamento em colunas

O agrupamento atual acumula larguras e fecha a linha quando `acc >= 100`. Se um item de 100% vier depois de um de 50%, os dois caem na mesma linha (`col-span-2 + col-span-4` = 6 colunas num grid de 4), o que empurra conteúdo para fora do card. Além disso, campos vazios são descartados **depois** do cálculo de largura, quebrando as somas.

- Reescrever o empacotamento: monta as células válidas primeiro, depois adiciona à linha corrente apenas enquanto `acc + width <= 100`; caso contrário abre nova linha.
- Item em bleed sempre ocupa linha própria.
- Resultado: todos os campos escolhidos pelo super admin aparecem, na ordem definida, sem transbordo.

### 4. Carrossel: setas em hover e isolamento do clique

- `GalleryCarousel` ganha `opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100` nas setas (`CarouselPrevious`/`CarouselNext`) e no contador, com `group` no contêiner. Em telas touch (sem hover), as setas permanecem visíveis — via `@media (hover: hover)`, para não inviabilizar o uso em mobile.
- Isolamento: o contêiner do carrossel recebe `onClick`/`onKeyDown` com `preventDefault()` + `stopPropagation()`, e as setas idem, de modo que clicar/arrastar no carrossel nunca dispara o `Link` do card. Os cards passam a envolver o conteúdo com o `Link` apenas nas áreas não-carrossel (o carrossel fica como irmão, fora do `<a>`, evitando também o HTML inválido de `<button>` dentro de `<a>`).

### 5. Propagação retroativa de alterações em tabelas padrão

Hoje `create_organization` instancia as tabelas padrão só na criação; edições posteriores do super admin não chegam às organizações existentes. Conforme sua escolha: **espelhamento total** e **automático ao salvar**.

- Nova função SQL `reconcile_category_standard_tables(_category_id uuid)` (SECURITY DEFINER, restrita a super admin), que para cada organização da categoria e cada `category_standard_tables`:
  - cria a tabela instanciada caso ainda não exista (match por `origin_standard_table_id`);
  - atualiza nome, ícone, descrição, ordem e `is_public` da tabela;
  - insere campos novos, atualiza rótulo/tipo/obrigatoriedade/ordem/config dos existentes (match por `category_field_key`);
  - **remove** os campos de origem-categoria que o super admin excluiu (espelhamento total). Campos criados localmente pela organização (`source <> 'category'`) não são tocados.
- As server functions `upsertCategoryStandardTable`, `deleteCategoryStandardTable`, `upsertCategoryStandardTableField` e `deleteCategoryStandardTableField` chamam a reconciliação logo após gravar, e retornam o resumo (tabelas/campos afetados) para um toast informativo.
- Aviso explícito no painel: a exclusão de um campo padrão remove o campo das organizações existentes e os valores deixam de ser exibidos.

### 6. Tabs do painel super admin em linha única com scroll lateral

- `TabsList` principal deixa de usar `flex-wrap` e passa a `w-full overflow-x-auto flex-nowrap justify-start` com `scrollbar` discreto e `shrink-0` nos gatilhos, mantendo altura e tokens atuais. Mesmo tratamento nas `TabsList` internas (Campos padrão, Layout público, Filtros) para consistência em 360px.

### Detalhes técnicos

- Arquivos: `src/components/venue/public-card-renderer.tsx`, `src/components/venue/gallery-carousel.tsx`, `src/routes/index.tsx`, `src/routes/explore.tsx`, `src/routes/public.$slug.index.tsx`, `src/routes/public.$slug.$tableId.index.tsx`, `src/routes/_authenticated.admin.index.tsx`, `src/lib/public.server.ts`, `src/lib/category-standard-tables.functions.ts`.
- Uma migração: função `reconcile_category_standard_tables` + GRANT de EXECUTE apenas para `authenticated` (guarda interna de super admin).
- `config.style` e `config.bleed` continuam em `jsonb` livre — sem migração de schema para o layout.

### Governança (§7)

- Validar em 360/768/1280, light + dark, nas rotas `/`, `/explore`, `/public/:slug`, `/public/:slug/:tableId` e `/admin`.
- Verificar papéis: anônimo e autenticado nas rotas públicas; super admin no painel; owner/editor nas tabelas instanciadas (campos bloqueados `is_locked`).
- Nenhum token de cor hardcoded; nenhuma biblioteca nova.
- Entrada datada em `CHANGELOG.md` cobrindo os seis itens.
