# Filtro de faixa numérica (a partir de / até) — Extensão da Iteração 33

Novo comportamento de filtro configurável pelo super admin que vincula **dois campos numéricos** (ex.: `qtd_min` e `qtd_max` de Espaços) em **um único filtro** com dois seletores: "A partir de" e "Até".

## Comportamento definido

- Semântica: **faixa contida** — o registro/organização só aparece quando a faixa dele estiver totalmente dentro da faixa pedida (`qtd_min >= X` e `qtd_max <= Y`). Se apenas um dos lados for escolhido, só esse lado é aplicado.
- Opções dos seletores: **geradas dos dados** publicados, seguindo a mesma lógica facetada já existente (respeitam busca e demais filtros ativos), ordenadas numericamente. "A partir de" usa os valores distintos do campo mínimo; "Até" usa os do campo máximo.
- Genérico: qualquer par de campos numéricos, em qualquer categoria, escopo organização ou registro.

## Configuração no super admin (Filtros)

Na aba Filtros da categoria, o seletor "Comportamento" ganha uma terceira opção:

- Filtro (lista) — atual
- Busca (texto livre) — atual
- **Faixa numérica (a partir de / até)** — novo

Ao escolher a faixa, o formulário passa a pedir dois campos: "Campo mínimo" e "Campo máximo" (listas restritas aos campos numéricos da categoria) e um rótulo opcional (ex.: "Capacidade"). A linha na tabela mostra as duas chaves vinculadas e permite editar/remover como hoje.

Os registros existentes de `qtd_min` e `qtd_max` como "Busca por texto" continuam funcionando; o super admin pode removê-los e criar o filtro de faixa no lugar (nenhuma remoção automática).

## Interface pública

Um único bloco de acordeon no mesmo padrão dos demais filtros (barra de busca da home, barra de filtros do explorar e coluna lateral de explorar/categoria), contendo dois seletores lado a lado: "A partir de" e "Até", com opção "Qualquer" para limpar. O contador de filtros ativos e o botão "Limpar filtros" consideram a faixa.

Codificação na URL, coerente com o padrão `f_<campo>` atual: `f_<chave>=min:100|max:300` (qualquer um dos lados pode ser omitido).

## Detalhes técnicos

- Migração: permitir `filter_type = 'range'` na tabela `category_filter_fields` (ajuste do CHECK) e adicionar colunas `min_field_key text` e `max_field_key text` (nulas para os tipos existentes). Sem novas tabelas, sem mudança de RLS/GRANTs.
- `src/lib/category-filters.functions.ts`: incluir `range` nos schemas Zod e persistir/retornar as duas chaves.
- `src/lib/filter-params.ts`: helpers `parseRangeValue` / `serializeRangeValue` e inclusão da faixa em `countSelectedFilters`.
- `src/lib/explore-filters.server.ts`: `ExploreFilterDef` ganha `filter_type: "range"` com `min_options` / `max_options` numéricas, calculadas dentro do mesmo laço de facetas (ignorando o próprio campo, como já é feito).
- `src/lib/public.server.ts`: aplicar a faixa nas listagens de organizações e de registros (comparação numérica tolerante a valores com texto, ex.: "200 pessoas"); `loadFilterKeys` passa a expor também as chaves de faixa.
- Novo `src/components/venue/filter-range-select.tsx` (shadcn Select + acordeon no mesmo padrão do `FilterOptionList`), consumido por `public-filter-sidebar.tsx`, `public-filter-bar.tsx` e `home-search-bar.tsx`.
- `CHANGELOG.md`: entrada datada como **Extensão da Iteração 33**.

## Validação

Build e typecheck; `/explore`, `/categoria/espacos` e home em 360/768/1280, light e dark; facetas continuam dinâmicas; filtros existentes sem regressão.
