## Problema

O renderizador `PublicCardBody` (usado em landing, `/explore` e `/public/$slug`) usa `flex flex-wrap gap-2` com `basis-1/4|1/2|3/4|full`. Com `gap-2`, dois itens `basis-1/2` somam mais que 100% da linha e quebram para 100% cada — a largura definida pelo super admin (25/50/75/100) não é respeitada visualmente. Ícones configurados aparecem apenas em células de texto (correto), mas hoje ficam pequenos e mal alinhados.

## Correção

Arquivo único: `src/components/venue/public-card-renderer.tsx`.

1. Substituir cada linha (`flex flex-wrap gap-2`) por um **grid CSS de 4 colunas** com `gap-3`, mapeando largura para span:
   - 25% → `col-span-1`
   - 50% → `col-span-2`
   - 75% → `col-span-3`
   - 100% → `col-span-4`
   Isso garante que somas de 25+75 ou 50+50 ocupem exatamente uma linha, respeitando a divisão do super admin.
2. Remover `basis-*` e `grow-0` (não são mais necessários); manter `min-w-0` no item para permitir `truncate`.
3. Melhorar renderização do ícone da célula de texto: aumentar para `h-4 w-4` e usar `shrink-0`, garantindo alinhamento com o label uppercase.
4. Ajustar altura da imagem em spans menores: quando `col-span < 4`, usar `aspect-square` (encaixa melhor em 25/50%); em `col-span-4`, manter `aspect-video`.
5. Manter fallback: quando `col-span-1` (25%), texto continua truncando; label não quebra.

Nenhuma mudança em backend, API pública, ou nos consumidores (`index.tsx`, `explore.tsx`, `public.$slug.index.tsx`) — todos passam `layout`/`fields`/`data` para o mesmo componente, então a correção se replica automaticamente nos três lugares.

## Verificação

- Build + typecheck.
- Playwright em 360, 768, 1280 (light+dark) capturando cards em `/`, `/explore?tab=orgs`, `/explore?tab=records`, `/public/{slug}` para confirmar que combinações 50/50, 25/75, 25/25/50 e 100 renderizam nas larguras corretas com ícones visíveis.
- Registro em `CHANGELOG.md` (Diretriz §0).