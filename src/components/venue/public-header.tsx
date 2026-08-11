import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CircleUserRound, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categorySlug, usePublicCategories } from "@/components/venue/category-tabs";
import { cn } from "@/lib/utils";

type Props = {
  showAuthActions?: boolean;
  /** Slug da categoria ativa (destaca o link correspondente). */
  activeCategorySlug?: string;
};

/** Esconde o header em scroll down e revela em scroll up. */
function useScrollDirection() {
  const [hidden, setHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const last = useRef(0);

  useEffect(() => {
    last.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      setAtTop(y < 8);
      if (Math.abs(delta) > 6) {
        setHidden(delta > 0 && y > 80);
        last.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { hidden, atTop };
}

export function PublicHeader({ showAuthActions = true, activeCategorySlug }: Props) {
  const cats = usePublicCategories();
  const list = cats.data ?? [];
  const { hidden, atTop } = useScrollDirection();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const onHero = isHome && atTop;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[transform,background-color,color] duration-300 motion-reduce:transition-none",
        hidden ? "-translate-y-full" : "translate-y-0",
        onHero
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-surface/90 text-foreground backdrop-blur",
      )}
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 sm:flex sm:justify-between sm:gap-3 sm:px-6">
        {/* Logo: apenas em telas maiores */}
        <Link to="/" className="hidden min-w-0 items-center gap-2 sm:flex">
          <img src="/Venuespace logo1.svg" alt="Venuespace Logo" className="h-5 w-auto" />
        </Link>

        <div className="justify-self-start sm:justify-self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5",
                  onHero
                    ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Compass className="h-4 w-4" />
                <span className="hidden sm:inline">Explore</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="sm:min-w-40">
              {list.map((c) => {
                const s = categorySlug(c);
                return (
                  <DropdownMenuItem key={c.id} asChild>
                    <Link
                      to="/categoria/$slug"
                      params={{ slug: s }}
                      preload="intent"
                      className={activeCategorySlug === s ? "text-foreground" : ""}
                    >
                      {c.name}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              {list.length === 0 ? <DropdownMenuItem disabled>Nenhuma categoria</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="justify-self-center sm:justify-self-auto">
          <Link to="/auth">
            <Button
              size="sm"
              variant={onHero ? "secondary" : "default"}
              className="rounded-full px-4 whitespace-nowrap"
            >
              Cadastrar empresa
            </Button>
          </Link>
        </div>

        <div className="justify-self-end sm:justify-self-auto">
          {showAuthActions ? (
            <Link to="/auth" aria-label="Entrar">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Entrar"
                className={cn(
                  "h-9 w-9",
                  onHero ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" : "",
                )}
              >
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
