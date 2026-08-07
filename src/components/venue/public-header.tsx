import { Link } from "@tanstack/react-router";
import { ArrowLeft, LogIn, circle-user-round } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categorySlug, usePublicCategories } from "@/components/venue/category-tabs";

type Props = {
  showAuthActions?: boolean;
  /** Slug da categoria ativa (destaca o link correspondente). */
  activeCategorySlug?: string;
};

export function PublicHeader({ showAuthActions = true, activeCategorySlug }: Props) {
  const cats = usePublicCategories();
  const list = cats.data ?? [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            <img src="/Venuespace logo1.svg" alt="Venuespace Logo" className="h-5 w-auto" />
          </span>
        </Link>
        <nav className="flex min-w-0 shrink items-center gap-1 overflow-x-auto sm:gap-2">
          {list.map((c) => {
            const s = categorySlug(c);
            const active = activeCategorySlug === s;
            return (
              <Link key={c.id} to="/categoria/$slug" params={{ slug: s }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={active ? "text-foreground underline underline-offset-4" : "text-muted-foreground"}
                >
                  {c.name}
                </Button>
              </Link>
            );
          })}
          {showAuthActions ? (
            <Link to="/auth" aria-label="Entrar">
              <Button variant="ghost" size="icon" aria-label="Entrar">
                <circle-user-round className="h-4 w-4" />
              </Button>
            </Link>
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
