# Correção/Extensão das Iterações 40 (catálogo de campos) e 3 (formulários públicos) — tabelas de sistema e formulários por tabela

Não é iteração nova: estende escopo já entregue (catálogo global de campos, tabelas padrão por categoria, formulários padrão por categoria).

## 1. "Todos os campos" — colunas

- A coluna **Tipo** deixa de existir; o selo do tipo (e os selos `obrigatório` / `divergente`) passa para a célula **Campo**, ao lado da chave.
- A coluna **Origem** vira **Base**: mostra `Base` quando o campo é base, `—` (ou `Não`) quando não é. O filtro "Todas as origens" sai da barra e é substituído por um filtro **Base / Não base** (o filtro atual "Somente base" dentro de Dependências volta a ser só de dependências).
- A coluna **Categorias** passa a exibir exclusivamente nomes de categoria: `Todas as categorias` quando base, senão a lista (`Espaços, Audiovisual`), e `—` quando nenhuma. A contagem de organizações sai dessa coluna.
- Nova ordem das colunas: **Campo — Categorias — Escopo — Dependências — Ações**.

Arquivo: `src/components/admin/field-catalog-section.tsx`.

## 2. Estrutura > Tabelas — tabelas de sistema editáveis

Hoje "Contatos" e "Reservas de X" nascem de funções no banco (`ensure_contacts_table`, `ensure_bookings_table`) com campos fixos, fora do modelo de categoria. Passam a ser **tabelas-modelo da categoria**, como decidido:

- Migração: novas colunas em `category_standard_tables` — `kind text` (`normal` | `contacts` | `bookings`) e `is_system boolean`. Para cada categoria existente, criar automaticamente o modelo `Contatos` e o modelo `Reservas`, com os campos hoje fixados no código (`contact_company`, `contact_cnpj`, `contact_address`, `__origem`; `booking_start`, `booking_end`, `event_location`, `booking_notes`, `travel_fee`).
- `ensure_contacts_table` / `ensure_bookings_table` passam a materializar a tabela a partir do modelo da categoria (mantendo `system_data.kind` e o vínculo `source_table_id` das reservas), em vez de inserir campos hardcoded. Tabelas já existentes são vinculadas ao modelo por `system_data->>'kind'`.
- `sync_category_standard_tables` passa a sincronizar também esses modelos, para que a edição do super admin retroaja às organizações já criadas.
- Na UI (`StandardTablesSection`), os modelos de sistema aparecem na mesma lista com selo `sistema`: nome, descrição, ícone e **todos os campos** editáveis; slug, `kind`, exclusão e alternância pública/reservável bloqueados (essas tabelas têm papel funcional fixo).
- O editor de campos (`StandardTableFieldsEditor`) já cobre os tipos; campos de sistema com dependência conhecida (`booking_start`, `booking_end`, `travel_fee`, `__origem`) ganham aviso de dependência ao mudar tipo ou remover, no mesmo padrão do catálogo global.

## 3. Formulários a partir de modelos de tabela

Extensão de `StandardFormsSection` / `category_standard_forms`:

- Novo modo de criação: **"A partir de uma tabela padrão"**. Escolhida a tabela-modelo, os campos dela são carregados como linhas do formulário, pré-marcadas.
- Migração em `category_standard_form_fields`: novas colunas `source_standard_field_key text` (chave herdada do modelo de tabela) e `visible boolean not null default true`. Rótulo, ordem e obrigatoriedade continuam editáveis por formulário e sobrepõem o modelo.
- Novo campo em `category_standard_forms`: `target_standard_table_id` — quando preenchido, a submissão grava **na própria tabela** (decisão confirmada), e não em Contatos. `apply_standard_forms_to_org` passa a apontar `views.submissions_table_id` para a tabela da organização instanciada desse modelo; quando vazio, mantém Contatos exatamente como hoje.
- **Campo oculto** (`visible = false`): continua sendo criado/mantido na tabela de destino, mas fica fora de `config.form_field_ids`, portanto não aparece no formulário público nem é aceito na submissão (`loadPublicFormSchema` já filtra por `form_field_ids`).
- Escopo (`organization` / `record`) permanece editável; para escopo `record`, a relação automática ao registro de origem continua sendo criada na tabela de destino.
- UI do editor de campos do formulário: lista com rótulo, chave (somente leitura quando herdada), tipo, obrigatório, ordem e switch **Visível no formulário**; campos avulsos continuam podendo ser criados manualmente.

## 4. Divergências identificadas (tratadas neste plano)

1. Formulário e tabela de destino eram sempre "Contatos" — resolvido pelo `target_standard_table_id`.
2. Campos de formulário eram criados na tabela Contatos mesmo quando conceitualmente pertenciam à tabela de origem — resolvido: os campos passam a ser criados na tabela de destino do formulário.
3. Tabelas de sistema tinham campos definidos em dois lugares (função SQL e catálogo) — resolvido: passam a ter fonte única no modelo de categoria.
4. `__origem` (relação automática) existia só em Contatos — passa a ser criado na tabela de destino de cada formulário de escopo `record`.

Regras de prioridade para não gerar novas divergências: modelo de categoria é fonte da verdade; funções `ensure_*` apenas materializam; sincronização sempre por chave (`field_key` / `system_data.kind`), nunca por id posicional; nenhum dado de registro é apagado em sincronização — campos removidos do modelo saem da estrutura, os valores em `records.data` permanecem intactos.

## 5. Fechamento (§7)

Build e typecheck limpos; validação em 360/768/1280 em light e dark; RLS e GRANTs revisados nas tabelas tocadas; nenhuma rota pública nova (sitemap inalterado); registro em `CHANGELOG.md` como correção/extensão das Iterações 3 e 40.
