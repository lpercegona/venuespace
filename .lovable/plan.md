## Causa raiz

O arquivo `src/routes/public.$slug.$tableId.tsx` é, na convenção do TanStack Router com nomes dot-separated, o **layout pai** de `public.$slug.$tableId.$recordId.tsx` (detalhes) e `public.$slug.$tableId.form.tsx` (formulário de interesse). Confirmado em `routeTree.gen.ts` (`getParentRoute: () => PublicSlugTableIdRoute`).

Hoje esse arquivo renderiza a **listagem inteira** e **não tem `<Outlet />`**. Regra do TanStack: quando um pai tem filhos, o componente do pai precisa renderizar `<Outlet />` — caso contrário a rota filha casa, mas nada da filha aparece na tela. Por isso os cliques em "Ver detalhes" e "Manifestar interesse" mudam a URL mas o usuário continua vendo a listagem (ou uma tela vazia dependendo do timing).

APIs `/api/public/...` respondem 200 corretamente (testado); o problema é 100% de composição de rotas.

## Correção

1. **Transformar o pai em layout puro** — `src/routes/public.$slug.$tableId.tsx` passa a ter apenas:
   ```tsx
   export const Route = createFileRoute("/public/$slug/$tableId")({
     component: () => <Outlet />,
   });
   ```
   Removendo `head`, hooks e todo JSX de listagem.

2. **Mover a listagem para a rota índice** — criar `src/routes/public.$slug.$tableId.index.tsx` contendo o `PublicListPage` atual (mesmo componente, mesmo `useQuery`, mesmo JSX), com seu próprio `head()` (título/description da tabela). Como é a index do pai, responde exatamente a `/public/:slug/:tableId` sem quebrar links existentes.

3. **Sem outras mudanças** — os arquivos `public.$slug.$tableId.$recordId.tsx` e `public.$slug.$tableId.form.tsx` já estão corretos; passarão a renderizar dentro do `<Outlet />` do novo layout.

4. **Verificação pós-build**
   - Typecheck (`tsgo --noEmit`).
   - Percurso manual via preview: listagem → clicar em "Ver detalhes" (detalhe carrega) → voltar → clicar em "Manifestar interesse" (formulário carrega com campos vindos de `/api/public/form-schema/:viewId`).

5. **CHANGELOG.md** — entrada objetiva: "Fix: rota pai `public/$slug/$tableId` sem `<Outlet />` impedia render das rotas filhas (detalhes/formulário). Convertida em layout; listagem movida para `.index.tsx`."

## Fora de escopo
Nenhuma alteração em API pública, RLS, estilos, ou lógica de submissão — a raiz é estritamente a hierarquia de rotas.