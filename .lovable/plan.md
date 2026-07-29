## Iteração 24 — Reservas master, Formulários padrão, Contato base e Perfil público em 2 colunas

Escopo fechado, 4 blocos. Estende as Iterações 7 (motor de reserva), 20/21 (tabelas padrão), 12 (campos de categoria) e 18/19 (perfil público).

---

### Bloco A — Controle master de reservas na tabela padrão

- Nova coluna `bookable boolean not null default false` em `category_standard_tables`.
- Modal de edição de tabela padrão (Admin → Tabelas padrão) ganha switch "Permitir recebimento de reservas", ao lado do switch de visibilidade pública.
- `sync_category_standard_tables` e `create_organization` propagam o master:
  - master ligado → tabela da org mantém o valor escolhido pelo usuário (default `false` na criação);
  - master desligado → `tables.bookable = false` forçado em todas as orgs da categoria (retroativo no sync).
- Camada de usuário (Iteração 7 / modal de edição de tabela em `/app/$orgSlug`): o switch "reservas" continua existindo, mas fica desabilitado com texto explicativo quando o master estiver desligado; o backend (`updateTable`) rejeita `bookable = true` se o master da tabela de origem estiver desligado.

### Bloco B — Formulários padrão por categoria (nova aba no Admin)

- Duas tabelas novas: `category_standard_forms` (categoria, escopo `organization` | `record`, `standard_table_id` para escopo registro, título, texto do botão, ativo) e `category_standard_form_fields` (chave, rótulo, tipo, obrigatório, ordem, config) — com GRANTs e RLS (leitura pública apenas do necessário; escrita só super admin).
- Nova aba "Formulários padrão" no painel de administração, com seletor de categoria e sub-abas "Organização" e "Registro" (por tabela padrão), reutilizando o editor de campos já usado em "Campos padrão" (mesmo componente de linhas: chave, rótulo, tipo, obrigatório, opções, ordem).
- Sincronização retroativa (mesmo padrão da Iteração 23): ao salvar, uma função no banco instancia/atualiza, em todas as organizações da categoria:
  - a tabela de destino das submissões (criada como tabela de sistema bloqueada, ex.: "Contatos" / "Interessados") com os campos do formulário;
  - a `view` `public_form` correspondente (`submissions_table_id` e `config.auto_relation_field_id` preenchidos), para escopo registro na tabela padrão correspondente e para escopo organização na tabela de contatos da org.
- Campos obrigatórios de lead existentes (`contact_email`) continuam garantidos pelo fluxo de submissão anônima.

### Bloco C — Campos de contato base

- Adicionar como campos de sistema de organização (tabela `organization_fields`, válidos para todas as categorias): `phone` (telefone), `whatsapp`, `email`, `website` (site).
- Aparecem automaticamente no cadastro/edição da organização (`EditOrgDialog` já renderiza campos de sistema) com máscaras/validações por tipo (`phone`, `email`, `url`).
- Expostos no payload público da organização (`getPublicOrganization`) e ignorados na lista genérica de "Informações" para não duplicar com os botões de contato.

### Bloco D — Página pública da organização em 2 colunas

- Reestruturar `/public/$slug` no mesmo formato de `/public/$slug/$tableId/$recordId`: header + `main` em grid `lg:grid-cols-3`, conteúdo principal (Informações, mapa, publicações) em `lg:col-span-2` e `aside` lateral.
- No `aside`, quando os campos estiverem preenchidos:
  - botão largo "Acessar o site" (link externo);
  - linha de botões somente-ícone: e-mail (`mailto:`), WhatsApp (`https://wa.me/...`), telefone (`tel:`) — todos com `aria-label` e alvo mínimo de 44px em mobile;
  - abaixo, o botão de contato/interesse quando existir formulário padrão de organização (Bloco B).
- Mobile: `aside` empilha acima das publicações; botões em largura total.

---

### Detalhes técnicos

- Migrations: coluna `bookable` em `category_standard_tables`; tabelas `category_standard_forms` e `category_standard_form_fields` (CREATE → GRANT → RLS → POLICY); atualização de `sync_category_standard_tables` e `create_organization`; nova função `sync_category_standard_forms(_category_id)` com verificação de super admin; inserção dos 4 campos base em `organization_fields`.
- Frontend: `src/routes/_authenticated.admin.index.tsx` (nova aba + switch de reservas), `src/routes/_authenticated.app.$orgSlug.index.tsx` (switch bloqueado), `src/routes/public.$slug.index.tsx` (layout 2 colunas + botões), novo `src/components/venue/contact-actions.tsx`.
- Backend: `src/lib/category-standard-tables.functions.ts` (campo `bookable`), novo `src/lib/category-standard-forms.functions.ts`, `src/lib/orgs.functions.ts` (guarda do master), `src/lib/public.server.ts` (campos de contato + form de organização).
- Sem cores hardcoded; apenas tokens semânticos e primitives shadcn existentes (`Button`, `Switch`, `Tabs`, `Card`, `Tooltip`).
- Validação antes de fechar: build/typecheck, rotas em 360/768/1280, light+dark, RLS/GRANTs revisados, entrada em `CHANGELOG.md` como **Iteração 24**.
