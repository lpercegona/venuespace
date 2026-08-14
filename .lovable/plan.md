# Mapa de execução — 2 iterações (JWT, concorrência e performance)

Todos os apontamentos foram agrupados em duas iterações. A Iteração A entrega todos os ganhos de baixo risco e as correções de estabilidade. A Iteração B faz a única mudança estrutural pesada (busca e filtros no banco).

## Iteração A — Estabilidade + ganhos imediatos (uma passada)

1. **"JWT issued at future"**
   - `src/hooks/use-auth.ts` deixa de encerrar a sessão em qualquer erro: só desloga em erro real de autenticação; para erro de relógio/rede tenta `refreshSession()` uma vez.
   - Retry único e silencioso nas chamadas de server function que falharem com token inválido (renova o token e repete).
   - Log estruturado de `iat`/`exp` versus horário do servidor no momento da rejeição, para confirmar a origem caso volte a ocorrer.

2. **Concorrência no motor de reservas** (confirmado em `src/lib/bookings.server.ts`: SELECT de conflito separado da gravação, sem trava)
   - Migração criando uma função no banco que valida e grava a reserva na mesma transação, travando as linhas envolvidas.
   - `bookings.server.ts` passa a chamar essa função; a segunda requisição simultânea recebe erro de conflito.

3. **Payload de galeria nas listagens** (confirmado em `src/lib/public.server.ts`: assina todas as imagens do array)
   - Listagens passam a assinar apenas a primeira imagem por item, mantendo o total como número; a galeria completa continua só na página individual.

4. **Cache de borda nas rotas públicas restantes**
   - `home-block-data`, `home-grouping-data`, `home-config`, `organizations.$slug`, `category-*` e blog passam a devolver `cache-control` com `s-maxage` + `stale-while-revalidate`, como já fazem `/records` e `/organizations`. O cache em memória (`server-cache.ts`) continua como camada local; não faz sentido instrumentar isolates, já que por definição cada isolate tem o seu.

5. **Redução de payload das listagens**
   - Selecionar apenas as colunas usadas pelos cards (hoje `description` e `category_data` inteiros viajam para cada item).

6. **Correção do erro de hidratação na home** (`src/routes/index.tsx`) — divergência entre o que o servidor e o cliente renderizam nos blocos, que hoje força re-render completo da árvore no primeiro carregamento.

7. **Carregamento sob demanda do editor rich-text** no admin (o `pdf-lib` já é só de servidor, não afeta o bundle público), com verificação de rede na home para confirmar.

## Iteração B — Busca, filtros e paginação no banco

Hoje a filtragem é toda em JavaScript sobre listas inteiras (`records` com limite de 2000, `explore-filters` com 5000, organizações sem limite) e a paginação é `slice` em memória. É a maior fonte de latência das páginas públicas.

1. Coluna de texto normalizado (sem acento, minúsculo) em `organizations` e `records`, preenchida na escrita por trigger.
2. Índices: texto normalizado + índices sobre os caminhos jsonb efetivamente usados nos filtros (hoje `records` só tem índices de `table_id`, `organization_id`, `status`, `applicant_user_id`).
3. `public.server.ts`: busca, filtros (incluindo multivalor e faixa numérica) e paginação passam para o banco.
4. `explore-filters.server.ts`: facetas por agregação no banco, em vez de varrer 5000 registros a cada mudança de filtro.
5. Validação: `EXPLAIN ANALYZE` das novas consultas e teste de duas requisições simultâneas de reserva confirmando o bloqueio da Iteração A.

## Observações técnicas

- Nada aqui altera contratos de API pública nem o comportamento visual das páginas.
- A Iteração B envolve migração de dados (preenchimento inicial do campo normalizado) e é executada depois de A para não misturar risco com as correções de estabilidade.
- Registro das duas iterações em `CHANGELOG.md`.
