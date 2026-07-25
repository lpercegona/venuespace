## Escopo (Iteração 22)

Três mudanças no layout público de cards e no cadastro de organização. Sem alteração de escopo além do pedido.

### 1. Nome e logo como itens do layout (super admin)

Hoje `src/routes/index.tsx`, `src/routes/explore.tsx` e a seção de organizações em `src/routes/public.$slug.index.tsx` renderizam **hardcoded** logo + `CardTitle` no `CardHeader` — o layout do super admin (que já expõe `name` e `logo_url` como campos-base) é ignorado para essas duas informações.

- Remover o `CardHeader` fixo com `<OrgLogo/> + <CardTitle/>` desses três locais.
- Renderizar todo o card (inclusive nome e logo) via `PublicCardBody`, respeitando ordem/largura definidas em "Card de organização".
- Em `src/components/venue/public-card-renderer.tsx`, tratar dois `field_key` especiais:
  - `name`: renderiza como **H3** (`<h3 class="font-display text-lg font-semibold line-clamp-2">`), sem label/ícone acima. Continua sendo o fallback natural de `getPublicCardTitle`.
  - `logo_url`: usa `OrgLogo` (fallback com ícone `Building2`) em vez do `LazyImage` cru, para preservar o comportamento de "sem logo → imagem genérica". Quando o campo estiver ausente do layout, nada é exibido.
- Se o layout da categoria estiver **vazio**, manter fallback atual (nome + descrição) apenas para não quebrar organizações sem layout configurado.
- Não altera cards de **registro** (o pedido é sobre organizações), mas o suporte a `name`/H3 fica no renderer genérico e é aproveitável se o super admin adicionar `name` ao card de registro.

### 2. Opção "sem margens" para imagens e galerias

Adicionar flag opcional `bleed: boolean` em `config` de itens de layout do tipo imagem/galeria.

- **Editor (`LayoutEditor` em `src/routes/_authenticated.admin.index.tsx`)**: nova coluna/checkbox "Sem margens" visível apenas quando o campo selecionado é do tipo `image`, `gallery` ou é `logo_url`. Persistido em `config.bleed` via `saveCategoryLayout` (o schema já aceita `config: z.record(...)`, sem migração).
- **Renderer (`PublicCardBody`)**: quando uma célula `single-image`/`gallery` tem `bleed: true`:
  - Se ocupa 100% da largura e é o **primeiro** item da primeira linha → aplicar classes negativas para escapar do padding do `Card` (`-mx-6 -mt-6 rounded-t-xl rounded-b-none`) e remover `aspect-*` fixo? Não: manter `aspect-video`, apenas anular padding lateral/superior.
  - Se ocupa 100% e está entre linhas → `-mx-6` (só lateral).
  - Se ocupa 100% e é o **último** item → `-mx-6 -mb-6 rounded-b-xl rounded-t-none`.
  - Em qualquer outra situação (largura < 100%), a flag é ignorada (não faz sentido "sem margem" numa célula que divide linha) e um aviso silencioso no editor informa isso.
- Nada muda no comportamento padrão (`bleed` ausente = comportamento atual).

### 3. Logo da organização vira upload de imagem

Em `src/components/venue/edit-org-dialog.tsx`, substituir o `Input type="url"` "Logo (URL)" por um uploader:

- Reaproveitar o padrão já em uso em `src/components/venue/dynamic-form.tsx` (campo `image`): `supabase.storage.from("venue-uploads").upload(path, file)` com `path = ${orgId}/logo/${uuid}-${nome}`, gerar signed URL via `getSignedUploadUrl` para preview, e persistir o **path** (não a URL crua) em `organizations.logo_url`.
- Renderizar preview com `OrgLogo` + botão "Remover" e "Substituir".
- `OrgLogo` hoje só aceita URL absoluta (`/^https?:\/\//`). Ampliar para: se o valor for um path (não http), resolver via `getSignedUploadUrl` no cliente (mesma lógica do `dynamic-form`) para exibir. Servidor público (`src/lib/public.server.ts`) segue devolvendo o valor como está em `org.logo_url`; adicionar resolução para signed URL quando for path, para que cards públicos continuem exibindo.
- Sem mudança no formulário de **criação** de organização (não tem campo de logo hoje — fora do escopo).

### Governança (§7)

- Sem migração de banco (usa `config.bleed` livre).
- Verificar RLS de `venue-uploads` já cobre a nova pasta `${orgId}/logo/`.
- Validar em 360/768/1280, light+dark, sem regressão em `/`, `/explore`, `/public/:slug`.
- Nenhum token de cor hardcoded.
- Atualizar `CHANGELOG.md` com entrada datada cobrindo os três itens.
- Auditoria de propagação: `PublicCardBody` é usado também no card de registro — mudança do `name` em H3 se aplica lá quando super admin incluir o campo (esperado, não regressão).
