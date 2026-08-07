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
        <p className="mt-4 text-muted-foreground">
          A Política de Privacidade completa da Venuespace será publicada em breve.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
