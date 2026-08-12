# Padronização das listagens, ativos compartilhados e ajustes de perfil

## 1. Listagem única para /explore e /categoria/$slug
Hoje as duas páginas repetem o mesmo código (grid, cards, paginação, filtros) com pequenas diferenças (2 vs 3 colunas, largura da sidebar).

- Criar um componente compartilhado `PublicListing` com: sidebar de filtros (desktop), barra de busca/filtros (mobile), grid de cards, estados de skeleton/vazio e paginação.
- `/explore` e `/categoria/$slug` passam a renderizar esse componente, mudando apenas título, categoria ativa e origem dos dados.
- Um único card de organização/registro compartilhado (extraído do código duplicado), usado também pela home.
- Mesmas larguras, espaçamentos e número de colunas nas duas páginas.

## 2. "Ver todos" da home aponta para a categoria
- O link passa a apontar para `/categoria/$slug` (slug da categoria do bloco), levando as regras "=" do bloco como pré-filtros na URL (`f_<campo>=<valor>`) e o termo, quando houver.
- Blocos sem categoria definida continuam indo para `/explore` com os mesmos pré-filtros.
- Blocos de atalho (links) continuam com o comportamento atual de cada card.

## 3. Busca e filtros flutuantes no mobile
- Nas páginas de listagem (explorar e categorias), no mobile a barra de busca/filtros sai do topo e vira um botão flutuante fixo no rodapé da tela ("Buscar e filtrar", com contador de filtros ativos).
- O botão abre uma folha (sheet) de tela cheia com a busca e os mesmos grupos de filtro em acordeão já existentes, com botões "Limpar" e "Ver resultados".
- O elemento flutuante respeita área segura do dispositivo e não cobre o rodapé do site ao fim da rolagem.

## 4. Otimizações adicionais de carregamento
- Imagens: `width`/`height` explícitos para evitar deslocamento de layout, `fetchpriority="high"` só na primeira imagem visível e `loading="lazy"` no restante; reduzir o pré-carregamento agressivo da galeria para a imagem atual + a próxima.
- Servir miniaturas nos cards (transformação de tamanho na URL da imagem) em vez da imagem original.
- Prefetch por intenção (`preload="intent"`) nos links de card e paginação; `keepPreviousData` já usado permanece.
- Revisar o cache do servidor: reaproveitar a mesma consulta entre explorar/categoria (mesma chave), aumentar TTL das listagens públicas e das URLs assinadas.
- Carregar sob demanda componentes pesados fora da primeira dobra (mapa, avaliações, lightbox).

## 5. Lightbox na galeria do perfil da organização
- Clique na imagem da galeria abre um lightbox em tela cheia com navegação por setas, teclado (setas/Esc) e gesto de arrastar no mobile, além do contador de imagens.
- As setas do carrossel continuam apenas trocando o slide, sem abrir o lightbox.

## 6. Reposicionamento do aviso sobre fotos
- O texto "Fotos indexadas de sites..." sai de baixo do card de contato e passa a ficar imediatamente junto ao texto "Este espaço é seu? ...", formando um bloco único de avisos, visível igualmente em desktop e mobile.

## 7. Rodapé em toda a navegação pública
- O rodapé passa a ser renderizado uma única vez para todas as páginas públicas (home, explorar, categorias, perfil da organização, registros, campanhas, blog, páginas legais, login e páginas de erro/404), evitando repetição em cada rota.
- Áreas autenticadas de administração continuam sem o rodapé.

## Detalhes técnicos
- Novos arquivos: `src/components/venue/public-listing.tsx`, `src/components/venue/public-org-card.tsx`, `src/components/venue/mobile-filter-sheet.tsx`, `src/components/venue/gallery-lightbox.tsx`.
- Alterações: `src/routes/explore.tsx`, `src/routes/categoria.$slug.tsx`, `src/routes/index.tsx` (link "Ver todos"), `src/components/venue/gallery-carousel.tsx`, `src/components/venue/lazy-image.tsx`, `src/components/venue/organization-page-immersive.tsx`, rotas públicas para o rodapé compartilhado.
- Sem mudanças de banco de dados. Registro da iteração no `CHANGELOG.md`.
