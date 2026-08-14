# Iteração B — Correção do atraso no carregamento da home

## O que a medição mostrou (números reais, medidos agora)

- Home (SSR) com cache frio: **4,3 s** até o primeiro byte. Com cache quente: **1,35 s**.
- O endpoint que monta os blocos da home (`home-grouping-data`) sozinho: **4,6 s** frio, **0,65 s** quente. É ele que domina o tempo.
- Latência de uma ida ao banco a partir do servidor: **~200 ms** por consulta.
- Volume de dados: **37 organizações públicas** e **10 registros**. Total de dados das organizações: **64 kB**.
- As fotos são URLs externas (não do nosso storage), então **assinar imagens não custa nada** aqui.

Conclusão: o atraso **não** vem do volume de dados nem de varredura de campos jsonb — vem da **quantidade de idas ao banco feitas uma depois da outra**. A home tem 7 blocos e cada bloco é resolvido em sequência, disparando várias consultas próprias (organizações, chaves de filtro, apelidos de opções, layouts, campos da categoria). São ~20–25 consultas encadeadas × 200 ms ≈ os 4,3 s observados.

Isso corrige a premissa da iteração B anterior (busca/filtros/índices no banco): com 37 organizações, mover a filtragem para o Postgres traria ganho desprezível. O ganho está em **reduzir e paralelizar as idas ao banco** e em **manter o resultado em cache por mais tempo**.

## O que será feito

1. **Blocos da home resolvidos em paralelo**
   Hoje os 7 blocos são resolvidos um após o outro. Passam a ser resolvidos ao mesmo tempo, sobre um único conjunto de organizações/registros já carregado. A regra de "não repetir a mesma organização entre blocos" é aplicada depois, na ordem dos blocos — o resultado visual continua idêntico.

2. **Uma única leitura de catálogo por requisição**
   Organizações públicas, registros públicos, layouts, campos de categoria, chaves de filtro e apelidos de opções passam a ser carregados **uma vez** por requisição (snapshot compartilhado) em vez de por bloco. Reduz de ~25 consultas para ~5.

3. **Cache com validade maior e chave estável**
   As chaves de cache hoje variam conforme os filtros de cada bloco, o que provoca falha de cache quase sempre; e a validade é de 30 s. Passam a chaves estáveis (o catálogo inteiro) com validade de 5 minutos e revalidação em segundo plano.

4. **Cache de borda na home**
   A resposta HTML da home e o endpoint dos blocos passam a devolver `s-maxage` + `stale-while-revalidate`, de modo que visitantes seguintes recebam a página já pronta da borda em vez de reprocessar no servidor.

5. **Redução do payload da home**
   A página hoje envia **581 kB** de HTML, com ~200 kB só de dados de blocos. Serão enviados apenas os campos usados pelos cards (hoje viajam `description` e `category_data` completos, além de galerias inteiras nos blocos), e apenas o agrupamento ativo é embutido — os demais carregam sob demanda ao trocar de aba.

6. **Verificação**
   Nova medição do tempo até o primeiro byte da home (frio e quente) e da contagem de consultas, com registro dos números antes/depois no `CHANGELOG.md`.

## Fora do escopo (e por quê)

- **Busca/filtros/paginação no Postgres, coluna de texto normalizado e índices jsonb**: adiados. Com 37 organizações e 10 registros o custo hoje é irrelevante frente às idas ao banco; a mudança é a mais cara do roteiro e só se paga com volume. Fica registrado como gatilho: reavaliar ao ultrapassar ~1.000 organizações ou ~5.000 registros.

## Detalhes técnicos

- `src/lib/home-data.server.ts`: substituir o `for` sequencial por um snapshot único (`loadPublicCatalogSnapshot`) + resolução dos blocos em memória, com deduplicação aplicada na ordem de `order_index`.
- `src/lib/public.server.ts`: extrair a leitura de organizações/registros e os `load*Batch` para o snapshot compartilhado; `listPublicOrganizations`/`listPublicRecords` passam a filtrar sobre ele. Projeção reduzida de colunas nas listagens.
- `src/lib/server-cache.ts`: chaves estáveis, TTL de 5 min para o snapshot e revalidação em segundo plano (serve o valor vencido e atualiza em paralelo).
- `src/routes/api/public/home-grouping-data.ts` e `src/routes/index.tsx`: cabeçalhos de cache de borda e pré-carregamento apenas do agrupamento ativo.
- `CHANGELOG.md`: registro como Iteração B, referenciando a Iteração A.
