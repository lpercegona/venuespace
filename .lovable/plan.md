# Correção/extensão da Iteração 32 — dados do cliente no orçamento e valor de deslocamento

Escopo fechado: (A) empresa, CNPJ e endereço do cliente no cadastro de contatos e no PDF; (B) valor de deslocamento na reserva, somado ao total e exibido no orçamento.

## Estado verificado

- O PDF hoje mostra no cabeçalho o nome e o CNPJ da **organização emissora** (`organizations.system_data.quote`), e no bloco "Dados do cliente e evento" apenas Cliente (nome/e-mail do contato), Local de instalação, Data de emissão e Validade.
- A tabela **Contatos** de cada organização tem hoje apenas campos genéricos vindos do formulário padrão da categoria (`formulario_teste`, `campo_de_form_do_registro`, `__origem`) — não existe empresa, CNPJ nem endereço.
- A tabela de reservas (`ensure_bookings_table`) tem os campos `booking_start`, `booking_end`, `event_location`, `booking_notes`. Não há campo de deslocamento.
- O total do orçamento é a soma dos itens (`itemTotal`), usado também como valor da proposta na conversa.

## A. Dados do cliente

### A1. Novos campos no cadastro de contatos

- A tabela Contatos passa a ter três campos próprios da organização (não vindos da categoria, portanto preservados nas sincronizações do super admin):
  - **Empresa / Razão social** (texto)
  - **CNPJ** (texto)
  - **Endereço do cliente** (texto longo)
- Criados para todas as organizações existentes e automaticamente para novas organizações.

### A2. Contatos editáveis como as demais tabelas

- A tabela Contatos deixa de ser bloqueada para gestão de campos: owner/editor pode adicionar, renomear, reordenar e remover campos próprios, e editar os registros de contato, exatamente como nas tabelas de ambientes/equipamentos.
- Continuam protegidos: a tabela não pode ser tornada pública, não pode ser excluída, e os campos que vêm do formulário padrão da categoria continuam sob controle do super admin.

### A3. Formulário de reserva

- O bloco "Contato" (novo contato) passa a exibir também Empresa, CNPJ e Endereço, junto dos campos do formulário padrão.
- Ao selecionar um contato existente, os dados de empresa/CNPJ/endereço são apenas exibidos (a edição acontece no cadastro do contato).

### A4. PDF

O bloco "DADOS DO CLIENTE E EVENTO" ganha as linhas, quando preenchidas:
- **Cliente:** nome (e-mail)
- **Empresa:** razão social
- **CNPJ:** documento do cliente
- **Endereço:** endereço do cliente
- **Local de Instalação**, **Data de Emissão** e **Validade** permanecem como estão.

## B. Valor de deslocamento

- Novo campo **Deslocamento** (moeda) na tabela de reservas, criado para as tabelas de reserva existentes e para as novas.
- No formulário de nova reserva/edição, campo de valor logo abaixo dos itens; o rodapé passa a mostrar Subtotal dos itens, Deslocamento e Total.
- O total da reserva = soma dos itens + deslocamento. É esse total que vai para a proposta registrada na conversa e para `agreed_value` no fechamento.
- No PDF, após a tabela de itens: linha **Subtotal dos itens**, linha **Deslocamento** e, por último, **Valor Total do Orçamento (N diárias)**. Quando o deslocamento for zero, o comportamento atual (apenas o total) é mantido.

## Detalhes técnicos

- **Migração**: `ensure_contacts_table` passa a garantir os campos `contact_company`, `contact_cnpj`, `contact_address` com `source = 'local'` (imunes à limpeza de campos órfãos de categoria em `apply_standard_forms_to_org`); `ensure_bookings_table` passa a garantir `travel_fee` (currency). Bloco de backfill para as tabelas de Contatos e de Reservas já existentes. Sem novas tabelas ou colunas.
- **Server**: `src/lib/bookings.server.ts` — `QuoteInput` ganha `clientCompany`, `clientCnpj`, `clientAddress` e `travelFee`; `buildQuotePdf` renderiza as novas linhas do bloco de cliente e o par subtotal/deslocamento; `loadContacts`/`contactLabel` passam a devolver também os dados de empresa. `src/lib/bookings.functions.ts` — `getBookingContext` inclui os campos novos no schema de contato; `createBooking`/`updateBooking` gravam `travel_fee` em `records.data`; `generateBookingQuote` soma o deslocamento no total da proposta.
- **UI**: `booking-form-dialog.tsx` ganha o campo de deslocamento e o rodapé com subtotal/deslocamento/total; `booking-contact-picker.tsx` exibe e coleta empresa/CNPJ/endereço; a área de tabelas libera a edição de campos da tabela Contatos (`orgs.functions.ts` mantém apenas as travas de visibilidade pública).
- **Governança §0**: validação em 360/768/1280, light+dark, sem regressão nas Iterações 7/32; entrada em `CHANGELOG.md` como "Correção/extensão da Iteração 32".
