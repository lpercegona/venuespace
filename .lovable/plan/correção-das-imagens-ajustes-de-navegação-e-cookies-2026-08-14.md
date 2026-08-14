# Correção das imagens + ajustes de navegação e cookies

## 1. Imagens não carregam (causa confirmada)

As imagens públicas passaram a ser entregues por caminhos relativos (`/api/public/img/...`) no lugar de URLs assinadas `https://...`. O endpoint funciona (testado: HTTP 200, `image/webp`), mas os componentes de card filtram valores com a regra "só é imagem se começar com `http(s)://`", então descartam todos os caminhos novos. Resultado: 22 cards na home sem nenhuma imagem renderizada.

Correção: aceitar também os caminhos internos `/api/public/img/...` nos pontos que validam URL de imagem:

- `src/components/venue/public-card-renderer.tsx` — `isUrl` / `mediaUrlsFor` / `hasImageExtension`.
- `src/components/venue/organization-page-immersive.tsx` — `isUrl` e `isMediaField`.
- `src/routes/public.$slug.index.tsx` — filtro que remove URLs da lista de atributos em texto (senão o caminho da imagem aparece como texto) e a checagem de `logo_url`.

Centralizar a regra num helper único em `src/lib/public-image.ts` (`isImageSource`) e usá-lo nesses três arquivos, evitando divergência futura.

Validação: abrir a home e uma página de organização no navegador e conferir que os cards têm `<img>` com `naturalWidth > 0`.

## 2. Carregamento da listagem do menu Explore

O dropdown "Explore" busca as categorias só quando o header monta, mostrando lista vazia no primeiro instante.

- Manter os dados em cache mais tempo (`staleTime` longo + `gcTime`) e usar `placeholderData` para não esvaziar a lista durante revalidação.
- Pré-carregar as categorias no carregamento inicial da aplicação (prefetch no router/root), para o menu já abrir preenchido.
- Enquanto carrega pela primeira vez, exibir itens de esqueleto no lugar de "Nenhuma categoria".

## 3. Banner e popup de cookies

- Todos os textos (parágrafo, títulos, descrições de categoria, botões) em `text-xs`.
- Reduzir a altura dos botões: de `min-h-11` para uma altura compacta (`h-8`), mantendo o espaçamento horizontal.
- Ajustar paddings do banner e do popup para acompanhar a redução.

## 4. Ícone do header: home fora da index

Em `src/components/venue/public-header.tsx`, o ícone à direita passa a depender da rota:

- Em `/`: ícone de login (`CircleUserRound`) apontando para `/auth` — como hoje.
- Em qualquer outra rota: ícone de casa (`Home`) apontando para `/`, com `aria-label` "Início".

## Registro

Registrar as alterações no `CHANGELOG.md` como correção da iteração vigente (estabilidade de imagens / header público / cookies).
