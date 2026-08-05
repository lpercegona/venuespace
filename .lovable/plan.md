# Correção/extensão das Iterações 18 e 22/23/27

Duas frentes: (1) descrição da organização com editor de texto limitado e limite de 2500 caracteres; (2) prefixo configurável nos campos do layout público dos cards.

## 1. Descrição da organização (extensão da Iteração 18)

Hoje a descrição é um `Textarea` simples com limite de 500 caracteres validado no servidor, exibida como texto puro no perfil público (Layout 1 e Layout 2).

O que muda:
- Editor limitado com três recursos apenas: **texto normal**, **título (renderiza `h4`)** e **lista com bullets** — reaproveitando o editor já existente do blog (Tiptap), configurado com esse conjunto reduzido de botões (sem imagem, link, citação, H2/H3, numerada).
- Limite de **2500 caracteres** contados sobre o texto puro (sem as marcações), com contador visível e bloqueio ao salvar quando excedido.
- Conteúdo salvo como HTML sanitizado no mesmo campo de descrição; a sanitização permite apenas `p`, `h4`, `ul`, `li`, `strong`, `em`, `br`.
- Onde a descrição aparece hoje como texto puro (meta tags, subtítulo de painéis, cards), passa a usar a versão convertida em texto para não exibir marcação.
- Nas páginas públicas (Layout 1 e Layout 2) a descrição passa a renderizar a formatação, com estilos de título `h4` e bullets alinhados aos tokens do design system.
- Descrições existentes em texto puro continuam funcionando (são exibidas como parágrafos).

## 2. Prefixo nos campos do layout público (extensão das Iterações 22/23/27)

Hoje cada campo do layout do card já aceita rótulo alternativo, ícone, largura, estilo e (no card imersivo) posição/apresentação. Falta um prefixo antes do valor.

O que muda:
- Nova coluna **Prefixo** na tabela de configuração de campos do card de organização e do card de registro, no painel do super admin.
- O prefixo é salvo junto da configuração do campo e vale para os dois estilos de card (padrão e imersivo).
- Na renderização, o prefixo aparece entre o ícone e o valor. Exemplo: ícone de pessoas + `ATÉ` + `120`.
- O prefixo só é exibido quando o campo tem valor preenchido; campos vazios continuam ocultos.
- Também vale para os slots do card imersivo que exibem texto (selo, topo direita, localização, título), e é ignorado em campos de imagem/galeria.

## Detalhes técnicos

- `src/lib/orgs.functions.ts`: limite de `description` passa de 500 para 2500 caracteres na criação e atualização, validando o comprimento do texto puro e sanitizando o HTML no servidor.
- Novo módulo de sanitização de descrição (reaproveitando `sanitize-html` já instalado) com allowlist reduzida; `htmlToText` reutilizado para metas e cards.
- `src/components/venue/edit-org-dialog.tsx` (e o formulário de criação de organização, se aplicável): substituir o `Textarea` por um editor reduzido baseado em `src/components/venue/tiptap-editor.tsx`, com prop de conjunto de botões restrito e contador de caracteres.
- Renderização: `src/routes/public.$slug.index.tsx` e `src/components/venue/organization-page-immersive.tsx` passam a renderizar HTML sanitizado dentro de um bloco com classes tipográficas do design system.
- Prefixo: adicionar `prefix` ao `EditorRow`/payload salvo em `category_public_layout_fields.config` (JSON — sem migração de banco) em `src/routes/_authenticated.admin.index.tsx` e `src/lib/category-layouts.functions.ts`; aplicar em `src/components/venue/public-card-renderer.tsx` no ponto onde o valor formatado é montado (grid padrão e slots imersivos).
- Sem novos tokens; sem cor hardcoded.
- `CHANGELOG.md` atualizado como correção/extensão das iterações citadas, conforme §0.

## Validação

- Build e typecheck limpos.
- Perfil público em 360 / 768 / 1280, light e dark, com descrição contendo título, parágrafo e bullets.
- Card público com prefixo configurado em ambos os estilos, verificando que campos vazios não exibem o prefixo.
- Iterações anteriores sem regressão (cards, galeria, tooltips, formulários).
