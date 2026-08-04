# Correções — Página de organização (Layout 2)

Escopo: correção da Iteração 28 (não abre nova iteração). Apenas frontend/apresentação.

## 1. Galeria hero (desktop e mobile)

- A faixa hero passa a exibir múltiplos slides visíveis no desktop em vez de uma única imagem: até 5 imagens encaixadas na largura do viewport (1 por vez no mobile, 2 em tablet, até 4–5 em telas grandes), mantendo o slider com setas.
- Todas as imagens usam preenchimento total do quadro com recorte centralizado (centro/centro), sem distorção e sem faixas vazias.
- Pré-carregamento mantido para as primeiras imagens visíveis; as demais seguem lazy.

## 2. Endereço no hero em mobile

- Reduzir o tamanho do texto e do ícone de localização no mobile para o endereço completo caber, mantendo endereço + separador + "Ver no mapa" em uma única linha (sem quebra e sem corte do link).
- Desktop mantém o tamanho atual.

## 3. Bloco "Manifestar interesse" no mobile

- No mobile o bloco de contato passa a aparecer logo abaixo do bloco Site/Telefone, antes de Ambientes/Localização/Avaliações (no desktop permanece na coluna direita, sobreposto ao hero).
- Versão mobile reduzida: formulário oculto por padrão; um botão "Entrar em contato" expande/recolhe o formulário.
- Permanecem visíveis os ícones de e-mail, WhatsApp e telefone e o botão "Acessar o site".
- Organizações sem formulário público continuam mostrando apenas os ícones de contato.

## Detalhes técnicos

- `src/components/venue/gallery-carousel.tsx`: nova prop de slides por viewport (basis responsiva do `CarouselItem`) usada pelo hero do Layout 2; manter `object-cover object-center` e a janela de precarregamento.
- `src/components/venue/organization-page-immersive.tsx`: extrair o conteúdo do card de contato para um subcomponente renderizado duas vezes — `lg:hidden` na coluna esquerda (colapsável) e `hidden lg:block` na coluna direita (expandido) — evitando duplicação de lógica; ajustar classes tipográficas do endereço (`text-xs sm:text-sm`, ícone `h-3.5 w-3.5 sm:h-4 sm:w-4`, `flex-nowrap` + `truncate`).
- Sem migração, sem novas dependências, sem cores hardcoded. Validar em 360/768/1280, light/dark, e registrar em `CHANGELOG.md` como correção das Iterações 27/28.
