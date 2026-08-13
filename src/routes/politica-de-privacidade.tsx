import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Venuespace" },
      { name: "description", content: "Política de Privacidade da plataforma Venuespace." },
      { property: "og:title", content: "Política de Privacidade — Venuespace" },
      { property: "og:description", content: "Política de Privacidade da plataforma Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 13/08/2026
        </p>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              1. Quem somos
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              A Venuespace ("nós", "plataforma") é operada por [razão
              social], CNPJ [número], com sede em Curitiba, Paraná, Brasil.
              Esta política descreve como coletamos, usamos e protegemos os
              dados pessoais de quem utiliza a plataforma, em conformidade
              com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              2. Dados que coletamos
            </h2>
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium text-foreground">
                      Categoria
                    </th>
                    <th className="px-4 py-2 font-medium text-foreground">
                      Exemplos
                    </th>
                    <th className="px-4 py-2 font-medium text-foreground">
                      Quando é coletado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Cadastro</td>
                    <td className="px-4 py-2 text-muted-foreground">Nome, e-mail, senha (hash)</td>
                    <td className="px-4 py-2 text-muted-foreground">Criação de conta</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Organização</td>
                    <td className="px-4 py-2 text-muted-foreground">Nome, descrição, categoria</td>
                    <td className="px-4 py-2 text-muted-foreground">Criação/edição de organização</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Endereço e localização</td>
                    <td className="px-4 py-2 text-muted-foreground">CEP, cidade, estado, rua, coordenadas</td>
                    <td className="px-4 py-2 text-muted-foreground">Cadastro de organização/espaço</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Solicitação/lead</td>
                    <td className="px-4 py-2 text-muted-foreground">Nome, e-mail, telefone</td>
                    <td className="px-4 py-2 text-muted-foreground">Envio de formulário público, com ou sem conta</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Conversa</td>
                    <td className="px-4 py-2 text-muted-foreground">Conteúdo das mensagens, propostas de valor</td>
                    <td className="px-4 py-2 text-muted-foreground">Uso do chat de negociação</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Uso e cookies</td>
                    <td className="px-4 py-2 text-muted-foreground">Páginas visitadas, dispositivo, IP</td>
                    <td className="px-4 py-2 text-muted-foreground">Navegação na plataforma</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              3. Cookies
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Utilizamos cookies e tecnologias semelhantes para manter sua
              sessão autenticada, lembrar preferências
              e entender como a plataforma é utilizada, para fins de melhoria
              contínua.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                <span className="text-foreground">Essenciais:</span>{" "}
                necessários para login e funcionamento básico da plataforma;
                não podem ser desativados.
              </li>
              <li>
                <span className="text-foreground">Preferência:</span>{" "}
                armazenam configurações de exibição, como tema claro/escuro.
              </li>
              <li>
                <span className="text-foreground">Desempenho e uso:</span>{" "}
                ajudam a entender como a plataforma é utilizada, de forma
                agregada.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Você pode gerenciar ou bloquear cookies diretamente nas
              configurações do seu navegador; desativar cookies essenciais
              pode impedir o funcionamento correto da plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              4. Finalidade e base legal do tratamento
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                <span className="text-foreground">Execução de contrato/pré-contrato:</span>{" "}
                viabilizar cadastro, publicação de organizações, espaços,
                produtos e serviços, contato entre as partes e negociação.
              </li>
              <li>
                <span className="text-foreground">Legítimo interesse:</span>{" "}
                segurança da plataforma, prevenção de fraude e abuso,
                melhoria do serviço, e manutenção de um diretório de
                organizações relevante para quem busca espaços, produtos e
                serviços.
              </li>
              <li>
                <span className="text-foreground">Consentimento:</span>{" "}
                comunicações de marketing (quando aplicável), quando não
                decorrentes diretamente do uso da plataforma.
              </li>
              <li>
                <span className="text-foreground">Cumprimento de obrigação legal:</span>{" "}
                quando exigido por autoridade competente.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              5. Organizações cadastradas sem usuário proprietário
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Algumas organizações listadas na plataforma podem não estar
              vinculadas a um usuário proprietário cadastrado. Nesses casos,
              as informações exibidas — como nome, descrição, endereço e
              fotografias — têm origem em fontes públicas, como o próprio
              site da organização ou resultados de mecanismos de busca, e
              são tratadas como informação pública já disponível na internet.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Se você é responsável por uma organização listada nessas
              condições, pode reivindicar a propriedade do perfil ou
              solicitar a correção, atualização ou remoção das informações
              publicadas, entrando em contato pelo e-mail{" "}
              <a
                href="mailto:contato@venuespace.com.br"
                className="text-primary hover:underline"
              >
                contato@venuespace.com.br
              </a>
              . Mais detalhes sobre o processo de reivindicação estão
              descritos na nossa página de{" "}
              <a href="/contestacao" className="text-primary hover:underline">
                Contestações
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              6. Com quem compartilhamos dados
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                Com a organização/empresa responsável, quando o titular
                envia uma solicitação de contato, candidatura ou orçamento
                — essa é a finalidade central do serviço.
              </li>
              <li>
                Com prestadores de infraestrutura técnica (hospedagem, banco
                de dados, envio de e-mail), sob contrato de confidencialidade.
              </li>
              <li>Não vendemos dados pessoais a terceiros para fins de publicidade.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              7. Direitos do titular
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Você pode, a qualquer momento, solicitar: confirmação de
              tratamento, acesso aos dados, correção de dados incompletos ou
              desatualizados, anonimização/exclusão de dados desnecessários,
              portabilidade e revogação de consentimento. Solicitações podem
              ser feitas em{" "}
              <a
                href="mailto:contato@venuespace.com.br"
                className="text-primary hover:underline"
              >
                contato@venuespace.com.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              8. Retenção de dados
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Dados de conta são mantidos enquanto a conta estiver ativa.
              Dados de solicitações/leads não convertidos em negociação são
              retidos por prazo indeterminado a partir do último contato,
              após o qual são anonimizados ou excluídos, salvo obrigação
              legal de retenção.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              9. Segurança
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Adotamos controles técnicos e administrativos para proteger os
              dados, incluindo controle de acesso por papel, isolamento de
              dados por organização e criptografia em trânsito. Nenhum
              sistema é inteiramente livre de risco; em caso de incidente
              relevante, notificaremos os titulares afetados e a ANPD
              conforme exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              10. Encarregado de Dados (DPO)
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              [Nome/e-mail de contato do encarregado, a definir]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              11. Alterações desta política
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Alterações relevantes serão comunicadas por e-mail ou aviso na
              plataforma, com a data de última atualização sempre indicada
              no topo desta página.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
