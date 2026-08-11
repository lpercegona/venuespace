# Correção/extensão da Iteração 32 — reserva multi-item e contato

Escopo: o formulário de nova reserva passa a montar o orçamento a partir dos registros da própria tabela reservável e a vincular um contato (existente ou novo). Não abre iteração nova — é extensão da Iteração 32 (gestão de reservas), que declarou o orçamento multi-item como pendência.

## Estado verificado

- A reserva é hoje um registro da própria tabela reservável (ex.: "Equipamentos", com campos Título, Categoria, Preço, Imagem, Código).
- O formulário atual (`BookingFormDialog`) renderiza todos os campos da tabela; campos de relação aparecem como caixa de texto pedindo UUID.
- O orçamento em PDF soma apenas os campos de moeda do próprio registro (1 item por reserva).
- A organização já tem a tabela de sistema "Contatos" (`system_data.kind = 'contacts'`), hoje sem campos e sem registros.
- O formulário de contato padrão da categoria existe em `category_standard_forms` (escopo organização) com seus campos.

## 1. Itens do orçamento

- O formulário de nova reserva exibe a lista de registros da tabela reservável (título + preço + imagem quando houver), com busca por nome e seleção múltipla (apenas marcar; sem quantidade).
- O total do orçamento é a soma do campo de moeda de cada registro selecionado, exibido em tempo real no rodapé do formulário.
- Os campos próprios da tabela deixam de ser preenchidos manualmente na reserva. Continuam no formulário apenas os campos de período (data de início e data de fim marcados como campos de reserva) e campos que não pertençam ao registro de item — se a tabela não tiver campos de período configurados, o bloco de datas não aparece e a reserva é criada sem período.
- A verificação de conflito de datas passa a rodar **por item selecionado**: se qualquer item já estiver reservado (fechada ou encerrada) em período sobreposto, a criação é bloqueada informando o item e o período conflitante.
- A lista de reservas passa a mostrar os itens da reserva (primeiros nomes + contador) no lugar do "recurso" único.

## 2. Contato da reserva

- Bloco "Contato" no formulário, com duas opções:
  - **Selecionar contato existente**: busca por nome/e-mail na tabela Contatos da organização.
  - **Adicionar novo contato**: abre os campos do formulário de contato padrão da categoria (escopo organização); ao salvar, cria o registro na tabela Contatos e já o seleciona.
- A reserva guarda a relação com o registro de contato (id). Nome/e-mail são exibidos na lista de reservas e usados no orçamento em PDF.
- Se a tabela Contatos ainda não tiver os campos do formulário padrão, eles são criados na primeira utilização, seguindo a definição da categoria (nada é inventado fora dela).

## 3. Orçamento em PDF

- Passa a listar cada item selecionado como uma linha (nome + valor) e o total como soma dos itens.
- O bloco "Contato" do PDF usa os dados do contato vinculado.
- A proposta registrada na conversa continua usando o total, sem mudança no ciclo negociação → fechada → encerrada.

## Detalhes técnicos

- **Sem alteração de schema.** Os itens e o contato são gravados em `records.system_data` (jsonb existente) da reserva: `{ "items": [{ "record_id", "label", "value" }], "contact_record_id": "<uuid>" }`. Nenhuma coluna ou tabela nova.
- **`src/lib/bookings.server.ts`**: novo `loadBookableItems` (registros da tabela reservável com rótulo e valor de moeda), `loadContactMeta` (tabela Contatos + campos do formulário padrão da categoria), `buildQuotePdf` recebendo os itens da reserva.
- **`src/lib/bookings.functions.ts`**: `getBookingContext` passa a devolver itens selecionáveis, contatos existentes e o schema de novo contato; `createBooking` valida itens + contato, roda a checagem de conflito por item e grava `system_data`; nova `createBookingContact` (autenticada, owner/editor) que garante os campos e insere o contato; `listBookings` devolve `items` e `contact`; `generateBookingQuote` monta as linhas a partir de `system_data.items`.
- **UI**: `booking-form-dialog.tsx` reescrito com três blocos (Período, Itens, Contato) sobre primitives já existentes (Command/Popover para busca, Checkbox, Card, Dialog, ScrollArea); novo `src/components/venue/booking-contact-picker.tsx`. Nada de cor hardcoded, tokens semânticos existentes.
- **Governança §0**: validação em 360/768/1280, light+dark, sem regressão nas Iterações 4/5/7/32; entrada no `CHANGELOG.md` como "Correção/extensão da Iteração 32".

## Pendência mantida

- Condição de corrida na checagem de conflito (sem constraint de exclusão no banco) continua como débito técnico da Iteração 7/32.
