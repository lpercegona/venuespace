## Objetivo

Instituir um registro obrigatório e cronológico de todas as implementações do Venuespace, e tornar isso norma soberana do projeto via skill.

## Entregas

### 1. Novo arquivo `CHANGELOG.md` (raiz do projeto)

Arquivo dedicado exclusivamente ao registro histórico das implementações. Estrutura:

- Cabeçalho curto explicando propósito e formato.
- Entradas em ordem cronológica **decrescente** (mais recente no topo).
- Cada entrada com: **data e hora** (`YYYY-MM-DD HH:MM` America/Sao_Paulo), **iteração/escopo**, e **descrição objetiva** em bullets do que foi feito (migrations, rotas, componentes, tokens).
- Sem chain-of-thought, sem justificativas subjetivas — apenas o que foi implementado.

Popular retroativamente com as entradas já executadas:

- **Iteração 1 — Fundação**: tokens oklch light+dark, tipografia Fraunces+Inter Tight, migrations (`profiles`, `organizations`, `memberships`, `tables`, `fields`, enums, `has_role`/`is_org_member`/`can_edit_org`, triggers), auth email+Google, layout `_authenticated`, rotas `/app`, `/app/$orgSlug`, schema builder de tabelas, `AppShell`, `EmptyState`.
- **Iteração 2 — Records + Grid Dinâmico**: migrations `records`/`views`/`permissions` com RLS, `records.functions.ts` (list/create/update/delete + resolver de `computed` soma/contagem/qty×valor e expansão de `relation`), `DynamicForm`, `DynamicGrid` (tabela desktop / cards mobile via `useIsMobile`, `ScrollArea`), rota `/app/$orgSlug/tables/$tableId`, ajuste do dashboard.

Datas retroativas: marcadas com a data corrente e nota `(registro retroativo)`.

### 2. Atualização da skill `venuespace` (`.agents/skills/venuespace/SKILL.md`)

Adicionar cláusula na **Diretriz de Desenvolvimento §0** (soberana):

> **Registro obrigatório de implementações**: toda entrega técnica — iteração completa, correção, migração, nova rota, novo componente compartilhado, novo token — é registrada no arquivo `CHANGELOG.md` na raiz do projeto, na mesma edição em que é implementada. Formato: data e hora (`YYYY-MM-DD HH:MM` America/Sao_Paulo), escopo, bullets objetivos do que foi feito. Ordem cronológica decrescente. Nenhuma iteração fecha sem entrada correspondente. Sem registro = entrega incompleta (§7).

Adicionar item correspondente ao **Checklist §7 (gate de fechamento)**:

> 8. `CHANGELOG.md` atualizado com entrada datada cobrindo tudo que a iteração implementou.

Após editar o draft, aplicar via `skills--apply_draft`.

## Arquivos afetados

- `CHANGELOG.md` (novo, raiz)
- `.agents/skills/venuespace/SKILL.md` (edição §0 + §7)

## Fora de escopo

- Nenhuma mudança de código de aplicação, migration, rota, componente ou token.
- Nenhuma automação de geração de changelog (git hook, script) — registro é manual e disciplinado pela skill.
