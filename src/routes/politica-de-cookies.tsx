import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicBreadcrumbs } from "@/components/venue/public-breadcrumbs";

import { Button } from "@/components/ui/button";
import { openCookiePreferences } from "@/lib/cookie-consent";

export const Route = createFileRoute("/politica-de-cookies")({
  head: () => ({
    meta: [
      { title: "Política de Cookies — Venuespace" },
      {
        name: "description",
        content:
          "Como o Venuespace usa cookies: categorias, finalidades, prazos e como revogar o consentimento, conforme a LGPD.",
      },
      { property: "og:title", content: "Política de Cookies — Venuespace" },
      {
        property: "og:description",
        content:
          "Como o Venuespace usa cookies: categorias, finalidades, prazos e como revogar o consentimento, conforme a LGPD.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://venuespace.com.br/politica-de-cookies" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://venuespace.com.br/politica-de-cookies" }],
  }),
  component: CookiePolicyPage,
});

const categories = [
  {
    name: "Necessários",
    purpose:
      "Autenticação, manutenção de sessão, segurança, prevenção a fraudes e preferências básicas de navegação.",
    examples: "Cookies de sessão do backend, token de autenticação, registro do próprio consentimento.",
    retention: "Sessão até 12 meses",
    legal: "Legítimo interesse / execução de contrato",
  },
  {
    name: "Analíticos",
    purpose:
      "Medir visitas, origem do tráfego, páginas mais acessadas e desempenho, de forma agregada, para melhorar a plataforma.",
    examples: "Google Tag Manager e Google Analytics.",
    retention: "Até 14 meses",
    legal: "Consentimento",
  },
  {
    name: "Marketing",
    purpose:
      "Mensurar campanhas, evitar repetição de anúncios e apresentar comunicação mais relevante em plataformas de mídia.",
    examples: "Tags de mensuração e remarketing acionadas pelo Google Tag Manager.",
    retention: "Até 12 meses",
    legal: "Consentimento",
  },
];

function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <PublicBreadcrumbs items={[{ label: "Home", to: "/" }, { label: "Política de Cookies" }]} />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Política de Cookies
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Última atualização: 14/08/2026</p>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">1. O que são cookies</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Cookies e tecnologias semelhantes (armazenamento local, pixels e identificadores)
              são pequenos arquivos gravados no seu dispositivo quando você acessa o
              Venuespace. Eles permitem que o site funcione corretamente, lembre suas escolhas
              e, quando você autoriza, ajudam a entender o uso da plataforma e a mensurar
              campanhas.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              2. Categorias e finalidades
            </h2>
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium text-foreground">Categoria</th>
                    <th className="px-4 py-2 font-medium text-foreground">Finalidade</th>
                    <th className="px-4 py-2 font-medium text-foreground">Exemplos</th>
                    <th className="px-4 py-2 font-medium text-foreground">Prazo</th>
                    <th className="px-4 py-2 font-medium text-foreground">Base legal</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.name} className="border-t border-border align-top">
                      <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.examples}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.retention}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.legal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Cookies necessários são indispensáveis à prestação do serviço e não podem ser
              desativados. Cookies analíticos e de marketing só são ativados após o seu
              consentimento — enquanto ele não é dado, as tags permanecem bloqueadas pelo
              modo de consentimento do Google Tag Manager.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              3. Como gerenciar seu consentimento
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Ao acessar o site pela primeira vez, você pode aceitar todos os cookies,
              rejeitar os não essenciais ou escolher categoria por categoria. Sua escolha é
              guardada neste navegador por 12 meses e pode ser alterada a qualquer momento
              pelo link "Preferências de cookies" no rodapé ou pelo botão abaixo.
            </p>
            <div className="mt-4">
              <Button className="h-11" onClick={() => openCookiePreferences()}>
                Abrir preferências de cookies
              </Button>
            </div>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Também é possível bloquear ou excluir cookies nas configurações do seu
              navegador. Nesse caso, algumas funcionalidades da plataforma podem deixar de
              funcionar corretamente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              4. Cookies de terceiros
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Utilizamos o Google Tag Manager para gerenciar tags de medição e marketing. Ao
              consentir, esses parceiros podem gravar cookies próprios, sujeitos às
              respectivas políticas de privacidade. Não vendemos dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              5. Seus direitos e contato
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Você pode solicitar confirmação de tratamento, acesso, correção, anonimização,
              portabilidade, eliminação e revogação do consentimento, nos termos do art. 18
              da LGPD, pelo e-mail{" "}
              <a
                href="mailto:contato@venuespace.com.br"
                className="text-foreground underline underline-offset-2"
              >
                contato@venuespace.com.br
              </a>
              . Detalhes completos sobre o tratamento de dados estão na{" "}
              <Link
                to="/politica-de-privacidade"
                className="text-foreground underline underline-offset-2"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
