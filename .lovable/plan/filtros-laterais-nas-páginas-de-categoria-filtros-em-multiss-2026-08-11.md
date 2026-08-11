# Filtros laterais nas páginas de categoria + filtros em multisseleção

Extensão da Iteração 33 (facetas e coluna lateral no /explore).

## 1. Coluna lateral nas páginas de categoria

- `/categoria/$slug` passa a usar o mesmo layout do `/explore` em desktop (`lg`): coluna esquerda fixa (~280px) com todos os filtros expandidos e a listagem à direita.
- Abaixo de `lg`, mantém-se a barra atual (busca + painel de filtros em popover), com o mesmo conteúdo de filtros.
- A grade de cards da categoria acompanha a largura restante (2 colunas em `lg`, 3 em telas muito largas).

## 2. Filtros por seleção, não dropdown

- Cada filtro deixa de ser um `select` e passa a listar as opções como itens marcáveis (checkbox), permitindo escolher mais de um valor por filtro.
- Listas curtas (até ~8 opções — categorias, comodidades, diferenciais) aparecem completas, sem scroll.
- Listas longas mostram todas as opções dentro de uma área com scroll (altura máxima) e ganham um campo de busca no topo do próprio filtro para localizar a opção.
- Cada filtro mostra a contagem de valores selecionados e um "limpar" próprio; o botão geral "Limpar filtros" continua existindo.
- No mobile, o mesmo componente aparece dentro do popover/painel de filtros.

## 3. Multisseleção com facetas dinâmicas

- Vários valores do mesmo filtro combinam em OU (bairro = Batel **ou** Água Verde); filtros diferentes combinam em E.
- As opções continuam facetadas: cada filtro mostra apenas valores que ainda produzem resultado considerando a busca e os **outros** filtros; valores já marcados permanecem visíveis.
- Filtros sem nenhuma opção disponível seguem ocultos.

## Detalhes técnicos

- URL: `f_<campo>` passa a aceitar múltiplos valores separados por `|` (ex.: `f_bairro=Batel|Água+Verde`). Parsing/serialização centralizados em um helper compartilhado (`src/lib/filter-params.ts`) usado por `/explore`, `/categoria/$slug` e a busca da home.
- Servidor: em `src/lib/public.server.ts` (`listPublicOrganizations` / `listPublicRecords`) e em `src/lib/explore-filters.server.ts`, o predicado de comparação passa a dividir o valor por `|` e casar por OU (mantendo a normalização sem acento/caixa). Facetas continuam ignorando o próprio campo.
- `src/routes/api/public/explore-filters.ts`, `getExploreFiltersFn` e `public-queries.ts` apenas repassam os valores multivalor (sem mudança de assinatura).
- Novo componente `src/components/venue/filter-option-list.tsx` (checkboxes + busca interna + scroll condicional), usado por `public-filter-sidebar.tsx` e `public-filter-bar.tsx`, que deixam de usar `Select`.
- `src/routes/categoria.$slug.tsx`: grid `lg:grid-cols-[280px_1fr]` com `PublicFilterSidebar` e `PublicFilterBar` só abaixo de `lg`.
- `CHANGELOG.md`: registrado como correção/extensão da Iteração 33.
