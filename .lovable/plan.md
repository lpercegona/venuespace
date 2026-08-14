# Erro "JWT issued at future" + plano de performance

## Parte 1 — "JWT issued at future"

O que já está confirmado no código:

- A validação do token acontece em `src/integrations/supabase/auth-middleware.ts` via `supabase.auth.getClaims(token)` (arquivo gerado, não editável). Essa validação compara o campo `iat` do token com o relógio de quem valida — se o relógio do emissor estiver adiantado em relação ao validador, o token é rejeitado mesmo sendo válido.
- `src/hooks/use-auth.ts` hoje trata **qualquer** erro de `getUser()` como sessão inválida e faz `signOut({ scope: "local" })`. Ou seja, uma falha transitória de relógio derruba o usuário para `/auth`.

Diagnóstico ainda não confirmado (primeiro passo do trabalho): capturar em qual camada o erro aparece (middleware de server function, chamada direta do browser ao backend, ou renovação de token) registrando `iat`/`exp` do token e o horário do servidor no momento da rejeição.

Correções propostas:

1. Tolerância a falha transitória no `use-auth`: só encerrar a sessão quando o erro for realmente de autenticação (token revogado/expirado). Para erros de relógio/rede, tentar `refreshSession()` uma vez e só então decidir.
2. Retry único e silencioso nas chamadas de server function que falharem com mensagem de token inválido: renova o token e repete a chamada, em vez de exibir erro ao usuário.
3. Página de login: mensagem clara quando o relógio local está fora de sincronia (diferença detectada comparando o horário do servidor devolvido por uma chamada pública com o horário do navegador).
4. Se a instrumentação mostrar que o problema vem da rotação de chaves de assinatura, migrar as chaves de assinatura do backend, o que remove a validação assimétrica antiga do caminho.

## Parte 2 — Itens de performance levantados

### 1. Cache entre isolates
`src/lib/server-cache.ts` é um `Map` em memória do processo. Em ambiente serverless cada isolate tem o seu, então o cache realmente "reseta" com frequência. Em vez de instrumentar para confirmar o óbvio, a correção é somar a isso um cache de borda: devolver `Cache-Control`/`s-maxage` nas leituras públicas (já existe em `/api/public/localidades`, falta nas demais) e passar as listagens públicas a responder com `stale-while-revalidate`. Mantemos o cache em memória como camada L1.

### 2. Concorrência no motor de reservas
Confirmado por leitura de `src/lib/bookings.server.ts`: `assertNoConflict` faz um SELECT e depois a gravação acontece em outra chamada, sem bloqueio nem restrição no banco. Duas confirmações simultâneas para o mesmo item/período passam. Correção: mover a checagem para uma função no banco que trave a linha do item durante a transação, e falhar a segunda requisição com mensagem de conflito. O teste de duas requisições em paralelo entra como validação depois da correção.

### 3 e 4. Busca textual e filtros jsonb
Confirmado: a filtragem é feita **em JavaScript**, sobre listas trazidas inteiras do banco (`records` com `.limit(2000)`, organizações sem limite, e `explore-filters.server.ts` com `.limit(5000)`). Nenhum índice ajuda nesse desenho — o gargalo é a transferência e o processamento em memória, não o plano da query.

Correção em duas etapas:
- Etapa A (rápida): reduzir colunas trazidas e materializar um campo de texto normalizado por registro/organização, gravado na escrita, para que a busca possa ir ao banco.
- Etapa B: mover busca, filtros e paginação para o banco usando esse campo normalizado + índices adequados (texto e caminhos jsonb mais usados nos filtros). As facetas passam a ser calculadas por agregação no banco.

Índices existentes hoje em `records`: `table_id`, `organization_id`, `status`, `applicant_user_id`. Não há nenhum índice de texto nem sobre caminhos de `data`.

### 5. Payload de galeria na listagem
Confirmado em `src/lib/public.server.ts`: para itens de listagem, **todas** as imagens do array de galeria são assinadas e enviadas, mesmo quando o card mostra uma só. Correção: limitar a assinatura a 1 imagem por item nas listagens (mantendo o total como número), e assinar a galeria completa apenas na página individual.

### 6. Peso de dependências administrativas
`pdf-lib` só é importado em `src/lib/bookings.server.ts` (servidor) — não entra no bundle público. O editor rich-text (Tiptap) é importado por componentes de administração; vamos garantir carregamento sob demanda desses componentes e confirmar com uma verificação de rede na home pública.

### 7. Custo da verificação de sessão
Confirmado: `getClaims` valida a assinatura localmente na maior parte dos casos, mas pode ir à rede para buscar a chave pública. Vamos medir uma vez e, se houver ida à rede recorrente, cachear o material de chave por isolate.

## Melhorias adicionais prioritárias que identifiquei

- Listagens públicas carregam a tabela inteira e paginam em memória (`slice`). Paginar no banco é o ganho isolado mais relevante de tempo de resposta.
- As facetas de filtro varrem até 5000 registros a cada mudança de filtro; com agregação no banco, cada interação de filtro deixa de custar uma varredura completa.
- Faltam índices para os campos mais usados nos filtros; entram junto com a etapa B.

## Ordem de execução sugerida

1. Instrumentar e corrigir o "JWT issued at future" (itens 1–3 da Parte 1).
2. Conflito de reservas no banco (item 2).
3. Limitar payload de galeria nas listagens (item 5).
4. Cache de borda nas rotas públicas (item 1).
5. Busca/filtros/paginação no banco + índices (itens 3 e 4).
6. Medições finais: bundle público e custo de verificação de sessão (itens 6 e 7).
