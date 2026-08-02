# Iteração 27 — Rótulos por categoria, novo card público e correções de contato

Escopo fechado. Duas partes: **Correção das Iterações 24/26** (ícones de contato e tabs da home) e **Iteração 27** (rótulos por categoria e novo estilo de card).

---

## 1. Correção da Iteração 24 — ícones de contato em perfis sem proprietário

Diagnóstico verificado no banco: as três organizações existentes (Electro Vibe, Ópera Arte, Encontro da Amazônia) têm `system_data` **vazio**. Os campos base de contato (`phone`, `whatsapp`, `email`, `website`) existem na definição, mas nunca foram preenchidos — por isso nada é renderizado. Não há bug de gating: o bloco de contato já fica na coluna direita, mas retorna vazio quando não há dado.

Ajustes:

- Na coluna direita do perfil público, quando não houver proprietário, os ícones (WhatsApp, telefone, e-mail) e o botão "Acessar o site" ocupam o lugar do botão de contato/chat, agrupados em um bloco próprio com título "Contato".
- Leitura dos valores com fallback: `system_data` → `category_data` (mesmas chaves), evitando sumiço quando o dado foi salvo como campo de categoria.
- Quando não houver nenhum dado de contato e nenhum proprietário, exibir aviso curto ("Esta organização ainda não informou canais de contato") em vez de coluna vazia.

## 2. Correção da Iteração 26 — tabs de categoria na home

- Substituir os botões atuais por `Tabs`/`TabsList`/`TabsTrigger` do shadcn (estilo botão segmentado), mantendo scroll lateral em mobile e a sincronização com `?categoria=`.
- Mesmo componente compartilhado continua servindo `/` e `/explore`.

---

## 3. Iteração 27a — Rótulos dinâmicos por categoria

- A aba **Rótulos** do painel admin ganha um seletor no topo: **"Plataforma (global)"** + uma entrada por categoria.
- Ao escolher uma categoria, o super admin edita as mesmas chaves de rótulo; campo vazio = herda o rótulo global.
- Resolução em cascata: rótulo da categoria → rótulo global → fallback embutido.
- Aplicação: páginas públicas **e** painel da organização (a categoria da organização em contexto define os rótulos).

## 4. Iteração 27b — Novo estilo de card público

- Em **Layouts públicos**, por categoria e por escopo (organização / registro), nova opção de **estilo de card**: `Padrão (atual)` ou `Imersivo (imagem de fundo)`.
- No estilo Imersivo, os campos deixam de ter largura livre e passam a ser encaixados em **slots fixos**:
  - `background`: imagem/galeria de fundo (card inteiro)
  - `badge_top_left`: pílula clara com ícone + valor (ex.: "ATÉ 1.000")
  - `badge_top_right`: texto em destaque sobre a imagem (usado no card de registro para o nome da organização)
  - `rating`: valor com ícone de estrela
  - `title`: título grande sobre a imagem
  - `footer`: faixa inferior, com **múltiplos campos ordenáveis** (ícones de comodidades à esquerda, texto à direita, ex.: "Curitiba - Paraná")
- O estilo visual (tipografia, gradiente sobre a imagem, arredondamento, espaçamentos) é fixo; o super admin escolhe apenas **qual campo entra em cada slot** e a ordem dentro do rodapé.
- Card de organização e card de registro usam a mesma mecânica, com os slots do print correspondente.

## 5. Iteração 27c — Respostas plotadas como ícones

- Na definição de campos `select`/`multiselect` (campos de categoria, tabela padrão e formulários padrão), cada opção passa a aceitar um **ícone lucide** opcional.
- Novo modo de exibição por slot: `Somente ícones`, que renderiza apenas os ícones das opções selecionadas, com `title`/`aria-label` do texto da opção.
- Opção sem ícone definido cai no texto normal.

---

## Detalhes técnicos

- **Banco**: nova tabela `category_labels (category_id, key, label, icon)` com GRANTs, RLS (leitura pública, escrita apenas super admin); coluna `card_style text not null default 'standard'` em `category_public_layouts`; ícones por opção gravados em `config.options[].icon` dos campos (sem migração de schema).
- **Backend**: `/api/public/platform-labels` passa a aceitar `?category=<id>`; `listCategoryLayout`/`saveCategoryLayout` passam a ler/gravar `card_style` e slots (`config.slot`, `config.display`); `public.server.ts` expõe `card_style` junto do layout nas rotas públicas.
- **Frontend**: `useLabels(categoryId?)` com cascata; `PublicCardBody` ganha branch `ImmersiveCard`; `CategoryTabs` reescrito sobre `Tabs` do shadcn; `ContactActions` com fallback de dados e bloco próprio na coluna direita.
- **Design system**: nenhum valor de cor novo em hardcode; o gradiente do card imersivo entra como token em `src/styles.css` (light + dark + `@theme inline`).
- **CHANGELOG.md**: uma entrada `Correção das Iterações 24/26` e uma entrada `Iteração 27`.
