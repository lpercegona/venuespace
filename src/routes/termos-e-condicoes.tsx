import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";

export const Route = createFileRoute("/termos-e-condicoes")({
  head: () => ({
    meta: [
      { title: "Termos e condições — Venuespace" },
      { name: "description", content: "Termos e condições de uso da plataforma Venuespace." },
      { property: "og:title", content: "Termos e condições — Venuespace" },
      { property: "og:description", content: "Termos e condições de uso da plataforma Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Termos e condições
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 13/08/2026
        </p>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              1. Objeto
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              A Venuespace é uma plataforma que conecta pessoas e organizações
              — empresas, espaços, prestadores de serviço, entre outras
              categorias de negócio — a pessoas interessadas, permitindo
              publicação de perfis e anúncios, contato e negociação direta
              entre as partes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              2. Papel da plataforma na negociação
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                A Venuespace não é parte na negociação, não processa
                pagamentos e não garante o cumprimento do acordo entre as
                partes.
              </strong>
              A plataforma disponibiliza a infraestrutura de publicação,
              busca e comunicação; a formalização do negócio, o pagamento e a
              prestação do serviço/entrega ocorrem diretamente entre o
              anunciante e o interessado, fora da plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              3. Cadastro
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              O usuário é responsável pela veracidade das informações
              fornecidas no cadastro e na publicação de organizações,
              independentemente de sua categoria ou natureza (empresa,
              espaço, prestador de serviço, entre outras). Contas podem ser
              suspensas em caso de informação falsa, fraude ou uso abusivo.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              4. Conteúdo enviado pelo usuário
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Ao publicar fotos, descrições ou qualquer outro conteúdo, o
              usuário declara ser o titular dos direitos sobre o material
              enviado, ou possuir autorização válida para publicá-lo, e é o
              único responsável por eventual violação de direitos de
              terceiros decorrente do conteúdo publicado.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              5. Regras de uso
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              É vedado:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Publicar conteúdo falso, ofensivo ou ilegal;</li>
              <li>Usar a plataforma para fins diversos da finalidade descrita;</li>
              <li>Tentar acessar dados de outros usuários sem autorização;</li>
              <li>
                Utilizar a plataforma para práticas discriminatórias na
                oferta ou negociação de organizações, produtos ou serviços de
                qualquer categoria.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              6. Limitação de responsabilidade
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Na máxima extensão permitida por lei, a Venuespace não se
              responsabiliza por:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                Qualidade, segurança ou legalidade das organizações,
                produtos ou serviços anunciados, independentemente da
                categoria;
              </li>
              <li>Cumprimento do que foi acordado entre as partes;</li>
              <li>
                Danos decorrentes de negociações.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              7. Propriedade intelectual
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              O conteúdo publicado por cada organização
              permanece de titularidade de quem o enviou, sob licença de uso
              para exibição na plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              8. Rescisão
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Qualquer parte pode encerrar a conta a qualquer momento. A
              Venuespace pode suspender ou remover contas que violem estes
              termos, mediante notificação quando possível.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              9. Foro
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Fica eleito o foro da comarca de Curitiba, Paraná, para
              dirimir eventuais controvérsias decorrentes destes termos.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
