import { Link } from "@tanstack/react-router";
import { ArrowLeft, CircleUserRound, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          <img src="/Venuespace logo1.svg" alt="Venuespace Logo" className="h-5 w-auto" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Compass className="h-4 w-4" />
              <span className="hidden sm:inline">Explore</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {list.map((c) => {
              const s = categorySlug(c);
              return (
                <DropdownMenuItem key={c.id} asChild>
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: s }}
                    className={activeCategorySlug === s ? "text-foreground" : ""}
                  >
                    {c.name}
                  </Link>
                </DropdownMenuItem>
              );
            })}
            {list.length === 0 ? (
              <DropdownMenuItem disabled>Nenhuma categoria</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button size="sm" className="rounded-full px-4">
              Cadastrar empresa
            </Button>
          </Link>
          {showAuthActions ? (
            <Link to="/auth" aria-label="Entrar">
              <Button variant="ghost" size="icon" aria-label="Entrar" className="h-9 w-9">
                <CircleUserRound className="h-5 w-5" />
              </Button>
            </Link>
          ) : null}
        </div>
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
