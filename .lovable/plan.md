# Correção das Iterações 22/24 + Iteração 26 — Categorias na navegação pública

Três frentes: bloqueio por ausência de proprietário, correção da listagem pública (caso Ópera Arte) e navegação pública separada por categoria.

## 1. Organizações sem proprietário (Correção da Iteração 24)

Hoje o desbloqueio de formulários/chat considera "qualquer membro que não seja super admin". Passa a considerar exatamente a existência de um membro com papel **proprietário (owner)** que não seja super admin.

- Sem owner: página pública da organização e páginas de registros exibem apenas os ícones de contato (WhatsApp, telefone, e-mail) e o botão "Acessar o site". Formulário público e chat ficam ocultos.
- O bloqueio também vale no servidor: envio de formulário e criação de conversa são rejeitados para organizações sem owner.

## 2. Ópera Arte fora da listagem pública (Correção da Iteração 22)

Verificado: a Ópera Arte está marcada como pública, mas **não possui nenhum registro publicado**, e a listagem pública atual só inclui organizações com ao menos 1 registro publicado — por isso ela some de `/` e `/explore`.

Correção conforme decidido: remover essa exigência. Toda organização pública passa a aparecer na listagem, com ou sem ambientes publicados. Os cards continuam usando o layout definido pelo super admin para a categoria.

## 3. Navegação pública por categoria (Iteração 26)

- Página inicial (`/`) ganha uma **linha de tabs de categoria** (ex.: Espaços, Audiovisual), carregadas dinamicamente das categorias existentes. Abaixo delas ficam as seções já existentes (organizações recentes e registros recentes), filtradas pela categoria ativa.
- A categoria ativa é refletida na URL (`?categoria=<slug>`), permitindo link direto e compartilhamento; a primeira categoria é o padrão.
- `/explore` recebe a mesma linha de tabs de categoria **acima** das tabs atuais de Organizações/Registros. Trocar de categoria mantém a aba interna e reinicia paginação/filtros dependentes de categoria.
- Filtros dinâmicos do explore passam a considerar a categoria ativa (já suportado pelo endpoint de filtros).
- Metadados de rota atualizados para refletir a categoria ativa quando aplicável.

## Detalhes técnicos

- `src/lib/public.server.ts`:
  - `orgHasAssignedUser` → passa a verificar `memberships.role = 'owner'` excluindo super admins (renomeada para refletir "tem proprietário").
  - `listPublicOrganizations`: remove o pré-filtro por organizações com registros publicados; mantém `is_public = true`, busca, filtros e paginação.
- `src/routes/api/public/$slug/$tableId.submit.ts` e criação de conversa: mesma regra de owner.
- `src/routes/index.tsx`: tabs de categoria (shadcn `Tabs`) + `validateSearch` com `categoria`; consultas de orgs/registros passam `category`.
- `src/routes/explore.tsx`: nova `TabsList` de categoria acima das tabs existentes, sincronizada com a search param; `fetchOrgs`/`fetchRecords`/`fetchFilters` recebem `category`.
- Categorias vêm de `/api/public/organization-categories` (já existente).
- Sem alteração de schema; nenhuma migração necessária.
- `CHANGELOG.md` recebe entrada datada cobrindo as duas correções e a Iteração 26.
