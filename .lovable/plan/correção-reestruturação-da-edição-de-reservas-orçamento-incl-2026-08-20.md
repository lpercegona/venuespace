# Correção — Reestruturação da edição de Reservas/Orçamento, inclusão de campo quantidade de itens.

Correção, complementação e reestruturação das Iterações 41 e 43. Escopo restrito ao que está descrito abaixo.

## 1. Seleção de categoria em dropdown, com opção "Padrão"

- A tela do módulo Reservas deixa de listar categorias em cards/linhas com switch e passa a usar um **dropdown de categoria**, no mesmo padrão já usado em Administração → Estrutura.
- A primeira opção do dropdown é **Padrão**: edita o modelo global de orçamento.
- O orçamento **deixa de depender de ativação/desativação**. O switch por categoria sai da tela de orçamento (a ativação do módulo Reservas em si continua existindo na tela de Módulos, mas não bloqueia a geração de orçamento).
- Regra de resolução do modelo na geração do PDF:
  1. modelo salvo da categoria, se existir;
  2. senão, modelo **Padrão**;
  3. categorias sem tabela reservável usam sempre o Padrão.
- Ao abrir uma categoria sem modelo próprio, o editor já carrega uma **cópia do Padrão** para personalizar; só passa a ter modelo próprio ao salvar.

## 2. Edição da categoria em abas superiores

- Abas no topo do bloco de edição: **Formulário** (funções atuais mantidas) e **Orçamento (PDF)**.
- Um **único botão Salvar**, no topo do bloco, que grava de uma vez formulário + modelo de orçamento da categoria (ou do Padrão) selecionada. Os botões Salvar internos do editor de PDF são removidos.

## 3. Nova seção Orçamento (PDF)

- **Estilo por bloco**: cor, tamanho de fonte, largura e alinhamento passam a ser controles do próprio bloco na folha (popover ao focar), gravados no bloco. A área lateral de "Estilo e blocos do documento" (reordenação + visibilidade) é **extinta**.
- **Pré-visualização removida** do painel lateral. Fica apenas um botão **"Ver pré-visualização"**, que gera o PDF real e abre em nova janela.
- **Variáveis viram tooltip/popover** de ajuda dentro da edição, listando as chaves exatamente como devem ser escritas (`{{cliente}}`, `{{total}}`, …), agrupadas por origem, com copiar ao clicar. O painel lateral de variáveis é removido.
- **Novos tipos de bloco** além de texto: **linha (divisória)**, **título** e **tabela** (linhas/colunas editáveis, com variáveis nas células). Todos mantêm a aparência da folha.
- **Todo o documento é editável em HTML**: títulos, seções, linhas, tabela de itens, totais, condições e mensagem final passam a ser blocos editáveis do mesmo modelo — nada mais fica preso em texto fixo do gerador.
- **Header**: mantém o layout estático (logo à esquerda, dados à direita), mas o conteúdo é editável — o super admin adiciona/remove variáveis em cada linha e define se cada linha é **texto** ou **título**.

## 4. Numeração do orçamento

- Formato atual `Orçamento #XXXXXXXX` (8 primeiros caracteres do id) é substituído por `**#DDMMAAAA` + sequência de 2 dígitos**, ex.: `#2008202601`, `#2008202602`.
- Sequência **global da plataforma**, reiniciando a cada dia (fuso America/Sao_Paulo).
- O número é atribuído no momento da geração do PDF e gravado junto ao orçamento em `records.system_data.quotes`, para que reaberturas mostrem o mesmo número. A variável `{{numero}}` passa a usar esse valor.

# 5. Campo de quantidade para itens de registro

- Na edição de campos Administração → Estrutura → Campos e Tabelas , adicionar um novo tipo de campo: quantidade (campo numérico inteiro, valor mínimo 1, valor padrão 1, sem casas decimais).
- O módulo de reservas faz controle de disponibilidade por período (ex.: estoque de equipamentos), o sistema deve verificar se a quantidade solicitada não excede a quantidade disponível para cada período selecionado.
- Todas outras instâncias da plataforma devem receber e interpretar a informação de quantidade.

## Notas técnicas

- **Migração**: `category_pdf_layout.category_id` passa a aceitar `NULL` (linha do modelo Padrão), com índice único parcial garantindo uma única linha Padrão; novos campos de estilo/tipo de bloco em `category_pdf_layout_fields` (`block_type`, `style` jsonb). Nova tabela `quote_counters (day date pk, seq int)` com função `security definer` `next_quote_number()` (atômica, `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`), com GRANT/RLS conforme padrão do projeto.
- **Renderização**: `pdf-layout.ts` ganha os novos tipos de bloco e o header configurável; `bookings.server.ts` (pdf-lib) e a folha HTML continuam consumindo a mesma lista de blocos, para que a edição espelhe a impressão.
- **Resolução do modelo**: `loadCategoryPdfLayout` passa a fazer fallback para o Padrão; `previewBookingQuote` e a geração real usam a mesma função.
- **Salvar unificado**: uma server function grava config do módulo (formulário) e layout do PDF na mesma ação.
- Design System: tokens semânticos, shadcn/ui, mobile-first (folha com rolagem horizontal em telas pequenas); nenhuma cor fixa.
- Validação: build, typecheck, telas em 360/768/1280 em light e dark, geração de orçamento existente sem regressão, RLS revisada.
- `CHANGELOG.md` recebe entrada datada referenciando a Iteração 44.