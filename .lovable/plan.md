# Correção da Iteração 28 — Layout 2, seleção estática e tooltips

Escopo: correção da Iteração 28 (não abre nova iteração). Referencia também as Iterações 22, 23, 24, 26 e 27.

## 1. Diagnóstico do comportamento da Iteração 28

Verificado no código atual:

1. **Layout 2 depende de configuração inexistente.** `organization-page-immersive.tsx` monta a página a partir de "slots" lidos de `config.position` (`background`, `badge`, `title`, `subtitle`, `rating`, `address`, `features`, `description`). Nenhum registro de layout tem esse `position` gravado, então hero, galeria, comodidades e descrição ficam vazios — daí a aparência desestruturada.
2. **A escolha do estilo pode se perder.** Em `src/lib/public.server.ts`, `page_style` é lido de `pageLayout[0].config.__card_style`. Se o layout `organization_page` não tiver linhas de campo, o estilo cai para `standard` mesmo com Layout 2 salvo.
3. **Conteúdo duplicado.** O componente calcula `detailsLayout` (campos fora dos slots) mas passa o `layout` inteiro para `PublicCardBody`, repetindo campos já usados no hero.
4. **Estrutura divergente do anexo.** Falta cabeçalho/breadcrumb (`PublicHeader` não é renderizado no Layout 2), o card de interesse não sobrepõe a galeria, o mapa está na coluna esquerda em vez da direita, e Avaliações aparece antes de Ambientes.
5. **Formulário quebrado no Layout 2.** A rota retorna o componente imersivo antes de montar o `InterestFormModal`, então o botão "Manifestar interesse" abre o estado mas nenhum modal.
6. **Tooltips incompletos.** Só o card imersivo usa `Tooltip`; nos cards padrão e nos blocos da página de organização o multiselect ainda é renderizado como texto separado por vírgula.
7. **Painel do super admin excessivo.** A aba "Página de organização" reaproveita o editor de campos (largura, bleed, estilo) que não faz sentido para uma página com estrutura fixa.

## 2. Diretrizes para evitar inconsistências futuras

- Nenhum layout novo pode depender de chaves de configuração (`position`, etc.) que a interface de administração não grava. Renderizador e editor entram na mesma entrega.
- Estado de configuração (estilo da página) nunca deve ser inferido a partir de registros filhos; deve ser lido da própria tabela pai.
- Layout com estrutura fixa recebe seleção estática; layout configurável recebe editor de campos. As duas coisas não se misturam na mesma aba.
- Toda variante de página pública precisa manter cabeçalho, modais e estados compartilhados da rota (o layout alternativo é o miolo, não a página inteira).
- Antes de fechar entrega baseada em imagem de referência, comparar bloco a bloco a ordem e a coluna de cada elemento com o anexo.

## 3. Plano de correção

### 3.1 Seleção estática do estilo da página

- Aba "Página de organização" passa a exibir apenas dois cards clicáveis: **Layout 1** e **Layout 2**, cada um com uma miniatura em skeleton (barras e blocos neutros) representando a estrutura — Layout 1: cabeçalho + duas colunas; Layout 2: faixa hero larga + colunas assimétricas com card flutuante.
- Nenhum editor de campos, largura, bleed ou ícone nessa aba. Salvar grava apenas `card_style` no escopo `organization_page`.
- `page_style` passa a ser lido diretamente de `category_public_layouts.card_style` do escopo `organization_page`, independentemente de existirem linhas de campo.

### 3.2 Layout 2 reescrito conforme o anexo

Estrutura fixa, sem slots configuráveis; os dados vêm dos campos da organização já existentes (mesma fonte do Layout 1):

```text
[PublicHeader]
[breadcrumb HOME > CATEGORIA]
[faixa hero full-bleed com a galeria da organização, altura fixa]
   nota (estrelas + média) · título da organização
   endereço em uma linha + "Ver no mapa"
[abaixo do hero]
 [coluna esquerda ~60%]                 [coluna direita ~40%, card sobreposto ao hero]
   campos em grade (rótulo pequeno)       card "Manifestar interesse" (formulário)
   descrição                                ícones e-mail/whatsapp/telefone + "Acessar o site"
   comodidades (ícone + tooltip)          Localização (mapa)
   site / telefone
   Ambientes (cards de registro, 3 colunas)
   Avaliações
```

- Card de interesse com `sticky` no desktop e margem negativa para sobrepor a base do hero; em mobile vai logo abaixo do hero, largura total.
- Ordem corrigida: Ambientes antes de Avaliações; mapa na coluna direita.
- Sem duplicação: cada campo aparece uma única vez.
- `InterestFormModal` e demais estados da rota passam a envolver os dois layouts.

### 3.3 Tooltips nos ícones de multiselect

- Valores de multiselect com ícone definido (`Opção | Icone`) renderizam apenas o ícone, com tooltip no hover/foco e `aria-label` — nos cards padrão, nos cards imersivos e nos blocos da página de organização (Layout 1 e Layout 2).
- Sem ícone configurado, mantém o texto atual.

## Detalhes técnicos

- `src/lib/public.server.ts`: `getPublicOrganization` busca `card_style` do escopo `organization_page` direto do registro pai; remove a dependência de `pageLayout[0]`.
- `src/routes/_authenticated.admin.index.tsx`: novo componente de seleção (cards + skeleton) para o escopo `organization_page`; `LayoutEditor` continua apenas nos escopos de card.
- `src/lib/category-layouts.functions.ts`: `saveCategoryLayout` aceita salvar somente `card_style` (lista de campos vazia) para `organization_page`.
- `src/components/venue/organization-page-immersive.tsx`: reescrito sem slots; consome `org.layout`, `org.fields`, `org.data`, `org.contact`, `records`.
- `src/components/venue/public-card-renderer.tsx`: extrair o render de multiselect com ícone para um componente compartilhado com `Tooltip`.
- `src/routes/public.$slug.index.tsx`: header, breadcrumb e `InterestFormModal` compartilhados entre os dois estilos.
- Sem migração de banco. Sem cores hardcoded; validar light/dark em 360/768/1280 e registrar em `CHANGELOG.md` como `Correção da Iteração 28`.
