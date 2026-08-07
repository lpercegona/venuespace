# Iteração 30 — Home configurável, páginas institucionais e ajustes de ordenação

Escopo fechado. Referências: Iteração 25 (acesso do super admin às organizações), Iteração 27 (rótulos/ícones de opções), Iteração 28 e correções (layouts públicos), correções de navegação pública (header/footer/`/categoria/$slug`).

## 1. Ordenação alfabética

- Listagem de organizações no painel (`/app`, visão do super admin e do usuário comum): ordenar por nome (A–Z, locale pt-BR, case-insensitive), substituindo a ordem por data de criação.
- Ícones de opções (comodidades) nos cards públicos: renderizar as opções em ordem alfabética do rótulo da opção, tanto no card padrão quanto no imersivo.

## 2. Seletor de organização no header administrativo

- No `AppShell`, quando nenhuma organização estiver selecionada, o gatilho passa a exibir apenas o ícone (sem o texto "Selecionar organização"), com `aria-label` descritivo e alvo de toque adequado. Com organização selecionada, o nome continua visível em largura fixa, truncando com reticências (…) quando exceder.

## 3. Novas páginas públicas + links no rodapé

Cinco rotas públicas novas, com cabeçalho e rodapé padrão, `<h1>` único, meta tags próprias e conteúdo placeholder curto (título + parágrafo indicativo para preenchimento posterior):

- `/termos-e-condicoes` — Termos e Condições
- `/politica-de-privacidade` — Política de Privacidade
- `/contestacao-de-espacos` — Contestação dos Espaços

O `PublicFooter` passa a listar esses cinco links + Blog, agrupados em colunas responsivas (coluna única em mobile).

## 4. Blocos dinâmicos da home (Super Admin)

Nova aba **Blocos da home** dentro de "Layout público". O super admin cria, ordena, ativa/desativa e remove blocos. Cada bloco tem:

- Título editável (ex.: "Espaços mais procurados", "Comportam mais de 200 pessoas").
- Fonte: organizações ou registros.
- Regra por campo: campo + operador (`=`, `≠`, `>`, `≥`, `<`, `≤`, `contém`, `preenchido`) + valor. Permite combinar mais de uma regra (E).
- Limite de cards e ordem de exibição.
- Presets rápidos para criar de uma vez os blocos por cidade (Curitiba, São Paulo, Porto Alegre, Florianópolis), cada um com filtro `cidade = <valor>` e link "Ver todos" que abre a listagem da categoria já pré-filtrada.

Os blocos são vinculados a um **agrupamento** (ver item 5), não a uma categoria isolada.

## 5. Agrupamentos da home ("Espaços" / "Fornecedores")

- Novo conceito de agrupamento: um termo com rótulo, slug e conjunto de categorias que ele carrega. Ex.: "Espaços" → categoria Espaços; "Fornecedores" → Audiovisual (todas as categorias que não sejam Espaços).
- O super admin define os agrupamentos e associa blocos da home a cada um.
- A home renderiza o alternador em pill toggle com os agrupamentos; ao alternar, troca tanto o filtro das listagens quanto o conjunto de blocos exibidos.

## 6. Home conforme o print

Alterações visuais em `/`:

- **Header**: logo à esquerda; ao centro um item único "Explore" com ícone de bússola que abre dropdown com as categorias (substitui os links soltos de categoria); à direita botão pill "Cadastrar empresa" + ícone de conta (login) sem rótulo.
- **Hero**: faixa de fundo na cor de marca ocupando toda a largura, título display centralizado em três linhas, texto em cor de contraste sobre a marca.
- **Alternador**: pill toggle centralizado abaixo do título, com fundo claro e item ativo em destaque (Fornecedores | Espaços).
- **Painel de conteúdo**: container claro com cantos superiores arredondados grandes, sobreposto ao fim do hero, contendo os blocos.
- **Blocos**: título com ícone à esquerda e link "Ver todas" à direita; grade de 3 colunas em desktop, 2 em tablet, 1 em mobile (mantendo os cards atuais).
- Todos os valores de cor via tokens semânticos; validação em light/dark e em 360/768/1280.

## Detalhes técnicos

- Migração: tabelas `home_groupings` (rótulo, slug, ordem, ativo), `home_grouping_categories` (relação com `organization_categories`) e `home_blocks` (agrupamento, título, fonte, regras jsonb, limite, ordem, ativo), com GRANTs, RLS (leitura `anon`/`authenticated`; escrita restrita a super admin) e seed dos agrupamentos Espaços/Fornecedores.
- Endpoints: `GET /api/public/home-config` (agrupamentos + blocos) e extensão de `/api/public/organizations` e `/api/public/records` para aceitar as regras de filtro dos blocos (whitelist de operadores, validação Zod, limites máximos).
- Server functions autenticadas para CRUD dos agrupamentos e blocos, com verificação de super admin.
- Ordenação alfabética aplicada em `listMyOrganizations` e no agrupamento de ícones em `public-card-renderer.tsx`.
- `CHANGELOG.md` recebe a entrada datada da Iteração 30 na mesma edição.
