# Iteração 28 — Tooltips, Cidade/Estado, Página de organização (novo modelo) e Avaliações

Referências: correções/extensões das Iterações 13, 22, 23, 24, 26 e 27 (layouts públicos, cards imersivos, página pública de organização). Escopo novo: avaliações.

## 1. Tooltips nas comodidades (correção da Iteração 27)

Nos cards públicos, os ícones de comodidades deixam de exibir o texto ao lado. O nome da opção passa a aparecer apenas em tooltip ao passar o mouse sobre o ícone (e por toque/foco no mobile), mantendo `aria-label` para leitores de tela.

## 2. Cidade e Estado por extenso

Novo campo virtual selecionável na configuração de layout público: **"Cidade - Estado (extenso)"**. Ele monta o texto a partir do endereço já cadastrado (`Curitiba - Paraná`), expandindo a UF pelo mapa das 27 unidades federativas. Disponível em todos os escopos de layout, inclusive no rodapé direito dos cards imersivos.

## 3. Novo modelo de página individual de organização

Nova aba **"Página de organização"** em Administração > Layout público, com seletor de estilo:

- **Padrão** — o layout atual (duas colunas).
- **Imersivo** — o modelo do anexo.

O modelo imersivo usa os mesmos campos já configurados (inclusive contatos e formulário), mudando apenas a organização e a renderização:

```text
[breadcrumb HOME > CATEGORIA]
[galeria full-bleed em faixa horizontal, altura fixa]
   nota + título da organização + endereço + "Ver no mapa" sobre a faixa
[coluna esquerda]                    [coluna direita, sobreposta à faixa]
  campos em grade (rótulo pequeno)     card "Manifestar interesse" (form)
  descrição                            ícones de contato + botão do site
  comodidades com ícone                Localização (mapa)
  site / telefone
  Ambientes (cards de registro)
  Avaliações
```

Cada bloco só aparece se houver conteúdo. Mobile: coluna única, galeria com altura reduzida, card do formulário abaixo da galeria.

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
