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
- O caminho gerado é registrado em `records.system_data` (coluna jsonb já existente no banco) sob a chave `quotes`, como **array de versões**: `{ "quotes": [{ "path": "...", "created_at": "...", "created_by": "<uuid>", "total": 0 }] }`. Cada geração acrescenta um item; nenhuma coluna nova é criada.
- A tela oferece link assinado temporário para download de qualquer versão.
- Ao gerar, registra também uma mensagem `type = 'proposal'` na conversa da reserva com o valor total, mantendo o fluxo de aceite existente (é o passo "envio de proposta" do ciclo de vida).
- **Escopo do orçamento (decisão explícita)**: v1 soma apenas os campos de moeda do próprio registro da reserva (recurso único). Orçamento multi-item pelo padrão relacional (tabela de itens + `computed`) fica **fora do escopo** desta iteração e entra como pendência declarada.


## 4. Ciclo de vida da reserva

Estágios com o valor de `deal_status` declarado explicitamente:

```text
negociação (deal_status = 'negotiating')
   --(envio de orçamento/proposta)-->  permanece 'negotiating'
   --(aceite da proposta)----------->  fechada   (deal_status = 'accepted')
   --(recusa)------------------------> recusada  (deal_status = 'declined' + status = 'archived')

fechada (accepted)
   --(serviço entregue)-------------->  encerrada (deal_status = 'closed')
```

- **Fechada = `accepted`** (não `closed`). É nesse momento que `agreed_value` é gravado, copiado da última proposta aceita — comportamento já existente em `setDealStatus`.
- **Encerrada = `closed`**, significando serviço entregue; `agreed_value` é preservado, não recalculado. Isto redefine o significado anterior de `closed` (antes "negócio concluído"); registros existentes em `closed` são lidos como encerrados, sem migração de dados.
- "Fechar negócio" (→ `accepted`) revalida conflito de datas no servidor e bloqueia em caso de sobreposição.
- Recusa: `deal_status = 'declined'` **e** `status = 'archived'`; some da lista padrão, aparece apenas no filtro "Arquivadas", com ação de desarquivar (volta a `status = 'draft'`, mantendo `declined`).


## Detalhes técnicos

- **PDF**: `pdf-lib` (compatível com o runtime edge do servidor; sem dependências nativas). Geração dentro do handler de `createServerFn`, upload via cliente Supabase autenticado; leitura por URL assinada temporária.
- **Server functions** (novo `src/lib/bookings.functions.ts`): `createBooking`, `listBookingsForRange`, `listAvailableResources`, `generateBookingQuote`, `archiveBooking`/`unarchiveBooking`. Todas com `requireSupabaseAuth`; escrita restrita a owner/editor.
- **Transições de estágio — sem função nova**: "negociação → fechada" (`accepted`) e "fechada → encerrada" (`closed`) reaproveitam o `setDealStatus` existente (Iteração 4), que já revalida conflito de datas via `runBookingCheck` em ambas as transições e já copia `agreed_value`. A tela de reservas apenas o chama; nenhuma lógica de negociação é duplicada em `bookings.functions.ts`.
- **Modelo de dados — nada novo**: verificado no banco que `record_status` já contém `draft | published | archived` e que `records.system_data` (jsonb) já existe. Portanto esta iteração **não altera schema de tabelas**; apenas passa a usar `archived` e a chave `system_data.quotes`.
- **Migração**: apenas políticas de storage para o prefixo `orcamentos/` no bucket privado `venue-uploads` (leitura/escrita restritas a membros da organização dona do caminho).
- **UI**: `src/routes/_authenticated.app.$orgSlug.calendar.tsx` reescrita como painel de gestão; novos componentes `src/components/venue/booking-form-dialog.tsx`, `booking-availability-filter.tsx`, `booking-status-actions.tsx`, todos sobre primitives shadcn já presentes (Dialog, Calendar/Popover, Table, Badge, Tabs) e tokens semânticos existentes.
- **Governança (§0)**: validação em 360/768/1280, light+dark, sem regressão nas Iterações 4/5/7; entrada em `CHANGELOG.md` como "Iteração 32 — extensão da Iteração 7".

## Pendências declaradas (não resolvidas nesta iteração)

- **Condição de corrida na checagem de conflito** (débito herdado da Iteração 7): a verificação continua em nível de aplicação, sem constraint de exclusão no banco (`EXCLUDE USING gist` sobre recurso + período). Esta iteração adiciona uma segunda superfície dependente do mesmo mecanismo (criação manual + revalidação no fechamento). Fica registrado como débito técnico crescente, a resolver em iteração própria com migração dedicada.
- **Orçamento multi-item relacional** (espaço + serviços adicionais) usando tabela de itens + `computed`: fora do escopo, a definir em iteração futura.

