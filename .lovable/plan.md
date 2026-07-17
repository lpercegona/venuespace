## Iteração 15 — Correções: Cards públicos, fluxo sem tabela e editor de blog

### Parte A — Cards públicos de organização renderizando vazio

**Diagnóstico:** `PublicCardBody` monta a grade (4 col) mas nenhum item aparece nas linhas. Os cards em landing/explorar/perfil recebem `layout` (do super admin) + `fields` (builtins + `category_org_fields`) + `data` (org.name, slug, description, logo_url, ...category_data). Como o replay mostra as linhas `.grid.grid-cols-4` sem filhos, a causa é uma das duas:

1. `layout.field_key` aponta para chaves de campos da categoria mas `organizations.category_data` está `{}` para as orgs existentes (retroativo não populou).
2. `formatValue` retorna string vazia para valores `null/""`, e `mediaUrlsFor` filtra URLs de storage não assinadas → item retorna `null` e a linha fica vazia.

**Correções:**

- Em `src/lib/public.server.ts` (`listPublicOrganizations`): ao montar `data`, garantir merge de fallbacks (name/slug/description/logo_url) e preservar `category_data` mesmo quando `null`. Confirmar via consulta se orgs existentes têm `category_data` vazio; se sim, exibir mesmo assim os campos builtin (nome/descrição) sempre que o layout referenciar `field_key` inexistente em `data`.
- Em `src/components/venue/public-card-renderer.tsx`:
  - Quando `raw` é vazio e o `field_key` do layout não corresponde a nenhum campo conhecido, renderizar um placeholder com apenas o ícone + label (mantendo grid) em vez de retornar `null`, para dar feedback visível do layout configurado.
  - Alternativa preferida: renderizar o item somente quando houver conteúdo, mas colapsar a linha ausente para não gerar `<div>` vazio (recomputar rows apenas com items visíveis, preservando `width_percent`).
  - Corrigir: se todos os itens da linha estiverem vazios, não renderizar a linha.
- Adicionar fallback visual: quando o card não tem nenhum item renderizado do layout, exibir descrição da org (mantendo o texto atual como fallback).
- Validar renderização com Playwright em `/`, `/explore` e `/public/$slug`.

### Parte B — Remover páginas que contenham tabela do fluxo público

**Escopo:** Simplificar o fluxo público removendo o conceito de "Tabela/Ambientes" da navegação exposta ao visitante. O fluxo passa a ser **Home → Organização → Registro** (sem passar por tabela).

**Alterações:**

- **Landing (`src/routes/index.tsx`)**: remover a seção "Ambientes publicados" (grid de records) e o card de destaque relacionado a tabelas. Manter apenas "Espaços recentes" (orgs).
- Manter Organizações e Ambientes no /explore Mantendo listagem de perfis e de ambientes.
- **Perfil público da org (`src/routes/public.$slug.index.tsx`)**: continuar listando registros publicados. Os cards devem ir direto para o registro.
- **Rotas de tabela**: manter apenas as rotas de detalhe de registro e API. As rotas de listagem por tabela deixam de ser linkadas na UI pública (mantidas em disco para não quebrar links diretos existentes, mas sem entrada de navegação):
  - `src/routes/public.$slug.$tableId.index.tsx` (rota folha) — remover links de navegação que apontem para ela; nenhum componente público deve gerar essa URL.
  - Confirmar que `PublicHeader` e `BackLink` não expõem link para tabela.
- Atualizar textos que mencionam "tabela/ambiente" para vocabulário neutro do visitante (rótulos configurados pelo super admin já cobrem admin/negócio; público perde a menção).

### Parte C — Página de criação de post do blog não abre

**Diagnóstico a executar em modo build:**

1. Abrir preview autenticado como super admin, ir em `/admin` → aba Blog → "Novo post" com Playwright e capturar console/network para identificar o erro real (rota `/admin/blog/new`).
2. Hipóteses prováveis a checar no código:
  - `TiptapEditor` chamando `useEditor` no primeiro render sem guarda de SSR (layout `_authenticated` é `ssr:false`, mas se `immediatelyRender` estiver default, pode disparar warning/erro em React 19 strict).
  - Import faltante (`@tiptap/extension-image`, `@tiptap/extension-link`) ou versão incompatível.
  - `getBlogPostAdmin` sendo disparado mesmo com `isNew` (não deveria — `enabled: !isNew`), mas se `postId` chegar como string `"new"` e algum outro efeito tentar validar uuid, quebra.
  - Rota `/_authenticated/admin/blog/$postId` matcheando "new" corretamente — verificar que não há conflito com outra rota.

**Correção esperada (a confirmar após diagnóstico):**

- Passar `immediatelyRender: false` para `useEditor` no `TiptapEditor` (compatibilidade React 19/SSR-safe).
- Adicionar `errorComponent`/tratamento visível no route file para não deixar tela em branco em caso de exceção do editor.
- Se o erro for dependência faltando, instalar o pacote correto.
- Garantir que o botão "Novo post" leva a `/admin/blog/new` e que a página renderiza formulário mesmo sem query carregada.

### Parte D — CHANGELOG

Registrar Iteração 15 em `CHANGELOG.md` cobrindo A, B e C.

### Detalhes técnicos

- `PublicCardBody`: nova lógica de agrupamento — filtrar itens vazios antes de montar as rows, mantendo `width_percent` como span.
- `listPublicOrganizations`: garantir que `data` inclui sempre `name`, `description`, `logo_url` mesmo se layout referenciar outra chave, e que campos com `type: image` sem valor não geram slot vazio.
- Explore: remover `zodValidator`/`fallback` da import list se não houver mais search params.
- Blog editor: reproduzir com Playwright em `/admin/blog/new`, coletar erro exato, aplicar patch mínimo.