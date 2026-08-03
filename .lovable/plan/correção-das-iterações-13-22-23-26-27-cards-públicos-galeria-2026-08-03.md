# Correção das Iterações 13/22/23/26/27 — cards públicos, galeria e categorias

Escopo de correção (§0: não abre nova iteração — ajusta comportamento já entregue nas iterações de layout público, galeria, skeleton e categorias).

## 1. Grade de 3 colunas no desktop

- Home (`/`): as duas grades (organizações e registros) passam de `lg:grid-cols-4` para `sm:grid-cols-2 lg:grid-cols-3`, incluindo os skeletons.
- Explorar já usa 3 colunas — apenas confirmar consistência de `gap`.

## 2. Galeria: clique prioriza a página individual

- Hoje o wrapper da galeria intercepta todo clique/pointer para não disparar o `<Link>` do card. Isso será restrito: apenas os botões seta esquerda/direita param a propagação.
- O restante da área da galeria (imagem, contador) volta a ser clicável e leva à página individual da organização/registro.
- Arrasto lateral do embla permanece, mas sem bloquear o clique simples.

## 3. Sem gap entre slides

- `CarouselContent`/`CarouselItem` do carrossel de galeria passam a usar espaçamento zero (variante sem `-ml-4`/`pl-4`), aplicando a todos os usos de galeria (cards padrão, cards imersivos e perfil público).

## 4. Pré-carregamento da próxima imagem

- `GalleryCarousel` passa a acompanhar o índice atual e forçar carregamento (`loading="eager"` / `fetchPriority`) do slide seguinte (e do anterior), mantendo `lazy` para os demais.

## 5. Rótulo nos ícones sem texto

- No card imersivo, os itens de "comodidades" (features exibidas só como ícone) passam a mostrar o rótulo da opção ao lado do ícone, em texto pequeno, mantendo `aria-label`.
- Mesma regra vale para células de ícone sem texto no card padrão.

## 6. Categorias sem registros públicos

- O app consulta a contagem de registros públicos da categoria ativa (endpoint público de registros com `limit=1`, lendo `total`).
- Explorar: quando a categoria não tem registros públicos (caso Audiovisual), as abas Organizações/Registros ficam ocultas e a listagem fixa em Organizações; se a URL vier com `tab=records`, cai para `orgs`.
- Home: a seção "Registros recentes" só aparece quando a categoria ativa tem registros públicos.
- Categoria padrão ao abrir home e explorar passa a ser "Espaços" (quando existir), em vez da primeira da lista.

## 7. Skeleton dinâmico conforme layout do super admin

- `PublicCardSkeleton` passa a receber o layout público da categoria (padrão ou imersivo) e desenhar blocos correspondentes: proporção de imagem/bleed, número de linhas e larguras (25/50/75/100%) para o estilo padrão; bloco de imagem cheia com barras nos cantos para o estilo imersivo.
- Home e Explorar buscam o layout da categoria antes/junto da listagem e passam ao skeleton; sem layout configurado, mantém o skeleton genérico atual.

## Detalhes técnicos

- Arquivos: `src/routes/index.tsx`, `src/routes/explore.tsx`, `src/components/venue/gallery-carousel.tsx`, `src/components/venue/lazy-image.tsx`, `src/components/venue/public-card-renderer.tsx`, `src/components/venue/public-card-skeleton.tsx`, `src/components/venue/category-tabs.tsx` (default "Espaços").
- Sem migração de banco; sem mudança de regra de negócio ou RLS.
- Apenas tokens semânticos; validação em 360/768/1280, light+dark; `CHANGELOG.md` recebe entrada de Correção referenciando as iterações originais.
