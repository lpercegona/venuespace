
# Revisão e correção — bloqueio na criação de organização

## Diagnóstico

O erro atual **não** é mais `row-level security` — mudou para:

```
Error: Legacy API keys are disabled
  at src/lib/orgs.functions.ts:32 (context.supabase.rpc("create_organization", ...))
```

Isto é resposta do PostgREST/GoTrue rejeitando a chamada porque **algum token em uso ainda tem formato de chave JWT legada** (após a rotação de chaves feita no turno anterior, o projeto passou a rejeitar chaves antigas). A causa é uma das três abaixo — o plano ataca as três em ordem:

1. **Sessão do navegador emitida antes da rotação/migração de assinatura.** O `access_token` guardado em `localStorage` continua sendo enviado como `Authorization: Bearer …` e é interpretado como chave legada por PostgREST quando cai no `apikey` header em alguma rota.
2. **Assinatura JWT do projeto ainda em HS256** (não migrada para ES256), então tokens novos também batem no bloqueio quando o gateway espera JWKS.
3. **`.env` correto (`sb_publishable_…`) mas processo Node do dev-server ainda com o valor antigo em `process.env`** (restart pendente).

## Escopo da correção

### 1. Ambiente e chaves
- Garantir que `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` estão em `sb_publishable_…` (já confirmado no `.env`).
- Migrar chaves de assinatura JWT para ES256 (`supabase--migrate_signing_keys`) — pré-requisito para as novas `sb_publishable_` funcionarem sem tocar em keys legadas.
- Reiniciar o dev server para recarregar `process.env`.

### 2. Sessão do usuário
- Adicionar uma limpeza defensiva no fluxo de login: se `supabase.auth.getUser()` falhar com erro de token/legacy, invocar `supabase.auth.signOut({ scope: "local" })` e redirecionar para `/auth`. Isto elimina o problema de sessões antigas sem forçar o usuário a limpar storage manualmente.
- Documentar no `AGENTS.md`/`CHANGELOG.md` a necessidade de logout uma vez após rotação.

### 3. `createOrganization`
- Manter a RPC `create_organization` (SECURITY DEFINER) já criada — ela é o caminho correto e permanece.
- Nenhuma outra alteração de contrato.

### 4. Varredura de regressão (Iterações 1–8)
Revisar cada superfície para confirmar que nenhuma outra chamada quebrou com a rotação de chaves ou está usando padrões proibidos pelo `/skill:venuespace`:

- **Iteração 1** — `orgs.functions.ts`, `tables.functions.ts`, `fields.functions.ts`, rotas `/app`, `/app/$orgSlug`, `/auth`; verificar tokens (`--brand`, status, `--shadow-elegant`) presentes em `src/styles.css` light + dark + `@theme inline`; fontes carregadas em `__root.tsx` via `<link>`.
- **Iteração 2** — `records.functions.ts` (Zod dinâmico, resolver de computed qty×valor / soma / contagem), `DynamicGrid` (cards em mobile, tabela dentro de `ScrollArea` no desktop), `DynamicForm`, CRUD de `views` e `permissions`, publicar/despublicar.
- **Iteração 3** — `GET /api/public/$slug/$tableId` e `POST …/submit` usando o publishable server client (não `supabaseAdmin`), gravação em `submissions_table_id` com `auto_relation_field_id`, geração de `lead_access_tokens` para anônimos, criação da `conversation` vinculada.
- **Iteração 4** — `messages.functions.ts`: proposta (`type='proposal'`, `proposed_value`), transições de `deal_status` copiando `agreed_value`, rota `/lead/$token`, inbox de conversas, polling 5s; acesso por membership / token / autenticado.
- **Iteração 5** — `applications.functions.ts` (`getMyApplications` cross-org), rota `/_authenticated/me/applications`; submissão autenticada preenche `applicant_user_id` **sem** criar membership.
- **Iteração 6** — Página `/public/$slug/campaigns/$recordId` (progresso, PIX, formulário `public_form`), computed somando apenas `contribution_status='confirmed'`, `PATCH …/contribution_status` restrito a owner/editor.
- **Iteração 7** — `runBookingCheck`: sobreposição via `fields.config.booking_role` + `resource_relation_field_id` em tabela `bookable`, rejeição na transição para `accepted`, calendário em `/_authenticated/app/$orgSlug/calendar`.
- **Iteração 8** — `/app/$orgSlug/members` (convite, alterar role, remover), sino de notificações via `messages.read_at`, meta tags por rota pública (og:image só em leaf routes), landing `/`.

Para cada uma:
- verificar que server fns protegidos só são chamados de componente/`_authenticated` loader (nunca loader público);
- verificar RLS/GRANTs das tabelas tocadas continuam corretos;
- verificar responsividade em 360/768/1280 e dark mode;
- verificar que nenhum endpoint `/api/public/*` retorna PII.

### 5. Registro
- Atualizar `CHANGELOG.md` com uma entrada datada (America/Sao_Paulo) descrevendo:
  - migração de chaves de assinatura (ES256),
  - defesa contra sessão legada no cliente,
  - varredura de regressão realizada (com o que foi verificado e o que foi corrigido, se houver).

## Detalhes técnicos

```text
Fluxo de erro atual
  Browser  ──[Bearer token legado]──►  serverFn createOrganization
     serverFn  ──[apikey=sb_publishable_…, Authorization=Bearer <token>]──►  PostgREST
        PostgREST  ─►  gateway detecta assinatura JWT legada  ─►  "Legacy API keys are disabled"
```

Ordem de execução ao aprovar o plano:
1. `supabase--migrate_signing_keys` (idempotente).
2. Restart dev server.
3. Patch no `useAuth`/guard `_authenticated` para signOut defensivo em token inválido.
4. Varredura arquivo-a-arquivo das Iterações 1–8, aplicando correções pontuais só onde houver falha real (sem refactors fora de escopo — Diretriz §0).
5. Atualização do `CHANGELOG.md`.

## Fora deste plano

- Qualquer nova funcionalidade além das 8 iterações já entregues.
- Alterações de design system fora das correções necessárias.
- Refactors amplos.
