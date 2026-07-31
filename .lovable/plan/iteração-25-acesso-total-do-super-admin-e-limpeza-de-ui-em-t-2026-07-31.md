# Iteração 25 — Acesso total do super admin e limpeza de UI em tabelas padrão

Extensão das Iterações 1 (fundação/RLS), 8 (membros) e 20/24 (tabelas padrão e bloqueio).

## 1. Super admin enxerga todas as organizações

- A lista em `/app` passa a incluir todas as organizações da instância quando o usuário for super admin; usuários normais continuam vendo apenas as suas.
- Organizações onde o super admin não é membro aparecem com selo "super admin" no card, para deixar claro que é acesso administrativo, não vínculo.
- O acesso continua invisível para usuários normais: nada muda na visão deles.
- Dentro de uma organização, o super admin navega normalmente (tabelas, registros, conversas, membros) mesmo sem membership.

## 2. Gestão de usuários da organização pelo super admin

- No fluxo de edição da organização, o super admin ganha uma seção "Membros": listar, adicionar por e-mail, alterar papel (proprietário/editor/leitor) e remover.
- Definir proprietário: alterar o papel de um membro para "proprietário" é permitido ao super admin em qualquer organização.
- Regra de integridade: a organização não pode ficar sem nenhum proprietário — remoção/rebaixamento do último proprietário é bloqueada com mensagem clara.
- Proprietários comuns mantêm o comportamento atual (a página de Membros existente segue igual para eles).

## 3. Usuário normal — tabelas padrão (bloqueadas)

Somente para tabelas padrão (`is_locked`), e somente para quem não é super admin:

- Painel da organização: remover o ícone de edição da tabela.
- Página de registros da tabela: remover o botão "Campos".
- Página de registros da tabela: remover o botão "Novo formulário" e a seção que lista os formulários públicos existentes.

Tabelas criadas pelo próprio usuário continuam com todos os controles. Super admin continua vendo tudo.

## Detalhes técnicos

- **Migração (RLS)**: adicionar `OR public.is_super_admin(auth.uid())` às políticas de SELECT/UPDATE/DELETE de `organizations`, `memberships`, `tables`, `fields`, `records`, `views`, `conversations`, `messages`, e ao `WITH CHECK` de INSERT em `memberships`. Sem novas tabelas, sem novos GRANTs.
- **`src/lib/orgs.functions.ts`**:
  - `listMyOrganizations`: se `is_super_admin`, consultar `organizations` diretamente (todas), marcando `role: 'super_admin'` quando não houver membership.
  - `getOrganizationBySlug`: retornar `myRole: 'owner'` efetivo para super admin (ou flag `isSuperAdmin`) para liberar as ações de dono na UI.
  - `updateOrganization` e guardas de membros (`addMemberByEmail`, `updateMembershipRole`, `removeMembership` em `applications.functions.ts`): aceitar super admin além de `has_role(owner)`; validar "último proprietário".
- **UI**:
  - `src/routes/_authenticated.app.index.tsx`: selo para orgs sem vínculo.
  - `src/components/venue/edit-org-dialog.tsx`: nova seção de membros, visível só para super admin, reaproveitando `listMembers`/`addMemberByEmail`/`updateMembershipRole`/`removeMembership`.
  - `src/routes/_authenticated.app.$orgSlug.index.tsx`: esconder o botão de edição da tabela quando `is_locked && !isSA`.
  - `src/routes/_authenticated.app.$orgSlug.tables.$tableId.index.tsx`: buscar `is_super_admin` + `is_locked` da tabela e ocultar botão "Campos", criação e listagem de formulários públicos nesse caso.
- **Fechamento**: typecheck, verificação em light/dark e 360/768/1280, e entrada em `CHANGELOG.md` como Iteração 25.
