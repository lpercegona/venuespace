# Correções: navegação pública por categoria, busca no admin e textos do Layout 2

## 1. Busca instantânea de organizações (super admin)

Na área de organizações (`/app`), quando o usuário for super admin, exibir um campo de busca acima da grade que filtra a lista carregada por nome, em tempo real (sem submit, sem chamada extra ao servidor). Usuários comuns não veem o campo.

## 2. Header público sem botões

- "Entrar"/"Começar" viram um único ícone de login (sem rótulo), levando a `/auth`.
- O link "Explorar" é substituído por links das categorias que possuem organizações públicas (ex.: Espaços, Audiovisual), destacando a categoria ativa.
- O link "Blog" sai do header e passa para um rodapé público novo, aplicado às páginas públicas (início, categorias, blog, perfis públicos).

## 3. Páginas por categoria

Nova rota dinâmica por categoria (`/categoria/espacos`, `/categoria/audiovisual`), reaproveitando a lógica atual de `/explore`:

- Listagem já filtrada pela categoria da URL, sem seletor de categoria dentro da página.
- Sem alternância Organizações/Registros (mostra apenas organizações por enquanto).
- Busca por texto e filtros dinâmicos mantidos, dispostos em uma única linha no desktop.
- No mobile, busca fica visível e os filtros são agrupados em um dropdown único ("Filtros"), com botão de limpar.
- Paginação e skeletons dinâmicos permanecem como hoje.

## 4. Remoções temporárias

- Bloco "Registros recentes" sai da home (código preservado, apenas não renderizado).
- Botão/abas de alternância Organizações/Registros saem do `/explore`.

## 5. Layout 2 — textos na página de organização

- Abaixo do bloco de contato (coluna direita, e também no bloco mobile): texto em letras miúdas
  "Fotos indexadas de sites de espaços ou de buscadores na internet. Para reivindicar autoria ou solicitar remoção, clique aqui.", com "clique aqui" abrindo e-mail para contato@venuespace.com.br.
- Abaixo de Site/Telefone: "Este espaço é seu? Clique aqui para reivindicar a propriedade e assumir o perfil.", abrindo e-mail para contato@venuespace.com.br com assunto "Reivindicação do espaço {nome do espaço}".

## Notas técnicas

- Arquivos afetados: `src/routes/_authenticated.app.index.tsx` (busca + `amISuperAdmin`), `src/components/venue/public-header.tsx` (ícone de login + categorias), novo `src/components/venue/public-footer.tsx`, nova rota `src/routes/categoria.$slug.tsx`, `src/routes/explore.tsx` e `src/routes/index.tsx` (remoções), `src/components/venue/organization-page-immersive.tsx` (textos e mailto).
- As categorias do header usam o mesmo endpoint público já existente de categorias, filtrando as que têm organizações públicas.
- Sem alterações de banco de dados; a correção não abre nova iteração e será registrada no `CHANGELOG.md`.
