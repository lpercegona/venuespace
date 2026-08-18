# Iteração 43 — Item D (unificação de campos) + Editor visual do Modelo de Orçamento

Continuação da Iteração 43. Nada de novo escopo além do descrito abaixo.

## Parte 1 — Item D: unificação dos campos-base da organização

O backfill já está no banco: cada categoria tem `org_name`, `org_logo`, `org_description` e `org_address` em `category_org_fields`, com `is_base = true` e `config.column_key` apontando para a coluna física (`name`, `logo_url`, `description`, `address`). Falta ligar a interface e a gravação.

- `CategoryFieldsForm` passa a entender `config.column_key` ao lado do `system_key` já suportado: lê e escreve num terceiro balde de valores (colunas da organização), incluindo os tipos `image` (upload de logo), `long_text` (editor rich text da descrição) e `address` (componente de endereço já existente).
- O formulário de organização (criação e edição) deixa de renderizar Nome, Logo, Descrição e Endereço como campos fixos: eles passam a vir da mesma definição do catálogo, respeitando rótulo, obrigatoriedade, tooltip, grupo e ordem configurados pelo super admin.
- `updateOrganization` e `createOrganization` recebem os valores de coluna a partir dessa definição, gravando nas colunas físicas (nada muda para páginas públicas, cards, sitemap e OG).
- Auditoria de cobertura em Administração → Estrutura → Campos: os três escopos (organização, tabela, registro) listam de fato todos os campos, inclusive os base, todos editáveis, sem duplicidade entre catálogo e formulário.

## Parte 2 — Editor visual do Modelo de Orçamento

Mantida a definição de modelos por categoria (tabelas `category_pdf_layout` e `category_pdf_layout_fields`) e a geração do PDF final por `pdf-lib` no servidor. Muda apenas a forma de editar.

- **Folha editável**: a área de edição passa a ser uma folha A4 em HTML que espelha o PDF (mesmas margens, cores, tipografia, cabeçalho com logo, tabela de itens, totais e rodapé de assinatura fixo). Edição direta na folha:
  - clicar no título/rótulo de um bloco edita o texto inline;
  - clicar no conteúdo edita o conteúdo do bloco (texto livre + variáveis);
  - arrastar o bloco reordena; alças laterais ajustam a largura (25/50/75/100%);
  - controles de tamanho de texto, seção e remover aparecem ao passar o mouse/focar no bloco.
- **Biblioteca de variáveis**: painel lateral com todas as variáveis disponíveis, agrupadas por origem — organização, contato/cliente (empresa, CNPJ, endereço, e-mail, telefone), reserva (todos os campos da tabela-modelo de reservas da categoria) e totais (itens, deslocamento, total, validade). Clicar insere a variável no ponto do cursor; a chave segue o padrão atual `{{chave}}`.
- **Adicionar bloco**: um botão na folha adiciona bloco a partir da biblioteca (campo da tabela) ou como bloco de texto livre.
- **Pré-visualização real**: o pdf.js sai do fluxo de edição e passa para uma aba/botão "Pré-visualizar PDF", que gera o documento real com os mesmos dados de amostra. Sem debounce a cada tecla.
- Salvar continua explícito, gravando campos e estilo do modelo da categoria.

## Notas técnicas

- Modelo de dados: reaproveita `category_pdf_layout_fields`; blocos de texto livre são gravados com `field_key` próprio (prefixo reservado) e o conteúdo em `label_override`/`section_title` estendidos por um campo de conteúdo — a coluna necessária é adicionada por migração com GRANT/RLS já existentes na tabela.
- Renderização: a folha HTML e o desenho no `pdf-lib` compartilham a mesma lista de blocos e a mesma resolução de variáveis, para que o que se edita seja o que se imprime.
- Design System: tokens semânticos, shadcn/ui, mobile-first (em telas pequenas a folha vira rolagem horizontal com zoom reduzido e a biblioteca vira Sheet); nenhuma cor fixa.
- Validação antes de fechar: build e typecheck, rotas tocadas em 360/768/1280 em light e dark, geração de orçamento existente sem regressão, edição/criação de organização sem regressão, RLS revisada.
- `CHANGELOG.md` recebe entrada datada cobrindo as duas partes, referenciando a Iteração 43.
