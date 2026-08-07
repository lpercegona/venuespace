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
        <p className="mt-4 text-muted-foreground">
          O conteúdo completo dos termos e condições de uso da Venuespace será publicado em breve.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
