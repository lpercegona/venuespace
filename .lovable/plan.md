## Iteração 18 — Galeria pública, perfil rico e visibilidade da organização

Extensão explícita das Iterações 13 (galeria/renderer) e 17 (payload público de organização). Não cria fluxo paralelo.

### 1. Bug: galeria mostra URL em vez de imagens (landing, /explore, perfil)

Causa confirmada em `src/lib/public.server.ts` → `signImagePathsInItems`:

```
if (f.type === "image" || imageLike) {
  const v = it.data?.[f.key];
  if (typeof v !== "string" || !v || isHttp(v)) continue; // <- pula para o PRÓXIMO campo
  ...
}
if (f.type === "gallery" || imageLike) { ... }
```

Para um campo `gallery` (array), o `continue` do primeiro `if` interrompe o loop antes do segundo bloco, então os paths do array nunca vão para `createSignedUrls`. Verificado no payload real de `/api/public/organizations`: `galeria` (image) volta assinada; `galeria_2` (gallery) volta como paths crus. O `PublicCardBody` então filtra por `isUrl` e cai no ramo de texto, exibindo a string do path.

**Correção**: substituir os `continue` por early-return do bloco atual (usar função interna, IIFE, ou `else if` invertendo a lógica) para que o mesmo campo seja avaliado nos dois ramos. Sem mudança de comportamento em image/file — apenas garantir que gallery seja processado.

Isso propaga sozinho para landing, `/explore` e `/public/$slug` (mesma função `listPublicOrganizations` / `listPublicRecords`).

### 2. Perfil público da organização mostra tudo do cadastro

Hoje `src/routes/public.$slug.index.tsx` só renderiza a lista de registros. Adicionar antes da lista um cabeçalho de perfil com:

- Logo (quando `logo_url` existe).
- Nome + descrição.
- Endereço formatado (linha 1: `street, number — complement`; linha 2: `neighborhood — city/UF — CEP`), respeitando o mesmo formato usado em `AddressFields`.
- Categoria (nome resolvido via categoria).
- Campos personalizados da categoria (o mesmo motor de `PublicCardBody` já cobre isso — reutilizar `fields` + `data` da organização), respeitando ícones/largura definidos no layout `organization_card` do super admin. Se algum campo estiver fora do layout, cair num render sequencial padrão (label + valor) para não esconder informação.

Fonte de dados: novo server-fn `getPublicOrganization({ slug })` em `src/lib/public.server.ts` que devolve o mesmo shape usado em `listPublicOrganizations` (item único: `data`, `fields`, `layout`, `address`, `category_id`, `category_name`), passando por `signImagePathsInItems`. Endpoint público `GET /api/public/organizations/$slug` para a rota consumir via query.

A rota `/public/$slug/` faz uma query paralela para org + records. 404 quando org não existe ou está oculta.

### 3. Visibilidade da organização (público / oculto)

Novo campo booleano `organizations.is_public` (default `true` para não quebrar organizações existentes — retroativo conforme diretriz §0).

Migration:

- `ALTER TABLE public.organizations ADD COLUMN is_public boolean NOT NULL DEFAULT true;`
- Ajustar a policy pública de SELECT em `organizations` para exigir `is_public = true` (mantém owner/editor/viewer com acesso via `is_org_member`).
- `listPublicOrganizations`, `listPublicRecords` e `getPublicOrganization` filtram `is_public = true`.
- Rotas públicas (`/public/$slug/…`, `/public/$slug/campaigns/$recordId`, formulário público) retornam 404 quando a org está oculta. Tokens de lead continuam funcionando (não passam pela listagem).

UI no painel do usuário: em `src/components/venue/edit-org-dialog.tsx`, adicionar `Switch` "Perfil público" no topo do formulário, ligado a `is_public`. `updateOrganization` recebe o campo (Zod `boolean().optional()`); persistência via `context.supabase.from('organizations').update({ is_public })`, autorizado pela policy de owner/editor já existente.

### 4. Governança (§0 e §7)

- CHANGELOG: nova entrada datada cobrindo a correção da galeria (Iteração 13), o perfil enriquecido (Iteração 17) e o toggle de visibilidade.
- Auditoria de propagação: landing (`/`), `/explore` (abas de organizações e registros), `/public/$slug/`, `/public/$slug/$tableId/$recordId`, endpoints `/api/public/organizations`, `/api/public/records`, `/api/public/campaigns/$recordId`, formulário público — todos revisados quanto ao filtro `is_public` e à assinatura de galeria.
- Roles verificadas: super_admin (mantém acesso via `is_super_admin`), owner/editor/viewer (mantêm acesso via `is_org_member`), anônimo (não vê orgs ocultas), autenticado não-membro (idem).
- Sem novos tokens, sem componente novo além do bloco de perfil (reutiliza `PublicCardBody`, `Card`, `Switch`).
- Build + smoke em 360/768/1280, light+dark, antes de fechar.

### Detalhes técnicos

- Refactor de `signImagePathsInItems`: extrair `signSingle(f, it)` e `signGallery(f, it)`; loop chama ambos por campo sem `continue` cruzado.
- `getPublicOrganization`: query única em `organizations` por slug (RLS via admin client, mas com filtro `is_public=true` explícito), junta layout + fields de categoria como já feito no batch, passa por `signImagePathsInItems` reaproveitando o array `[item]`.
- Novo route file `src/routes/api/public/organizations.$slug.ts` (GET) — não confundir com o `organizations.ts` de listagem existente.
- `EditOrgDialog` já usa `useQueryClient` e invalida `["org", slug]` / `["my-orgs"]` no save; nada a acrescentar além do campo.
- Sem mudanças em `records`, `permissions`, chat, campanhas, reservas, /admin, categorias, blog.
