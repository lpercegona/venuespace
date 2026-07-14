## Documento: Estado atual do Venuespace

Vou gerar um `.docx` em `/mnt/documents/venuespace-estado-atual.docx` cobrindo tudo o que foi construído até agora, para servir como handoff / referência do projeto.

### Estrutura do documento

1. **Capa e resumo executivo**
   - Nome, categoria da solução, objetivo da v1, status atual.

2. **Skill do projeto (`/skill:venuespace`)**
   - Diretriz de Desenvolvimento §0 (soberana): regras de escopo, ambiguidade = parada, validação obrigatória, registro em `CHANGELOG.md`.
   - Design System vinculante: shadcn/ui + Tailwind v4, tokens oklch em `src/styles.css`, tipografia Space Grotesk, dark mode obrigatório, mobile-first 360px, acessibilidade AA.
   - Governança e checklist de fechamento de iteração.

3. **Arquitetura**
   - Stack: TanStack Start v1, React 19, Vite 7, Tailwind v4, shadcn/ui, TanStack Query.
   - Backend: Lovable Cloud (Supabase) — RLS + `createServerFn` + `/api/public/*`.
   - Modelo de dados: `organizations`, `memberships`, `tables`, `fields`, `records`, `views`, `permissions`, `conversations`, `messages`, `lead_access_tokens`, `super_admins`.
   - Segurança: `has_role`, `is_org_member`, `is_super_admin`, políticas RLS + GRANTs, `SECURITY DEFINER` `create_organization`.
   - Convenções: `public_form` grava em tabela separada; motor de reserva rejeita datas sobrepostas.

4. **O que foi programado — por iteração**
   - **1 Fundação**: Auth (e-mail + Google), schema base, RLS, tokens de design, layout `_authenticated/`, painel `/app` e `/app/$orgSlug`.
   - **2 Records + Grid Dinâmico**: CRUD com validação Zod dinâmica, `computed` fields, `DynamicGrid` e `DynamicForm`.
   - **3 Publicação pública + public_form**: `/api/public/$slug/$tableId`, submissões geram `lead_access_tokens` e conversas.
   - **4 Chat + propostas + `deal_status`**: mensagens, propostas com valor, transições `negotiating → accepted/declined → closed`, inbox.
   - **5 Candidaturas autenticadas**: `/me/applications`.
   - **6 Campanhas**: soma apenas contribuições confirmadas, chave PIX, confirmação manual.
   - **7 Motor de reserva**: `booking_role`, verificação de conflito, calendário de ocupação.
   - **8 Membros + polimento**: convites, notificações in-app, SEO/OG por rota, landing.
   - **Super admin universal**: `lpercegona@gmail.com` promovido via trigger.
   - **Melhorias UX pós-v1**: edição de tabelas, uploads reais (imagem/arquivo com `venue-uploads`), opções inline em select/multiselect, chat flutuante, detalhes públicos de registro com URLs assinadas, dropdown de perfil, selecionador de organização, `SettingsModal`, edição de formulários públicos, otimizações de performance (staleTime, batching de signed URLs, cache-control), fonte Space Grotesk, edição/exclusão de organização e tabela, carrossel de publicações recentes na landing, página `/explore`, `PublicHeader` unificado + botão voltar, formulário de interesse como modal.

5. **Fluxo completo de navegação**
   - **Público**:
     - `/` (landing + carrossel recentes) → `/explore` (busca/paginação).
     - `/public/$slug/$tableId` (listagem) → `/public/$slug/$tableId/$recordId` (detalhe com PublicHeader + Voltar).
     - Modal `InterestFormModal` (aberto pela listagem, pelo detalhe ou pela rota fallback `/public/$slug/$tableId/form`).
     - `/public/$slug/campaigns/$recordId` (campanha + PIX + contribuir).
     - `/lead/$token` (acompanhamento pós-submissão).
     - `/auth` (login/cadastro, Google).
   - **Autenticado (`_authenticated/`)**:
     - `/app` (lista de organizações) → `/app/$orgSlug` (painel).
     - `/app/$orgSlug/tables/$tableId` (grid + views) → `/tables/$tableId/schema` (fields).
     - `/app/$orgSlug/conversations` (inbox).
     - `/app/$orgSlug/members`, `/app/$orgSlug/calendar`.
     - `/me/applications`.
     - Chat flutuante (`ChatWidget`) e sino de notificações no `AppShell`.
     - `SettingsModal` acionado pelo dropdown do avatar (Perfil / Notificações / Segurança).
     - Selecionador de organização + "Ver todas as organizações".

6. **Fora de escopo (confirmado)**
   - Pagamento automático, NF, estoque, marketplace, white label, realtime websocket, e-mail transacional.

7. **Governança operacional**
   - `CHANGELOG.md` na raiz com todas as entradas datadas (América/São_Paulo).
   - Checklist obrigatório antes de fechar iteração.

### Formato

- `.docx` gerado com `docx-js`, US Letter, Space Grotesk indisponível em Word → fallback Arial no documento (a fonte do produto continua Space Grotesk).
- Cabeçalhos hierárquicos (H1/H2/H3), listas com `LevelFormat.BULLET`, sem tabelas decorativas.
- Validação pós-geração (unpack + repack) e QA visual página a página antes de entregar.
- Arquivo salvo em `/mnt/documents/venuespace-estado-atual.docx` e apresentado via `<presentation-artifact>`.