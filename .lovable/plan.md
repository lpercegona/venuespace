# Home com busca, "Ver todos" e filtros dinâmicos no Explorar

Extensão das Iterações 30/31 (home configurável e filtros públicos).

## 1. "Ver todos" nos blocos da home

- Cada bloco de listagem (cards de organizações/registros) ganha um link "Ver todos" alinhado à direita do título.
- O destino é a página da categoria do agrupamento ativo (`/categoria/$slug`); se o agrupamento não tiver categoria definida, cai para `/explore`.
- As regras do bloco que correspondem a campos filtráveis (ex.: bairro, cidade, tipo) são convertidas em parâmetros `f_<campo>=<valor>` na URL, de modo que a página de destino abre já filtrada como o bloco.
- Blocos do tipo "atalhos" (links) continuam sem "Ver todos".

## 2. Barra de busca na hero da home

- Logo abaixo do título aparece um bloco de busca: campo de texto ("Buscar espaços, fornecedores...") + botão de filtros + botão "Buscar".
- O botão de filtros abre o mesmo painel de filtros da categoria ativa (selects dinâmicos).
- Ao buscar, navega para `/explore` levando `q`, a categoria da aba ativa e os `f_<campo>` selecionados.
- Layout mobile-first: em telas pequenas o campo ocupa a largura toda com os botões abaixo; em desktop tudo em uma linha dentro de um cartão arredondado sobre o fundo da hero.

## 3. Filtros dinâmicos (home e explorar)

- O endpoint de filtros passa a receber o termo de busca e os filtros já selecionados e retorna apenas as opções que ainda produzem resultados (facetas).
- Para cada filtro, as opções são calculadas sobre o conjunto filtrado pelos **outros** filtros (comportamento padrão de facetas), permitindo trocar o valor do próprio filtro sem zerar as opções.
- Opções sem nenhum item correspondente ficam ocultas; um filtro que fique sem opções é omitido da barra.
- Vale igualmente para a home (hero), `/explore` e `/categoria/$slug`.

## 4. Explorar em desktop: filtros na coluna lateral

- A partir de `lg`, o conteúdo vira duas colunas: barra lateral esquerda fixa (~280px) com todos os filtros expandidos (busca no topo, cada select visível, botão "Limpar") e a listagem à direita em **duas colunas** de cards.
- Abaixo de `lg`, mantém-se a barra atual com busca + popover de filtros e a grade em 1–2 colunas.

## Detalhes técnicos

- `src/lib/explore-filters.server.ts`: `listExploreFilters` recebe `q` e `filters`; aplica os mesmos predicados de `public.server.ts` (comparação sem acento/caixa) ao computar valores distintos, excluindo o próprio campo do recorte. Cache-key inclui os filtros.
- `src/routes/api/public/explore-filters.ts` e `getExploreFiltersFn` (`src/lib/public-catalog.functions.ts`): repassam `q` e `f_*`.
- `src/lib/public-queries.ts`: `categoryFiltersQuery` passa a receber `q`/`filters` na queryKey.
- Novo componente `src/components/venue/public-filter-sidebar.tsx` para o painel expandido do desktop, reaproveitando os tipos de `public-filter-bar.tsx`.
- Novo componente `src/components/venue/home-search-bar.tsx` usado em `src/routes/index.tsx`.
- `src/routes/index.tsx`: "Ver todos" em `HomeBlockSection` (mapeamento regra → `f_*`).
- `src/routes/explore.tsx`: novo grid `lg:grid-cols-[280px_1fr]` e cards em `lg:grid-cols-2`.
- `CHANGELOG.md`: registro como correção/extensão das Iterações 30/31.
