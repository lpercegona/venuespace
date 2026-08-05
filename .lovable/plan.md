# Correções da galeria pública (Layout 2 e cards)

Ajustes visuais na galeria de imagens usada nos cards públicos e na página de organização (Layout 2).

## O que muda

1. **Marcador de slides esticado no hero**: no Layout 2 o contador "1/5" passou a ocupar toda a altura da faixa hero. Volta a ser um selo pequeno no canto inferior direito.
2. **Setas e marcador acima do overlay**: nos cards públicos (organização e registro) e na página de organização, os controles da galeria passam a ficar na frente do gradiente escuro usado para contraste do texto, continuando clicáveis apenas neles (o resto do card segue navegando para a página individual).
3. **Estilo glass**: setas e marcador ganham fundo translúcido com desfoque (vidro fosco) e borda sutil, em vez de fundo sólido.
4. **Cards públicos sem contador**: o marcador de quantidade de imagens deixa de aparecer nos cards de listagem; permanece apenas na galeria da página de organização.

## Detalhes técnicos

`src/components/venue/gallery-carousel.tsx`:
- Causa do contador esticado: com `fillContainer`, a classe `[&>div]:h-full` aplicada ao `Carousel` atinge todos os filhos diretos, incluindo o `div` do contador. Restringir o seletor ao viewport do carrossel (ex.: `[&>div:first-child]:h-full`) ou mover o contador para fora do `Carousel`, dentro do wrapper relativo.
- Adicionar `z-30` (acima do overlay) aos wrappers das setas e ao contador, mantendo `stopNav`/`stopPropagation`.
- Trocar o fundo do contador e das setas por `bg-background/30 backdrop-blur-md border-white/25 text-white` (apenas classes utilitárias; sem `-webkit-backdrop-filter` manual).
- Nova prop `showCounter?: boolean` (padrão `true`).

`src/components/venue/public-card-renderer.tsx`: passar `showCounter={false}` nas três instâncias de `GalleryCarousel` (slots de imagem/galeria e fundo do layout imersivo).

`src/components/venue/organization-page-immersive.tsx`: sem mudanças (mantém o contador).
