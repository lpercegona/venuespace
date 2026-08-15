# Correção da Iteração 40 — Escopo único por campo + filtro de categoria

Correção do catálogo global de campos (Estrutura > Campos > "Todos os campos"), entregue na Iteração 40. Não é escopo novo.

## O que muda para o usuário

1. **Escopo único.** No diálogo de edição, o campo deixa de ter interruptores por categoria × escopo. Passa a existir uma escolha única de escopo — **Organização, Tabela ou Registro** — aplicada ao campo inteiro. Abaixo dela, a seleção de categorias vira uma lista simples de marcação (um interruptor por categoria), sempre dentro do escopo escolhido.
2. **Campo base.** Com "Campo base da plataforma" ligado, a seleção de categorias continua desabilitada e o campo é aplicado a todas as categorias — no escopo escolhido.
3. **Troca de escopo.** Ao mudar o escopo de um campo existente, as definições no escopo anterior são removidas e recriadas no novo escopo, nas categorias marcadas. Um `AlertDialog` de confirmação informa quantas categorias serão movidas.
4. **Novo filtro de categoria.** A barra de filtros de "Todos os campos" ganha um seletor de categoria, ao lado de escopo e dependência, listando as categorias existentes e mostrando apenas campos usados na categoria selecionada.
5. **Selo de escopo no card.** Em vez de contagens por escopo (`Organização: 3`, `Tabela: 1`), cada card passa a exibir um único selo de escopo. Campos herdados com mais de um escopo exibem o selo `escopo divergente` e, ao abrir a edição, o escopo predominante vem pré-selecionado — salvar consolida no escopo escolhido.

## Detalhes técnicos

### `src/lib/field-catalog.functions.ts`
- `applyFieldCatalogEntry`: `targets` passa a ser `{ scope, category_ids[] }` (escopo único). O handler faz upsert nas categorias alvo do escopo escolhido e **delete da chave nos outros dois escopos**, garantindo segmentação. Com `is_base = true`, expande para todas as categorias do escopo escolhido.
- `FieldCatalogEntry` ganha `scope: CatalogScope` (escopo predominante) e `scope_divergent: boolean`, calculados na agregação de `listFieldCatalog`.

### `src/components/admin/field-catalog-section.tsx`
- Estado `targets: Set<string>` (chaves `cat::scope`) é substituído por `scope: CatalogScope` + `categories: Set<string>`.
- Seleção de escopo via `RadioGroup` shadcn (3 opções, alvo de toque ≥44px em mobile); lista de categorias em cards com um `Switch` cada.
- Novo `catFilter` no `useMemo` de filtragem, com `<Select>` "Todas as categorias"; grid de filtros passa a `sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]`.
- Card do campo: um `Badge` de escopo + `Badge` destrutivo `escopo divergente` quando aplicável.
- `AlertDialog` de confirmação quando o escopo salvo difere do escopo atual do campo.

### Fechamento (§7)
Build e typecheck limpos; tela validada em 360/768/1280 em light e dark; sem cor hardcoded; nenhuma rota pública nova (sitemap inalterado); entrada em `CHANGELOG.md` como **Correção da Iteração 40**.
