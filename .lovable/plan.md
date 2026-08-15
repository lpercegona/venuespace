# Módulos (nova área do super admin) + formulário de reservas vinculado à tabela

Extensão das Iterações 7/32 (reservas e orçamento em PDF) e 40 (estrutura de campos). Não é escopo inédito: o módulo Reservas passa a ser configurável, e o formulário de nova reserva deixa de ter campos fixos no código.

## 1. Formulário de nova reserva vinculado à tabela de reservas

Hoje `BookingFormDialog` renderiza apenas os dois campos de período (`periodFields`) e um `travel_fee` fixo no código. Passa a renderizar **todos os campos da tabela de reservas** da organização, na ordem definida, respeitando tipo, obrigatoriedade, tooltip e blocos — reutilizando o mesmo renderizador de campos já usado nos formulários dinâmicos.

Exceções mantidas como estão:
- **Itens do orçamento**: continuam como listagem de itens disponíveis no período, com valor diário, dias, desconto, cortesia e observação por item.
- **Contato**: continua como seleção/busca com criação rápida (`BookingContactPicker`).
- Campos `computed` continuam somente leitura.

Validação no servidor (`createBooking` / `updateBooking`) passa a validar o `data` contra os campos reais da tabela, e não contra uma lista fixa.

## 2. Nova área "Módulos" na administração

Novo grupo no menu do super admin, ao lado de Configurações / Estrutura / Layout / Conteúdo, com uma lista de módulos. No lançamento existe um módulo: **Reservas**. A estrutura é um registro genérico de módulos, para que novos entrem sem alterar a arquitetura.

### 2.1 Ativação por categoria

- Lista de categorias com switch Ativo/Inativo para o módulo.
- Desativado: a área de Reservas e o botão "Nova reserva" somem para as organizações da categoria **e** o servidor rejeita criação/edição/geração de orçamento (leitura do histórico continua permitida).

### 2.2 Configuração do formulário de reservas

Por categoria, sobre os campos do modelo de tabela de reservas:
- Visível no formulário (sim/não)
- Rótulo sobreposto
- Ordem
- Obrigatório
- Campos de itens e contato aparecem como linhas fixas (só ordem/rótulo), pois são componentes de seleção.

### 2.3 Layout do PDF de orçamento

Configuração por opções + template de textos:
- Blocos ligáveis/desligáveis e reordenáveis: logo, dados da organização, dados do cliente (nome, empresa, CNPJ, endereço), período, tabela de itens, descontos, taxa de deslocamento, total, observações, condições, rodapé.
- Quais colunas da tabela de itens aparecem.
- Cor de destaque (a partir dos tokens existentes) e tamanho do logo.
- Campos de texto com variáveis: cabeçalho, condições/termos e mensagem final, com `{{organizacao}}`, `{{cliente}}`, `{{periodo}}`, `{{total}}`, `{{numero}}`, `{{data}}`.
- Pré-visualização gerando um PDF de exemplo com dados fictícios.

## Detalhes técnicos

- **Migração**: `platform_modules` (`key`, `name`, `description`, `is_active`) com a linha `bookings`; `category_modules` (`category_id`, `module_key`, `is_enabled`, `config jsonb`) com unicidade por par. GRANTs para `authenticated` (leitura) e `service_role`; escrita restrita a super admin via política usando `is_super_admin`. Leitura pública não é necessária.
- `config` guarda `form` (lista de `{ field_key, visible, label_override, required, order_index }`) e `pdf` (blocos, colunas, cor, textos). Nada de coluna nova por opção — o módulo evolui só pelo jsonb.
- **Server fns** em `src/lib/modules.functions.ts`: `listModules`, `listCategoryModules`, `setModuleEnabled`, `saveModuleConfig`, todas com `requireSupabaseAuth` + verificação de super admin. Helper `assertModuleEnabled(supabase, orgId, 'bookings')` em `src/lib/modules.server.ts`, chamado em `createBooking`, `updateBooking`, `setDealStatus` de reserva e `generateBookingQuote`.
- **UI**: `src/components/admin/modules-section.tsx` (lista de módulos) + `src/components/admin/module-bookings.tsx` (abas Categorias / Formulário / PDF), registrados em `ADMIN_GROUPS` de `src/routes/_authenticated.admin.index.tsx` como grupo `modules`. Registro de módulos em `src/lib/module-registry.ts` para que um novo módulo seja apenas mais uma entrada.
- **Formulário**: `getBookingContext` passa a devolver todos os campos da tabela de reservas mais a config do módulo; `BookingFormDialog` renderiza via o renderizador de campos já existente, mantendo itens e contato como blocos próprios.
- **PDF**: `src/lib/bookings.server.ts` passa a ler a config do módulo e montar os blocos na ordem configurada, com interpolação das variáveis; sem config, mantém exatamente o layout atual como padrão.
- Sem rota pública nova — sitemap inalterado. Apenas shadcn/ui e tokens existentes; validação em 360/768/1280 em light e dark; entrada no `CHANGELOG.md` como extensão das Iterações 7/32 e nova Iteração de Módulos.
