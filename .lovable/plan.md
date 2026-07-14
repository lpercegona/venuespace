## Escopo

Cinco ajustes: edição de organização, exclusão de organização e tabela, remoção do botão "Conversas" do painel, carrossel de tabelas públicas na landing e página `/explore` listando todas as tabelas públicas.

---

### 1. Edição de organização (modal)

- Novo server fn `updateOrganization({ id, name, description, logo_url? })` em `src/lib/orgs.functions.ts` — restrito a role `owner` via `has_role`.
- Novo componente `src/components/venue/edit-org-dialog.tsx` (Dialog shadcn + react-hook-form + zod).
- Gatilho: ícone de lápis ao lado do nome da organização no header do `_authenticated.app.$orgSlug.index.tsx` (visível apenas para owner). Após salvar, invalida `["org", slug]` e `["my-orgs"]`.

### 2. Exclusão de organização e de tabela

- Server fn `deleteOrganization({ id })` — apenas `owner`. Remove cascata natural via FKs existentes; se faltar cascade em alguma tabela filha, adicionar migração `ON DELETE CASCADE` nas FKs para `organization_id`.
- Server fn `deleteTable({ id })` — `owner` ou `editor`. Cascade em `fields`, `records`, `views`, `permissions`, `conversations` que referenciem a tabela; ajustar FKs se necessário.
- UI:
  - Organização: item "Excluir organização" no mesmo modal de edição, com `AlertDialog` de confirmação exigindo digitar o slug. Ao concluir, `navigate({ to: "/app" })`.
  - Tabela: ícone de lixeira no `TableCard` do dashboard da org (já tem lápis). `AlertDialog` de confirmação exigindo digitar o nome da tabela.
- Ambas ações restritas por RLS já existente + checagem explícita no handler.

### 3. Remover botão "Conversas" do painel

- Em `src/components/venue/app-shell.tsx`, remover o item "Conversas" do dropdown do avatar (mantém Configurações, Minhas candidaturas, Calendário, Membros, Sair).
- Manter o `ChatWidget` flutuante intacto (já é a superfície única de acesso a conversas).
- A rota `_authenticated.app.$orgSlug.conversations.*` permanece funcional (acesso via link direto), apenas sem entrada no menu.

### 4. Carrossel de tabelas públicas na landing (`/`)

- Novo endpoint `GET /api/public/tables` em `src/routes/api/public/tables.ts` (sem auth, `Cache-Control: public, max-age=60`): retorna as N tabelas mais recentes que possuem ao menos um `record` com `status = 'published'`. Projeção segura: `{ org_slug, org_name, table_id, table_slug, table_name, table_icon, published_count, latest_published_at }`. Ordena por `latest_published_at DESC`, limite 12.
- Query via `supabaseAdmin` (server-only) com joins limitados às colunas acima; nenhuma PII de record.
- UI: novo componente `src/components/venue/public-tables-carousel.tsx` usando o Carousel do shadcn (`embla-carousel-react`). Inserido em `src/routes/index.tsx` acima da grid de features. Cada card leva a `/public/$slug/$tableId`.
- Se lista vazia, o carrossel não é renderizado (fail-soft).

### 5. Página "Explorar" com todas as tabelas públicas

- Nova rota pública `src/routes/explore.tsx` (`/explore`), SSR, com `head()` próprio (title + description + og). Loader chama server fn `listAllPublicTables({ limit, offset, q? })` alimentado pelo mesmo dataset do endpoint acima, com paginação simples (offset/limit) e busca opcional por nome de tabela/organização.
- UI: grid responsiva de cards (mesmo card do carrossel), input de busca, paginação (Prev/Next). Sem auth.
- Link "Ver todas" no cabeçalho do carrossel na landing → `/explore`. Link "Explorar" também no header público da landing.

---

## Detalhes técnicos

- **Sem alterações de esquema** exceto, se necessário, ajustar `ON DELETE CASCADE` nas FKs para `organization_id` e `table_id` para permitir exclusão sem órfãos. Verificar antes com `information_schema` e migrar apenas o que faltar.
- **RLS** já cobre delete via policies existentes de owner/editor; server fns fazem checagem explícita adicional com `has_role`.
- **Endpoint público** de tabelas usa `supabaseAdmin` apenas para leitura projetada — nenhuma coluna sensível, nada de `data` de records. Confere §7.5 do checklist.
- **CHANGELOG.md** atualizado com entrada datada cobrindo os cinco itens.
- **Validação** antes de fechar: build + typecheck; testes manuais em 360/768/1280 light+dark de: modal de edição, dois AlertDialogs de exclusão, dropdown do avatar sem "Conversas", carrossel na `/`, `/explore` com busca e paginação; regressão do restante do app; nenhum PII em `/api/public/tables`.

## Fora de escopo (não fazer nesta iteração)

- Transferência de organização, arquivamento em vez de deletar, soft-delete, lixeira/undo, filtros avançados no explore (categorias, tags), SEO estruturado (JSON-LD) na `/explore`.
