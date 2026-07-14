## Escopo

1. **Header público reutilizável** em todas as rotas públicas.
2. **Botão "Voltar"** nas páginas de detalhe/instância.
3. **Formulário de interesse sempre como modal flutuante** (nunca página cheia).

## 1. Componente `PublicHeader`

Novo `src/components/venue/public-header.tsx`:
- Marca "Venuespace" à esquerda (link para `/`).
- Nav central: `Explorar` (`/explore`).
- Ações à direita: `Entrar` e `Começar` (ambas → `/auth`).
- Prop opcional `back?: { to: string; params?: any; label?: string }` renderizando um botão com ícone `ArrowLeft` antes da marca. Quando ausente, sem botão.
- Sticky, `border-b`, tokens semânticos (`bg-surface/80 backdrop-blur`), responsivo mobile-first (menu colapsa itens não-essenciais em `<sm`).

## 2. Aplicar em todas as rotas públicas

Substituir/complementar o `<header>` local por `<PublicHeader />` em:

- `src/routes/index.tsx` — troca o header inline pelo componente.
- `src/routes/explore.tsx` — idem.
- `src/routes/public.$slug.$tableId.index.tsx` — adiciona `PublicHeader` acima do header contextual da tabela (sem back — é topo do fluxo público daquela tabela).
- `src/routes/public.$slug.$tableId.$recordId.tsx` — `PublicHeader` com `back` para `/public/$slug/$tableId`.
- `src/routes/public.$slug.campaigns.$recordId.tsx` — `PublicHeader` com `back` para `/` (não há listagem pública de campanhas; alternativa: `/explore`).
- `src/routes/lead.$token.tsx` — `PublicHeader` sem back (thread do lead é destino final).
- `src/routes/auth.tsx` — `PublicHeader` sem os botões `Entrar/Começar` (variante `minimal` via prop `showAuthActions=false`).

O botão voltar usa `<Link>` tipado do TanStack (`to` + `params`), nunca `history.back()` — mantém preload e evita quebrar entrada direta por URL.

## 3. Formulário de interesse como modal

- Novo `src/components/venue/interest-form-modal.tsx`:
  - Props: `open`, `onOpenChange`, `slug`, `tableId`, `viewId`, `recordId?`.
  - `Dialog` shadcn com `max-w-2xl`, `ScrollArea` interno para telas pequenas.
  - Move para dentro do modal a lógica atual de `public.$slug.$tableId.form.tsx`: `fetchFormFields(viewId)`, campos `contact_name`/`contact_email`, `DynamicForm` e `handleSubmit` que chama `/api/public/:slug/:tableId/submit`.
  - Ao sucesso: `toast` + fecha modal + navega para `/lead/$token` quando o backend retornar token; caso autenticado (sem token), fecha e mostra toast "Enviado — acompanhe em Minhas candidaturas".
  - Loading via `Loader2`; erro via `EmptyState` dentro do modal.

- Pontos de uso (substituem o `<Link to="/public/$slug/$tableId/form">`):
  - Listagem pública (`public.$slug.$tableId.index.tsx`): botão "Manifestar interesse" em cada card abre o modal com `recordId` daquele card.
  - Detalhe do registro (`public.$slug.$tableId.$recordId.tsx`): CTA principal abre o modal com o `recordId` da rota.
  - Página de campanha (`public.$slug.campaigns.$recordId.tsx`): botão "Contribuir" continua fluxo próprio (fora do escopo desta iteração); nada muda ali.

- Rota antiga `public.$slug.$tableId.form.tsx`: mantida como fallback compatível (deep link) mas passa a renderizar o mesmo `InterestFormModal` com `open=true` sobre um shell mínimo (header + card resumido), para que URLs antigas continuem funcionando. Não redireciona.

## 4. Notas técnicas (para revisão)

- `PublicHeader` importa apenas do `@tanstack/react-router` (`Link`) e primitives shadcn — nenhum estado global.
- O modal usa `Dialog` + `DialogContent`; foco inicial no primeiro campo; `aria-describedby` no título.
- Nenhuma mudança de esquema, RLS ou endpoint. Nenhum novo token de cor.
- Iterações 3–6 (submissão pública, campanhas, chat) continuam funcionando: mesmos endpoints, mesmos payloads.
- Checklist §7 aplicável: build + typecheck, 360/768/1280 em light+dark, sem hardcode de cor, CHANGELOG atualizado.

## Arquivos

Criar:
- `src/components/venue/public-header.tsx`
- `src/components/venue/interest-form-modal.tsx`

Editar:
- `src/routes/index.tsx`
- `src/routes/explore.tsx`
- `src/routes/public.$slug.$tableId.index.tsx`
- `src/routes/public.$slug.$tableId.$recordId.tsx`
- `src/routes/public.$slug.campaigns.$recordId.tsx`
- `src/routes/lead.$token.tsx`
- `src/routes/auth.tsx`
- `src/routes/public.$slug.$tableId.form.tsx` (thin wrapper de compat)
- `CHANGELOG.md`
