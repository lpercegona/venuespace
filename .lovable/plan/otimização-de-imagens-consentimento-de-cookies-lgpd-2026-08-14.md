# Otimização de imagens + Consentimento de cookies (LGPD)

Escopo fechado, em duas frentes independentes. Referência: as imagens hoje vivem no bucket privado `venue-uploads`, enviadas por `dynamic-form.tsx`, `settings-modal.tsx`, `tiptap-editor.tsx` e `_authenticated.admin.blog.$postId.tsx`, e servidas por URLs assinadas.

## Parte 1 — Motor de otimização de imagens

### 1.1 Pipeline único de upload
- Novo módulo `src/lib/image-optimizer.ts` (client-side, browser):
  - Redimensiona para no máximo 1920 px no maior lado (logos/avatares: 512 px).
  - Reencoda para **WebP** com qualidade 0.82 via `createImageBitmap` + `OffscreenCanvas` (fallback `<canvas>`), preservando proporção.
  - Ignora GIF animado e SVG (envia original).
  - Se o resultado ficar maior que o original, mantém o original.
  - Retorna `File` com extensão `.webp` e `contentType` correto.
- Todos os quatro pontos de upload passam a chamar esse módulo antes de `storage.upload`, mantendo o mesmo caminho/nome (extensão ajustada).

### 1.2 Backfill único das imagens já existentes
Executado uma vez durante a implementação, sem interface permanente:
1. Server function temporária, restrita a super admin, que (a) lista os objetos de imagem do bucket e (b) devolve URLs assinadas de leitura.
2. Reprocessamento local: download, redimensionamento e reencode para WebP.
3. Server function temporária, restrita a super admin, que grava a versão otimizada **no mesmo caminho** (`upsert`), preservando todas as referências já salvas no banco — nenhum registro precisa ser alterado.
4. Relatório final: quantidade de arquivos, bytes antes/depois, arquivos pulados.
5. As duas funções temporárias são removidas ao final da execução.

Arquivos com ganho menor que 10% são mantidos como estão.

### 1.3 Entrega
- `LazyImage` ganha `width`/`height` opcionais para reduzir layout shift onde já há dimensão conhecida (cards e galeria).
- Sem mudança de contrato nas APIs públicas.

## Parte 2 — Consentimento de cookies (LGPD)

### 2.1 Componentes
- `src/components/venue/cookie-consent.tsx`:
  - Banner fixo no rodapé (mobile: bloco inteiro; desktop: barra centralizada), com "Aceitar todos", "Rejeitar não essenciais" e "Preferências".
  - Modal de preferências com três categorias: **Necessários** (sempre ativos, switch desabilitado), **Analíticos**, **Marketing**.
  - Texto explicando finalidade, base legal (LGPD art. 7º), retenção e direitos do titular, com links para a Política de Privacidade e a nova Política de Cookies.
  - Preferência gravada em `localStorage` (`vs_cookie_consent`, versão + data + categorias), renovada a cada 12 meses ou quando a versão do texto mudar.
  - Renderizado apenas após hidratação (evita mismatch SSR), montado uma única vez em `__root.tsx`.
- Link "Preferências de cookies" no `PublicFooter`, reabrindo o modal a qualquer momento.

### 2.2 Google Consent Mode v2
- Em `__root.tsx`, antes do snippet do GTM, `gtag('consent','default', ...)` com `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` em `denied` e `security_storage: granted`.
- Ao salvar preferências, `gtag('consent','update', ...)` com o estado escolhido — o GTM já instalado passa a respeitar a escolha sem alterar tags.

### 2.3 Nova página `/politica-de-cookies`
- Rota `src/routes/politica-de-cookies.tsx` no mesmo padrão visual das páginas legais existentes, com `head()` próprio (title, description, og, canonical).
- Conteúdo: o que são cookies, tabela de categorias e finalidades (necessários — sessão/autenticação/segurança; analíticos — GTM/GA; marketing), prazos, como revogar o consentimento, contato do encarregado (`contato@venuespace.com.br`) e link para a Política de Privacidade.
- Link adicionado ao `PublicFooter` junto aos demais links legais.

## Detalhes técnicos
- Otimização 100% no browser (Canvas/WebP) — nada de dependência nativa no runtime de servidor.
- Backfill não altera caminhos nem registros; sobrescreve os objetos no mesmo path.
- Sem novos tokens de cor: banner e modal usam `Dialog`, `Switch`, `Button` e `Card` do shadcn com tokens semânticos já existentes; validação em light/dark e 360/768/1280.
- `CHANGELOG.md` recebe uma entrada de nova iteração (escopo inédito) cobrindo as duas frentes.
