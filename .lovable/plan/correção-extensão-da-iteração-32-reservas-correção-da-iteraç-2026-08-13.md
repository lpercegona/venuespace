# Correção/extensão da Iteração 32 (reservas) + correção da Iteração 33 (busca mobile)

Escopo fechado. Duas frentes independentes: (A) reservas — separação, formulário e orçamento em PDF; (B) busca/filtros públicos em mobile. Nenhum item fora do listado abaixo.

---

## A. Reservas

### A1. Reservas apartadas da listagem de registros

Hoje a reserva nasce como um registro da própria tabela reservável, então ela aparece misturada ao catálogo e é interpretada como reserva por heurística (`system_data.items` ou `deal_status != none`).

Passa a existir, por tabela reservável, uma **tabela de reservas dedicada** criada automaticamente na primeira vez que a área de Reservas abre a tabela:

- Nome: `Reservas de <Nome da tabela>`, `is_system = true`, `is_public = false`, `is_locked = true`, `system_data = { kind: 'bookings', source_table_id: <id da tabela reservável> }`.
- Campos: início e término do período (data/hora) + observações gerais da reserva.
- A tabela reservável volta a ser **apenas catálogo**: seus registros nunca recebem `deal_status`, itens ou conversas.
- A área de Reservas lê exclusivamente a tabela de reservas; a listagem de registros da tabela reservável passa a ocultar tabelas `kind='bookings'` do menu de tabelas.
- **Migração de dados**: registros existentes da tabela reservável que hoje são reservas (têm `system_data.items` ou `deal_status != 'none'`) são movidos para a nova tabela de reservas, preservando `deal_status`, `agreed_value`, `system_data` e as conversas vinculadas (o `record_id` não muda, apenas o `table_id`).

### A2. Nova reserva — itens disponíveis para a data

- O formulário passa a exigir o período **antes** da lista de itens.
- Com o período preenchido, a lista mostra apenas os itens **livres** no período (sem sobreposição com reserva `accepted`/`closed`), com opção de exibir também os ocupados marcados como indisponíveis (não selecionáveis).
- Ao alterar o período, a lista é recalculada e itens que ficaram indisponíveis são desmarcados com aviso.

### A3. Campos do formulário de reserva

Cada item selecionado abre uma linha com:
- **Observações do item** (texto livre, aparece sob a descrição no PDF).
- **Cortesia** (texto curto opcional, renderizado como selo no PDF, como no anexo).
- **Desconto** com seletor **R$ / %**, aplicado sobre o subtotal do item.
- **Valor diária** (herdado do registro, editável para aquela reserva) e **nº de diárias** derivado do período (editável para casos excepcionais).

Cálculo: `subtotal do item = valor diária × nº de diárias`; `total do item = subtotal − desconto`; `total do orçamento = soma dos totais`.

Campos da reserva como um todo:
- **Observações da reserva** (texto longo, seção "Observações e cortesias" do PDF).
- **Local de instalação/evento** (texto livre).
- Contato: continua vindo do formulário de contato configurado pelo super admin (sem alteração).

### A4. Dados do emissor (configuração da organização)

Nas configurações da organização, novo bloco "Orçamento" (owner/editor):
- CNPJ, site, logo (a logo já existente da organização é usada quando houver), condições de pagamento padrão (lista de linhas) e validade do orçamento em dias (padrão 15).
- Reutilizados em todo orçamento gerado por aquela organização.

### A5. Layout do PDF

Reescrita da geração para reproduzir o anexo:
1. **Cabeçalho** em faixa escura com logo à esquerda, nome da organização, CNPJ e site à direita; filete de destaque abaixo.
2. **Título**: "ORÇAMENTO DE LOCAÇÃO" + regra horizontal.
3. **DADOS DO CLIENTE E EVENTO**: tabela de duas colunas (Cliente, Local de Instalação, Data de Emissão, Validade).
4. **ESPECIFICAÇÃO DOS SERVIÇOS / ITENS**: cabeçalho escuro com as colunas Descrição do item / Período de locação / Valor diária / Valor total; descrição em negrito com observação abaixo e selo de cortesia; desconto exibido na linha quando houver.
5. Linha de fechamento **"Valor Total do Orçamento (N diárias)"**.
6. **CONDIÇÕES DE PAGAMENTO** em bloco destacado com barra lateral.
7. **OBSERVAÇÕES E CORTESIAS** em bullets.
8. Rodapé com paginação "Página X de Y" e mensagem de encerramento em página final.

Datas em português por extenso ("25 e 26 de Julho de 2026", com "(N diárias)").

---

## B. Busca e filtros públicos em mobile

- O ativo flutuante das páginas **Explorar** e **listagem por categoria** passa a ter a **mesma aparência da barra de busca da home** (campo arredondado com lupa + botão de filtros + botão de busca), fixado no rodapé e **centralizado** horizontalmente na tela.
- O botão de busca perde o texto "Buscar" e passa a exibir **apenas o ícone de lupa**, tanto na home quanto em explorar/categorias (com `aria-label` para acessibilidade).

---

## Detalhes técnicos

- **Sem alteração de schema**: a tabela de reservas usa as tabelas existentes `tables`/`fields`/`records` com `system_data.kind='bookings'`; a configuração de orçamento usa `organizations.system_data`. A migração aplica apenas uma função `ensure_bookings_table(_source_table_id uuid)` (SECURITY DEFINER) e o `UPDATE` de reclassificação dos registros já existentes.
- **Server**: `src/lib/bookings.functions.ts` ganha `ensureBookingsTable`, e `getBookingContext`/`createBooking`/`updateBooking`/`listBookings`/`listAvailableResources` passam a operar sobre a tabela de reservas, lendo o catálogo da tabela de origem. Itens gravados em `system_data.items` com `{ record_id, label, daily_value, days, discount, discount_type, note, courtesy }`.
- **PDF**: `src/lib/bookings.server.ts` — `buildQuotePdf` reescrita com `pdf-lib` (retângulos para faixas, medição de texto para colunas, quebra de linha e paginação). Logo embarcada quando for PNG/JPEG acessível; caso contrário, cabeçalho sem imagem.
- **UI**: `booking-form-dialog.tsx` reorganizado (período → itens disponíveis → detalhes por item → contato → observações); novo `booking-item-row.tsx`; novo bloco de configuração no `settings-modal.tsx`/edição da organização; `mobile-filter-dock.tsx` e `home-search-bar.tsx` alinhados visualmente.
- **Governança §0**: validação em 360/768/1280, light+dark, sem regressão nas Iterações 4/7/32/33; entrada em `CHANGELOG.md` como "Correção/extensão das Iterações 32 e 33".

## Pendência declarada

- Condição de corrida na checagem de conflito continua em nível de aplicação (débito herdado da Iteração 7).
