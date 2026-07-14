import { Link } from "@tanstack/react-router";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

type BackTo =
  | { to: "/"; params?: undefined; label?: string }
  | { to: "/explore"; params?: undefined; label?: string }
  | { to: "/public/$slug/$tableId"; params: { slug: string; tableId: string }; label?: string };

type Props = {
  back?: BackTo;
  showAuthActions?: boolean;
  showExplore?: boolean;
};

export function PublicHeader({ back, showAuthActions = true, showExplore = true }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {back ? (
            <Link
              to={back.to as any}
              params={back.params as any}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={back.label ?? "Voltar"}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{back.label ?? "Voltar"}</span>
            </Link>
          ) : null}
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <div className="h-6 w-6 shrink-0 rounded-md bg-primary" aria-hidden />
            <span className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Venuespace
            </span>
          </Link>
        </div>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showExplore ? (
            <Link to="/explore">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Compass className="h-4 w-4" />
                <span className="hidden sm:inline">Explorar</span>
              </Button>
            </Link>
          ) : null}
          {showAuthActions ? (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Entrar</Button>
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
