import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";

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
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Contestações de espaços
        </h1>
        <p className="mt-4 text-muted-foreground">
          Para contestar a publicação de um espaço ou reivindicar a propriedade de um perfil, envie um e-mail para{" "}
          <a href="mailto:contato@venuespace.com.br" className="text-primary hover:underline">
            contato@venuespace.com.br
          </a>
          . O conteúdo completo desta página será publicado em breve.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
