import { Link } from "@tanstack/react-router";
import { ArrowLeft, Compass, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  showAuthActions?: boolean;
  showExplore?: boolean;
  showBlog?: boolean;
};

export function PublicHeader({ showAuthActions = true, showExplore = true, showBlog = true }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            <img
              src="/Venuespace logo1.svg"
              alt="Venuespace Logo"
              className="h-6 w-auto" // Ajuste a altura (h-6) conforme necessário para o seu layout
            />
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showExplore ? (
            <Link to="/explore">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Compass className="h-4 w-4" />
                <span className="hidden sm:inline">Explorar</span>
              </Button>
            </Link>
          ) : null}
          {showBlog ? (
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Blog</span>
              </Button>
            </Link>
          ) : null}
          {showAuthActions ? (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm">Começar</Button>
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

type BackTo =
  | { to: "/"; params?: undefined }
  | { to: "/explore"; params?: undefined }
  | { to: "/blog"; params?: undefined }
  | { to: "/public/$slug"; params: { slug: string } }
  | { to: "/public/$slug/$tableId"; params: { slug: string; tableId: string } };

export function BackLink({ to, params, label = "Voltar" }: BackTo & { label?: string }) {
  return (
    <Link
      to={to as any}
      params={params as any}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
