# Iteração 32 — Gestão de reservas (extensão da Iteração 7)

Escopo fechado: botão de nova reserva manual, visão geral com filtro de disponibilidade, orçamento em PDF gerado no servidor e ciclo de vida da reserva (negociação → fechamento → encerramento; recusadas arquivadas).

Base existente que será estendida (não recriada): rota `/app/$orgSlug/calendar` (Iteração 7), `listOccupancy` e `runBookingCheck` em `src/lib/applications.functions.ts`, `setDealStatus` em `src/lib/messages.functions.ts`, `createRecord` em `src/lib/records.functions.ts`, `DynamicForm`.

## 1. Nova reserva manual

- Na área de Reservas, cada tabela reservável ganha o botão "Nova reserva" (visível para owner/editor).
- Abre um Dialog com o `DynamicForm` da tabela, com **todos os campos configurados** (recurso, data início, data fim, contato, valor etc.), conforme decidido.
- Ao salvar: valida conflito de datas com `runBookingCheck` antes de gravar; se houver sobreposição com reserva `accepted`/`closed`, bloqueia e mostra o período conflitante.
- Reserva criada nasce com `deal_status = 'negotiating'` e uma conversa vinculada ao registro, igual às reservas vindas do formulário público.

## 2. Visão geral e filtro de disponibilidade

- A página de Reservas passa a ter, por tabela reservável:
  - **Filtro de data**: por padrão data única; alternância para intervalo (data início / data fim).
  - **Reservas do período**: lista das reservas que tocam a data/intervalo, com recurso, período, status e link para a conversa.
  - **Disponibilidade**: lista dos recursos livres no período selecionado (recursos da tabela de origem sem sobreposição com reservas aceitas/fechadas).
- Filtro de status (negociação, fechada, encerrada, arquivadas) — arquivadas ocultas por padrão.
- Mobile: cards; desktop: tabela dentro de `ScrollArea`. Estados de loading, vazio e erro cobertos.

## 3. Orçamento em PDF (gerado no servidor e salvo)

- Server function autenticada gera o PDF da reserva e o salva no bucket privado existente `venue-uploads`, em `orcamentos/<organization_id>/<record_id>/<timestamp>.pdf`.
- Conteúdo: nome/logo da organização, número e data do orçamento, recurso reservado, período, dados de contato do interessado, itens/valores dos campos de moeda da reserva, valor total proposto e observações.
- O caminho gerado é registrado no `system_data` do registro (histórico de orçamentos), e a tela oferece link assinado para download; cada geração adiciona uma nova versão.
- Opcionalmente registra a proposta na conversa com o valor, mantendo o fluxo de aceite existente.

## 4. Ciclo de vida da reserva

Transições explícitas na tela de reservas e na conversa:

```text
negociação  --(envio de orçamento/proposta)-->  negociação
negociação  --(aceite da proposta)----------->  fechada
fechada     --(serviço entregue)-------------->  encerrada
negociação  --(recusa)------------------------>  recusada + arquivada
```

- "Fechar negócio" só é permitido se não houver conflito de datas (revalidação no servidor).
- Recusa: `deal_status = 'declined'` **e** `status = 'archived'`; some da lista padrão, aparece apenas no filtro "Arquivadas", com ação de desarquivar.
- Encerramento: `deal_status = 'closed'`, mantendo o valor acordado.

## Detalhes técnicos

- **PDF**: `pdf-lib` (compatível com o runtime edge do servidor; sem dependências nativas). Geração dentro do handler de `createServerFn`, upload via cliente Supabase autenticado; leitura por URL assinada temporária.
- **Server functions** (novo `src/lib/bookings.functions.ts`): `createBooking`, `listBookingsForRange`, `listAvailableResources`, `generateBookingQuote`, `archiveBooking`/`unarchiveBooking`. Todas com `requireSupabaseAuth`; escrita restrita a owner/editor.
- **Migração**: política de storage para o prefixo `orcamentos/` no bucket `venue-uploads` (leitura/escrita apenas por membros da organização). Sem novas tabelas — reservas continuam em `records`, usando `deal_status`, `status` e `system_data`.
- **UI**: `src/routes/_authenticated.app.$orgSlug.calendar.tsx` reescrita como painel de gestão; novos componentes `src/components/venue/booking-form-dialog.tsx`, `booking-availability-filter.tsx`, `booking-status-actions.tsx`, todos sobre primitives shadcn já presentes (Dialog, Calendar/Popover, Table, Badge, Tabs) e tokens semânticos existentes.
- **Governança (§0)**: validação em 360/768/1280, light+dark, sem regressão nas Iterações 4/5/7; entrada em `CHANGELOG.md` como "Iteração 32 — extensão da Iteração 7".
