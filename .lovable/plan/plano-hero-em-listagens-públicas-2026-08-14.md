# Plano: Hero em listagens públicas

## Objetivo
Inserir um Hero colorido abaixo do header nas páginas `/explore` e `/categoria/$slug`, substituindo o título textual atual, com a frase dinâmica `“{Categoria} do jeito que você busca!”` e a mesma aparência de fundo do Hero da home (`bg-primary`).

## Escopo
- Aplica-se apenas às rotas públicas de listagem: `/explore` e `/categoria/$slug`.
- Mantém o restante do layout (filtros laterais, dock mobile, abas de categoria, paginação).
- Não altera a home nem as páginas individuais de organização.

## Implementação

### 1. Componente `ListingHero`
Criar `src/components/venue/listing-hero.tsx` como componente reutilizável:
- Fundo `bg-primary` (mesmo token do Hero da home).
- Texto `text-primary-foreground`.
- Padding e tipografia alinhados ao Hero da home (`pb-24 pt-[85px]`, título `font-display text-3xl font-semibold sm:text-5xl`).
- Aceita prop `title: string`.
- Sem busca integrada — a busca continua na barra de filtros/sidebar.

### 2. Ajuste em `PublicListing`
Em `src/components/venue/public-listing.tsx`:
- Substituir o bloco de título (`h1` + `description`) por um novo slot `hero?: React.ReactNode`.
- Quando `hero` for fornecido, renderizá-lo no topo da seção, antes do conteúdo restante.
- Preservar `beforeTitle` e `aboveContent` para os casos que ainda os usam.
- Remover props `title` e `description` do uso de listagem com Hero; mantê-las opcionais para compatibilidade com telas que ainda as usarem (se houver).

### 3. Rota `/explore`
Em `src/routes/explore.tsx`:
- Calcular o nome da categoria ativa: `activeCat?.name ?? "Explorar"`.
- Passar `<ListingHero title={`${categoryName} do jeito que você busca!`} />` para o slot `hero` do `PublicListing`.
- Remover o `title="Explorar"` e `description` do `PublicListing`.
- Manter `beforeTitle={<BackLink to="/" label="Início" />}` e as `CategoryTabs` em `aboveContent`.

### 4. Rota `/categoria/$slug`
Em `src/routes/categoria.$slug.tsx`:
- Calcular o nome da categoria: `category?.name ?? "Categoria"`.
- Passar `<ListingHero title={`${categoryName} do jeito que você busca!`} />` para o slot `hero` do `PublicListing`.
- Remover o `title` e `description` atuais.

### 5. Verificações
- Conferir se o Hero não quebra o grid de filtros/cards abaixo (mantém margens e `lg:grid`).
- Validar contraste e responsividade mobile.
- Executar `tsgo` e verificar preview para garantir ausência de regressões.

## Não inclui
- Alteração do Hero da home.
- Mudança nos tokens de cor.
- Novos campos de busca no Hero.
