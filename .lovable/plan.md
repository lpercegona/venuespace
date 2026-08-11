# Correção/extensão das Iterações 26, 30 e 31 — busca instantânea, paginação, header e nova navegação do admin

Entrega registrada como **Correção/extensão** (escopo já existente: página de categoria/explorar da Iteração 26/30, header público da Iteração 31, painel do super admin das Iterações 9–30). Sem nova numeração de iteração.

## 1. Busca instantânea e filtros em dropdown

- A busca das páginas `/categoria/$slug` e `/explore` passa a filtrar conforme se digita (debounce de 300 ms), atualizando a URL sem recarregar a listagem inteira; o botão "Buscar" deixa de ser necessário e é removido.
- Resultados anteriores continuam visíveis enquanto a nova busca carrega (sem piscar skeleton a cada tecla).
- Em desktop os filtros deixam de ficar soltos na linha e passam a ficar agrupados num único dropdown "Filtros" (mesmo componente hoje usado no mobile), com contador de filtros ativos e ação "Limpar".

## 2. Paginação da página explorar

Causa raiz confirmada: a paginação grava `page` como texto na URL (`String(page + 1)`), enquanto o schema de validação espera número — o valor inválido cai no fallback `1`, então a página nunca avança. Correção: gravar `page` como número em `/explore` e em `/categoria/$slug` (mesmo defeito nas duas rotas), e voltar a página para 1 ao mudar busca ou filtro.

## 3. Header público

- Logo passa a ser SVG inline com cor herdada: branca sobre o fundo colorido do topo da home e na cor de marca sobre o fundo cinza claro.
- "Cadastrar empresa" sai do centro e passa a ficar imediatamente ao lado do ícone de login, à direita (mobile e desktop). "Explore" permanece à esquerda.

## 4. Tela de administração — nova navegação e estilo

**Sidebar com 4 grupos** substituindo a fila horizontal de abas:

- Configurações: Geral, Rótulos
- Estrutura: Categorias, Campos, Tabelas, Formulários, Agrupamentos
- Layout: Filtros públicos, Layout público, Seções home (antigo "Blocos da home")
- Conteúdo: Blog, Avaliações

Dentro de cada página, os itens do grupo aparecem como **toggle segmentado** (trilha branca arredondada com pílula roxa deslizante), não mais abas sublinhadas.

**Topbar**

- "VENUESPACE" vira seletor de organização com dropdown (ícone + nome + seta), absorvendo o botão de prédio isolado que hoje fica ao lado do avatar — a duplicidade é eliminada.
- Barra de busca central "Buscar organizações", com a mesma filtragem instantânea por nome já usada na lista de organizações do super admin; ao selecionar, navega para a organização.
- Item de menu do perfil "Minhas candidaturas" passa a se chamar "Interações".

**Estilo**

- Pill total no botão "Salvar" e no item ativo do menu lateral.
- Cantos suavemente arredondados (não pill) em inputs e selects.
- Sombra leve em cards, aba ativa e item de menu ativo.
- Mais contraste no fundo dos ícones.
- Título "Configurações da instância" com subtítulo "Ajustes globais que valem para todas as organizações." e botão "Voltar" no canto superior direito mantidos.
- Abaixo de 860px a sidebar vira menu hambúrguer com abertura lateral.

## Detalhes técnicos

- `src/routes/explore.tsx` e `src/routes/categoria.$slug.tsx`: `page` numérico no `navigate({ search })`; hook local de debounce; `placeholderData: keepPreviousData` nas queries; extração do bloco de filtros para um componente compartilhado `src/components/venue/public-filter-bar.tsx` (Popover em todos os breakpoints).
- `src/components/venue/venuespace-logo.tsx`: SVG inline com `fill="currentColor"`; `public-header.tsx` aplica `text-primary-foreground` / `text-primary` conforme `onHero`, e reordena o grid para `[Explore | espaço | Cadastrar + Login]`.
- Admin: `src/routes/_authenticated.admin.index.tsx` passa a usar `SidebarProvider`/`Sidebar` (`collapsible="offcanvas"` abaixo de 860px) com estado de seção em search param (`?sec=`), preservando integralmente as seções já existentes (`GeneralSection`, `LabelsSection`, `CategoriesSection`, `DefaultFieldsSection`, `StandardTablesSection`, `StandardFormsSection`, `FilterFieldsSection`, `LayoutsSection`, `HomeGroupingsSection`, `HomeBlocksSection`, `BlogSection`, `ReviewsSection`) — sem alterar sua lógica.
- Novo `src/components/venue/segmented-toggle.tsx` (cva + tokens) para o toggle segmentado.
- `src/components/venue/app-shell.tsx`: seletor de organização unificado com a marca, campo de busca de organizações (visível para super admin), rótulo "Interações".
- Tokens de sombra/arredondamento existentes em `src/styles.css`; qualquer token novo é criado lá em light + dark + `@theme inline`. Sem cores hardcoded.
- `CHANGELOG.md` recebe entrada datada identificando a correção e as iterações de origem.
