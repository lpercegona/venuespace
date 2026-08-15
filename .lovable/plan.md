# Correção da Iteração 40 — Aba "Todos os campos": destaque, tabela e campos de organização

Continuação direta da Iteração 40 (catálogo global em Estrutura > Campos). Não é escopo novo.

## O que muda para o usuário

1. **Aba destacada.** O botão "Todos os campos" deixa de ter o estilo das demais abas: texto vermelho (token `destructive`) quando não selecionado; fundo vermelho e texto branco quando selecionado. Reforça que é a zona de risco.
2. **Seletor de categoria oculto.** O `Select` de categoria no topo direito do bloco "Campos padrão por categoria" some enquanto a aba "Todos os campos" está ativa (ele não tem efeito nessa aba). Volta a aparecer nas abas Organização / Tabela / Registro. A área de "Reconciliação retroativa", que também depende da categoria selecionada, fica oculta na mesma condição.
3. **Campos criados dentro de organizações passam a ser editáveis.** O painel recolhível somente-leitura é removido. Essas chaves passam a aparecer na mesma listagem principal, com o mesmo padrão dos demais registros, marcadas com o selo `organização` e a contagem de organizações que usam a chave. Elas entram na busca e em todos os filtros (escopo, categoria, dependência), e ganham um novo filtro de **origem** (Todas / Catálogo / Organização).
   - Editar uma dessas chaves permite: rótulo, tipo, obrigatório, tooltip, ordem, configuração por tipo, escopo único e categorias. Salvar grava a chave no catálogo (escopo + categorias escolhidos) e atualiza rótulo/tipo/config nas linhas já existentes dentro das organizações, mantendo os dados preenchidos.
4. **Visualização em tabela.** Os cards empilhados dão lugar a uma tabela de uma linha por campo, com rolagem horizontal quando necessário. Colunas: Campo (rótulo + chave), Tipo, Escopo, Origem, Categorias, Dependências, Ações. Em telas estreitas a tabela rola lateralmente, sem quebrar em cards.

## Detalhes técnicos

### `src/lib/field-catalog.functions.ts`
- `listFieldCatalog` passa a incluir também as chaves vindas de `public.fields` (via join em `tables.organization_id`) que não existem nas três tabelas de cascata. Cada uma vira um `FieldCatalogEntry` com `origin: "organization"`, `usages: []`, `organizations: number`, escopo inferido (`record`, escopo das tabelas de organização) e dependências pelo mesmo `loadDependencies`.
- Novo campo `origin: "catalog" | "organization"` e `organizations: number` no tipo `FieldCatalogEntry`. Entradas atuais recebem `origin: "catalog"`.
- `applyFieldCatalogEntry` ganha flag opcional `sync_org_fields`: quando verdadeira, além do upsert/delete já existentes, atualiza `label`, `type` e `config` em `public.fields` para aquela `key` (via `supabaseAdmin`, dentro do handler, após a verificação de super admin). Nenhuma linha de dados de registro é tocada.
- `listOrphanOrgFieldKeys` deixa de ser usada pela UI (mantida como export até a limpeza, ou removida junto com o painel).

### `src/components/admin/field-catalog-section.tsx`
- Novo estado `originFilter` e coluna correspondente no `useMemo` de filtragem; campos de origem "organização" respeitam busca, escopo, categoria e dependência.
- Lista renderizada com `Table` do shadcn dentro de um contêiner `overflow-x-auto`; ações (editar/remover) em ícones na última coluna, alvo de toque ≥44px.
- Remoção do bloco `Collapsible` de diagnóstico e da query `admin-field-orphans`.
- Ao salvar um campo de origem "organização", envia `sync_org_fields: true`.

### `src/routes/_authenticated.admin.index.tsx`
- `DefaultFieldsSection`: `Tabs` passa de `defaultValue` para estado controlado (`tab`), permitindo ocultar o `Select` de categoria e o bloco de reconciliação quando `tab === "all"`.
- `TabsTrigger value="all"` recebe classes com tokens semânticos: `text-destructive data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground`. Sem cor hardcoded.

### Fechamento (§7)
Build e typecheck limpos; validação em 360/768/1280 em light e dark; estados loading/empty/error preservados; sem cor hardcoded; nenhuma rota pública nova (sitemap inalterado); registro em `CHANGELOG.md` como correção da Iteração 40.
