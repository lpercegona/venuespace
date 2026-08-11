## 2026-08-11 15:05 (America/Sao_Paulo) — Correção/extensão da Iteração 32 — edição e exclusão de reservas

- **Editar reserva**: `BookingFormDialog` passa a operar em modo de edição (período, itens do orçamento e contato pré-carregados); novo botão "Editar" em cada reserva da página de Reservas.
- **Excluir reserva**: novo botão "Excluir" com confirmação (`AlertDialog`); remove a reserva, a conversa vinculada, mensagens, tokens de acesso do lead e os PDFs de orçamento do bucket privado.
- **Backend** (`src/lib/bookings.functions.ts`): novas server fns `updateBooking` (revalida conflito de datas por item, ignorando a própria reserva) e `deleteBooking`; ambas restritas a owner/editor (e super admin) via `assertCanEdit`.

## 2026-08-11 (America/Sao_Paulo) — Correção da Iteração 32 — reserva multi-item e contato

- **Nova reserva multi-item**: o formulário passa a listar os registros da própria tabela reservável para compor o orçamento (busca por nome, seleção múltipla, total somado). Itens gravados em `records.system_data.items` (`record_id`, `label`, `value`); sem novas colunas.
- **Contato**: novo `src/components/venue/booking-contact-picker.tsx` — seleção de contato existente da tabela de contatos da organização ou criação inline com os campos do formulário padrão da categoria. Vínculo por `system_data.contact_record_id`.
- **Backend** (`bookings.server.ts` / `bookings.functions.ts`): helpers `loadBookableItems`, `loadContactSetup`, `loadContacts`, `contactLabel`; `createBookingContact`; `createBooking` valida conflito de datas por item; `listBookings` devolve itens, total e contato; `generateBookingQuote` monta o PDF a partir dos itens selecionados (fallback para campos de moeda quando não houver itens).
- **UI**: `booking-form-dialog.tsx` reescrito (período + itens + contato + total) e lista de reservas exibindo contato, quantidade de itens e total.

## 2026-08-11 (America/Sao_Paulo) — Correção da Iteração 32 — erro `Cannot destructure property '__extends'`


- Causa: `pdf-lib@1.17.1` depende de `tslib@^1` (cópia aninhada 1.14.1, somente CommonJS). Ao ser convertida para ESM pelo bundler (`__toESM(...)`), a exportação nomeada `__extends` fica indefinida e a geração de orçamento em PDF quebra em runtime.
- `tslib` atualizado para `^2` (2.8.1) no projeto.
- `vite.config.ts`: alias `^tslib$` → `node_modules/tslib/tslib.es6.mjs`, garantindo uma única cópia ESM do tslib no bundle (cliente e servidor), independentemente de cópias aninhadas 1.x.

## 2026-08-11 17:15 (America/Sao_Paulo) — Iteração 32 — Gestão de reservas (criação manual, disponibilidade, orçamento em PDF e ciclo de negociação)

- **Backend**: novos `src/lib/bookings.server.ts` (metadados de reserva a partir de `fields.config.booking_role`/`resource_relation_field_id`, verificação de conflito de datas e construção do PDF com `pdf-lib`) e `src/lib/bookings.functions.ts` (`getBookingContext`, `listBookings`, `listAvailableResources`, `createBooking`, `archiveBooking`, `generateBookingQuote`, `getQuoteUrl`).
- **Armazenamento**: PDFs de orçamento gravados em `venue-uploads` sob `orcamentos/{organization_id}/`, com política de leitura para membros da organização; histórico versionado em `records.system_data.quotes`.
- **Ciclo de vida**: `negotiating` (envio de orçamento/proposta) → `accepted` (fechamento) → `closed` (serviço entregue); recusa aplica `declined` e arquiva o registro (`status='archived'`), com opção de desarquivar.
- **Rota `/app/$orgSlug/calendar`** reescrita como painel de gestão de reservas: uma seção por tabela reservável, botão "Nova reserva", filtro de disponibilidade por data única ou período, `SegmentedToggle` por estágio, alternância de arquivadas e lista com valor acordado e contagem de orçamentos.
- **Componentes novos**: `src/components/venue/booking-form-dialog.tsx` (DynamicForm com validação de conflito no servidor), `booking-availability-filter.tsx` e `booking-status-actions.tsx` (transições, arquivamento, geração e abertura do PDF, link para a conversa).
- Meta tags da rota atualizadas (título/descrição próprios, `noindex`).

## 2026-08-11 (America/Sao_Paulo) — Correção/extensão das Iterações 26, 30 e 31 — busca, paginação e navegação da administração

- **Busca pública instantânea**: novo `src/hooks/use-debounced-value.ts` e `src/components/venue/public-filter-bar.tsx` (campo de busca + popover "Filtros" em linha única, mesmo padrão em desktop e mobile). Aplicado em `src/routes/categoria.$slug.tsx` e `src/routes/explore.tsx`; consultas usam `keepPreviousData` para evitar flicker.
- **Paginação corrigida** em `/explore` e `/categoria/$slug`: `page` passa a ser gravado na URL como número (antes `String(...)`, rejeitado pelo `z.number()` do `validateSearch`, que revertia para a página 1). Skeleton usa `isPending` para não reaparecer entre páginas.
- **Header público** (`src/components/venue/public-header.tsx` + novo `src/components/venue/venuespace-logo.tsx`): logo inline com `fill-current` (branca sobre o hero, cor de marca sobre a superfície) e "Cadastrar empresa" ao lado do ícone de login.
- **Administração** (`src/routes/_authenticated.admin.index.tsx`): abas substituídas por sidebar com 4 grupos (Configurações, Estrutura, Layout, Conteúdo) em pílula, com `SegmentedToggle` (novo `src/components/venue/segmented-toggle.tsx`) para as seções do grupo; abaixo de 860px a navegação vira menu hambúrguer em `Sheet`.
- **Topbar** (`src/components/venue/app-shell.tsx`): marca "VENUESPACE" unificada ao seletor de organização (pílula com dropdown), busca central instantânea de organizações e item de menu "Minhas candidaturas" renomeado para "Interações".

## 2026-08-10 (America/Sao_Paulo) — Otimização de páginas públicas, skeleton dinâmico e header


- Novo `src/lib/public-catalog.functions.ts`: server functions (`getPublicCategoriesFn`, `getHomeGroupingsFn`, `getHomeGroupingDataFn`, `getCategoryLayoutFn`, `listPublicOrganizationsFn`, `getExploreFiltersFn`) para leitura pública direta no servidor, sem round-trip HTTP durante o SSR.
- Novo `src/lib/public-queries.ts`: `queryOptions` compartilhados (categorias, home, layout, filtros e listagem por categoria) usados tanto nos loaders quanto nos componentes.
- Novo `src/lib/server-cache.ts`: cache em memória com TTL e dedup de chamadas concorrentes.
- `src/lib/public.server.ts`: `signPathsCached` reutiliza URLs assinadas (TTL 45min); layouts, campos de categoria, aliases de opções e a base de organizações públicas passam a ser cacheados (TTL 30s). `src/lib/explore-filters.server.ts` e `src/lib/home-data.server.ts` usam os mesmos caches.
- `src/routes/index.tsx` e `src/routes/categoria.$slug.tsx`: `loader` com `ensureQueryData`/`prefetchQuery` (dados de bloco em streaming, sem bloquear o HTML). Tempo de `/api/public/home-grouping-data` caiu de ~8,5s para ~0,2s em cache quente.
- Skeleton inicial (`PublicCardSkeletonGrid`) recebe o layout configurado pelo super admin para a categoria, refletindo o formato real do card.
- `src/components/venue/public-header.tsx`: em mobile a logo é omitida (Explorar à esquerda, "Cadastrar empresa" ao centro, login à direita); header fixo com a mesma cor do hero no topo da home, some no scroll down e reaparece no scroll up.

## 2026-08-09 00:20 (America/Sao_Paulo) — Correção/extensão da Iteração 30 — filtros, atalhos e blocos
- **Filtros públicos** (`src/lib/explore-filters.server.ts`): as opções dos filtros `select` deixam de ser derivadas apenas de organizações com registros publicados; passam a varrer `organizations` com `is_public = true` (mesma base da listagem) e a unir com as opções declaradas em `config.options` dos campos da categoria. Escopo `record` filtra por categoria na consulta e também une as opções configuradas. Deduplicação case/acento-insensível.
- **Regras de blocos** (`src/lib/public.server.ts`): comparação normalizada por acento/caixa/espaços; `address.city_state_full` resolvido a partir de cidade + estado por extenso; `=`, `!=` e `contains` casam tanto pelo valor quanto pelo rótulo da opção (`category_org_fields` / `category_standard_table_fields`). Filtros `f_*` da listagem usam o mesmo casamento.
- **Atalhos da home** (`src/lib/home-data.server.ts`, `src/routes/index.tsx`): cada card de atalho devolve `category_slug` e navega para `/categoria/$slug` com o pré-filtro `f_<campo>`, em vez da página antiga `/explore`. Editor de blocos ganhou seleção da categoria de destino.
- **Popover de field-keys** (`src/components/admin/home-blocks-section.tsx`, `/api/public/field-keys`): layout em duas colunas com scroll, exibindo as opções disponíveis de cada field-key; clique na chave preenche o filtro e clique na opção preenche chave + valor.

## 2026-08-08 00:15 (America/Sao_Paulo) — Correção/extensão da Iteração 30 — regras, deduplicação e novos blocos da home

- `src/lib/public.server.ts`: `applyRules` reescrito com normalização de valores (`normalizeValues`) — passa a funcionar com campos de lista (multiselect, ex.: comodidades), booleanos, números e objetos; comparações `=`/`!=`/`contains` agora são case-insensitive e avaliam cada item da lista. `listPublicOrganizations` e `listPublicRecords` aceitam `exclude_ids`.
- Novo `src/lib/home-data.server.ts`: `loadHomeGroupingData` resolve os blocos de um agrupamento em sequência, sem repetir organizações/registros já exibidos em blocos anteriores da mesma página; assina imagens dos cards de atalho. `listAvailableFieldKeys` expõe as field-keys base, de endereço e de categoria.
- Novos endpoints públicos: `src/routes/api/public/home-grouping-data.ts` (dados dos blocos com deduplicação) e `src/routes/api/public/field-keys.ts` (catálogo de field-keys).
- Migration: `home_blocks` ganha `block_type` ('cards' | 'links'), `columns` (3 | 4) e `items` (jsonb), com CHECK constraints.
- `src/lib/home-config.functions.ts`: DTO e schema Zod estendidos com `block_type`, `columns` e `items` (tipo `HomeBlockLink`).
- `src/components/admin/home-blocks-section.tsx`: seleção de tipo de bloco, alternância de 3/4 colunas, editor de cards de atalho (título, imagem de fundo, field_key + valor de pré-filtragem) e popover informativo `FieldKeysHelper` com todas as field-keys disponíveis.
- `src/routes/index.tsx`: consome `/api/public/home-grouping-data`, aplica a grade configurada (3 ou 4 colunas), renderiza blocos de atalho com link para `/explore` pré-filtrado, oculta blocos sem resultado e remove o botão "Cadastrar meu espaço" do hero.
- `src/routes/api/public/organization-categories.ts`: retorna apenas categorias com ao menos uma organização pública, ocultando categorias vazias na navegação e no explorar.

## 2026-08-07 01:31 (America/Sao_Paulo) — Iteração 30 — camada de dados: agrupamentos e blocos da home

- Novo `src/lib/home-config.functions.ts` com server functions: `listHomeGroupingsPublic` (leitura pública dos agrupamentos ativos, categorias e blocos ativos), `listHomeGroupingsAdmin`, `listHomeBlocksAdmin`, `saveHomeBlock`, `deleteHomeBlock`, `saveHomeGrouping`, `deleteHomeGrouping` — as funções administrativas exigem super admin e são validadas com Zod (`home_groupings`, `home_blocks`).
- Novos endpoints públicos: `src/routes/api/public/home-config.ts` (GET) expondo os agrupamentos ativos com seus blocos; `src/routes/api/public/home-block-data.ts` (GET) retornando organizações ou registros filtrados pelas regras de um bloco.
- `src/routes/api/public/organizations.ts` e `src/routes/api/public/records.ts` passam a aceitar `?rules=` (JSON com `{field_key, operator, value}`), com operadores permitidos `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `filled`; filtro aplicado em `src/lib/public.server.ts` (`applyRules`) e limite máximo de 50 itens reforçado nas rotas.
- Redesign da home (`src/routes/index.tsx`): hero com cor de marca, título centralizado, toggle de agrupamentos estilo pill, renderização dinâmica dos blocos ativos via `HomeBlockSection` e `HomeBlockCard`.
- Novo componente `src/components/admin/home-groupings-section.tsx` para o super admin criar/editar/remover agrupamentos de home e vinculá-los a categorias.
- Novo componente `src/components/admin/home-blocks-section.tsx` para o super admin criar/editar/remover blocos de conteúdo (fonte, filtros, ordenação, limite) dentro de cada agrupamento.
- Painel super admin (`src/routes/_authenticated.admin.index.tsx`) ganha as abas "Agrupamentos" e "Blocos da home".
- Correção de ordenação: `listMyOrganizations` (`src/lib/orgs.functions.ts`) agora ordena organizações por nome (case-insensitive, `localeCompare` pt-BR) em vez de `created_at`.
- Correção de ordenação: ícones de opções multiselect (`kind: "icons"`) no `public-card-renderer.tsx` (padrão e imersivo) agora são ordenados alfabeticamente pelo label da opção, com fallback para o valor bruto.

## 2026-08-05 21:55 (America/Sao_Paulo) — Correção/extensão das Iterações 18 e 22/23/27 — descrição rica e prefixo nos cards

- Descrição da organização (extensão da Iteração 18): limite ampliado de 500 para **2500 caracteres** (contados sobre o texto puro) e novo editor limitado com texto, título (H4) e bullets — `src/components/venue/rich-text-editor.tsx`.
- Novo utilitário `src/lib/rich-text.ts` (`sanitizeRichText`, `richTextToPlainText`, `toRichTextHtml`, `RICH_TEXT_MAX`), com allowlist restrita a `p`, `h4`, `ul`, `li`, `strong`, `em`, `br`; sanitização aplicada no servidor em `createOrganization`/`updateOrganization`.
- Novo componente `src/components/venue/rich-text-view.tsx` usado na página pública (Layout 1 e Layout 2); descrições antigas em texto puro continuam sendo exibidas como parágrafos.
- Onde a descrição aparece como texto puro (painel da organização, cards públicos), o HTML é convertido em texto para não vazar marcação.
- Prefixo nos cards públicos (extensão das Iterações 22/23/27): nova coluna **Prefixo** no editor de layout de cards de organização e registro; salvo em `category_public_layout_fields.config.prefix` (sem migração) e renderizado entre o ícone e o valor, tanto no Layout 1 quanto nos slots de texto do Layout 2. Campos sem valor continuam ocultos.

## 2026-08-05 16:20 (America/Sao_Paulo) — Correção do Layout 2 — galeria multi-imagem, endereço mobile e contato colapsável

- `GalleryCarousel`: novas props `itemBasisClassName` (largura responsiva por slide) e `preloadCount`; no modo `fillContainer` o viewport interno recebe `h-full`, corrigindo a galeria que ocupava apenas parte da faixa hero.
- Página de organização (Layout 2): hero exibe até 5 imagens simultâneas em telas grandes (1 no mobile, 2 em sm, 3 em lg, 4 em xl, 5 em 2xl), com `object-cover object-center` e slider mantido.
- Endereço do hero no mobile: fonte/ícone reduzidos e versão curta (rua, número e cidade/UF) para caber com "Ver no mapa" em uma única linha; desktop mantém o endereço completo.
- Mobile: bloco "Manifestar interesse" movido para logo abaixo de Site/Telefone, colapsado por padrão — botão "Entrar em contato" expande o formulário, mantendo os ícones de e-mail, WhatsApp, telefone e "Acessar o site".

## 2026-08-04 15:45 (America/Sao_Paulo) — Correção das Iterações 27/28 — tooltips, pré-carregamento da galeria e posição da localização

- Tooltips dos ícones de multiselect voltam a funcionar nos cards públicos: a camada sobreposta do card imersivo usava `pointer-events-none`, bloqueando hover/foco. Gatilhos agora usam `pointer-events-auto`, `tabIndex` e clique isolado (o card continua navegando para a página individual).
- `GalleryCarousel`: pré-carrega até 5 imagens (atual, anterior e próximas) quando a galeria tiver mais slides; demais permanecem `lazy`.
- Imagens da galeria com enquadramento centro/centro (`object-cover object-center`), inclusive no hero do Layout 2.
- Página individual de organização (Layout 2): bloco "Localização" movido da coluna direita para logo abaixo de "Ambientes", antes de "Avaliações".

## 2026-08-05 (America/Sao_Paulo) — Correção da Iteração 28 — tooltips gerais, seleção estática do Layout 2 e reestruturação da página imersiva


- Tooltips de multiselect com ícones passam a valer em **todos** os cards públicos (padrão e imersivo) e nos blocos de comodidades da página de organização, via `OptionIconList` compartilhado em `public-card-renderer.tsx` (antes só o card imersivo tinha tooltip).
- Painel super admin > Layout público > "Página de organização" deixa de usar o editor de campos e passa a exibir apenas dois cards de seleção com miniatura em skeleton (Layout 1 e Layout 2), salvando somente `card_style`.
- `src/components/venue/organization-page-immersive.tsx` reescrito com estrutura fixa conforme o modelo: breadcrumb, faixa hero full-bleed com gradiente, avaliação, título e endereço com "Ver no mapa"; colunas 60/40; grade de campos, descrição, comodidades com ícone, site/telefone, Ambientes em 3 colunas e Avaliações à esquerda; card "Manifestar interesse" sobreposto e sticky, ícones de contato, "Acessar o site" e mapa à direita.
- Novo `src/components/venue/interest-form.tsx`: formulário de interesse reutilizável inline; `InterestFormModal` passa a consumi-lo (sem duplicação de lógica).
- `src/lib/public.server.ts`: `page_style` deixa de ser inferido pela quantidade de campos e é lido diretamente de `category_public_layouts.card_style`; campo `page_layout` (não utilizado) removido do payload.
- Rota `public.$slug.index.tsx` unificada: ambos os layouts sob `PublicHeader`.

## 2026-08-04 (America/Sao_Paulo) — Iteração 28 — tooltips de comodidades, cidade/estado extenso, novo layout de página de organização e avaliações

- Tooltips em comodidades dos cards imersivos: rótulo aparece apenas no hover do ícone (`Tooltip` shadcn) em vez de texto ao lado.
- Novo campo virtual base `address.city_state_full` (Cidade - Estado extenso) para layouts públicos, com mapa de UF para nome completo (`src/lib/public.server.ts`).
- Campo virtual `rating` (Avaliação média) adicionado aos campos base de organização para permitir posicionamento no layout público.
- Nova aba "Página de organização" no painel super admin (Layout público) com estilos Layout 1 (padrão/duas colunas) e Layout 2 (imersivo/hero).
- Novo componente `src/components/venue/organization-page-immersive.tsx` renderizando hero de galeria com título, avaliação e endereço sobrepostos; coluna principal com sobre, comodidades, informações, mapa e avaliações; coluna lateral fixa com formulário/contato.
- `GalleryCarousel` ganha prop `fillContainer` para preencher heros de altura fixa sem distorcer o aspecto ou vazar para fora do container.
- Sistema de avaliações: tabela `organization_reviews` com status `pending`/`approved`/`rejected`; usuários autenticados enviam nota 1-5 e comentário; exibição pública mostra média e total apenas das aprovadas.
- Painel super admin ganha aba "Avaliações" para aprovar ou rejeitar avaliações pendentes.

## 2026-08-03 (America/Sao_Paulo) — Correção das Iterações 13/22/23/26/27 — cards públicos, galeria e categorias

- Correção da Iteração 22/23: grades públicas da home passam a 3 colunas no desktop (`sm:grid-cols-2 lg:grid-cols-3`), alinhadas ao `/explore`.
- Correção da Iteração 13/23: `GalleryCarousel` deixa de bloquear o clique do card — apenas as setas esquerda/direita interceptam o evento; o restante da galeria navega para a página individual.
- Correção da Iteração 13: slides sem gap (`ml-0`/`pl-0` no carrossel de galeria) em todos os usos (cards padrão, imersivo e perfil público).
- Correção da Iteração 13: pré-carregamento forçado do slide anterior e do próximo (`loading="eager"` + `fetchPriority`), demais slides permanecem lazy; contador passa a mostrar posição atual.
- Correção da Iteração 27: comodidades exibidas por ícone no card imersivo agora mostram o rótulo da opção ao lado do ícone.
- Correção da Iteração 26: categorias sem registros públicos ocultam a listagem de registros — no `/explore` as abas Organizações/Registros somem e a listagem fica em Organizações; na home a seção "Registros recentes" é omitida. Categoria padrão passa a ser "Espaços" quando existir.
- Correção da Iteração 22/27: skeleton dos cards públicos passa a refletir o layout configurado pelo super admin (linhas, larguras 25/50/75/100%, bleed e variante imersiva), via novo hook `src/hooks/use-public-catalog.ts`.

## 2026-08-02 10:00 (America/Sao_Paulo) — Iteração 27: rótulos por categoria, card imersivo e ícones por opção

- Rótulos por categoria (`category_labels`): server fns `listCategoryLabelsPublic`/`upsertCategoryLabel`/`deleteCategoryLabel`, rota `/api/public/category-labels` e cascata no `useLabels(categoryId)` (fallback → global → categoria). Admin > Rótulos ganhou seletor Global/Categoria com remoção do override.
- Novo estilo de card público "imersivo" (`category_public_layouts.card_style`): imagem de fundo com posições fixas (selo, topo-direita, avaliação, título, comodidades, localização). Editor de layout do super admin alterna entre Padrão e Imersivo e define a posição de cada campo.
- Comodidades podem ser exibidas somente como ícones: opções de `select`/`multiselect` aceitam a sintaxe "Opção | Icone", persistida em `config.option_icons` (editores de campos de categoria e de tabelas padrão).
- Correção da Iteração 24: contatos públicos (telefone, whatsapp, e-mail, site) agora fazem fallback para os campos de categoria, exibindo os ícones na coluna direita do perfil mesmo sem proprietário.
- Correção da Iteração 26: tabs de categoria na home passam a usar o componente Tabs do shadcn (estilo botão).

## 2026-08-01 (America/Sao_Paulo) — Correção das Iterações 22/24/25 + Iteração 26 — categorias na navegação pública

Correções de escopo já entregue (norma §0 "Correções não abrem iteração") + Iteração 26.

- Correção da Iteração 24/25: `orgHasAssignedUser` (`src/lib/public.server.ts`) passa a exigir membro com papel **proprietário (owner)** não super admin. Sem owner, formulário público e chat ficam desativados na página da organização e dos registros, restando apenas ícones de contato e site.
- Correção da Iteração 25: removida a trava `assertNotLastOwner` em `src/lib/applications.functions.ts` — organizações podem ficar sem proprietário (substituída por `assertMembershipExists`).
- Correção da Iteração 22: `listPublicOrganizations` não exige mais ≥1 registro publicado; toda organização pública é listada em `/` e `/explore` (caso "Ópera Arte").
- Iteração 26: novo componente `src/components/venue/category-tabs.tsx` (tabs de categoria com scroll lateral, alvo ≥44px, tokens semânticos).
- Iteração 26: `/` e `/explore` ganham tabs de categoria sincronizadas com a search param `categoria` (slug da categoria); no explore ficam acima das tabs Organizações/Ambientes, que continuam funcionando e preservam a categoria ao trocar de aba, filtro ou página.
- Iteração 26: listagens de organizações, registros e filtros dinâmicos passam a receber a categoria ativa; links "Ver todas/Ver todos" propagam a categoria.

## 2026-07-31 (America/Sao_Paulo) — Iteração 25 — acesso nativo do super admin, membros na edição da organização e limpeza de tabelas padrão

- RLS: políticas permissivas "super admin full access" (via `public.is_super_admin`) em `organizations`, `memberships`, `tables`, `fields`, `records`, `views`, `permissions`, `conversations`, `messages`.
- `src/lib/orgs.functions.ts`: helpers `isSuperAdmin` e `canManageOrg`; `listMyOrganizations` retorna todas as organizações da instância para o super admin (marcadas com `is_super_admin_access`); `getOrganizationBySlug` devolve `myRole: 'owner'` e `isSuperAdmin`; `updateOrganization`, `deleteOrganization` e `addMemberByEmail` passam a usar `canManageOrg`.
- `src/lib/applications.functions.ts`: `updateMembershipRole` e `removeMembership` protegidos por `assertNotLastOwner` (organização não pode ficar sem proprietário).
- Novo componente `src/components/venue/org-members-manager.tsx` (listar, adicionar por e-mail, alterar papel, remover), exibido dentro de `EditOrgDialog` apenas para super admin (`canManageMembers`).
- `/app`: organizações acessadas por super admin exibem badge "super admin" em vez do papel de membro.
- Tabelas padrão (`is_locked`) para usuário comum: ícone de edição da tabela oculto (`canStruct`), botão "Campos" oculto e seção "Formulários públicos" (criação e listagem) oculta na página de registros; super admin mantém acesso total.
## 2026-07-30 (America/Sao_Paulo) — Correção da Iteração 24 — contatos unificados, gating por usuário atribuído e botões de contato

Correção/extensão de escopo já entregue na Iteração 24 — **não abre iteração nova** (norma §0 "Correções não abrem iteração").

- Perfil público da organização: `ContactActions` passa a receber o botão do formulário (`formSlot`) e renderiza ao lado dele os botões somente ícone de WhatsApp, telefone e e-mail (`aria-label`, alvo 44px); "Acessar o site" segue como botão largo.
- Contato pela plataforma exige organização atribuída: novo helper `orgHasAssignedUser` (membro que não é super admin) em `src/lib/public.server.ts`; quando não há usuário atribuído, `public_form_view` retorna `null` em `getPublicOrganization`, `loadPublicTable` e `loadPublicRecord`, e `POST /api/public/$slug/$tableId/submit` responde 403.
- Tabela única de contatos por organização: nova função `public.ensure_contacts_table` (tabela de sistema "Contatos", `is_locked`, sempre privada, marcada por `system_data.kind = 'contacts'`); `apply_standard_forms_to_org` reescrita para apontar os dois formulários padrão (organização e registro) para a mesma tabela, mesclando campos por `field_key`, mantendo um único `__origem` e gravando `config.form_field_ids` por formulário.
- Migração de dados: respostas das tabelas antigas de submissão movidas para a tabela "Contatos" da mesma organização (campos ausentes copiados, views reapontadas) e tabelas antigas removidas; rotina reaplicada a todas as organizações existentes.
- Tabela de contatos nunca pública: trigger `trg_contacts_table_private` força `is_public = false`, `updateTable` rejeita a ativação e o switch "Tabela pública" aparece desabilitado com texto explicativo no painel da organização.

## 2026-07-29 13:55 (America/Sao_Paulo) — Iteração 24

- Tabelas padrão: novo controle mestre "recebe reservas" (`category_standard_tables.bookable`); quando desligado, força `tables.bookable = false` em todas as orgs da categoria e o backend (`updateTable`) rejeita habilitação; switch da tabela do usuário fica desabilitado (`bookable_master` em `listTables`).
- Nova área "Formulários padrão" no painel do super admin: tabelas `category_standard_forms` e `category_standard_form_fields` (RLS + GRANTs), server fns em `src/lib/category-standard-forms.functions.ts`, seções `StandardFormsSection`/`StandardFormFieldsEditor`.
- Instanciação retroativa via `apply_standard_forms_to_org` / `sync_category_standard_forms`, também chamada em `create_organization` e `sync_category_standard_tables`: cria a tabela de destino das submissões (bloqueada), espelha campos e cria/atualiza a view `public_form` (com `auto_relation_field_id` no escopo registro).
- Campos de contato base para todas as organizações (`organization_fields`): telefone, WhatsApp, e-mail e site.
- Página pública da organização em 2 colunas (mesmo formato da página de registro), com novo componente `ContactActions` (botão "Acessar o site" + ícones de e-mail, WhatsApp e telefone) e botão do formulário público de organização no `aside`.

## 2026-07-28 (America/Sao_Paulo) — Correção das Iterações 22/23 — cards públicos: espaçamento do subtítulo e gap entre campos

Correção visual de escopo já entregue — **não abre iteração nova** (norma §0 "Correções não abrem iteração").

**Iterações corrigidas**
- **Iteração 22 (layout público de organização: nome/logo controlados pelo super admin, imagens com bleed e upload de logo)**
- **Iteração 23 (cards públicos: padding p-4, estilos por item, packing de colunas, carrossel isolado e propagação retroativa)**

**Correções**
- **Espaçamento entre linhas do card (`src/components/venue/public-card-renderer.tsx`)**: `space-y-3` → `space-y-2` entre rows do renderer; `gap-3` → `gap-2` entre células da grid interna.
- **Margem do subtítulo (`src/components/venue/public-card-renderer.tsx`)**: células com `style = "subtitle"` passam a usar `mb-0`, eliminando a margem inferior que separava o subtítulo dos elementos seguintes.
- **Fallbacks de lista (`src/routes/index.tsx`, `src/routes/explore.tsx`)**: `gap-3` entre logo e título nos cards sem layout reduzido para `gap-2`.
- **Fallback de registros (`src/routes/public.$slug.$tableId.index.tsx`)**: `space-y-3` nos `CardContent` de fallback e de ações reduzido para `space-y-2`.

**Auditoria de propagação (§7)**
- Apenas classes utilitárias de espaçamento foram alteradas; nenhuma mudança de payload, RLS, esquema ou lógica de negócio.
- Roles: sem impacto em permissões.

## 2026-07-27 03:25 (America/Sao_Paulo) — Correção das Iterações 11/12 e 2 — select/multiselect: persistência de opções e plotagem


Correção de escopo já entregue — **não abre iteração nova** (norma §0 "Correções não abrem iteração", incluída na skill nesta mesma edição).

**Iterações corrigidas**
- **Iterações 11/12 (cascata de campos por categoria + consolidação em "Campos padrão")**: origem do bug de perda de `config.options`.
- **Iteração 2 (Records + Grid/Form dinâmicos)**: paridade de renderização por tipo de campo nos componentes genéricos.
- **Iterações 20/21 (tabelas padrão)**: apenas referência — o editor de tabelas padrão já preservava `config` e serviu de baseline.

**Causa raiz verificada**
`ScopeEditor` (`src/routes/_authenticated.admin.index.tsx`) mapeava as linhas dos três escopos descartando `config`. Em consequência, `openEdit()` não repovoava as opções e o salvamento regravava `config` vazio, apagando `options`. Confirmado no banco: `category_org_fields.tipos_de_eventos` e `organization_category_default_fields.tipos_de_layout` com `config = {}`, contra `category_standard_table_fields.tipos_de_layout` com `config.options` íntegro.

**Correções**
- **Persistência (`_authenticated.admin.index.tsx`)**: `UnifiedField` passa a carregar `config`; os três mapeamentos de query o propagam; `openEdit()` repovoa `optionsText` e o papel `cep`; o salvamento faz **merge** com o `config` existente, gravando `options` apenas para `select`/`multiselect` e limpando `options`/`role` na troca de tipo. A listagem exibe a contagem/preview das opções e sinaliza "sem opções configuradas".
- **Plotagem (`src/components/venue/category-fields-form.tsx`)**: `multiselect` renderiza chips toggle (valor como array, alvo ≥ 36px, `aria-pressed`) no mesmo padrão do `DynamicForm`; `select` exibe aviso quando não há opções em vez de combo vazio; `relation` ganha campo dedicado; `phone` usa `type="tel"`.
- **Tipos compartilhados (`src/lib/field-schema.ts`)**: `FIELD_TYPES` alinhado à lista canônica (`long_text`, `phone`, `gallery`); `zodForField` valida `gallery` como array de strings.
- **Detalhe público (`src/routes/public.$slug.$tableId.$recordId.tsx`)**: `computed` com `kind = "count"` deixa de ser formatado como moeda; `multiselect` vazio mostra "—"; arrays genéricos deixam de cair em `String(raw)`.
- **Card público (`src/components/venue/public-card-renderer.tsx`)**: fallback para valores array em qualquer tipo, evitando `[object Object]`/JSON cru.
- **Migração de reparo**: restaura `config.options` de `tipos_de_layout` (escopo registro) a partir do campo homônimo da tabela padrão da categoria e propaga para os campos já instanciados nas tabelas das organizações que estavam sem opções.

**Auditoria de propagação (§7)**
- `DynamicForm` / `DynamicGrid`: (b) não precisavam mudar — já tratavam `multiselect` e `gallery` corretamente; o bug estava no editor de categoria e no `CategoryFieldsForm`.
- `CategoryFieldsForm` (usado em criação/edição de organização e tabela): (a) atualizado.
- Painel super admin, escopos organização/tabela/registro: (a) atualizado — persistência corrigida nos três.
- `public-card-renderer` / `/explore` / landing / `/api/public/*`: (a) revisados; apenas formatação de leitura, sem mudança de payload nem exposição de PII.
- Detalhe público de registro e página de campanha: (a) formatação de `computed`/`multiselect` corrigida.
- Roles: super_admin (edita os campos padrão), owner/editor (preenchem via `CategoryFieldsForm`), viewer/autenticado não-membro/anônimo (somente leitura, coberta pelas correções de formatação).
- Sem mudança de esquema; sem alteração de RLS/GRANTs.

**Pendência declarada (§0, ambiguidade = parada)**
As opções do campo `tipos_de_eventos` (escopo organização) foram perdidas pelo bug e não há fonte equivalente no banco para restaurá-las. Aguardando a lista de opções desejada para aplicar a migração de reparo correspondente.

## 2026-07-26 — Iteração 23 — Cards públicos: padding p-4, estilos por item, packing de colunas, carrossel isolado e propagação retroativa

- **Padding/bleed (`src/components/venue/public-card-renderer.tsx`)**: nova prop `padding` (4 | 6, default 4). As margens negativas de bleed passam a acompanhar o padding real do card (`-mx-4/-mt-4/-mb-4`), corrigindo o encaixe do carrossel e das imagens 100%. `src/routes/public.$slug.index.tsx` usa `padding={6}` no bloco de informações da organização (container `p-6`); os demais cards usam `p-4`.
- **Estilos por item**: `config.style` (`title` | `subtitle` | `normal`) escolhido pelo super admin no `LayoutEditor` (nova coluna "Estilo"), válido para card de organização **e** de registro. `title` renderiza `<h3>` font-display; `subtitle` renderiza linha discreta com ícone; `normal` mantém rótulo + valor. Default: `title` para `name`, `normal` para os demais.
- **Campos-base do card de registro**: `org_name`, `table_name` e `deal_status` agora são campos selecionáveis no layout (`src/routes/_authenticated.admin.index.tsx`) e são injetados no payload público (`RECORD_BUILTIN_FIELDS` em `src/lib/public.server.ts`, mais `deal_status` na query de registros públicos).
- **Fim do hardcode nos cards de registro**: `src/routes/index.tsx`, `src/routes/explore.tsx`, `src/routes/public.$slug.index.tsx` e `src/routes/public.$slug.$tableId.index.tsx` renderizam o card inteiro via `PublicCardBody` quando há layout; sem layout, mantêm o fallback anterior (sem regressão).
- **Packing de colunas**: algoritmo guloso reescrito — a linha é fechada antes de estourar 100% e itens com bleed ocupam linha própria. Isso elimina o descarte silencioso de campos escolhidos pelo super admin.
- **Carrossel (`src/components/venue/gallery-carousel.tsx`)**: setas e contador ocultos por padrão e revelados em hover/focus em dispositivos com ponteiro; wrapper com `preventDefault`/`stopPropagation` em click/pointerdown/keydown, isolando o slider do `<Link>` que envolve o card.
- **Propagação retroativa de tabelas padrão**: nova função `public.sync_category_standard_tables(_category_id)` (SECURITY DEFINER, exige super admin) espelha tabelas e campos padrão em todas as organizações já existentes da categoria — cria/renomeia/atualiza tabelas de origem padrão, insere/atualiza campos `source='category'` e remove os que deixaram de existir. Chamada automaticamente em todos os upserts/deletes de `src/lib/category-standard-tables.functions.ts`.
- **Tabs do admin**: `TabsList` principal agora é uma linha única com scroll lateral (`w-full flex-nowrap justify-start overflow-x-auto`).

### Auditoria de propagação (§7)
- **Roles**: super admin — único a editar layouts e tabelas padrão (guard na RPC + `requireSA` nos server fns). owner/editor/viewer: recebem retroativamente as mudanças de tabelas padrão; tabelas de origem padrão continuam `is_locked`. Autenticado não-membro e anônimo: apenas leitura dos cards públicos.
- **Superfícies públicas**: `/api/public/organizations`, `/api/public/records`, `/api/public/$slug/$tableId` e `/api/public/category-layout/$categoryId` revisados — `deal_status` já era exposto na rota de tabela pública; nenhum PII novo. `config.style` é livre no schema existente, sem migração.
- **Não tocados / justificativa**: `public.$slug.$tableId.$recordId` e a página de campanha exibem registro completo (não card), fora do escopo. `DynamicGrid`/`DynamicForm` não usam layout de card — nenhum novo tipo de campo foi criado, apenas pseudo-campos de leitura no renderer público.

## 2026-07-25 — Iteração 22 — Layout público de organização: nome/logo controlados pelo super admin, imagens com bleed e upload de logo

- **Renderer (`src/components/venue/public-card-renderer.tsx`)**: `PublicCardBody` passa a tratar dois `field_key` especiais quando adicionados ao layout — `name` renderiza como `<h3>` (font-display, semibold, `line-clamp-2`) sem label/ícone; `logo_url` renderiza via `OrgLogo`, com fallback de ícone genérico quando a organização não tem logo. Nova prop opcional `orgName` alimenta o `alt` do logo (default: `data.name`).
- **Opção "sem margens"** (`config.bleed: true`): itens de layout de largura 100% do tipo imagem/galeria/logo podem ignorar o padding lateral e as margens de topo/base do card. O renderer aplica `-mx-6 -mt-6 -mb-6` conforme a célula seja primeira, última ou intermediária; para larguras < 100% a flag é ignorada por design.
- **Editor do super admin** (`src/routes/_authenticated.admin.index.tsx`, `LayoutEditor`): nova coluna "Sem margens" na tabela do layout, disponível apenas quando o campo é de mídia (`logo_url` ou nomes tipo `image/gallery/foto/logo/...`) **e** ocupa 100% de largura; persistido em `config.bleed`. O schema Zod em `saveCategoryLayout` (`src/lib/category-layouts.functions.ts`) já aceita `config: z.record(...)`, sem migração.
- **Cards públicos** (`src/routes/index.tsx`, `src/routes/explore.tsx`, `src/routes/public.$slug.index.tsx`): removidos os `CardHeader` fixos com logo + título hardcoded — quando a categoria tem layout definido, o card inteiro é renderizado por `PublicCardBody` (respeitando a ordem escolhida pelo super admin). Sem layout definido, mantém-se o fallback anterior (logo + nome + descrição). Wrapper `overflow-hidden` + `<div className="p-6">` interno para permitir bleed sem quebrar o `rounded-xl` do `Card`.
- **Logo por upload** (`src/components/venue/edit-org-dialog.tsx`): campo "Logo (URL)" substituído por `UploadField` (padrão já usado em `src/components/venue/dynamic-form.tsx`) — armazena o path no bucket `venue-uploads` e passa o path direto para `organizations.logo_url`. Zod de `updateOrganization` (`src/lib/orgs.functions.ts`) relaxado de `.url()` para `.max(500)` para aceitar path de storage. `OrgLogo` (`src/components/venue/org-logo.tsx`) resolve path em URL assinada no cliente via `supabase.storage.createSignedUrl` quando o valor não é http; para as listagens públicas o `signImagePathsInItems` de `src/lib/public.server.ts` continua assinando `data.logo_url` server-side (sem mudança).

### Auditoria de propagação (§7)
- **Roles**: apenas `super_admin` altera o layout (RLS em `category_public_layouts*`, preservada); `owner` faz upload da logo pelo dialog de edição (RLS do bucket `venue-uploads` `owner = auth.uid()` já cobre); `editor`/`viewer`/anônimo — apenas leitura. Sem alteração em RLS.
- **Superfícies públicas**: `/api/public/organizations`, `/api/public/organizations/:slug`, `/api/public/category-layout/:categoryId` já devolvem `config` livre; passam a incluir `bleed` sem alteração. `signImagePathsInItems` já assinava `data.logo_url` (tipo `image`) — cards públicos recebem URL http válida.
- **Não tocados / justificativa**: cards de **registro** (record cards) reusam o mesmo `PublicCardBody`, então nome-como-H3 é aproveitável se o super admin incluir `name` no card de registro (não é regressão — é extensão). Formulário de **criação** de organização não recebe upload de logo — não tinha esse campo antes; alteração fora do escopo do pedido. `getPublicOrganization` continua expondo `org.logo_url` cru como fallback do header do perfil; `OrgLogo` agora resolve isso client-side para o owner autenticado (perfil público continua funcionando via `data.logo_url` já assinado).

---



Novo mecanismo, paralelo aos `organization_category_default_fields` (Iteração 9) — que segue valendo para campos pré-sugeridos em tabelas criadas livremente pelo admin comum. Esta iteração introduz **tabelas inteiras** definidas pelo super admin e travadas para o usuário. Não retroage a organizações existentes.

- **Migração**: novas tabelas `category_standard_tables` e `category_standard_table_fields` (leitura pública, escrita restrita a `is_super_admin`, GRANTs incluídos). Novas colunas em `tables`: `origin_standard_table_id` (FK) e `is_locked` (default false). Políticas RLS de `tables` (UPDATE/DELETE) e `fields` (INSERT/UPDATE/DELETE) reescritas para exigir `NOT is_locked OR is_super_admin`. RPC `create_organization` estendida: ao criar organização com categoria, instancia automaticamente as tabelas-modelo da categoria e seus campos, marcando `is_locked=true` e `origin_standard_table_id` preenchido (colisão de slug resolvida com sufixo `-N`).
- **Server fns**: `src/lib/category-standard-tables.functions.ts` com CRUD de tabelas-modelo e campos (todos gated por `is_super_admin`).
- **Correção paralela — gallery em records** (extensão da Iteração 13): `src/lib/records.functions.ts` → `zodForField` agora aceita `gallery` como array de strings (antes caía no default `string`, bloqueando publicação de galeria em qualquer record).
- **Admin panel** (`src/routes/_authenticated.admin.index.tsx`): nova aba "Tabelas padrão" com seletor de categoria, CRUD das tabelas-modelo e editor de campos por tabela (mesmos 17 tipos, incluindo `gallery`).
- **Schema da tabela** (`src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`): quando `is_locked=true` e usuário não é super admin, ocultamos criar/editar/excluir campo; badge "Travada" e subtítulo explicando a origem; incluímos `gallery` no seletor de tipo (paridade com Iteração 13).
- **Grid de tabelas da organização** (`src/routes/_authenticated.app.$orgSlug.index.tsx`): `listTables` agora expõe `is_locked` e `origin_standard_table_id`; badge "padrão" com ícone de cadeado nos cards travados; botões de renomear/excluir tabela ocultos para não-super-admin quando travada. CRUD de registros dentro da tabela travada segue por role (owner/editor/viewer), como especificado.

### Auditoria de propagação (§7)
- **Roles**: `super_admin` gerencia tabelas-modelo e edita estrutura de tabelas travadas em qualquer organização. `owner`/`editor`/`viewer` — CRUD de registros em tabelas travadas segue normalmente; estrutura é somente-leitura (RLS + UI). Autenticado não-membro e anônimo — sem acesso a esquema; leitura pública de registros continua governada por `views` publicadas.
- **Superfícies públicas**: nenhuma nova superfície `/api/public/*`. `listPublicRecords`/`listPublicOrganizations`/`loadPublicTable` não filtram por `is_locked` (correto: publicação continua sendo por `views.status`, não por origem estrutural).
- **Componentes genéricos**: `DynamicGrid` e `DynamicForm` não precisam mudar — leem `fields` da tabela instanciada como sempre; campos `gallery` já eram tratados no formulário (Iteração 13) e agora validam no servidor (`zodForField`).
- **Não tocados / justificativa**: `deleteTable`/`updateTable` no `orgs.functions.ts` — a política RLS de `tables` já bloqueia UPDATE/DELETE em tabela travada para não-super-admin (erro chega ao cliente via `toast.error`); guarda dedicada de aplicação seria redundante. `createField`/`updateField`/`deleteField` — mesma justificativa via RLS de `fields`. Reconciliação retroativa fora de escopo por design (documentado no pedido).

---

## 2026-07-21 — Iteração 19 — Carrossel de galeria, perfil enriquecido, senha e correção de galeria em record fields


Extensão explícita das Iterações 11/12 (cascata de campos), 13 (galeria/renderer) e 18 (perfil público).

- **Bug (Iteração 12) — galeria em record fields**: `src/lib/organization-categories.functions.ts` → `FIELD_TYPES` inclui `gallery`. O painel do super admin em "Campos padrão → Registro" usa `upsertCategoryDefaultField`, cujo Zod ainda vetava `gallery` mesmo após a Iteração 12 ter incluído o tipo no cadastro dos outros escopos.
- **Galeria como carrossel** (extensão da Iteração 13): novo `src/components/venue/gallery-carousel.tsx` reutilizando shadcn/embla (`Carousel*`). `src/components/venue/public-card-renderer.tsx` renderiza `gallery` via `GalleryCarousel` (aspect-video 100%, aspect-square nas larguras menores) com contador e navegação prev/next. Propaga para landing, `/explore`, cards internos de organização e ambientes, e perfil público.
- **Perfil público de organização** (`src/routes/public.$slug.index.tsx`): removido `/{slug}` do cabeçalho; categoria agora ocupa esse espaço acima do nome. Nova seção "Localização" com iframe do Google Maps (`https://www.google.com/maps?q=<endereço>&output=embed`, sem chave de API) baseada nos campos de endereço cadastrados.
- **Cards públicos de organização** (`src/routes/index.tsx`, `src/routes/explore.tsx`): logo (`o.logo_url`) renderizada ao lado do nome quando presente; `/{slug}` removido em ambos os pontos.
- **Alteração de senha no modal de Configurações** (`src/components/venue/settings-modal.tsx`): aba "Segurança" agora contém formulário com nova senha + confirmação, com validação de comprimento (≥ 8), match e feedback via `sonner`; grava via `supabase.auth.updateUser({ password })`.
- **Login Google no site publicado**: `supabase--configure_social_auth` executado — provedor já estava habilitado. A implementação atual (`src/routes/auth.tsx` usando `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`) está de acordo com a integração gerenciada; nenhuma mudança de código foi necessária.

## 2026-07-20 — Iteração 18 — Galeria pública, perfil rico e visibilidade da organização

Extensão explícita das Iterações 13 (galeria/renderer) e 17 (payload público de organização) + novo controle de visibilidade.

- **Correção de galeria em cards públicos** (bug regressivo da Iteração 13): `src/lib/public.server.ts` → `signImagePathsInItems` reescrito para avaliar single-image e gallery independentemente. O `continue` do ramo single interrompia o loop antes do ramo gallery quando o valor era array, e por isso paths crus da galeria voltavam ao frontend e eram exibidos como texto. Verificado no payload de `/api/public/organizations` antes/depois. Propaga para landing, `/explore` e perfil público.
- **Perfil público enriquecido** (`src/routes/public.$slug.index.tsx`): agora consome novo endpoint `/api/public/organizations/$slug` e mostra logo, nome, categoria, descrição, endereço formatado, campos personalizados via `PublicCardBody` (respeitando layout `organization_card` do super admin) e um fallback tabular para campos personalizados fora do layout. Erro/ausente cai em `EmptyState` "Perfil indisponível". Lista de publicações mantém comportamento anterior.
- **Novo server helper**: `getPublicOrganization(slug)` em `src/lib/public.server.ts` — reaproveita `signImagePathsInItems`, layout e fields de categoria; resolve `category_name`.
- **Nova rota pública**: `src/routes/api/public/organizations.$slug.ts` (GET com cache `max-age=30, s-maxage=60, stale-while-revalidate=300`).
- **Visibilidade da organização** (Iteração 18):
  - Migration: `organizations.is_public boolean NOT NULL DEFAULT true` + índice parcial. Default `true` preserva organizações existentes.
  - `listPublicOrganizations`, `listPublicRecords`, `getPublicOrganization`, `loadPublicTable`, `loadPublicRecord` e a rota `/api/public/campaigns/$recordId` filtram `is_public = true` (organizações ocultas somem de landing, `/explore`, perfil público, páginas de tabela/registro/formulário público e campanhas). Membros continuam vendo pelo painel autenticado; tokens de lead direto continuam funcionando (não passam pela listagem).
  - `src/lib/orgs.functions.ts`: `orgUpdate` aceita `is_public`; `getOrganizationBySlug` devolve `is_public`.
  - `src/components/venue/edit-org-dialog.tsx`: novo `Switch` "Perfil público" em cada organização.
  - `src/routes/_authenticated.app.$orgSlug.index.tsx`: passa `is_public` ao dialog.
- **Auditoria de propagação**: landing, `/explore` (abas de organizações e registros), `/public/$slug/`, `/public/$slug/$tableId/$recordId`, formulário público, `/public/$slug/campaigns/$recordId`, endpoints `/api/public/organizations`, `/api/public/records`, `/api/public/organizations/$slug`, `/api/public/campaigns/$recordId` — todos revisados. Roles: super_admin, owner/editor/viewer (via `is_org_member`), autenticado não-membro, anônimo — visibilidade oculta só afeta as duas últimas.
- Sem novos tokens, sem componente novo além do bloco de perfil (reutiliza `PublicCardBody`, `Card`, `Switch`).

---

## 2026-07-19 — Correção da Iteração 12/13 — Campo `gallery` e uploads em campos de categoria
- `src/lib/category-cascade.functions.ts`: enum `FIELD_TYPES` do validador Zod passa a incluir `gallery` (o enum do banco `field_type` já tinha desde a migração de 2026-07-15); com isso o super admin consegue criar/editar campos personalizados do tipo galeria em `organization_category_default_fields`, `category_org_fields` e `category_table_fields` sem erro "Invalid enum value".
- `src/components/venue/dynamic-form.tsx`: `UploadField` e `GalleryField` exportados para reuso.
- `src/components/venue/category-fields-form.tsx`: passa a renderizar `image`/`file` com `UploadField` e `gallery` com `GalleryField` — antes esses tipos caíam no `Input` de texto genérico, então o usuário via um campo de texto ao invés do uploader.
- Extensão da Iteração 12 (unificação de "Campos padrão") + Iteração 13 (introdução do tipo `gallery`). Referência preservada — sem iteração paralela.

## 2026-07-19 — Iteração 17 — Card público de organização reflete configuração do super admin

- `src/lib/public.server.ts`: `ORG_BUILTIN_FIELDS` inclui campos-base de endereço (`address.cep/street/number/complement/neighborhood/city/state`) além de `name`, `slug`, `description`, `logo_url`; `listPublicOrganizations` achata `organizations.address` no payload `data` do card, permitindo que o layout definido pelo super admin renderize esses valores.
- `src/routes/_authenticated.admin.index.tsx` (`LayoutEditor` no escopo `organization_card`): passa a oferecer campos-base (Nome, Descrição, Logo, Cidade, UF, Bairro, Logradouro, Número, Complemento, CEP) somados aos campos de cascata da categoria.
- Nota operacional: layouts salvos com chaves inexistentes (ex.: `foto_capa`, `endereco`) continuam ignorados pelo renderer; o super admin deve remover essas linhas em Admin › Layout público › Card de organização e escolher os campos-base agora disponíveis.

## 2026-07-18 — Iteração 16 — Filtros dinâmicos em Explorar

- Nova tabela `category_filter_fields` (categoria + escopo + chave + tipo `search`/`select`) com GRANTs para `anon`/`authenticated`/`service_role` e políticas: leitura pública, escrita restrita a super admin.
- `src/lib/category-filters.functions.ts`: CRUD (`listCategoryFilterFieldsPublic`, `upsertCategoryFilterField`, `deleteCategoryFilterField`).
- `src/lib/explore-filters.server.ts` + `src/routes/api/public/explore-filters.ts`: retorna definições de filtro + valores distintos por categoria/escopo.
- `src/lib/public.server.ts`: `listPublicOrganizations` e `listPublicRecords` aceitam `filters` e ampliam a busca livre para chaves `search` configuradas (inclui bloco de endereço em organização, incluindo cidade).
- `src/routes/api/public/organizations.ts` e `records.ts`: leem parâmetros `f_<key>` da querystring.
- `src/routes/explore.tsx`: tabs com termos dinâmicos (`useLabels`), estado (q, page, filtros) sincronizado no URL, paginação independente por aba, dropdowns dinâmicos por filtro e botão "Limpar".
- `src/routes/index.tsx`: reintroduzido bloco "{Registros} recentes" e títulos usam `useLabels`; import `FileText` corrigido.
- `_authenticated.admin.index.tsx`: nova aba "Filtros públicos" com sub-abas Organização/Registro, seleciona campos disponíveis (base + campos da categoria) e alterna entre `select` e `search`.

## 2026-07-17 — Iteração 15 — Correções (Blog + fluxo público sem tabelas)
- Renomeado `src/routes/_authenticated.admin.tsx` → `_authenticated.admin.index.tsx` para permitir rotas filhas (`admin.blog.$postId`) renderizarem — editor de novo post volta a abrir.
- `src/components/venue/tiptap-editor.tsx`: `immediatelyRender: false` (React 19) e guardas para evitar hydration mismatch.
- `src/components/venue/public-card-renderer.tsx`: filtra células vazias antes de agrupar em linhas, eliminando gaps quando `category_data` não preenche todos os campos do layout.
- `src/routes/index.tsx`: removida seção "Ambientes publicados" (fluxo público sem tabelas).
- `src/routes/public.$slug.index.tsx`: removida referência ao nome da tabela nos cards de registros.
- `src/routes/public.$slug.$tableId.$recordId.tsx` e `.form.tsx`: BackLinks agora voltam ao perfil da organização em vez da listagem de tabela.

## 2026-07-16 — Iteração 14 — Blog (Super Admin)
- Fix: ícones Lucide nos cards públicos agora resolvem kebab-case/PascalCase.
- Tabela `blog_posts` com RLS (Super Admin escreve; anon lê publicados).
- Server fns `src/lib/blog.functions.ts` (CRUD + sign cover) e helpers públicos `src/lib/blog-public.server.ts`.
- Rotas públicas `/blog` (listagem) e `/blog/$slug` (post) com SEO/OG e capa.
- Endpoints `/api/public/blog` e `/api/public/blog/$slug`.
- Editor Tiptap (`src/components/venue/tiptap-editor.tsx`) com upload inline em `venue-uploads`.
- Aba "Blog" no `/admin` com listagem, criação, edição, publicação e remoção.
- Link "Blog" no `PublicHeader`.
- Sanitização de HTML server-side com `sanitize-html`.

## 2026-07-16 (America/Sao_Paulo) — Cards públicos respeitam largura e ícone do layout do super admin

- `src/components/venue/public-card-renderer.tsx`: trocado `flex flex-wrap` + `basis-*` por grid CSS de 4 colunas (`grid grid-cols-4 gap-3`) com `col-span-1/2/3/4` mapeado às larguras 25/50/75/100%. Combinações 50/50, 25/75 e 25/25/50 agora ocupam exatamente uma linha em vez de quebrar.
- Ícones definidos pelo super admin (`config.icon`) renderizam com `h-3.5 w-3.5 shrink-0` alinhados ao rótulo uppercase; imagens com span < 100% usam `aspect-square`, span=100% mantém `aspect-video`.
- Propagação automática: landing `/`, `/explore` (abas de perfis e registros) e `/public/$slug` compartilham o mesmo renderer, sem alterações nos consumidores. Backend, API pública e roles não foram tocados.

## 2026-07-15 06:57 (America/Sao_Paulo) — Correção de imagens em cards públicos + landing de espaços

- `src/components/venue/public-card-renderer.tsx`: renderer público agora identifica mídia por tipo (`image`/`gallery`), nome de campo/rótulo (`foto`, `imagem`, `galeria`, `logo`, `capa`) e extensão de imagem em URL; URLs assinadas deixam de cair no fallback textual e passam a renderizar `<img>`/galeria.
- `src/lib/public.server.ts`: assinatura server-side ampliada para campos de mídia detectados por tipo, nome/rótulo e paths com extensão de imagem, cobrindo layouts configurados com chaves como `foto_capa`/`galeria` mesmo quando o metadado chega inconsistente.
- `src/routes/index.tsx`, `src/routes/explore.tsx` e `src/routes/public.$slug.index.tsx`: cards de registros/ambientes deixam de remover o primeiro item do layout para título; o layout público completo definido pelo super admin é renderizado no card.
- `src/routes/index.tsx`: textos, meta description e CTAs da landing ajustados para a proposta atual de listagem e negociação de espaços de eventos.
- Auditoria de propagação: superfícies afetadas atualizadas — landing `/`, explorar `/explore` e perfil público `/public/$slug`; endpoints `/api/public/organizations` e `/api/public/records` mantidos sem PII e com URLs assinadas; roles internas não alteradas.

## 2026-07-15 (America/Sao_Paulo) — Endereço padrão em organizações + correção da criação

- DB: adicionada coluna `organizations.address jsonb NOT NULL DEFAULT '{}'`.
- DB: `create_organization` agora exige `_category_id` (era ignorado — causava violação NOT NULL) e aceita `_address jsonb`. Antigas assinaturas removidas.
- `src/lib/orgs.functions.ts`: `orgCreate`/`orgUpdate` incluem `address` (CEP, logradouro, número, complemento, bairro, cidade, UF). `createOrganization` passa `category_id` e `address` diretamente para a RPC, evitando `UPDATE` pós-insert quando não há overrides.
- `src/components/venue/address-fields.tsx`: novo componente compartilhado com autocomplete via `/api/public/viacep/{cep}` (blur do CEP).
- `src/routes/_authenticated.app.index.tsx`: novo formulário de criação inclui `AddressFields`.
- `src/components/venue/edit-org-dialog.tsx` + `src/routes/_authenticated.app.$orgSlug.index.tsx`: edição da organização inclui e carrega `address`.
- `src/routes/_authenticated.admin.tsx`: `BASE_FIELDS.org` (aba Campos padrão) exibe CEP, logradouro, número, complemento, bairro, cidade e UF como campos padrão read-only.

## 2026-07-15 (America/Sao_Paulo) — Cards públicos de landing/explore usam layout do super admin

- `src/lib/public.server.ts`: `listPublicOrganizations` e `listPublicRecords` agora anexam por item `layout` (do `category_public_layouts` do escopo `organization_card`/`record_card`) e `fields` (built-ins + `category_org_fields` para orgs; `fields` da tabela para records). Batch: uma única consulta de layouts/campos por página de resultados.
- `src/routes/index.tsx` e `src/routes/explore.tsx`: cards passam a renderizar via `PublicCardBody` quando há layout configurado; fallback para descrição/data quando a categoria não tem layout. Título do card de registro segue o primeiro campo do layout.

## 2026-07-15 (America/Sao_Paulo) — Iteração 13 (Fase B): UI de layouts + galeria + ViaCEP + Explore


### Frontend
- `src/routes/index.tsx` (landing): removido o carrossel único de tabelas; substituído por dois blocos separados "Organizações recentes" e "Registros recentes" consumindo `/api/public/organizations` e `/api/public/records`. Adicionado CTA "Explorar" apontando para `/explore`.
- `src/routes/explore.tsx`: reescrita com abas `Organizações | Registros` (search param `tab` validado com Zod adapter). Busca unificada aplica-se à aba ativa. Paginação preservada.
- `src/routes/public.$slug.index.tsx`: nova rota pública `/public/$slug` — listagem das tabelas publicadas da organização.
- `src/components/venue/public-card-renderer.tsx`: novo componente `PublicCardBody` que agrupa `LayoutItem`s por linhas cumulativas de 100% e renderiza cada item com `basis-1/4|1/2|3/4|full`, rótulo override, ícone lucide e formatação por tipo.

### Campo `gallery` (ponta a ponta)
- `src/components/venue/dynamic-form.tsx`: novo `GalleryField` com upload múltiplo para bucket `venue-uploads` (paths `${uid}/gallery/...`) e remoção individual. Integrado ao switch de tipos.
- `src/components/venue/dynamic-grid.tsx`: `formatValue` renderiza até 3 thumbs + contador `+N` para o tipo `gallery`.
- `src/lib/public.server.ts` (`loadPublicRecord`): pré-assinatura em lote também dos paths de galerias; retorno inclui `galleries: Record<key, string[]>`.
- `src/routes/public.$slug.$tableId.$recordId.tsx`: nova seção de cards de galeria (grid 2/3 colunas responsivo) usando `galleries[key]`.

### ViaCEP autocomplete
- `src/components/venue/dynamic-form.tsx`: para campos `text` com `config.role === "cep"`, o `onBlur` chama `/api/public/viacep/{cep}` e preenche automaticamente os campos-alvo (defaults: `logradouro`, `bairro`, `cidade`, `estado`; customizável via `config.cep_targets`).

### Editor de campos padrão (super admin)
- `src/routes/_authenticated.admin.tsx` (`ScopeEditor`):
  - Adicionado `gallery` à lista `FIELD_TYPES` (super admin agora pode criar campos de galeria em qualquer escopo).
  - Nova área "Opções (uma por linha)" no diálogo quando o tipo é `select` ou `multiselect`; salva em `config.options`.
  - Novo toggle "Autocompletar via ViaCEP" quando o tipo é `text`; grava `config.role = "cep"`.
  - `config` agora é enviado no `upsertCategoryDefaultField` / `upsertCategoryCascadeField`.

### Editor de Layout Público (super admin)
- `src/routes/_authenticated.admin.tsx`: nova aba superior "Layout público" com sub-abas `Card de organização | Card de registro`. `LayoutEditor` lista os campos configurados com controles de ordem (↑↓), rótulo override, ícone lucide e largura (25/50/75/100%); permite adicionar campos disponíveis da categoria e salvar via `saveCategoryLayout`.

### Dependências
- `bun add @tanstack/zod-adapter` — usado pelo `validateSearch` da `/explore`.

### Auditoria de propagação
- DynamicGrid / DynamicForm / detalhe público: novo tipo `gallery` propagado em todas as três superfícies.
- Rotas públicas afetadas: `/`, `/explore`, `/public/$slug`, `/public/$slug/$tableId/$recordId` — todas atualizadas ou criadas.
- Endpoints públicos: `/api/public/organizations`, `/api/public/records`, `/api/public/viacep/$cep` já criados na Fase A; nenhum retorna PII.
- Roles: alterações no admin permanecem restritas a `super_admin` (gate `amISuperAdmin` + RLS `is_super_admin(auth.uid())`). Papéis owner/editor/viewer/anônimo não são impactados nesta iteração.

## 2026-07-15 (America/Sao_Paulo) — Iteração 13 (Fase A): Backend de layouts públicos + galeria + ViaCEP

### Banco
- Migration: nova tabela `category_public_layouts (category_id, scope, unique)` e `category_public_layout_fields (layout_id, field_key, width_percent, order_index, config)`; `scope` é um enum `public_layout_scope ('organization_card', 'record_card')`.
- Migration: tipo de campo `gallery` adicionado ao enum `field_type` (array de arquivos com URLs pré-assinadas — consumidores serão atualizados na Fase B).
- Migration: removida a antiga tabela `organization_category_public_layouts` (substituída pelo novo modelo em dois escopos).
- GRANTs: `SELECT` público em ambas as tabelas de layout; escrita restrita a super admin via RLS (`is_super_admin(auth.uid())`).

### Backend
- `src/lib/public.server.ts`:
  - Novo helper `loadPublicLayout(categoryId, scope)` para resolver layout por categoria.
  - Nova função `listPublicOrganizations({ q, category_id, limit, offset })` — devolve apenas organizações com ≥1 registro publicado, ordenadas por `updated_at`, com busca em nome + descrição.
  - Nova função `listPublicRecords({ q, category_id, limit, offset })` — devolve registros publicados com JOIN em tabela e organização, busca em nome de tabela, organização e valores textuais de `record.data`.
  - `loadPublicTable` agora retorna `record_card_layout` (novo formato: `{ field_key, width_percent, order_index, config }`) no lugar do antigo `category_layout`.
- Novas server functions `listCategoryLayout` e `saveCategoryLayout` em `src/lib/category-layouts.functions.ts` — CRUD restrito a super admin, valida `width_percent ∈ {25,50,75,100}` e soma por linha ≤ 100.

### Endpoints públicos
- `GET /api/public/organizations` — busca de perfis públicos.
- `GET /api/public/records` — busca de registros publicados.
- `GET /api/public/viacep/$cep` — proxy server-side para `viacep.com.br` com validação de CEP e cache 24h.
- `GET /api/public/category-layout/$categoryId?scope=organization_card|record_card` — layout público resolvido para consumo anônimo.

### Frontend (mínimo para desbloquear build)
- `src/routes/public.$slug.$tableId.index.tsx`: consumidor migrado para o novo formato `record_card_layout` (campo `field_key`, ícone e rótulo lidos de `config`).

### Pendente para Fase B (próxima iteração)
- Editor "Layout Público" no `/admin` (drag-order + largura 25/50/75/100 por linha, por escopo).
- Componente `PublicCardRenderer` (CSS grid respeitando `width_percent`).
- Suporte a `type='gallery'` em `DynamicForm`, `DynamicGrid` e página de detalhe pública (upload múltiplo + pré-assinatura em lote).
- Reformulação de `/` (blocos separados de organizações recentes / registros recentes) e `/explore` (abas Organizações | Registros).
- Editor de opções de `select`/`multiselect` em Campos Padrão.
- Autocomplete de CEP via `config.role = 'cep'` disparando o proxy `/api/public/viacep/$cep`.
- Auditoria e correção dos 17 tipos de campo em 5 superfícies (DynamicGrid, DynamicForm, público, PublicCardRenderer, editor de opções).

---

## 2026-07-15 (America/Sao_Paulo) — Conexão dos campos padrão ao fluxo do usuário

### Frontend
- Novo componente `src/components/venue/category-fields-form.tsx`: renderiza os campos definidos por super admin em `category_org_fields` / `category_table_fields` a partir de `/api/public/category-schema/$categoryId`, escopo `org | table`, com suporte a text/long_text/number/currency/date/datetime/email/url/phone/select/boolean.
- `src/routes/_authenticated.app.index.tsx`: diálogo "Nova organização" passou a renderizar os campos da categoria escolhida e envia `category_data` no `createOrganization`.
- `src/components/venue/edit-org-dialog.tsx`: prop `org` recebe `category_data`; edição de organização carrega os valores atuais e persiste em `category_data` via `updateOrganization`.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`:
  - `EditOrgDialog` passa a receber `system_data` e `category_data` do carregamento da organização.
  - Diálogo "Nova tabela" renderiza os campos de categoria (`scope=table`) usando `organizations.category_id` e envia `category_data` no `createTable`.
  - `TableCard` recebe `orgCategoryId` e usa `t.category_data` como valor inicial; edição envia `category_data` no `updateTable`.

### Backend
- `src/lib/orgs.functions.ts`: `getOrganizationBySlug` retorna `category_data`; `listTables` retorna `category_data`. Sem migrations, sem alterações em RLS/GRANTs.

---

## 2026-07-15 (America/Sao_Paulo) — Iteração 12: Consolidação da administração de campos

### Frontend
- `/admin`: removidas as abas **Layout público**, **Campos de sistema** e **Cascata**.
- Nova aba unificada **Campos padrão** com sub-tabs `Organização` / `Tabela` / `Registro`, mesmo modelo de edição (rótulo → chave snake_case com sufixo `_2`, chave travada em edição, tipo, obrigatório, ordem) e painel único de reconciliação retroativa via `reconcileCategoryAllOrganizations`.
- Listagem de cada escopo exibe no topo os campos-base fixos (org: `name`, `slug`, `category_id`; tabela: `name`, `icon`, `description`; registro: nenhum) marcados com badge `base` e sem ações de edição/remoção.
- Escopo **Registro** grava em `organization_category_default_fields` via `listCategoryDefaultFields` / `upsertCategoryDefaultField` / `deleteCategoryDefaultField`; escopos **Organização** e **Tabela** continuam gravando em `category_org_fields` / `category_table_fields` via cascade functions.

### Limpeza
- Removidos `src/components/venue/category-cascade-section.tsx` e `src/lib/category-layouts.functions.ts` (não referenciados).
- Sem migrations, sem alterações em RLS, GRANTs ou endpoints públicos.

---

## 2026-07-15 (America/Sao_Paulo) — Iteração 11 (parcial): Cascata de campos por categoria

### Backend
- Migration: `category_org_fields`, `category_table_fields`, `organizations.category_data`, `tables.category_data`, `organization_categories.base_field_config`, `fields.source` (`user | category | legacy`) e `fields.category_field_key`; RPC `reconcile_org_category_fields(_org_id uuid)` idempotente.
- Nova `src/lib/category-cascade.functions.ts`: `listCategoryCascadeFields`, `upsertCategoryCascadeField`, `deleteCategoryCascadeField`, `updateCategoryBaseFieldConfig`, `getCategoryBaseFieldConfig`, `reconcileOrganizationCategoryFields`, `reconcileCategoryAllOrganizations`, `getCategorySchemaPublic`.
- Nova rota `src/routes/api/public/category-schema.$categoryId.ts` (cache 30s).
- `src/lib/orgs.functions.ts`:
  - `createOrganization` passa a exigir `category_id`; aceita `category_data`.
  - `updateOrganization` aceita `category_data` e dispara `reconcile_org_category_fields` quando a categoria muda.
  - `createTable` / `updateTable` aceitam `category_data`; `getTable` retorna `category_data`.
  - `createTable` marca fields semeados com `source='category'` e `category_field_key`.
  - `listFields` retorna `source` e `category_field_key`.
  - Novo guard `assertFieldMutable`: apenas super admin pode editar/remover fields com `source != 'user'`.

### Frontend
- `src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`: badge "categoria" e bloqueio de edição/remoção para fields de origem categoria a usuários não-super-admin.
- `src/routes/_authenticated.app.index.tsx`: categoria obrigatória na criação de organização; removida a opção "Sem categoria".

### Pendente da Iteração 11 (próximo passo)
- UI no `/admin` para editar `category_org_fields`, `category_table_fields` e `base_field_config` por categoria.
- Formulários dinâmicos usando `getCategorySchemaPublic` na criação/edição de organização e tabela.
- Botão "Reconciliar retroativamente" na aba Categorias.
## 2026-07-14 19:57 (America/Sao_Paulo) — Rótulos dinâmicos em telas de domínio


- Rotas autenticadas de organizações, tabelas, registros, esquema, calendário e candidaturas passaram a resolver termos de domínio via `useLabels()` com fallback explícito.
- A exploração pública e o formulário dinâmico substituem referências fixas a organização/tabela/registro por labels configuráveis quando há chave semântica correspondente.
- Admin recebeu ajustes em descrições e estados vazios relacionados a organizações, tabelas, registros e campos.
- Nenhuma alteração de backend, RLS, tokens de design ou migrations.
## 2026-07-14 19:54 (America/Sao_Paulo) — Cache previsível dos termos globais

- `src/routes/api/public/platform-labels.ts`: troca o cache público do endpoint por `cache-control: no-store`, evitando respostas compartilhadas obsoletas enquanto termos-núcleo são administráveis em runtime.
- `src/hooks/use-instance-context.ts`: consulta `/api/public/platform-labels` com `cache: "no-store"`, remove o `staleTime` de 5 min e revalida ao montar, focar a janela ou reconectar.
- `src/routes/_authenticated.admin.tsx`: atualiza o texto da seção de termos-núcleo para refletir que a sessão atual é invalidada após salvar e outras sessões revalidam nos eventos configurados.
## 2026-07-14 19:53 (America/Sao_Paulo) — Layout da tela de login

- `src/routes/auth.tsx`: remove o botão de voltar ao início do header da tela de login, mantendo apenas marca e Explorar.
- `src/routes/auth.tsx`: reorganiza a tela em duas colunas no desktop, com área esquerda em degradê preparada para futura imagem e formulário de login à direita; preserva layout responsivo em coluna única no mobile.
- Nenhuma alteração de backend, RLS, rotas públicas ou tokens de design.

## 2026-07-14 19:42 (America/Sao_Paulo) — Restrição do atalho Administração no menu do perfil

- `src/components/venue/app-shell.tsx`: corrige a condição do item "Administração" no dropdown do perfil para renderizar somente quando `amISuperAdmin()` retornar `is_super_admin: true`.
- Nenhuma alteração de rota, backend, RLS ou tokens de design.

## 2026-07-14 — Iteração 10 (continuação): Campos de sistema editáveis + sweep de rótulos

### Backend
- **Nova função** `src/lib/system-fields.functions.ts`: `listSystemFieldsPublic({ scope })`, `listAllSystemFieldsPublic()`, `upsertSystemField`, `deleteSystemField` — escopos `organization | table | record`, gravam nas tabelas `organization_fields`, `table_fields`, `record_fields` (super admin only).
- **Nova rota pública** `src/routes/api/public/system-fields.ts` retornando os três escopos com cache 60s.
- **Novo hook** `src/hooks/use-system-fields.ts` (`useSystemFields(scope)`) — dicionário cacheado (5 min).
- `src/lib/orgs.functions.ts`: `createOrganization` / `updateOrganization` / `getOrganizationBySlug` / `listMyOrganizations` agora aceitam e retornam `system_data` (JSONB).
- `src/lib/records.functions.ts`: `createRecord` / `updateRecord` aceitam `system_data`; `listRecords` passa a expor o campo.

### Admin UI
- **Nova aba "Campos de sistema"** em `/admin` com seletor de escopo (Organização / Tabela / Registro), CRUD completo (chave snake_case, rótulo, tipo, obrigatório, ordem) reutilizando `FIELD_TYPES` do motor unificado (`field-schema.ts`).
- Invalidação recíproca com a query `system-fields` para refletir mudanças imediatamente no cliente.

### Integração transversal
- `EditOrgDialog` agora renderiza dinamicamente os campos de sistema da organização (texto, textarea/long_text, number/currency, date/datetime, email/url/phone, select, boolean) e persiste em `organizations.system_data`. Rótulos como "Excluir organização" e "Categoria" passaram a usar `useLabels()`.

### Sweep de rótulos (Frente 2)
- `AppShell` migrou strings hardcoded → `useLabels()`: seletor de organização, dropdown "Organizações", "Nenhuma organização", "Ver todas as organizações", "Reservas" (bookings), "Membros" (memberships).
- Comportamento de fallback preservado via `FALLBACK_LABELS` do hook.

### Pendências identificadas
- UI de tabelas (schema builder) e registros (formulário na `_authenticated.app.$orgSlug.tables.$tableId.index.tsx`) ainda não renderizam campos de sistema, embora o backend já aceite `system_data`. Próxima entrega.
- `PublicHeader` mantém "Explorar" hardcoded — sem chave semântica associada; deixado como cópia de UI, sem impacto de termos-núcleo.

### Governança
- Sem cor hardcoded; sem quebra de tokens.
- `tsgo --noEmit`: ✅ limpo.
## 2026-07-14 22:15 — Iteração 10 (parcial): layout público por categoria + retroatividade

- Migration prévia: novas tabelas `organization_category_public_layouts`, `organization_fields`, `table_fields`, `record_fields`; coluna `system_data jsonb` em `organizations`, `tables`, `records`; enum `field_source_kind`; `system_form_fields` removida.
- `src/lib/field-schema.ts` (novo): extrai `zodForField` / `buildSchemaFromFields` e a lista `FIELD_TYPES` compartilhada (base para os campos de sistema de org/tabela/registro).
- `src/lib/platform-labels.functions.ts`: remove tipos/fn de `system_form_fields` (tabela dropada).
- `src/lib/category-layouts.functions.ts` (novo): `listCategoryPublicLayoutPublic`, `upsertCategoryPublicLayoutItem`, `deleteCategoryPublicLayoutItem`, `seedCategoryDefaultsRetroactive` (semeia campos padrão em tabelas existentes da categoria — não sobrescreve chaves já presentes).
- `src/routes/_authenticated.admin.tsx`: aba "Rótulos" simplificada (remove SFF); nova aba "Layout público" com CRUD por categoria (origem, chave, ícone lucide, rótulo override, ordem) + botão "Aplicar campos padrão retroativamente" que dispara `seedCategoryDefaultsRetroactive`.
- `src/lib/public.server.ts` / `PublicTablePayload`: expõe `organization.category_id` e `category_layout`.
- `src/routes/public.$slug.$tableId.index.tsx`: quando a categoria da org define layout público, os cards passam a renderizar campos, rótulos e ícones definidos pelo super admin, com fallback para heurística anterior quando não há layout.

---



- `src/components/venue/conversation-thread.tsx` agora recebe `formatCtx` obrigatório; substitui `toLocaleString`/`Intl.NumberFormat` fixos por `formatDateTime`/`formatCurrency`.
- `src/components/venue/chat-widget.tsx`: aceita `org` como prop, deriva `formatCtx` via `useFormatContext(org)`, propaga para `ConversationThread` e ao badge de valor acordado; datas do inbox usam `formatDateTime`.
- `src/components/venue/app-shell.tsx`: passa `org` ao `ChatWidget`; adiciona link "Administração" no menu do perfil visível apenas quando `amISuperAdmin` retorna verdadeiro.
- `src/routes/_authenticated.app.$orgSlug.conversations.$conversationId.tsx`: injeta `formatCtx` derivado do org atual no `ConversationThread`.
- `src/routes/lead.$token.tsx`: usa `formatCtx` (padrão da instância) para valor acordado e mensagens; remove `Intl.NumberFormat` fixo.
- `src/routes/public.$slug.campaigns.$recordId.tsx`: valores confirmados e meta agora usam `formatCurrency(formatCtx)`.
- `src/routes/_authenticated.me.applications.tsx`: valor acordado via `formatCurrency`, data de envio via `formatDateTime`.
- `src/components/venue/edit-org-dialog.tsx`: adiciona seleção de categoria e overrides opcionais de fuso horário e moeda; valores em branco herdam padrão da instância; envia `category_id`, `timezone`, `currency` no `updateOrganization`.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`: repassa `category_id`, `timezone`, `currency` do org atual ao `EditOrgDialog`.
- `src/routes/_authenticated.app.index.tsx`: diálogo "Nova organização" agora exige selecionar categoria (com opção "Sem categoria"); remove import não usado de `useServerFn`.

---

# CHANGELOG — Venuespace

Registro cronológico de todas as implementações do projeto. Norma soberana da skill `venuespace` (§0 e §7): nenhuma iteração fecha sem entrada correspondente.

**Formato de cada entrada:**

- Cabeçalho: `## YYYY-MM-DD HH:MM (America/Sao_Paulo) — <escopo>`
- Bullets objetivos do que foi implementado (migrations, rotas, componentes, tokens, correções).
- Sem justificativas subjetivas, sem chain-of-thought — apenas o que foi feito.
- Ordem cronológica **decrescente** (mais recente no topo).

---

## 2026-07-14 23:15 — Header público unificado, voltar em detalhes, formulário como modal

- `src/components/venue/public-header.tsx`: novo componente sticky compartilhado (marca + Explorar + Entrar/Começar), prop `back` para botão de voltar tipado, `showAuthActions` e `showExplore` para variantes; mobile-first (labels colapsam em `<sm`).
- `src/components/venue/interest-form-modal.tsx`: novo Dialog shadcn que encapsula o formulário público (contato + `DynamicForm` do view), reaproveitando `/api/public/form-schema/:viewId` e `/api/public/:slug/:tableId/submit`; navega para `/lead/$token` no sucesso; loading/erro tratados dentro do modal.
- `src/routes/index.tsx`: header inline substituído por `<PublicHeader />`.
- `src/routes/explore.tsx`: header inline substituído por `<PublicHeader back={{to:"/"}} />`.
- `src/routes/public.$slug.$tableId.index.tsx`: `PublicHeader` no topo; botão "Manifestar interesse" de cada card abre `InterestFormModal` com o `recordId` respectivo em vez de navegar para a rota `/form`.
- `src/routes/public.$slug.$tableId.$recordId.tsx`: `PublicHeader` com `back` para a listagem da tabela (rótulo "Voltar para <tabela>"); CTA "Manifestar interesse" agora abre o modal.
- `src/routes/public.$slug.campaigns.$recordId.tsx`: `PublicHeader` com `back` para `/explore` (fluxo de contribuição inalterado).
- `src/routes/lead.$token.tsx`: `PublicHeader` sem botões de auth (destino final do lead).
- `src/routes/auth.tsx`: `PublicHeader` com `back` para `/` e sem ações de auth (evita duplicar Entrar/Começar).
- `src/routes/public.$slug.$tableId.form.tsx`: reescrita como fallback compatível — mantém a URL/`search` param antigos, renderiza `PublicHeader` + shell mínimo e abre o `InterestFormModal`; ao fechar volta para a listagem da tabela.
- Nenhuma alteração de esquema, endpoints, RLS ou tokens de cor. Typecheck limpo.

---


## 2026-07-14 22:30 — Edição/exclusão de organização e tabela + Explorar público

- `src/lib/orgs.functions.ts`: `updateOrganization` (owner-only, patch de name/description/logo_url), `deleteOrganization` (owner-only, confirma slug), `deleteTable` (owner-only, confirma nome).
- `src/components/venue/edit-org-dialog.tsx`: modal de edição da organização com AlertDialog de exclusão (digitar slug para confirmar); invalida `["org", slug]` e `["my-orgs"]`; ao excluir navega para `/app`.
- `src/routes/_authenticated.app.$orgSlug.index.tsx`: botão "Editar organização" (visível para owner) que abre o modal; TableCard ganhou ícone de lixeira com AlertDialog exigindo digitar o nome; botão "Conversas" removido do header do painel (superfície única passa a ser o widget flutuante).
- `src/lib/public.server.ts`: `listPublicTables({ limit, offset, q })` agregando tabelas com pelo menos um record `status='published'`, projetando apenas metadados seguros (sem PII e sem `data` de records).
- `src/routes/api/public/tables.ts`: endpoint `GET /api/public/tables` com `Cache-Control: public, max-age=60, s-maxage=120, stale-while-revalidate=300`.
- `src/components/venue/public-tables-carousel.tsx`: carrossel shadcn com as 12 publicações mais recentes; card leva a `/public/:slug/:tableId`; fail-soft se vazio.
- `src/routes/index.tsx`: seção "Publicações recentes" com o carrossel + link "Ver todas" para `/explore`; novo botão "Explorar" no header público.
- `src/routes/explore.tsx`: nova rota pública `/explore` com busca por nome de tabela/organização, paginação (24 por página), grid responsiva e `head()` próprio (title/description/og/twitter).
- Nenhuma alteração de esquema: FKs de `organization_id` e `table_id` já estão com `ON DELETE CASCADE`.
- Typecheck limpo.

---


## 2026-07-14 21:00 — Fix: rota pública de detalhes e formulário não abriam

- `src/routes/public.$slug.$tableId.tsx`: convertida em layout puro (`() => <Outlet />`); antes renderizava a listagem sem `<Outlet />`, o que impedia o render das rotas filhas (`$recordId`, `form`) apesar da URL casar.
- `src/routes/public.$slug.$tableId.index.tsx`: nova rota índice contendo `PublicListPage` (mesma listagem, mesmo `head`), respondendo em `/public/:slug/:tableId`.
- Endpoints `/api/public/...` inalterados (200 OK verificado).

---


## 2026-07-14 20:15 — Edição de formulários públicos + otimização do fluxo público

- **Backend / server fns**
  - `src/lib/messages.functions.ts`: novas `getPublicFormView` e `updatePublicFormView` (nome, `auto_relation_field_id`, `form_field_ids`) com validação de propriedade e permissão via RLS existente. `submissions_table_id` permanece imutável.
  - `src/lib/public.server.ts` (`loadPublicRecord`): assinatura de URLs em batch (`createSignedUrls`) em vez de N chamadas sequenciais; resolução paralela de `relation` com labels reais; payload agora inclui `relations`.
- **API pública**
  - `src/routes/api/public/$slug/$tableId.ts` e `.../$tableId.$recordId.ts`: cabeçalho `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300` nos handlers `GET`.
- **UI**
  - `src/routes/_authenticated.app.$orgSlug.tables.$tableId.index.tsx`: ícone de lápis em cada card de formulário público abre `EditFormViewDialog` (Input nome, Select de campo relação, lista de Checkbox para escolher campos exibidos). Salvar dispara `updatePublicFormView` e invalida `["views", tableId]`.
  - `src/routes/public.$slug.$tableId.$recordId.tsx`: renderiza labels de `relation` a partir do payload; `<img>` com `loading="lazy"` + `decoding="async"`.
- **Performance**
  - `src/components/venue/app-shell.tsx`: `staleTime: 60_000` em `org`, `me-profile` e `my-orgs` para eliminar refetch entre navegações.
- **Verificação**
  - Fluxo público percorrido (listagem → detalhes → formulário → submissão); typecheck limpo.

---


## 2026-07-14 18:40 — UX: edição de tabelas, uploads reais, dropdown de perfil, chat flutuante, detalhes públicos

- **Backend / server fns**
  - `src/lib/orgs.functions.ts`: novos `updateTable` (patch de nome/descrição/ícone/bookable, com permissão owner/editor) e `addFieldOption` (append em `fields.config.options`, valida tipo `select`/`multiselect` e evita duplicatas case-insensitive).
  - `src/lib/profile.functions.ts` (novo): `getMyProfile`, `updateMyProfile` e `getSignedUploadUrl` (assina objetos privados de `venue-uploads` via `supabaseAdmin`).
  - `src/lib/public.server.ts`: `loadPublicRecord` retorna um único registro publicado, campos, `signed_urls` pré-assinadas para `image`/`file` e referência ao `public_form_view`.
- **API pública**
  - `src/routes/api/public/$slug/$tableId.$recordId.ts` (novo): `GET` retorna detalhe público com URLs assinadas.
- **Rotas**
  - `src/routes/public.$slug.$tableId.$recordId.tsx` (novo): página pública de detalhe do registro (título, imagens, campos formatados, arquivos assinados, CTA para o formulário público).
  - `src/routes/public.$slug.$tableId.tsx`: cards agora linkam para `/public/:slug/:tableId/:recordId` e ganham botão explícito "Ver detalhes".
  - `src/routes/_authenticated.me.settings.tsx` (novo): configurações do perfil (nome de exibição + upload de avatar em `venue-uploads/<uid>/avatar-*`).
- **Componentes**
  - `src/components/venue/app-shell.tsx`: removidos links soltos do topo; adicionado dropdown de perfil (avatar) com Configurações, Minhas candidaturas, Calendário, Membros e Sair; renderiza `ChatWidget` quando há org ativa; mantém `NotificationsBell` no header.
  - `src/components/venue/chat-widget.tsx` (novo): botão flutuante bottom-right; abre `Sheet` com listagem de conversas da org e painel de conversa inline (thread + envio de texto/proposta + aceitar/recusar). Polling de 5 s reaproveitado.
  - `src/components/venue/dynamic-form.tsx`: reescrito com `UploadField` real (upload direto para `venue-uploads` via cliente autenticado, com preview via signed URL) para `image` e `file`; `multiselect` renderizado como chips; `select`/`multiselect` recebem inline "Adicionar opção" (usa `addFieldOption`); props `disableUploads`/`disableOptionEditing` para uso em formulários públicos anônimos.
  - `src/components/venue/dynamic-grid.tsx`: `image` renderiza thumbnail via signed URL; `file` sinaliza presença; demais tipos mantidos.
- **Painel da organização**
  - `src/routes/_authenticated.app.$orgSlug.index.tsx`: cada card de tabela ganha ícone lápis (visível para owner/editor) que abre `Dialog` de edição usando `updateTable`; link do card para o detalhe da tabela preservado.
- **Esquema da tabela**
  - `src/routes/_authenticated.app.$orgSlug.tables.$tableId.schema.tsx`: para campos `select`/`multiselect`, exibe `OptionsManager` com lista atual e input para adicionar novas opções (usa `addFieldOption`).
- **Formulário público**
  - `src/routes/public.$slug.$tableId.form.tsx`: `DynamicForm` invocado com `disableUploads` e `disableOptionEditing` — anônimos veem URL de texto no lugar do upload (bucket privado exige sessão) e não editam opções.
- **Diretriz §0 / §7**
  - Nenhuma iteração anterior alterada; RLS de `venue-uploads` continua restrito a owners (uploads via cliente autenticado sob `<uid>/…`).

---


## 2026-07-14 17:20 — Correção: bloqueio na criação de organização

- Verificado que as chaves de assinatura JWT do projeto já estão em ES256 (`in_use`); HS256 permanece apenas como `previously_used`.
- Confirmado `.env` com chaves `sb_publishable_…` (novo formato) em `SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY`; dev server reiniciado para recarregar `process.env`.
- `createOrganization` mantida como RPC `public.create_organization` (SECURITY DEFINER) — validação de `auth.uid()` e inserção acontecem no banco, contornando erro de RLS/policy no INSERT direto.
- `src/hooks/use-auth.ts`: revalidação da sessão via `supabase.auth.getUser()`; token inválido/stale (ex.: emitido antes da rotação de chaves) dispara `signOut({ scope: "local" })` e o guard `_authenticated` redireciona para `/auth`.
- Varredura de regressão executada sobre Iterações 1–8: server fns em `orgs.functions.ts`, `records.functions.ts`, `messages.functions.ts`, `applications.functions.ts` e rotas `src/routes/api/public/*` continuam usando o padrão correto (`.functions.ts` para app-internal com `requireSupabaseAuth`; `public.server.ts` publishable-key para rotas anônimas).

---

## 2026-07-14 18:30 — Iterações 5, 6, 7, 8



**Iteração 5 — Candidatura autenticada + /me/applications:**
- Migração RLS: `records: applicants can read own` (aplicant_user_id = auth.uid()); índices `messages(read_at)` e `records(applicant_user_id)`.
- `src/lib/applications.functions.ts`: `getMyApplications` cross-org, retorna com conversation_id anexado.
- `src/routes/_authenticated.me.applications.tsx`: lista candidaturas do usuário, link para conversa.
- `src/routes/public.$slug.$tableId.form.tsx`: envio agora anexa Authorization Bearer quando há sessão, preenchendo applicant_user_id no /submit.

**Iteração 6 — Campanhas de arrecadação:**
- `src/routes/api/public/campaigns/$recordId.ts`: GET com progresso confirmado (soma apenas `contribution_status='confirmed'`), POST cria contribuição em tabela de submissões via public_form, gera conversa e lead_access_token quando anônimo.
- `src/routes/public.$slug.campaigns.$recordId.tsx`: página pública com meta, barra de progresso, chave PIX e formulário de contribuição.
- `applications.functions.ts`: `setContributionStatus` (owner/editor via RLS) e `listContributionsForCampaign`.

**Iteração 7 — Motor de reserva:**
- `applications.functions.ts`: `runBookingCheck` (detecção via `fields.config.booking_role` start/end + relação de recurso), `checkBookingConflict` server fn, `listOccupancy`.
- `messages.functions.ts`: `setDealStatus` rejeita transição para `accepted`/`closed` quando há conflito de datas com outra reserva aceita/fechada no mesmo recurso.
- `src/routes/_authenticated.app.$orgSlug.calendar.tsx`: calendário simples de ocupação por tabela reservável.

**Iteração 8 — Membros + polimento + notificações:**
- `applications.functions.ts`: `updateMembershipRole`, `removeMembership`, `listUnreadForOrg`, `markConversationRead`.
- `src/routes/_authenticated.app.$orgSlug.members.tsx`: adicionar membro por e-mail, alterar papel, remover (restrito a owner).
- `src/components/venue/notifications-bell.tsx`: sino com contador de mensagens não lidas (polling 15s), popover com últimas 20.
- `src/components/venue/app-shell.tsx`: integração com bell, links "Membros"/"Calendário"/"Minhas candidaturas".

**Validação:** Typecheck limpo. RLS revisado. Nenhum endpoint público retorna PII. Sem regressão nas iterações 1-4.

---


## 2026-07-14 17:00 — Iteração 3 + Iteração 4: Publicação pública, formulários, chat e negociação

**Migrations:**
- Novas tabelas: `conversations`, `messages`, `lead_access_tokens` (com RLS, GRANTs, índices).
- Políticas `TO anon SELECT` em `organizations`, `tables`, `fields`, `views` (metadados públicos) e em `records` restrita a `status='published'`.
- `messages`: policies para membros da org, autor autenticado, e delete restrito a editores. `lead_access_tokens`: locked (apenas service_role via server routes).

**Server routes (`/api/public/*`):**
- `GET /api/public/$slug/$tableId` — payload público via cliente publishable (org, tabela, campos, records publicados, view public_form ativa).
- `POST /api/public/$slug/$tableId/submit` — validação Zod do payload, verificação de origem, preenchimento automático do campo relação, criação de record na tabela de submissões, criação de `conversation` vinculada e geração de `lead_access_token` (para anon).
- `GET|POST /api/public/lead/$token` — leitura da conversa e envio de mensagens (texto e proposta) por interessado anônimo.
- `GET /api/public/form-schema/$viewId` — expõe o esquema efetivo do formulário (campos visíveis, campos obrigatórios).

**Server functions (`src/lib/messages.functions.ts`):**
- `listConversations`, `getConversation`, `listMessages`, `sendMessage` (papel `member`/`lead` inferido de membership).
- `setProposalStatus` (accept/decline em `messages.proposal_status`).
- `setDealStatus` (`negotiating → accepted/declined → closed`; ao fechar copia `agreed_value` da última proposta aceita).
- `createPublicFormView` (criação de views `public_form` com `submissions_table_id` e `auto_relation_field_id`).

**Server helpers:** `src/lib/public.server.ts` — factory de cliente publishable (com fetch shim para chaves `sb_`), `loadPublicTable`, `loadPublicFormSchema`.

**Componentes:**
- `src/components/venue/conversation-thread.tsx` — renderizador de mensagens com suporte a propostas (aceitar/recusar) e estilo por remetente.

**Rotas UI:**
- `/public/$slug/$tableId` — página pública com lista de registros publicados e CTA "Manifestar interesse".
- `/public/$slug/$tableId/form` — formulário público com validação de e-mail, submissão via API pública, redirect para `/lead/$token`.
- `/lead/$token` — chat do interessado anônimo (polling 5s, envio de texto/proposta).
- `/app/$orgSlug/conversations` — inbox de conversas da organização (polling 5s).
- `/app/$orgSlug/conversations/$conversationId` — detalhe da conversa: thread, envio de texto/proposta, aceitar/recusar propostas, transições `deal_status`.

**Ajustes UI:**
- `/app/$orgSlug`: novo botão "Conversas" no header.
- `/app/$orgSlug/tables/$tableId`: painel "Formulários públicos" (criar/remover view `public_form` apontando para tabela de submissões, com escolha do campo relação de origem); botão "Ver público" abre `/public/...` em nova aba; link de "Abrir formulário" para cada view.

**Sem regressão:** Iterações 1 e 2 continuam funcionando (org, tabelas, campos, records, grid).
**Sem PII em endpoints públicos além do que o organizador publicou/exigiu no formulário.**
**Sem cor hardcoded; sem componente duplicado.**

---

## 2026-07-14 13:25 — Norma de registro + CHANGELOG (registro retroativo)

- Criado `CHANGELOG.md` na raiz do projeto como arquivo dedicado ao histórico de implementações.
- Skill `venuespace` atualizada: cláusula de **Registro obrigatório de implementações** adicionada à Diretriz de Desenvolvimento §0 (soberana) e item 8 adicionado ao Checklist §7 (gate de fechamento de iteração).
- Entradas retroativas das Iterações 1 e 2 incorporadas abaixo.

---

## 2026-07-14 — Iteração 2: Records + Grid Dinâmico (registro retroativo)

- **Migrations**: tabelas `records`, `views`, `permissions` com RLS habilitada e GRANTs para `authenticated`/`service_role`; políticas escopadas por `has_role`/`is_org_member`/`can_edit_org`.
- **Server functions** (`src/lib/records.functions.ts`): `listRecords`, `createRecord`, `updateRecord`, `deleteRecord`, `publishRecord` com validação Zod dinâmica de `data` jsonb contra `fields`.
- **Resolver de campos**: `computed` (soma, contagem, soma qty×valor) e expansão de `relation` na leitura.
- **Componentes de domínio**:
  - `src/components/venue/dynamic-form.tsx` — formulário dinâmico por `field.type`.
  - `src/components/venue/dynamic-grid.tsx` — tabela em desktop (dentro de `ScrollArea`) e cards em mobile via `useIsMobile`; ações via `DropdownMenu`.
- **Rota**: `/app/$orgSlug/tables/$tableId` — CRUD completo de registros + publicar/despublicar (`status`).
- **Ajuste**: card da tabela no dashboard `/app/$orgSlug` aponta para a página de registros; atalho para schema builder preservado.
- Sem novos tokens; sem cor hardcoded; sem regressão da Iteração 1.

---

## 2026-07-14 — Iteração 1: Fundação (registro retroativo)

- **Lovable Cloud** habilitado; cliente Supabase gerado.
- **Migrations**:
  - Enums: `app_role` (owner, editor, viewer), `record_status`, `deal_status`, `contribution_status`, `field_type`, `view_type`.
  - Tabelas: `profiles`, `organizations`, `memberships`, `tables`, `fields` — todas com RLS habilitada e GRANTs explícitos.
  - Funções SECURITY DEFINER: `has_role(user, org, role)`, `is_org_member`, `can_edit_org` (search_path fixo).
  - Triggers: criação automática de `profiles` no signup; atribuição de `owner` ao criador da organização.
- **Auth**: login por e-mail/senha e Google via broker Lovable.
- **Design System** (`src/styles.css`):
  - Tokens em **oklch** para light + dark: neutros (ivory/graphite), marca (deep teal), estados (success/warning/info), status de negociação e contribuição.
  - Utilities: sombras elegantes, gradientes de marca; todos registrados em `@theme inline`.
  - Tipografia: Fraunces (display) + Inter Tight (body) via `<link>` em `__root.tsx` e `@theme`.
- **Componentes de domínio**:
  - `src/components/venue/app-shell.tsx` — layout autenticado com header responsivo.
  - `src/components/venue/empty-state.tsx` — padrão compartilhado para estados vazios.
- **Server functions** (`src/lib/orgs.functions.ts`): listar/criar organizações, tabelas, campos; convite básico de membro por e-mail.
- **Rotas**:
  - `/auth` — login/signup e-mail + Google.
  - `/_authenticated` — layout com gate client-side.
  - `/app` — organizações do usuário.
  - `/app/$orgSlug` — dashboard da organização (tabelas + membros).
  - `/app/$orgSlug/tables/$tableId/schema` — schema builder de campos.
- **Meta tags globais** atualizadas para "Venuespace".

## Iteração 21 — Visibilidade pública de tabelas
- Migração: colunas `is_public` em `tables` e `category_standard_tables` (padrão `false`); RPC `create_organization` propaga o valor definido nas tabelas-modelo ao instanciar novas organizações.
- Backend: `orgs.functions.ts` (create/update/get/list `tables`) e `category-standard-tables.functions.ts` aceitam `is_public`.
- Filtros públicos: `listPublicTables`, `loadPublicTable`, `listPublicRecords` e `loadPublicRecord` em `src/lib/public.server.ts` passam a exigir `tables.is_public = true`.
- UI organização: diálogos "Nova tabela" e "Editar tabela" ganharam toggle "Tabela pública". Badge "pública" aparece no card. Em tabelas travadas (padrão), toggle de visibilidade fica editável mesmo com estrutura bloqueada.
- UI super admin: diálogo de tabela-modelo ganhou toggle "Pública por padrão".
