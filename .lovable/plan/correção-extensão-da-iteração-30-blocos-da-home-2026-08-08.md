# Correção/Extensão da Iteração 30 — Blocos da home

Escopo: correções de comportamento da Iteração 30 (home configurável) + extensões aprovadas nesta solicitação. Registro no `CHANGELOG.md` como `Correção/Extensão da Iteração 30`.

## 1. Field-keys nos filtros dos blocos (causa raiz verificada)

Os filtros dos blocos passam pela função de avaliação de regras em `src/lib/public.server.ts` (`applyRules`). Verificado no código atual:

- `contains` só funciona quando o valor é string (`typeof raw !== "string"` retorna falso). Campos `multiselect` como "comodidades"/"diferenciais" guardam **array**, então nunca casam.
- `=` / `!=` comparam `String(raw)` contra o valor — em array vira `"a,b,c"`, resultado incorreto.
- Bloco existente hoje usa `{field_key: "diferenciais", operator: "filled", value: "natureza"}`, ou seja o valor é ignorado por `filled`.

Correção: tornar os operadores cientes de array e de booleano.

- `contains` e `=` sobre array: casa se **algum** item do array for igual (case-insensitive) ao valor; `contains` também aceita correspondência parcial no item.
- `!=` sobre array: nenhum item casa.
- `filled` mantém o comportamento atual.
- Valores booleanos aceitam `true/false/sim/não`.

Sem mudança de schema.

## 2. Bloco informativo com as field-keys disponíveis

No editor de blocos (Super Admin > Layout da Home > Blocos), ao lado de "Filtros":

- Botão/ícone de ajuda que abre um popover com a lista **dinâmica** de field-keys utilizáveis, separadas em: campos base da organização (nome, slug, descrição, endereço/cidade/UF, etc.) e campos da categoria (por categoria, com tipo e opções quando `select`/`multiselect`).
- A lista vem de um endpoint público novo que reúne as chaves base + os campos de categoria já existentes, para não duplicar definição no frontend.
- Clique em uma chave preenche o campo `field_key` da regra em edição.

## 3. Sem repetição de organizações na home

Na renderização da home, aplicar deduplicação em cascata: o primeiro bloco fica com seus resultados; blocos seguintes descartam itens já exibidos e completam com os próximos itens ainda não usados. Para isso os blocos de um agrupamento passam a ser carregados em uma única requisição sequencial (server-side), pedindo mais itens do que o limite para permitir a reposição. Se um bloco ficar vazio após a dedup, ele não é renderizado.

## 4. Agrupamentos/categorias vazias não devem aparecer

Causa: as categorias públicas (`/api/public/organization-categories`) são listadas sem verificar se existe organização pública nelas, e os agrupamentos da home são listados sem verificar se produzem itens.

Correção:
- O endpoint de categorias públicas passa a retornar apenas categorias com pelo menos uma organização pública — isso corrige header, tabs da home, `/categoria/$slug` e explorar de uma vez.
- Na home, agrupamento sem nenhum bloco com resultado é ocultado da pill toggle.

## 5. Hero

Remover o botão "Cadastrar meu espaço" do hero da home.

## 6. Novo tipo de bloco: cards genéricos (links)

Novo tipo de bloco `links`, além de `organizations`/`records`:

- Cada item do bloco tem: título, imagem de fundo (upload, mesmo componente de upload já usado no cadastro de organização) e um destino de pré-filtragem.
- Destino: categoria + campo + valor (ex.: `address.city = Curitiba`), gerando link para `/categoria/$slug?f_<campo>=<valor>` (mesma convenção de filtros já usada em explorar).
- Renderização: card com imagem de fundo, gradiente e título sobreposto, na mesma grade dos demais blocos.

## 7. Número de colunas por bloco

Campo "Colunas" no editor do bloco com opções 3 (padrão) e 4, aplicado na grade em desktop (`lg`); mobile continua 1 coluna e `sm` 2.

## Detalhes técnicos

- Migração em `home_blocks`: `block_type text not null default 'query'` (`query` | `links`), `columns smallint not null default 3` com check em (3,4), `items jsonb not null default '[]'` para os cards genéricos. GRANTs/RLS já existentes na tabela permanecem; políticas revisadas para as novas colunas (não exigem mudança).
- `src/lib/home-config.functions.ts`: schemas Zod e DTOs estendidos com `block_type`, `columns`, `items`; leitura pública passa a devolver os novos campos.
- `src/lib/public.server.ts`: `applyRules` com suporte a array/boolean; nova função para carregar os blocos de um agrupamento com dedup.
- Novo endpoint público de metadados de field-keys para o popover de ajuda.
- `src/components/admin/home-blocks-section.tsx`: tipo de bloco, colunas, editor de itens (título, upload de imagem, categoria/campo/valor), popover de field-keys.
- `src/routes/index.tsx`: remoção do botão do hero, grade por `columns`, render de bloco `links`, ocultação de agrupamentos vazios.
- `CHANGELOG.md`: entrada `Correção/Extensão da Iteração 30`.

## Validação

Build + typecheck; home e `/explore` em 360/768/1280, light e dark; bloco com filtro em campo multiselect retornando resultados; agrupamento vazio oculto; nenhuma organização repetida entre blocos.
