## Escopo

Correção/extensão da **Iteração 24** (master de reservas, formulários padrão, campos de contato base, layout público em 2 colunas). Não abre nova iteração — será registrada no `CHANGELOG.md` como `Correção da Iteração 24`.

## 1. Botões de contato ao lado do botão de formulário

Na página pública da organização (`src/routes/public.$slug.index.tsx` + `src/components/venue/contact-actions.tsx`):

- O bloco lateral passa a agrupar, na mesma área: botão primário do formulário (quando disponível) e, logo abaixo/ao lado, os botões **somente ícone** de WhatsApp, telefone e e-mail, alimentados por `system_data.whatsapp / phone / email`.
- "Acessar o site" permanece como botão largo com rótulo.
- Cada ícone só aparece se o campo estiver preenchido; `aria-label` obrigatório; alvo de toque `h-11 w-11`.

## 2. Contato pela plataforma só com usuário atribuído

- `getPublicOrganization` e `loadPublicTable` (`src/lib/public.server.ts`) passam a calcular `has_assigned_user`: existe `memberships` da organização cujo `user_id` **não** está em `super_admins`.
- Quando `false`: `public_form_view` retorna `null` nas páginas públicas de organização e de registro, o chat/lead por token não é oferecido, e a lateral exibe apenas os contatos diretos (site/WhatsApp/telefone/e-mail).
- O endpoint de submissão (`src/routes/api/public/$slug/$tableId.submit.ts`) rejeita a submissão quando a organização não tem usuário atribuído (proteção server-side, não só de UI).

## 3. Tabela única de contatos por organização

Hoje `apply_standard_forms_to_org` cria **uma tabela de submissões por formulário**. Passa a existir **uma única tabela "Contatos" por organização**, com os dois formulários (organização e registro) gravando nela.

Migração:
- Nova tabela de sistema `Contatos` por organização (`is_system = true`, `is_locked = true`, `is_public = false`), identificada por marcador em `system_data` (ex.: `kind = 'contacts'`), independente de categoria.
- `apply_standard_forms_to_org` reescrita para: garantir a tabela `Contatos`, espelhar nela a união dos campos de todos os formulários padrão ativos da categoria (mesclando por `field_key`), manter um único campo `__origem` (relation) preenchido apenas pelas submissões de escopo registro, e apontar `views.submissions_table_id` de ambos os formulários para essa tabela.
- Limpeza de campos `source='category'` passa a considerar a união dos campos de todos os formulários (não apagar campos do outro formulário).
- **Migração de dados**: registros existentes nas tabelas de submissão antigas são movidos para a tabela `Contatos` da mesma organização; conversas e `lead_access_tokens` seguem vinculados aos mesmos `record_id`; as tabelas antigas vazias são removidas.
- `apply_standard_forms_to_org` passa a ser executada também na criação de organização mesmo sem formulários padrão, garantindo a tabela `Contatos` para todos.

## 4. Tabela de contatos nunca pública

- Backend: `updateTable` (`src/lib/orgs.functions.ts`) rejeita `is_public = true` para a tabela de contatos; migração garante `is_public = false`.
- Frontend: no painel da organização, o switch "pública" dessa tabela aparece desabilitado com texto explicativo; a tabela também é excluída das listagens públicas (`listPublicTables`, `listPublicRecords`) por já ser `is_public = false`.

## Detalhes técnicos

- Migrações SQL: coluna/marcador de identificação da tabela de contatos, reescrita de `public.apply_standard_forms_to_org`, backfill de dados e execução retroativa para todas as organizações existentes.
- Arquivos tocados: `src/lib/public.server.ts`, `src/lib/orgs.functions.ts`, `src/routes/api/public/$slug/$tableId.submit.ts`, `src/routes/public.$slug.index.tsx`, `src/routes/public.$slug.$tableId.$recordId.tsx`, `src/routes/public.$slug.$tableId.index.tsx`, `src/components/venue/contact-actions.tsx`, `src/routes/_authenticated.app.$orgSlug.index.tsx`.
- Sem novos tokens de cor; apenas primitives shadcn já existentes (Button, Switch, Tooltip).
- Validação: build/typecheck, rotas públicas em 360/768/1280 em light+dark, submissão de formulário de organização e de registro caindo na mesma tabela, organização sem usuário atribuído sem formulário/chat.
