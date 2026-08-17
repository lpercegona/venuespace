# Iteração 43 — PDF configurável, Módulos em cards, Logo na autenticação e Unificação de Campos

Quatro frentes, escopo fechado. Decisões confirmadas: o modelo de PDF por categoria **substitui** a configuração atual (`category_modules.config.pdf`, Iteração 41), com migração; os campos-base da organização passam a ser definidos em `category_org_fields` **mapeados para a coluna física**; preview do PDF via **pdf.js**.

## A — Modelo configurável de PDF de reserva por categoria

**Banco**

- Novas tabelas `category_pdf_layout` (id, category_id único, updated_at) e `category_pdf_layout_fields` (id, layout_id, field_key, label_override, width_percent 25/50/75/100, font_size 8–24, order_index, section_title). GRANTs + RLS: leitura autenticada, escrita apenas super admin; trigger de updated_at.
- Migração dos dados existentes em `category_modules.config.pdf` (cor, tamanho da logo, blocos, textos) para o novo layout; a aba antiga de PDF em Módulos deixa de editar `config.pdf`.

**Backend**

- CRUD do layout restrito a super admin (`category-pdf-layout.functions.ts`).
- `generateBookingQuote` passa a ler o layout da categoria antes de desenhar; sem layout configurado, mantém exatamente o desenho atual como fallback.
- `previewBookingQuote({ category_id, layout_draft })`: gera PDF de amostra a partir da configuração ainda não salva, usando um registro real de reserva quando existir, se não dados fictícios coerentes por tipo de campo. Não persiste nada.
- Rodapé de assinatura fixo (não editável), desenhado no rodapé de **todas** as páginas: à esquerda "Orçamento gerado através da plataforma venuespace.", ao centro a logo do Venuespace, à direita "venuespace.com.br" como link clicável para [https://venuespace.com.br](https://venuespace.com.br) (anotação de link `pdf-lib`).
- Auditoria e correção da resolução da logo da organização, garantindo renderização confiável tanto no preview quanto no PDF final, na mesma posição já definida na Iteração 32 (sem nova posição, sem tornar configurável).

**Frontend**

- Em `/admin` → administração → modulos - reservas "Modelo de Orçamento (PDF)": lista dos campos disponíveis na tabela-modelo de reservas da categoria + botão "adicionar ao modelo".
- Cada linha do modelo: campo, rótulo editável, largura (25/50/75/100), tamanho de texto (stepper), seção/título opcional, reordenação por arrastar, remover.
- Preview ao lado renderizado com pdf.js (carregado sob demanda apenas no admin), atualizado com debounce de ~600ms a cada alteração, exibindo rodapé de assinatura e logo da organização como parte do resultado final.

## B — Módulos em cards

- A listagem de módulos deixa de ter toggles: passa a exibir cards com ícone, nome, descrição e badge de status (ativo/inativo), sem ação direta na listagem.
- O card abre a página de edição do módulo, com ativação/desativação por categoria e as configurações específicas do módulo, seguindo o mesmo padrão de interação da frente A (lista configurável + reordenação + preview ao vivo).

## C — Logo centralizada na autenticação

- `/auth` (login, cadastro e recuperação) passa a exibir a logo centralizada no topo, reaproveitando o componente/asset de logo já usado em `/para-empresas`.

## D — Unificação de campos em Administração → Estrutura → Campos

- Campos-base hoje gravados como colunas fixas em `organizations` (nome, logo, descrição, endereço) passam a ter definição em `category_org_fields`, marcados como base, com `config.column_key` apontando para a coluna física. O valor continua sendo gravado na coluna (páginas públicas, cards, sitemap e OG seguem intactos); rótulo, obrigatoriedade, tooltip, grupo e ordem passam a ser editáveis no catálogo.
- O formulário de organização passa a renderizar esses campos a partir da mesma definição — fonte única, sem cópia paralela; o suporte a `column_key` entra no `CategoryFieldsForm` ao lado do `system_key` já existente, e a gravação no `updateOrganization`.
- Auditoria de cobertura: varrer os três escopos (organização, tabela, registro) e garantir que "Todos os campos" liste realmente todos, incluindo os que hoje ficam de fora, todos editáveis, mantendo o padrão estrutural atual e persistindo em todas as áreas de edição de campos.

## Notas técnicas

- Tokens, shadcn/ui, mobile-first e dark mode conforme o Design System; nenhuma cor fixa.
- `pdfjs-dist` é a única dependência nova, importada dinamicamente no painel do super admin.
- Migrações: novas tabelas do layout de PDF com GRANT/RLS/trigger; backfill de `category_org_fields` para os campos-base de organização.
- Validação antes de fechar: build, rotas tocadas em 360/768/1280 em light e dark, geração de orçamento existente sem regressão, RLS revisada.
- `CHANGELOG.md` recebe entrada datada cobrindo as quatro frentes.