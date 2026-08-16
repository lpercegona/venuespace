# Correção das Iterações 41/42 — ícones de tabela, tabelas padrão bloqueadas e destino pós-login

Três correções de escopo já entregue. Nenhuma abre iteração nova.

## 1. Ícones das tabelas não aparecem

Duas causas verificadas:

- Nenhuma tabela de organização tem ícone gravado: consulta ao banco mostra `tables.icon = NULL` em todas as linhas, mesmo quando a tabela-modelo tem ícone (ex.: "Contatos" com `category_standard_tables.icon = 'users'`). A sincronização de tabelas padrão não copia o ícone para as tabelas das organizações.
- Mesmo que houvesse ícone, o card no painel da organização e o cabeçalho da tabela renderizam sempre o ícone genérico de tabela, ignorando o valor salvo.

Correção:

- Propagar `icon` da tabela-modelo para as tabelas das organizações na sincronização (criação e atualização), com backfill das tabelas já existentes que estão sem ícone.
- Renderizar o ícone salvo dinamicamente (nome lucide) no card do painel e no cabeçalho da tabela, com o ícone genérico como fallback quando vazio ou inválido.

## 2. Tabelas padrão sem edição/exclusão para usuários

Hoje o card de tabela mostra os botões de editar e excluir sempre que a tabela não está travada, independentemente de ser tabela-modelo da categoria.

Correção: para qualquer tabela originada de tabela-modelo da categoria (incluindo Contatos e Reservas), ocultar os botões de editar e excluir e bloquear o diálogo de edição para todos os papéis (owner, editor, admin da organização). Somente super admin mantém acesso, pela área de Administração. A tabela continua acessível para uso normal (registros).

## 3. Destino após o login

Hoje todo login cai em `/app` (lista de organizações). Novo comportamento, apenas para quem não é super admin:

- Nenhuma organização vinculada: página de organizações com o estado vazio e o botão "Nova organização" (como hoje).
- Exatamente uma organização: redirecionar direto para a página da organização, que já lista tabelas e o atalho de membros.
- Duas ou mais: página de organizações com a lista (como hoje).

Super admin continua sempre na lista.

## Detalhes técnicos

- `src/components/venue/lucide-icon.tsx` (novo): componente compartilhado `IconByName` + `resolveLucide`, extraído do que hoje está duplicado em `public-card-renderer.tsx`; este passa a importar do novo módulo.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`: `TableCard` usa `IconByName` com fallback `Table`; `canStruct`/`canDeleteStruct` passam a exigir `isSA` quando `t.origin_standard_table_id` estiver preenchido ou `system_data.kind !== 'normal'`.
- `src/routes/_authenticated.app.$orgSlug.tables.$tableId.index.tsx`: cabeçalho usa o ícone dinâmico.
- Migração: atualizar `sync_category_standard_tables` (e o insert de tabelas padrão) para copiar `icon`, mais `UPDATE` de backfill nas tabelas existentes com `icon IS NULL` a partir de `origin_standard_table_id`.
- `src/routes/_authenticated.app.index.tsx`: após carregar `listMyOrganizations` e `amISuperAdmin`, redirecionar com `replace` quando não-SA e houver exatamente uma organização.
- `CHANGELOG.md`: entrada `Correção das Iterações 41/42` com data America/Sao_Paulo.
- Validação: build/typecheck, painel em 360/768/1280, light+dark, sem regressão nas rotas tocadas.
