# Correção/Extensão da Iteração 30 — filtros, atalhos e blocos

Registro no `CHANGELOG.md` como continuação da `Correção/Extensão da Iteração 30`.

## 1. Filtros de explorar/categoria sem todas as opções (causa raiz verificada)

Em `src/lib/explore-filters.server.ts` (`listExploreFilters`, escopo `organization`), as opções dos filtros `select` são calculadas assim: primeiro busca `records` com `status = 'published'`, extrai os `organization_id` dessas tabelas e só então lê as organizações desse conjunto.

Consequência: organizações **públicas sem registros publicados** nunca entram na varredura, então valores que só existem nelas não aparecem no dropdown — apesar de a listagem (`listPublicOrganizations`) usar simplesmente `organizations.is_public = true`. A varredura também não filtra por `is_public`, ou seja, pode considerar organização não pública.

Correção:

- Trocar a origem da varredura por `organizations` com `is_public = true` (+ `category_id` quando informado), a mesma base da listagem.
- Complementar as opções com os valores declarados na configuração do campo: para campos `select`/`multiselect` de `category_org_fields`, incluir as opções definidas em `config.options` mesmo quando ainda não houver organização usando aquele valor (união com os valores encontrados nos dados, sem duplicar, case-insensitive).
- Mesma correção de origem para o escopo `record`: hoje varre até 5000 registros sem restringir por categoria na consulta; passa a filtrar por categoria na consulta e a unir com as opções configuradas em `category_standard_table_fields`.
- Filtros do tipo `search` definidos pelo super admin continuam alimentando a busca; na barra de filtros da página de categoria eles seguem aplicados via campo de busca (sem mudança de layout).

## 2. Atalhos de pré-filtragem apontando para a página antiga

Em `src/routes/index.tsx`, o `ShortcutCard` navega para `to="/explore"` com `search[f_<campo>]`. O destino correto é a nova listagem por categoria.

Correção:

- `loadHomeGroupingData` (`src/lib/home-data.server.ts`) passa a devolver, junto de cada item de atalho, o `category_slug` derivado do nome da categoria (mesma função de slug usada em `category-tabs`), a partir do `category_id` já salvo no item.
- `ShortcutCard` passa a usar `to="/categoria/$slug"` com `params={{ slug: category_slug }}` e `search={{ f_<campo>: valor }}`.
- Sem `category_id` no item, o atalho cai para a categoria padrão da navegação pública (primeira categoria com organizações públicas), preservando o pré-filtro.

## 3. Correspondência exata nos blocos da home

`applyRules` já compara valor a valor em minúsculas para `=`. O que falta:

- `address.city_state_full` aparece na lista de field-keys, mas o resolvedor de organização procura essa chave dentro de `address`, onde ela não existe — a regra nunca casa. Passa a ser derivada de cidade + estado por extenso.
- Campos `select`/`multiselect` guardam o **valor** da opção, enquanto o super admin costuma digitar o **rótulo**. `=`/`!=`/`contains` passam a casar tanto pelo valor quanto pelo rótulo da opção, resolvidos pela configuração do campo da categoria.
- Comparação normalizada por acento/espaços, para que "Sao Paulo" e "São Paulo" casem.

## 4. Tooltip de field-keys com scroll e opções

No popover `FieldKeysHelper` (`src/components/admin/home-blocks-section.tsx`):

- Layout em duas colunas dentro do popover (mais largo), com scroll vertical explícito e altura máxima, agrupado por escopo (Base, Endereço, cada categoria).
- Cada field-key exibe, quando `select`/`multiselect`, a lista de opções disponíveis (rótulo + valor) em chips; clicar em uma opção preenche `field_key` e `value` da regra em edição, clicar na chave preenche só a chave.
- O endpoint `/api/public/field-keys` passa a devolver `options` por field-key (a partir de `config.options`).

## Detalhes técnicos

- `src/lib/explore-filters.server.ts`: nova origem de varredura, união com opções configuradas, filtro por categoria no escopo record.
- `src/lib/home-data.server.ts`: `category_slug` nos itens de atalho; `listAvailableFieldKeys` com `options`.
- `src/lib/public.server.ts`: resolvedor com `address.city_state_full`, normalização de acentos e casamento por rótulo/valor de opção.
- `src/routes/index.tsx`: destino dos atalhos para `/categoria/$slug`.
- `src/components/admin/home-blocks-section.tsx`: popover em colunas, com scroll e chips de opções clicáveis.
- `CHANGELOG.md`: nova entrada.

## Validação

Build + typecheck; `/categoria/espacos` e `/categoria/audiovisual` com todos os filtros configurados listando opções; atalho "bairros mais buscados" abrindo a listagem de categoria já filtrada; bloco da home com regra `=` em campo de lista retornando resultados; popover com scroll e opções em 360/1280.
