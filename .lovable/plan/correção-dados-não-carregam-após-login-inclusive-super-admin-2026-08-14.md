# Correção: dados não carregam após login (inclusive super admin)

## Causa confirmada

A última iteração de segurança revogou `EXECUTE` das funções `SECURITY DEFINER` e devolveu o direito apenas a 9 delas para o papel `authenticated`. Duas funções ficaram de fora — `is_org_member()` e `can_edit_org()` — mas elas **são usadas dentro das políticas de RLS**, e políticas de RLS são avaliadas com o papel de quem consulta (`authenticated`), não com o dono da função.

Verificação feita no banco:

- ACL atual: `is_org_member` e `can_edit_org` = `{postgres, service_role}` (sem `authenticated`).
- 26 políticas em `conversations`, `fields`, `memberships`, `messages`, `organizations`, `permissions`, `records`, `tables` e `views` chamam essas duas funções, todas para o papel `authenticated`.
- `profiles` só é legível via join em `memberships`, cuja política também depende de `is_org_member` — por isso e-mail/nome do usuário não aparecem.
- Dados em si estão íntegros: 6 usuários em auth, 6 perfis (nenhum sem e-mail, nenhum faltando) e 1 super admin registrado.

Resultado prático: qualquer leitura/gravação nessas tabelas retorna "permission denied for function", derrubando organizações, tabelas, campos, registros, mensagens e reservas — para usuários comuns **e** para o super admin (a política de super admin não é alcançada porque a consulta já falha na avaliação das demais políticas).

## Correção

1. Nova migração concedendo `EXECUTE` em `public.is_org_member(uuid, uuid)` e `public.can_edit_org(uuid, uuid)` ao papel `authenticated`.
   - Ambas são funções booleanas somente-leitura, sem efeito colateral, e escopadas por `_user_id` informado — o mesmo perfil de risco de `has_role`/`is_super_admin`, que já mantêm o grant.
   - `anon` permanece sem `EXECUTE` (nenhuma política pública as usa).
2. Auditoria de fechamento: rodar uma consulta que cruza todas as expressões de política com o ACL das funções, garantindo que nenhuma outra política dependa de função sem grant para o papel indicado.
3. Validação end-to-end na pré-visualização, autenticado como super admin: carregar `/app`, uma organização, suas tabelas/campos/registros, membros (com e-mail no perfil) e a área de conversas; confirmar ausência de erros de permissão no console.
4. Atualizar a memória de segurança para registrar que `is_org_member` e `can_edit_org` precisam de `EXECUTE` para `authenticated` por serem chamadas de dentro de políticas de RLS — evitando que uma varredura futura as revogue de novo.
5. Registrar a correção no `CHANGELOG.md` como continuação da iteração de segurança anterior (não como nova iteração de produto).

## Fora do escopo

Nenhuma alteração de esquema, de políticas de RLS ou de código de front-end — o problema é exclusivamente de privilégio de execução.
