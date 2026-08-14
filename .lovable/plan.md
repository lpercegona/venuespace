# Correção da Iteração 33 — largura das colunas de cards em /explore e /categoria/$slug

## Objetivo

Ajustar o layout desktop das listagens públicas para que os cards preencham melhor a largura da tela, mantendo a primeira coluna dedicada aos filtros.

## Alterações

1. **Grade externa de 5 colunas** em `src/components/venue/public-listing.tsx`:
   - Coluna 1: barra lateral de filtros, largura fixa (~280 px).
   - Colunas 2–5: área de cards.

2. **Container de cards ocupa 4 colunas** (`lg:col-span-4`) para aproveitar todo o espaço restante.

3. **Grid interno de cards mantido em 2 colunas**, de modo que cada card ocupe 2 colunas da grade externa — 2 cards por linha preenchendo a largura disponível.

4. **Abrangência**: `/explore` e `/categoria/$slug` compartilham `PublicListing`, então ambos são atualizados com a mesma mudança.

## Validação

- Verificar visualmente em desktop (viewport ≥ 1024 px) que os cards ficam mais largos e ocupam toda a área à direita dos filtros.
- Confirmar que não há regressão no mobile (layout continua empilhado).

## Registro

- Entrada em `CHANGELOG.md` como correção/extensão da Iteração 33.
