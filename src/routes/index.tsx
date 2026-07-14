import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Database, MessageSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary" aria-hidden />
            <span className="font-display text-lg font-semibold tracking-tight">Venuespace</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Começar</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Motor de dados para operações vivas
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Suas tabelas, suas páginas, suas conversas — <span className="text-primary">sem código</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Crie catálogos, candidaturas, campanhas e reservas em minutos. Publique
            páginas públicas, receba interessados por formulário e feche negócios direto no chat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-6">
                Criar minha organização
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Database, title: "Tabelas dinâmicas", body: "Modele qualquer domínio: imóveis, vagas, campanhas, catálogos." },
            { icon: Sparkles, title: "Publicação seletiva", body: "Marque registros como públicos e ganhe uma página pronta." },
            { icon: MessageSquare, title: "Chat com propostas", body: "Interessados conversam, negociam e você fecha em um lugar só." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Venuespace
        </div>
      </footer>
    </div>
  );
}
