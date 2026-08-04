# Correção da Iteração 28 — tooltips, galeria e posição da localização

Escopo: correção (não abre nova iteração). Refere-se às Iterações 27 e 28.

## 1. Tooltips nos ícones dos cards públicos

Causa verificada: no card imersivo (`public-card-renderer.tsx`), a camada de conteúdo sobreposta à imagem usa `pointer-events-none`. Os ícones de comodidades ficam dentro dessa camada, então nunca recebem hover/foco — o `Tooltip` existe, mas nunca dispara.

Correção:
- Manter `pointer-events-none` apenas na camada de gradiente/estrutura e aplicar `pointer-events-auto` nos gatilhos de tooltip (ícones), sem reativar clique nas demais áreas (o card continua navegando para a página individual).
- Garantir gatilho acessível: `tabIndex={0}` + `aria-label` também nos ícones do card imersivo (hoje só o `OptionIconList` tem).
- Verificar no navegador o hover em card padrão, card imersivo e página de organização.

## 2. Galeria da página individual

- Pré-carregar até 5 imagens: `GalleryCarousel` passa a marcar como `eager` o slide atual e os próximos até completar 5 (quando houver mais imagens), mantendo `lazy` no restante.
- Enquadramento: imagens da galeria com `object-cover object-center` (ajuste centro/centro) em todos os usos, inclusive no hero do Layout 2.

## 3. Posição do bloco Localização

- Na página individual da organização (Layout 2), o bloco "Localização" (mapa) sai da coluna direita e passa para a coluna esquerda, imediatamente abaixo do bloco "Ambientes" e acima de "Avaliações".
- A coluna direita mantém o card "Manifestar interesse" e os ícones de contato.

## Detalhes técnicos

- `src/components/venue/gallery-carousel.tsx`: cálculo de janela de precarregamento (até 5) e `object-center` nas imagens.
- `src/components/venue/public-card-renderer.tsx`: `pointer-events-auto` nos gatilhos de tooltip do card imersivo; `tabIndex`/`aria-label` consistentes.
- `src/components/venue/organization-page-immersive.tsx`: mover a seção de mapa para depois de "Ambientes".
- Sem migração, sem novos tokens, sem cores hardcoded. Validar light/dark em 360/768/1280 e registrar em `CHANGELOG.md` como `Correção das Iterações 27/28`.
