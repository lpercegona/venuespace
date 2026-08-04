# Iteração 28 — Tooltips, Cidade/Estado, Página de organização (novo modelo) e Avaliações

Referências: correções/extensões das Iterações 13, 22, 23, 24, 26 e 27 (layouts públicos, cards imersivos, página pública de organização). Escopo novo: avaliações.

## 1. Tooltips nas comodidades (correção da Iteração 27)

Nos cards públicos, os ícones de comodidades deixam de exibir o texto ao lado. O nome da opção passa a aparecer apenas em tooltip ao passar o mouse sobre o ícone (e por toque/foco no mobile), mantendo `aria-label` para leitores de tela.

## 2. Cidade e Estado por extenso

Novo campo virtual selecionável na configuração de layout público: **"Cidade - Estado (extenso)"**. Ele monta o texto a partir do endereço já cadastrado (`Curitiba - Paraná`), expandindo a UF pelo mapa das 27 unidades federativas. Disponível em todos os escopos de layout, inclusive no rodapé direito dos cards imersivos.

## 3. Novo modelo de página individual de organização

Nova aba **"Página de organização"** em Administração > Layout público, com seletor de estilo:

- **Layout 1** — o layout atual (duas colunas, galeria acima do conteúdo, informações e formulário lado a lado).
- **Layout 2** — o modelo do anexo (galeria horizontal full-bleed com overlay de título, colunas assimétricas, card de interesse flutuante sobre a galeria).

A escolha do estilo é salva no mesmo registro `category_public_layouts` usando o novo escopo `organization_page` e o campo `card_style` (`standard` para Layout 1, `immersive` para Layout 2). Os campos configuráveis continuam sendo os mesmos já disponíveis nos layouts de card de organização.

### Layout 1 (atual)

Estrutura em duas colunas de largura equivalente:

```text
[header com logo, nome da organização, categoria e endereço]
[coluna esquerda]                              [coluna direita]
  bloco de campos configuráveis em grid          card "Entrar em contato" (formulário)
  descrição                                      ícones de contato (e-mail, whatsapp, telefone)
  comodidades                                    botão "Acessar o site"
  localização (mapa)
  Ambientes (cards de registro)
  Avaliações
```

- A galeria, quando presente, fica dentro do bloco de campos configuráveis e respeita as larguras definidas pelo super admin.
- Cada bloco só aparece se houver conteúdo.

### Layout 2 (novo)

Estrutura em faixa horizontal hero + colunas assimétricas:

```text
[breadcrumb HOME > CATEGORIA]
[faixa horizontal full-bleed com galeria, altura fixa]
   - gradiente escuro na base da faixa
   - nota de avaliação (estrelas + número)
   - título da organização
   - endereço resumido + link "Ver no mapa"
[conteúdo abaixo da faixa]
  [coluna esquerda, ~60%]                      [coluna direita, ~40%, sobreposta parcialmente à faixa]
    campos em grade (rótulo pequeno)               card "Manifestar interesse" (formulário)
    descrição                                        ícones de contato (e-mail, whatsapp, telefone)
    comodidades com ícone                            botão "Acessar o site"
    site / telefone                                  Localização (mapa)
    Ambientes (cards de registro)
    Avaliações
```

Detalhes do Layout 2:

- **Galeria hero**: ocupa toda a largura da tela (`full-bleed`), altura fixa de `h-72` em mobile e `h-96` em desktop. A galeria respeita as configurações de bleed do layout público (sem padding/margem interna). Os controles de navegação (setas) aparecem apenas no hover/foco, conforme ajustado na Iteração 23.
- **Overlay**: gradiente semitransparente (`from-background/80 to-transparent` ou similar via token) na base da faixa, garantindo legibilidade do texto branco sobre a imagem. O texto usa `text-primary-foreground`/`text-background` com sombra sutil (`text-shadow` via utilitário quando necessário, mas preferencialmente contraste pelo gradiente).
- **Nota de avaliação**: exibida apenas se houver avaliações aprovadas. Mostra estrelas preenchidas + média (ex: "4,5").
- **Título da organização**: `font-display text-3xl sm:text-4xl font-semibold`.
- **Endereço resumido**: linha única com cidade/UF ou endereço completo, truncado com ellipsis.
- **Link "Ver no mapa"**: ancora suave para a seção de localização abaixo.
- **Card de interesse**: posicionado na coluna direita, com `sticky top-24` em desktop para acompanhar a rolagem. Em mobile, o card fica imediatamente abaixo da faixa hero, ocupando largura total.
- **Coluna esquerda**: blocos empilhados verticalmente com espaçamento consistente (`space-y-8` ou `gap-8`).
- **Ambientes**: grid de cards de registro em 3 colunas no desktop, conforme ajustado na iteração anterior.
- **Avaliações**: seção própria abaixo de Ambientes, mostrando média, total e cards de avaliações aprovadas.

Cada bloco só aparece se houver conteúdo. Mobile: coluna única, galeria com altura reduzida, card do formulário abaixo da faixa hero.

## 4. Avaliações

Nova área de avaliações na página individual de organização (nos dois estilos).

- Somente usuários autenticados podem avaliar: nota de 1 a 5 estrelas + comentário, uma avaliação por usuário por organização (editável pelo próprio autor).
- Toda avaliação nasce **pendente** e só aparece publicamente após aprovação do super admin.
- Área de moderação no painel de Administração: lista de pendentes com aprovar/rejeitar.
- A seção pública mostra média, total e as avaliações aprovadas; visitante não logado vê convite para entrar.

## Detalhes técnicos

- **Banco**: adicionar valor `organization_page` ao enum `public_layout_scope`; nova tabela `public.organization_reviews` (organization_id, user_id, rating smallint 1-5, comment, status pending/approved/rejected) com GRANTs, RLS (autor gerencia a própria; leitura pública apenas de `approved`; super admin modera via `is_super_admin`), unique (organization_id, user_id) e trigger `tg_set_updated_at`.
- **Layout**: reutilizar `category_public_layouts.card_style` para o novo escopo (`standard` | `immersive`) e `category_public_layout_fields` para os campos.
- **Frontend**: `Tooltip` do shadcn em `public-card-renderer.tsx`; novo `OrganizationPageImmersive` em `src/components/venue/`; `src/routes/public.$slug.index.tsx` escolhe o estilo a partir do layout da categoria; nova seção `OrganizationReviews`.
- **API**: `GET /api/public/organizations/$slug` passa a devolver `page_style`, média e avaliações aprovadas; server fns autenticadas para criar/editar avaliação e para moderação.
- **Design system**: sem cores hardcoded; overlays e badges por tokens existentes; validar light/dark em 360/768/1280.
- **CHANGELOG.md**: entrada datada cobrindo migração, rotas, componentes e correções.
