# Correção da Iteração 35 (ícones do header) + Iteração 36 (página para empresas)

## 1. Ícone do header (correção da Iteração 35)

Regra atual: fora da home o ícone da direita vira "Início"; em páginas com `showAuthActions={false}` (inclusive `/auth`) nenhum ícone aparece.

Nova regra:

- **Desktop (`sm+`)**: sempre o ícone de login (`CircleUserRound`) apontando para `/auth`, em todas as páginas, sem trocar por casa.
- **Mobile (`<sm`)**: ícone de casa apontando para `/` em todas as páginas que não sejam a home — incluindo `/auth` e demais páginas institucionais. Na home, ícone de login.
- O ícone passa a ser sempre renderizado; `showAuthActions` continua controlando apenas o botão "Cadastrar empresa" (que segue oculto em `/auth`).

Arquivo: `src/components/venue/public-header.tsx`.

## 2. Nova página institucional para donos de empresa

Rota pública nova: `/para-empresas` (link "Para empresas" no `PublicFooter`; o botão "Cadastrar empresa" do header continua indo para `/auth`).

Conteúdo (copy em pt-BR, foco em conversão + SEO):

- **Hero**: H1 "Cadastre seu espaço ou serviço no Venuespace", subtítulo, CTA primário "Cadastrar empresa" (→ `/auth`) e CTA secundário "Ver categorias" (→ `/explore`).
- **Por que estar no Venuespace**: 4 cards (visibilidade em buscas, contato direto sem comissão, agenda e reservas, gestão de propostas e orçamentos).
- **Como funciona**: 4 passos numerados (criar conta → cadastrar organização → publicar espaços/serviços → receber e negociar pedidos).
- **O que você pode publicar**: espaços para eventos, equipamentos e audiovisual, serviços — cada bloco com texto descritivo rico e link para a categoria correspondente.
- **Recursos da plataforma**: lista com página pública própria, galeria de fotos, avaliações, chat com interessados, orçamento em PDF, calendário de reservas.
- **FAQ** (accordion shadcn, 6 perguntas: custo, tempo de aprovação, quem vê meus dados, posso editar depois, como recebo os contatos, posso reivindicar uma página já existente → `contato@venuespace.com.br`).
- **CTA final** com botão para `/auth`.

SEO da rota:

- `head()` próprio: title (< 60 chars), description (< 160), `og:title`, `og:description`, `og:type: website`, `og:url` e `canonical` em `https://venuespace.com.br/para-empresas`.
- JSON-LD `FAQPage` com as mesmas perguntas do accordion + `BreadcrumbList`.
- Um único `<h1>`, hierarquia `h2`/`h3` consistente, `<main>`, `<section>`, links internos para `/explore` e categorias.

## Detalhes técnicos

- Novo arquivo `src/routes/para-empresas.tsx` com `createFileRoute("/para-empresas")`, `PublicHeader` + `PublicFooter`, componentes shadcn já existentes (`Button`, `Card`, `Accordion`, `Badge`) e apenas tokens semânticos — nenhuma cor hardcoded, nenhum token novo.
- `Accordion` será adicionado a `src/components/ui/` caso ainda não exista.
- Sem alterações de backend, migrations ou RLS.
- `CHANGELOG.md` recebe entrada datada cobrindo a correção do header e a nova rota.
- Validação: build/typecheck, rotas em 360/768/1280 em light e dark, e verificação de que as páginas existentes seguem funcionando.
