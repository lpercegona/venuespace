import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicBreadcrumbs } from "@/components/venue/public-breadcrumbs";


export const Route = createFileRoute("/contestacao-de-espacos")({
  head: () => ({
    meta: [
      { title: "Contestações de espaços — Venuespace" },
      { name: "description", content: "Solicite a contestação ou remoção de um espaço listado na Venuespace." },
      { property: "og:title", content: "Contestações de espaços — Venuespace" },
      { property: "og:description", content: "Solicite a contestação ou remoção de um espaço listado na Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContestPage,
});

function ContestPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <PublicBreadcrumbs items={[{ label: "Home", to: "/" }, { label: "Contestações e reivindicações" }]} />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Contestações e reivindicações
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 13/08/2026
        </p>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              1. Sobre as fotografias publicadas
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Fotos indexadas de sites de organizações ou de buscadores na
              internet. Para reivindicar autoria ou solicitar remoção, siga
              o processo descrito abaixo.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              2. Reivindicar a propriedade de uma organização
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Esta organização é sua? Você pode reivindicar a propriedade e
              assumir o perfil. O processo funciona da seguinte forma:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                Envie a solicitação de reivindicação a partir do perfil da
                organização — seja ela um espaço, uma empresa, ou qualquer
                outra categoria de negócio publicada na plataforma.
              </li>
              <li>
                Crie uma conta, caso ainda não tenha uma, e apresente
                evidência do vínculo com a organização (e-mail com domínio
                correspondente, telefone já publicado no perfil, ou
                documento, conforme o caso).
              </li>
              <li>A solicitação entra em análise da nossa equipe.</li>
              <li>
                Após a análise, a organização é transferida para o
                solicitante, ou a solicitação é recusada com justificativa
                enviada por e-mail.
              </li>
            </ol>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Organizações sem proprietário continuam visíveis publicamente
              durante o processo, salvo decisão de ocultação por denúncia
              procedente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              3. Contestar conteúdo ou fotografia
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Qualquer pessoa pode reportar uma fotografia ou informação
              publicada na plataforma. Para isso:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                Envie sua identificação e a descrição do problema (autoria,
                informação incorreta, conteúdo inadequado), com evidência
                quando aplicável.
              </li>
              <li>
                Nossa equipe responde em até 7 dias úteis.
              </li>
              <li>
                Enquanto a solicitação está em análise, o conteúdo
                contestado pode ser ocultado preventivamente, sem exclusão
                definitiva até a conclusão da análise.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              4. Propriedade intelectual e direitos de imagem
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Quem publica conteúdo na Venuespace declara ser o titular dos
              direitos sobre o material enviado, ou possuir autorização
              válida para publicá-lo. Caso você identifique uso indevido de
              marca, texto, imagem ou qualquer outro material sobre o qual
              detenha direitos, entre em contato pelos canais abaixo,
              informando:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Identificação de quem contesta e, quando aplicável, comprovação de titularidade;</li>
              <li>Localização exata do conteúdo contestado na plataforma;</li>
              <li>Descrição do direito supostamente violado.</li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Solicitações comprovadamente procedentes resultam na remoção
              ou ocultação do conteúdo contestado.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              5. Contato
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Para qualquer um dos processos acima, envie um e-mail para{" "}
              <a
                href="mailto:contato@venuespace.com.br"
                className="text-primary hover:underline"
              >
                contato@venuespace.com.br
              </a>
              {" "}com o assunto correspondente (reivindicação de propriedade,
              contestação de conteúdo, ou propriedade intelectual).
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
