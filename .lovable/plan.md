# Otimização de carregamento e novo header público

## 1. Performance das páginas públicas

Hoje toda página pública (home, `/categoria/$slug`, `/explore`, `/public/$slug`, blog) monta vazia e só então dispara `fetch` no cliente — o usuário vê skeleton mesmo quando o dado poderia vir pronto do servidor.

Mudanças:
- Adicionar `loader` nas rotas públicas usando `context.queryClient.ensureQueryData(...)` para os dados de primeira dobra (home: config de agrupamentos + dados do primeiro bloco; categoria: categorias, layout, filtros e primeira página de organizações; organização: dados do perfil). O HTML já chega com conteúdo (melhor LCP e SEO).
- Extrair as chamadas duplicadas (`fetchHomeGroupings`, `fetchOrgs`, `fetchFilters`, categorias) para `queryOptions` compartilhados, evitando refetch entre páginas e permitindo prefetch.
- Alinhar `staleTime` com o cache HTTP já existente (categorias/labels/layouts = 5 min) e adicionar `cache-control` nos endpoints públicos que hoje estão sem ele ou com `no-store` indevido (ex.: `category-labels`).
- Prefetch em hover/foco nos links de categoria do header e nos cards, para navegação instantânea.
- Imagens: `loading="lazy"` + `decoding="async"` em cards fora da primeira dobra, `fetchpriority="high"` e `preload` apenas na imagem de herói da página de organização; `width`/`height` para evitar layout shift.
- Reduzir requisições em cascata na home (config → dados do bloco) resolvendo os dados do agrupamento inicial no mesmo loader.

## 2. Skeleton fiel ao layout da categoria

- A home hoje renderiza `PublicCardSkeletonGrid` sem `layout`, caindo no skeleton genérico. Passar o layout configurado (organização/registro) da categoria de cada bloco, como já é feito em `/categoria/$slug` e `/explore`.
- Em `/public/$slug` (linha do grid de registros) passar o layout de `record_card` da categoria.
- O número de colunas do skeleton deve seguir o `columns` (3 ou 4) do bloco, e a contagem seguir `limit_count`.
- Ajustar `PublicCardSkeleton` para respeitar também prefixos/ícones e o rodapé cidade-estado do layout, mantendo o mesmo espaçamento do card real (sem “pulo” ao trocar skeleton por conteúdo).

## 3. Header público no mobile

Em telas pequenas (`< sm`): ocultar a logo e usar três áreas em grid — Explore à esquerda, botão “Cadastrar empresa” centralizado, ícone de login à direita. No desktop nada muda (logo à esquerda, como hoje).

## 4. Comportamento e cor do header

- Header fixo no topo, com a mesma cor do hero da home enquanto estiver no topo da página inicial; nas demais páginas (e após rolar) fundo cinza claro (token de superfície) com borda sutil.
- Esconder ao rolar para baixo e reaparecer ao rolar para cima (transição de translate, sem “piscar”), respeitando `prefers-reduced-motion`.
- Compensar a altura do header fixo no conteúdo para não cobrir o topo das páginas.

## Detalhes técnicos

- Rotas: `src/routes/index.tsx`, `categoria.$slug.tsx`, `explore.tsx`, `public.$slug.index.tsx`, `blog.index.tsx` ganham `loader` + `queryOptions` em um novo `src/lib/public-queries.ts`.
- Skeleton: `src/components/venue/public-card-skeleton.tsx` recebe `columns`; chamadas passam `layout` vindo de `useCategoryLayout`.
- Header: `src/components/venue/public-header.tsx` com hook local de direção de scroll (`useScrollDirection`), classes `fixed top-0 translate-y-0 / -translate-y-full`, cores via tokens (`bg-primary` no topo da home, `bg-surface` no restante) — sem cores hardcoded.
