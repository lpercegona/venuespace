# Correção/extensão das Iterações 40 e 41 — governança de tabelas, contatos e painel do usuário

Escopo fechado: governança de criação de tabelas (categoria + instância), campos de contato totalmente editáveis pelo super admin, e simplificação do painel da organização para usuários.

## 1. Categoria: permitir criação de novas tabelas

- Nova opção por categoria: "Permitir criação de novas tabelas pelas organizações" (ligada por padrão).
- Disponível na criação e na edição de categoria em Administração > Estrutura > Categorias.
- Quando desligada, o botão "Nova tabela" some do painel da organização (para admins da organização e usuários normais). O servidor também recusa a criação.

## 2. Instância: ampliar o bloqueio existente

- O toggle já existente "permitir gestão de campos por usuários" passa a bloquear também a criação de novas tabelas por quem não é super admin.
- O mesmo bloqueio passa a valer para os campos da tabela de Contatos (hoje ela escapa da regra).
- Com o toggle desligado, usuários seguem podendo criar organizações e registros normalmente.
- Botão "Nova tabela" oculto quando bloqueado (por categoria ou por instância).

## 3. Contatos: todos os campos editáveis pelo super admin

Hoje a tabela-modelo "Contatos" de cada categoria tem apenas Empresa/Razão social, CNPJ e Endereço do cliente. Nome, e-mail e telefone eram dados fixos do sistema.

- Passam a existir como campos padrão editáveis na tabela-modelo Contatos de cada categoria: Seu nome (`contact_name`), E-mail (`contact_email`), Telefone (`contact_phone`).
- Super admin edita rótulo, tipo, obrigatoriedade, ordem e pode remover, por categoria, em Estrutura > Tabelas > Contatos > Campos.
- A alteração sincroniza para as tabelas de Contatos já existentes das organizações da categoria.
- Formulário de novo contato (dentro da criação de reserva) e captação pública passam a gravar nesses campos; a lista de contatos continua exibindo nome e e-mail.

## 4. Página da tabela

- "Ver público" só aparece quando a tabela está marcada como pública.
- A seção "Formulários públicos" (lista + criação) fica oculta para todos que não são super admin.

## 5. Painel da organização (usuários)

- Removido o bloco "Membros" da página.
- Removidos o título e o ícone "Tabelas".
- Cards de tabela no novo estilo: apenas ícone + nome (sem descrição, sem badges), mantendo as ações de editar/excluir para quem tem permissão.
- Interações, Reservas (quando o módulo está ativo) e Membros passam a ser cards de atalho na mesma grade, com o mesmo estilo.
- Esses três itens saem do menu dropdown do perfil no cabeçalho.

## Detalhes técnicos

- Migração: `organization_categories.allow_custom_tables boolean not null default true`.
- Dados: inserir `contact_name` / `contact_email` / `contact_phone` em `category_standard_table_fields` para cada tabela-modelo `kind = 'contacts'` e rodar `sync_category_standard_tables` por categoria para propagar às organizações.
- `src/lib/orgs.functions.ts`: `createTable` valida `allow_custom_tables` da categoria da organização e reaproveita `checkFieldManagementAllowed` (renomeado internamente para cobrir tabelas); `getOrganizationBySlug` passa a retornar `category_allow_custom_tables`.
- `src/lib/organization-categories.functions.ts` + `_authenticated.admin.index.tsx`: campo `allow_custom_tables` no formulário de categoria.
- `src/lib/bookings.functions.ts` / `src/routes/api/public/$slug/$tableId.submit.ts`: gravar nome/e-mail/telefone nos novos campos, com fallback para registros antigos.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`: novo `TableCard` compacto, remoção do bloco de membros, grade única com cards de atalho.
- `src/routes/_authenticated.app.$orgSlug.tables.$tableId.index.tsx`: gate `is_public` no "Ver público" e gate de super admin na seção de formulários.
- `src/components/venue/app-shell.tsx`: remoção dos itens Interações/Reservas/Membros do dropdown.
- `CHANGELOG.md`: entrada de correção referenciando as Iterações 40 e 41.