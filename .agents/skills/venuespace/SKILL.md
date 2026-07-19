---
name: venuespace
description: Referência canônica do produto Venuespace. Aplica-se sempre que a tarefa envolver motor de dados multi-tenant orientado a metadados, tabelas/campos/registros dinâmicos, publicação pública seletiva de registros, formulários públicos com captação de leads e submissões em tabela separada com relação automática, chat vinculado a registros com propostas comerciais e deal_status, campanhas de arrecadação com confirmação manual de contribuições (sem processamento de pagamento), motor de reserva com verificação de conflito de datas em tabelas bookable, papéis/permissões via memberships + has_role, rotas públicas /api/public/*, ou Design System obrigatório shadcn/ui + Tailwind v4 com tokens semânticos em src/styles.css. Contém também a Diretriz de Desenvolvimento soberana que rege todas as decisões técnicas do projeto.
---

# Venuespace — Documento pré-requisito (skill do projeto)

Plano validado. A **Diretriz de Desenvolvimento (§0)** é soberana e precede toda outra seção — inclusive Design System e Iterações. Correções críticas incorporadas: (a) `public_form` sempre grava numa tabela de destino separada com relação automática ao registro de origem; (b) motor de reserva rejeita sobreposição de datas em tabelas `bookable`. Núcleo desenhado para evoluir a Business Operating System (módulos, construtores visuais, White Label, domínios próprios, marketplace, SDK) sem reestruturar o core.

---

## 0. Diretriz de Desenvolvimento (soberana, obrigatória)

Vale acima de qualquer outra seção. Em caso de conflito entre esta diretriz e qualquer decisão de design, arquitetura, escopo ou implementação sugerida em iteração, **prevalece esta diretriz**.

- **Estritamente técnico e objetivo**: implementar exatamente o que está documentado. Sem interpretações subjetivas, simplificações "de bom senso", mudanças de comportamento, decisões de produto ou alterações de arquitetura não especificadas.
- **Ambiguidade = parada**: diante de ambiguidade, inconsistência ou conflito entre requisitos, o desenvolvimento **é interrompido** e o esclarecimento é solicitado ao usuário antes de qualquer código. Nunca assumir solução por iniciativa própria.
- **Escopo fechado por iteração**: cada iteração entrega apenas o que está listado em seus itens. Novas ideias, refinamentos ou atalhos ficam fora até serem explicitamente aprovados e incorporados ao plano.
- **Critérios inegociáveis por entrega**: corretude, estabilidade, manutenibilidade, segurança, desempenho e compatibilidade com a arquitetura existente. Nenhuma implementação pode comprometer escalabilidade futura, integridade dos dados, interoperabilidade entre módulos ou funcionalidades já existentes.
- **Validação técnica obrigatória antes de fechar etapa**: build, rotas afetadas em light+dark e mobile+desktop, iterações anteriores continuam funcionando (sem regressão), RLS e permissões nos endpoints tocados.
- **Sem "melhorias" implícitas**: refactors, renomeações e otimizações fora do escopo só ocorrem por solicitação explícita.
- **Registro obrigatório de implementações**: toda entrega técnica — iteração completa, correção, migração, nova rota, novo componente compartilhado, novo token — é registrada em `CHANGELOG.md` na raiz do projeto, na mesma edição em que é implementada. Formato: `## YYYY-MM-DD HH:MM (America/Sao_Paulo) — <escopo>` seguido de bullets objetivos do que foi feito. Ordem cronológica decrescente (mais recente no topo). Nenhuma iteração fecha sem entrada correspondente. Sem registro = entrega incompleta (§7, item 8).
- **Consulta obrigatória a iterações anteriores**: antes de iniciar qualquer nova solicitação, revisar `CHANGELOG.md` e as iterações já registradas neste plano. Se a solicitação estiver direta ou indiretamente relacionada a uma iteração/entrega anterior (mesmo módulo, mesma tela, mesmo componente, mesma tabela, mesma decisão de arquitetura), **referenciar explicitamente** a iteração original e tratar a nova solicitação como correção/extensão dela — nunca criar uma iteração paralela que duplique escopo, reintroduza padrões abandonados ou ignore decisões já tomadas. Só criar iteração nova quando o escopo for genuinamente inédito.

---

## Venuespace — Plano de construção

Motor de dados multi-tenant orientado a metadados. Qualquer organização cria suas próprias tabelas/campos/registros sem código, com publicação pública, captação por formulário, chat com propostas, campanhas de arrecadação com confirmação manual e reserva com verificação de conflito de datas. Sem processamento de pagamento.

MVP apenas. Arquitetura preparada para evoluir a Business Operating System sem reestruturar o núcleo.

### Decisões de arquitetura incorporadas

1. **Public form → tabela de destino separada + relação automática.** View `public_form` grava numa `submissions_table_id` distinta da tabela pública; cada submissão nasce com `relation` automática ao registro de origem.
2. **Motor de reserva com verificação de conflito de datas.** Fields `date` marcados `booking_start`/`booking_end`; em tabelas `bookable`, backend rejeita sobreposição com record `deal_status ∈ {accepted, closed}` do mesmo recurso.
3. **Backend**: Lovable Cloud (Supabase) — RLS + `createServerFn` para app-internal, `/api/public/*` para anônimo/token.
4. **Frontend**: TanStack Start v1, shadcn/ui, TanStack Query. Públicas top-level (SSR), autenticadas sob `_authenticated/`.
5. **Papéis** em `memberships(role app_role)` — nunca no perfil. `has_role(user, org, role)` SECURITY DEFINER.
6. **Sem pagamento, sem realtime na v1**: notificação in-app + polling 5s no chat. E-mail via Resend fica no roadmap.
7. **Nome do produto**: Venuespace (títulos, meta tags, marca).

### Modelo de dados (delta sobre o spec)

```
views (id, table_id, name, type, config jsonb, submissions_table_id nullable)
  -- type=public_form → submissions_table_id obrigatório
  -- config.auto_relation_field_id: field relation preenchido automaticamente

fields.config:
  -- booking_role: 'start' | 'end'    (apenas type=date)
  -- resource_relation_field_id       (em tabelas bookable)

tables.bookable boolean default false
```

Demais tabelas (`organizations`, `memberships`, `tables`, `fields`, `records`, `permissions`, `conversations`, `messages`, `lead_access_tokens`) idênticas ao spec original.

### Iterações (escopo fechado)

**1 — Fundação**: Lovable Cloud, migrations (enums, tabelas, RLS, GRANTs, `has_role`), auth e-mail+Google (broker Lovable), trigger `profiles`, layout `_authenticated/`, CRUD `organizations`/`memberships`/`tables`/`fields`, painéis `/app`, `/app/$orgSlug`, `/app/$orgSlug/tables/$tableId/schema`. **Aceite**: cria org, tabela "Imóveis", convida editor. Também nesta iteração: tokens de marca/estado/status de negociação e contribuição criados em `src/styles.css` (light + dark + `@theme inline`); par tipográfico definido e carregado via `<link>` em `__root.tsx`; metas globais atualizadas (Venuespace).

**2 — Records + grid dinâmico**: server fns com validação Zod dinâmica de `data` jsonb contra `fields`, resolver de `computed` (soma, contagem, soma qty×valor) e `relation` na leitura, `DynamicGrid` e `DynamicForm` genéricos, CRUD `views` (grid interna) e `permissions`, publicar/despublicar (`status`), componente `EmptyState` compartilhado. **Aceite (A+D)**: catálogos + orçamento com computed qty×valor.

**3 — Publicação pública + public_form**: `GET /api/public/$slug/$tableId` (server publishable client, política `TO anon` restrita a `status='published'`, projeção via `views.config`), `POST /api/public/$slug/$tableId/submit` (grava em `submissions_table_id`, preenche `auto_relation_field_id`, rate-limit best-effort por IP), submissão anônima (gera `lead_access_tokens`, exige `contact_email`) e autenticada (preenche `applicant_user_id`), `conversation` criada vinculada ao record de submissão, rotas `/public/$slug/$tableId` e `/public/$slug/$tableId/form`. **Aceite (B)**: dois interessados → dois records + duas conversas.

**4 — Chat + propostas + deal_status**: CRUD `messages` (acesso por membership, por token, ou por sessão autenticada), UI com `type='proposal'` + `proposed_value`, `PATCH /records/$id/deal_status` (`negotiating → accepted/declined → closed`; ao fechar copia `agreed_value` da última proposta aceita), rota `/lead/$token`, inbox `/app/$orgSlug/conversations`, polling 5s. **Aceite (C)**.

**5 — Candidatura autenticada + /me/applications**: submissão preenche `applicant_user_id` sem tornar o usuário membro, server fn `getMyApplications` cross-org, rota `/me/applications` sob `_authenticated/`. **Aceite (E)**.

**6 — Campanhas de arrecadação**: convenção "Campanhas" + "Contribuições" (relacionadas), `computed` na campanha soma apenas `contribution_status='confirmed'`, página pública `/public/$slug/campaigns/$recordId` (meta, barra de progresso, chave PIX, formulário via `public_form`), `PATCH /records/$id/contribution_status` restrito a owner/editor, painel do organizador para confirmar recebimentos. **Aceite (F)**.

**7 — Motor de reserva**: detecção via `fields.config.booking_role` + `resource_relation_field_id` em tabela `bookable`, query de conflito, rejeição também na transição para `accepted`, calendário simples de ocupação. **Aceite extra**: locação entre datas rejeita segunda reserva sobreposta.

**8 — Membros + polimento**: `/app/$orgSlug/members` (convite por e-mail, alterar role, remover), notificações in-app (sino) via `messages.read_at`, SEO/OG por rota pública (title/description/og por org + record; og:image apenas em leaf routes com imagem real), landing `/` explicando Venuespace, meta tags globais confirmadas.

### Regras de permissão

owner (total), editor (records + negociação + confirmação de contribuição), viewer (leitura), autenticado não-membro (submeter + próprias submissões + chat), anônimo (ler publicados + submeter em public_form + chat via token).

### Fora de escopo (confirmado)

Pagamento/PIX automático, NF/recibo/contrato, estoque automático, marketplace cross-tenant, white-label, CMS, fórmula livre, automações condicionais, IA generativa de estrutura, realtime via websocket, e-mail transacional (roadmap com Resend).

### Preparado para evoluir sem refazer o núcleo

- **Modularidade**: cada domínio (chat, público, reservas, contribuições) é pacote isolado do core metadata → base para módulos plugáveis.
- **Metadata-first**: tabelas, campos, views, permissões são dado, não código → base para construtores visuais e SDK.
- **`organizations.slug`** é o eixo de tenancy → base para White Label / domínios próprios (mapear `custom_domain → org`).
- **`/api/public/*`** é superfície pública versionada → base para SDK e marketplace.
- **RLS + `has_role` + `permissions`** → autorização declarativa que escala para papéis customizados por módulo.

---

## Design System (obrigatório e vinculante, subordinado à Diretriz §0)

Toda a interface deve usar **exclusivamente shadcn/ui** sobre **Tailwind v4**, com tokens semânticos em `src/styles.css`. Nenhuma tela, funcionalidade ou iteração pode introduzir padrão visual paralelo. Customizações ocorrem por **composição/extensão** dos componentes existentes (via `cva`/variants), nunca por reimplementação. Toda extensão é documentada e reutilizada. Alinha-se com `components.json` já presente (style "new-york", baseColor slate, cssVariables true, iconLibrary lucide) e com o `src/styles.css` atual (oklch + `@theme inline` + `@custom-variant dark`).

### 1. Fundação de tokens (única fonte da verdade)

- Todos os tokens em `src/styles.css` no bloco `@theme inline`, mapeando variáveis declaradas em `:root` e `.dark` — sempre em **oklch**.
- **Proibido hardcode de cor**: nada de `text-white`, `bg-black`, `bg-[#...]`, `border-[color:...]`. Sempre semântico: `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-destructive` etc.
- Tokens adicionais a criar na Iteração 1: `--brand`, `--brand-foreground`, `--brand-glow`, `--gradient-brand`, `--shadow-elegant`, `--surface`, `--surface-foreground`, cores de estado (`--success`, `--warning`, `--info` + `-foreground`) e cores de status (`--status-negotiating`, `--status-accepted`, `--status-declined`, `--status-closed`, `--status-pledged`, `--status-confirmed`) — contraste AA validado em light e dark, registradas em `@theme inline`.
- **Dark mode** obrigatório desde a Iteração 1 (`@custom-variant dark (&:is(.dark *))` já presente); toda cor nova exige valor em `:root` **e** `.dark`.
- Tipografia: par distinto (não Inter/Poppins default). Fontes carregadas via `<link>` em `src/routes/__root.tsx` (nunca `@import` de URL remota em `styles.css` — Lightning CSS não resolve URL e o build cai); expostas como `--font-display` / `--font-body` sob `@theme`.
- Utilities customizadas via `@utility nome { ... }` no topo de `styles.css`, nunca `@layer utilities`.
- Bordas: default de v4 é `currentColor`; usar sempre `border border-border` (ou variante semântica).

### 2. Componentes

- **Origem única**: primitives shadcn/ui em `src/components/ui/*` (Button, Input, Select, Dialog, Sheet, DropdownMenu, Popover, Command, Tabs, Card, Table, Form + react-hook-form + zodResolver, Sonner/Toast, Tooltip, Skeleton, Badge, Avatar, Alert, Calendar, Sidebar, Breadcrumb, Pagination, ScrollArea, Separator, Resizable, Accordion, Collapsible, HoverCard, ContextMenu, NavigationMenu, Progress, Slider, Switch, Checkbox, RadioGroup, Textarea, InputOTP, Chart). Adicionar sob demanda por iteração — nunca em massa.
- **Composições de domínio** em `src/components/{domain}/*` (`DynamicGrid`, `DynamicForm`, `RecordCard`, `ConversationThread`, `ProposalMessage`, `BookingCalendar`, `CampaignProgress`, `PublicRecordHeader`, `EmptyState`, `StatusBadge`) — construídas ENCIMA das primitives, com `cva` para variants e `cn()` (já em `src/lib/utils.ts`) para merge.
- **Ícones**: apenas `lucide-react`.
- **Antes de criar qualquer componente**: verificar se já existe em `src/components/ui/*` ou `src/components/{domain}/*`. Se existir similar, estender via nova variant. Duplicar componente é bug de review.
- **Formulários**: sempre `<Form>` shadcn + `react-hook-form` + `zod`; o **mesmo schema** é reutilizado no server via `createServerFn().inputValidator()`.
- **Feedback**: `sonner` para toast; `AlertDialog` para confirmação destrutiva; `Skeleton` para loading; `EmptyState` padrão para vazio; boundary de erro por rota (padrão TanStack) obrigatório.

### 3. Responsividade (mobile-first, obrigatório)

- **Mobile-first**: base para 360px; breakpoints Tailwind (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`); `useIsMobile()` (já em `src/hooks/use-mobile.tsx`, breakpoint 768) usado para decisões estruturais (cards vs tabela, Sheet vs DropdownMenu).
- **Padrão texto + widgets fixos**: `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between`; texto em container `min-w-0` + `truncate`; ícones/avatares `shrink-0`.
- **Alvos de toque** ≥ 44×44px (`h-11`/`min-h-11`) em ações primárias mobile.
- **DynamicGrid**: modo **cards em mobile** (`<md`), tabela em desktop dentro de `ScrollArea` horizontal quando exceder a largura — nunca overflow horizontal sem `ScrollArea`.
- **Navegação**: `Sidebar` shadcn com `collapsible="icon"` em desktop e `collapsible="offcanvas"` (Sheet) em mobile; `SidebarTrigger` sempre visível fora da sidebar; contêiner sob `SidebarProvider` com `w-full`.
- **Chat, formulários públicos, página de campanha**: single-column em mobile, split/sidebar em `lg+`.
- **Imagens**: `max-w-full h-auto`, `loading="lazy"`, `alt` obrigatório.
- **Teste obrigatório** em 360×640, 768×1024 e 1280×800 antes de fechar iteração (checklist §7).

### 4. Acessibilidade (não-negociável)

- Contraste mínimo AA (4.5:1 texto normal, 3:1 texto grande) em light **e** dark — validar ao criar token.
- Semântica HTML: exatamente um `<h1>` por rota, hierarquia consistente, `<main>`, `<nav>`, `<header>`, `<footer>`.
- Focus visível: `focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` (usar `ring-3` — em v4 `ring` bare é 1px/currentColor). Nunca remover outline sem substituir; usar `outline-hidden` (não `outline-none`) em resets acessíveis.
- `aria-label` em botões só com ícone; `aria-live="polite"` para toasts e novas mensagens do chat; `aria-invalid` + mensagens em campos de Form.
- Teclado em Dialog/Sheet/DropdownMenu/Command herdado do Radix — não quebrar.
- Respeitar `prefers-reduced-motion`: animações não-essenciais desativadas.

### 5. Motion e profundidade

- Animação via `tw-animate-css` (já importado) para entradas/saídas de Dialog/Sheet/Toast; `framer-motion` apenas em landing e página pública de campanha, e apenas quando explicitamente no escopo da iteração. Micro-interações discretas, nunca decorativas.
- Sombra/elevação via tokens (`--shadow-elegant` e utilities semânticas); proibido `shadow-[...]` arbitrário.
- Radius consistente via `--radius` (base) e utilities `rounded-sm/md/lg/xl/2xl`; proibido `rounded-[Xpx]` arbitrário.
- Defaults v4 renomeados a respeitar: `bg-linear-to-r` (não `bg-gradient-to-r`), `shrink-0` (não `flex-shrink-0`), `grow` (não `flex-grow`); tamanhos bare (`shadow`, `rounded`, `blur`) shiftaram — usar nomes explícitos.

### 6. Direção estética do Venuespace

- Tom: **editorial-utilitário**, denso mas respirado — leva a sério a diversidade de casos (imóveis, vagas, campanhas, catálogos) sem parecer template genérico.
- Paleta base definida na Iteração 1 (evitar roxo/índigo padrão de IA); cor de marca única + neutros ricos + estados; validar em dark.
- Tipografia: display distinta para títulos, sans neutra para corpo (par definido na Iteração 1).
- Layouts públicos priorizam legibilidade e OG bem formados; layouts internos priorizam densidade de dados com breathing room.

### 7. Governança (aplicada em toda iteração, gate de fechamento)

- **Toda funcionalidade** começa respondendo: (a) qual primitive shadcn cobre isto? (b) que variant/composição preciso adicionar? (c) o token existe ou precisa ser criado? Só depois escrever JSX. Se qualquer resposta for ambígua → parar e perguntar (Diretriz §0).
- **Novo componente compartilhado** entra em `src/components/{ui|domain}/`, exporta variants via `cva`, aceita `className` + `cn()`, é responsivo por padrão, cobre estados: default, hover, focus-visible, disabled, loading, empty, error.
- **Novo token** entra em `src/styles.css` (light + dark + `@theme inline`) na mesma edição em que é usado — nunca via classe arbitrária.
- **Proibido**: `tailwind.config.js` (v4 é CSS-first), diretivas `@tailwind base/components/utilities`, `@apply` fora de `styles.css` sem `@reference`, `@layer utilities` para custom utilities, classes de cor hardcoded, componentes duplicados, bibliotecas UI concorrentes (MUI, Chakra, Ant, DaisyUI, Mantine, Bootstrap), `@import` de URL remota em CSS.
- **Checklist obrigatório antes de fechar iteração** (bloqueante):
  1. Build passa; typecheck limpo.
  2. Toda tela nova validada em 360 / 768 / 1280 e em light + dark.
  3. Estados verificados: loading, empty, error, disabled, focus-visible.
  4. Nenhuma cor hardcoded, nenhum componente duplicado, nenhum token novo fora de `styles.css`.
  5. Iterações anteriores continuam funcionando (sem regressão); RLS e GRANTs revisados nas tabelas tocadas; endpoints `/api/public/*` sem PII.
  6. Meta tags específicas de rota preenchidas quando a iteração adicionar rotas públicas.
  7. Nenhum item fora do escopo da iteração foi introduzido (Diretriz §0).
  8. `CHANGELOG.md` atualizado com entrada datada (America/Sao_Paulo) cobrindo tudo que a iteração implementou — migrations, rotas, componentes, tokens e correções.

Se qualquer item do checklist falhar, a iteração **não fecha** — corrigir antes de avançar.
