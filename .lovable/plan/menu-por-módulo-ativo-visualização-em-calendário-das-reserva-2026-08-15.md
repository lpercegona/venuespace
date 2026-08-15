# Menu por módulo ativo + visualização em calendário das reservas

Correção/extensão da Iteração 41 (Módulos) e da Iteração 32 (Gestão de reservas). Não é escopo inédito de módulos: ajusta a visibilidade do menu conforme o módulo e amplia a tela de reservas já existente.

## 1. Ocultar o acesso quando o módulo está desativado

Hoje o item "Reservas" do menu do perfil (`AppShell`) aparece sempre, e a rota `/app/$orgSlug/calendar` mostra um aviso de módulo desativado.

- `AppShell` passa a consultar o estado dos módulos da organização atual e só renderiza o item de menu do módulo quando ele está ativo para a categoria da organização.
- Enquanto o estado carrega, o item não pisca (fica oculto até haver resposta).
- A rota continua protegida no servidor e mantém o aviso caso alguém acesse a URL direto.
- Regra genérica: o menu é montado a partir do registro de módulos, para que novos módulos entrem sem alterar o componente.

## 2. Alternância Lista / Calendário nas reservas

Na página de reservas, para quem tem reservas disponíveis (tabela reservável + módulo ativo), aparece um alternador no topo de cada painel:

- **Lista** — exatamente a listagem atual (sem mudança de comportamento).
- **Calendário** — nova visualização, com um segundo alternador interno:
  - **Normal (mês)**: grade mensal com os dias e as reservas de cada dia (rótulo do item + faixa de horário/datas), navegação mês anterior/próximo, indicação visual do estágio da negociação pelos tokens de status existentes.
  - **Linha do tempo / Grade de ocupação**: uma linha por item reservável (recurso) e colunas por dia do período visível (semana ou mês), com barras contínuas ocupando o intervalo de cada reserva — leitura rápida de ocupação e vazios.

Comportamentos:
- Clicar numa reserva abre o mesmo painel de edição/ações já usado na lista.
- A preferência de visualização é lembrada por tabela durante a sessão.
- Filtros de estágio e "mostrar arquivadas" continuam valendo nas duas visualizações.
- Mobile: calendário mensal compacto e timeline com rolagem horizontal; alvos de toque ≥ 44px.

## Detalhes técnicos

- **Menu**: `AppShell` usa `getOrgModuleState` (já existente) com a organização resolvida por `orgSlug`, `staleTime` alto; itens de menu de módulo passam a vir de `MODULE_REGISTRY` (chave → rota/ícone/rótulo).
- **Dados**: sem migração e sem novo endpoint. As duas visões consomem o mesmo `listBookings` já usado na lista; quando em modo calendário, a consulta usa o intervalo do mês/semana visível em vez do filtro pontual.
- **Componentes novos** em `src/components/venue/`: `booking-calendar-view.tsx` (mês) e `booking-timeline-view.tsx` (grade de ocupação), ambos sobre primitives shadcn existentes (`Card`, `ScrollArea`, `Badge`, `Button`, `Tooltip`) e o `SegmentedToggle` já existente para as alternâncias. Sem biblioteca de calendário nova.
- **Tokens**: reutiliza os tokens de status de negociação já definidos em `src/styles.css`; nenhuma cor nova, nenhuma classe de cor fixa.
- Sem rota pública nova — sitemap inalterado. Validação em 360/768/1280 em light e dark; entrada no `CHANGELOG.md` como correção/extensão das Iterações 32 e 41.
