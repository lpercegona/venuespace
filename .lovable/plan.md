# Correções: imagens instáveis, header mobile e banner de cookies

Extensão das iterações 31/35 (performance pública e consentimento LGPD).

## 1. Imagens que somem ou piscam

Diagnóstico confirmado na leitura do código: todas as imagens públicas são
entregues por URLs assinadas temporárias (`createSignedUrl(s)` com 1 hora em
`src/lib/public.server.ts`, `blog-public.server.ts`, `org-logo.tsx`,
`dynamic-grid.tsx`). Consequências observáveis:

- A URL expira em 1h; quem fica com a aba aberta, ou recebe HTML/JSON servido
  do cache de borda (`s-maxage` + `stale-while-revalidate`) ou do snapshot de
  memória, passa a apontar para links vencidos — as imagens somem.
- A cada revalidação a URL assinada muda (token novo), então o navegador
  considera outra imagem e recarrega do zero — daí o "piscar" ao navegar.
- `LazyImage` reinicia o estado `loaded` em cada montagem, exibindo o skeleton
  novamente mesmo para imagens já em cache.

Correção:

- Criar uma rota pública estável de imagem (`/api/public/img/*`) que lê o
  arquivo do storage no servidor e responde com `cache-control: public,
  max-age=31536000, immutable` e o `content-type` correto. A URL passa a ser
  determinística (mesmo caminho = mesma URL), nunca expira e é cacheada pelo
  navegador e pela borda.
- Substituir a assinatura de URLs nos caminhos públicos (listagens, cards,
  galerias, página de organização, blog, logo da organização, grade dinâmica)
  por essa URL estável. Áreas privadas (avatar, anexos de reserva, uploads em
  edição) seguem com URL assinada.
- `LazyImage`: manter um registro em memória das URLs já carregadas na sessão,
  para não reexibir skeleton em remontagem; reservar espaço com proporção fixa
  (evita reflow) e manter transição só na primeira carga.
- Estabilizar os dados: nas consultas públicas usar `staleTime` maior,
  `refetchOnWindowFocus: false` e manter os dados anteriores durante a troca de
  página/filtro, para o conteúdo não sumir e voltar durante a navegação.

## 2. Header mobile

Em `public-header.tsx`, no mobile: ícone "Explore" alinhado à esquerda, botão
"Cadastrar empresa" centralizado no header e ícone de login à direita. No
desktop, o layout atual (logo à esquerda, Explore centralizado) é mantido.

## 3. Banner de cookies

- Ao abrir o popup de preferências, o banner sai da tela (fica oculto enquanto
  o diálogo estiver aberto) e volta apenas se o usuário fechar sem decidir.
- Ajustes visuais e de acessibilidade: texto do parágrafo em tamanho legível
  (mín. 13–14px), botões com altura mínima de 44px e alvo de toque adequado,
  botões empilhados no mobile e em linha a partir de `sm`, contraste e foco
  visíveis, largura máxima e espaçamentos revisados.

## Notas técnicas

- Nova rota: `src/routes/api/public/img/$.ts` (`createFileRoute` com handler
  GET), lendo via cliente admin do storage; valida o caminho para impedir
  travessia e restringe ao bucket `venue-uploads`.
- Helper compartilhado para converter caminho de storage em URL pública
  estável, usado no servidor e no cliente.
- Arquivos afetados: `src/lib/public.server.ts`, `src/lib/blog-public.server.ts`,
  `src/lib/home-data.server.ts`, `src/components/venue/org-logo.tsx`,
  `src/components/venue/dynamic-grid.tsx`,
  `src/components/venue/lazy-image.tsx`,
  `src/components/venue/public-header.tsx`,
  `src/components/venue/cookie-consent.tsx`, e as consultas públicas em
  `src/hooks/use-public-catalog.ts`.
- Registro da iteração em `CHANGELOG.md`.
