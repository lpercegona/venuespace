# Breadcrumbs em todas as páginas públicas + skeleton do perfil por estilo de página

Extensão das Iterações 26/28/31 (navegação pública e página imersiva) e correção da Iteração 28 (skeleton do perfil). Não abre iteração nova para o skeleton: é correção de escopo já entregue.

## 1. Componente compartilhado de trilha

Novo `src/components/venue/public-breadcrumbs.tsx`, extraindo exatamente a faixa já usada na página imersiva (borda inferior, fundo `bg-surface`, texto uppercase `tracking-[0.18em]` em `text-muted-foreground`, separador `>`), agora com `nav aria-label="Trilha"` + `ol/li` semânticos e `aria-current="page"` no último item.

API: `<PublicBreadcrumbs items={[{ label, to?, params? }]} />` — itens com `to` viram `<Link>`, o último é texto. Sem cor hardcoded, sem novo token.

## 2. Onde aplicar

Todas as páginas públicas, exceto `/` (home) e `/para-empresas`. Os links "Voltar/Início" (`BackLink`) existentes permanecem como estão.

| Rota | Trilha |
| --- | --- |
| `/explore` | Home > Explorar |
| `/categoria/$slug` | Home > {Categoria} |
| `/blog` | Home > Blog |
| `/blog/$slug` | Home > Blog > {Título do post} |
| `/public/$slug` (padrão) | Home > {Categoria} > {Organização} |
| `/public/$slug` (imersivo) | mantém a trilha atual, migrada para o componente |
| `/public/$slug/$tableId` | Home > {Categoria} > {Organização} > {Tabela} |
| `/public/$slug/$tableId/$recordId` | Home > {Categoria} > {Organização} > {Tabela} > {Registro} |
| `/public/$slug/$tableId/form` | ... > {Tabela} > Contato |
| `/public/$slug/campaigns/$recordId` | Home > {Organização} > {Campanha} |
| `/politica-de-privacidade`, `/politica-de-cookies`, `/termos-e-condicoes`, `/contestacao-de-espacos` | Home > {Título da página} |

Regras: rótulos usam os dados já carregados na rota (nada de nova consulta); segmentos sem dado carregado são omitidos; nomes longos usam `truncate`; em `/explore` e `/categoria/$slug` a trilha entra entre o header e o `ListingHero`, sem quebrar o `-mt-[57px]` do hero (a faixa fica abaixo do hero para preservar o encaixe visual atual).

## 3. Skeleton do perfil da organização por estilo de página

Hoje `/public/$slug` mostra sempre o skeleton do layout padrão, mesmo quando o super admin definiu `page_style = immersive` — gerando salto visual ao carregar.

- O `page_style` passa a ser conhecido antes da renderização: a rota `/public/$slug` prefetch da consulta `public-org` no `loader` (mesma função `fetchOrg`), com `ensureQueryData`, para que o SSR já renderize o estilo certo.
- Para navegação client-side sem cache, novo `OrganizationProfileSkeleton` com duas variantes:
  - **Padrão**: cabeçalho com logo quadrado + linhas de título/descrição/endereço, corpo em 3 colunas (2 de conteúdo + coluna lateral de contato) e grade de publicações em 3 colunas.
  - **Immersive**: faixa de trilha, hero full-bleed (`h-72 sm:h-[26rem]`), bloco de título sobreposto e grade 60/40 de conteúdo + coluna lateral fixa.
  - Enquanto o `page_style` for desconhecido, usa a variante padrão (comportamento atual).
- A grade de publicações do skeleton continua usando `PublicCardSkeletonGrid`, que já deriva do layout de cards configurado.

## 4. Detalhes técnicos

- Arquivos tocados: novo `src/components/venue/public-breadcrumbs.tsx`, novo `src/components/venue/organization-profile-skeleton.tsx`, e edições em `explore.tsx`, `categoria.$slug.tsx`, `blog.index.tsx`, `blog.$slug.tsx`, `public.$slug.index.tsx`, `public.$slug.$tableId.index.tsx`, `public.$slug.$tableId.$recordId.tsx`, `public.$slug.$tableId.form.tsx`, `public.$slug.campaigns.$recordId.tsx`, `politica-de-privacidade.tsx`, `politica-de-cookies.tsx`, `termos-e-condicoes.tsx`, `contestacao-de-espacos.tsx`, `organization-page-immersive.tsx`.
- Sem migração de banco, sem alteração de API pública, sem nova rota — logo, sem alteração no sitemap.
- Sem `og:image` ou meta novas; `head()` de cada rota permanece.

## 5. Fechamento (checklist §7)

Build + typecheck, validação em 360/768/1280 em light e dark, estados de loading/empty/error do perfil, ausência de regressão nas iterações anteriores e entrada datada no `CHANGELOG.md` como `Correção/Extensão das Iterações 26/28/31 — breadcrumbs públicos e skeleton do perfil`.
