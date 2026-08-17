import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CircleUserRound, Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categorySlug, usePublicCategories } from "@/components/venue/category-tabs";
import { VenuespaceLogo } from "@/components/venue/venuespace-logo";

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

  const exploreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-10 gap-1.5 sm:h-9",
            onHero
              ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              : "text-muted-foreground",
          )}
          aria-label="Explorar categorias"
        >
          <Compass className="h-5 w-5 sm:h-4 sm:w-4" />
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
        {list.length === 0 ? (
          cats.isPending ? (
            [0, 1, 2].map((i) => (
              <DropdownMenuItem key={`sk-${i}`} disabled className="pointer-events-none">
                <span className="h-4 w-24 animate-pulse rounded bg-muted" />
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>Nenhuma categoria</DropdownMenuItem>
          )
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        {/* Esquerda: Explore no mobile, logo no desktop */}
        <div className="flex min-w-0 items-center justify-start gap-2">
          <div className="sm:hidden">{exploreMenu}</div>
          <Link to="/" className="hidden min-w-0 items-center gap-2 sm:flex" aria-label="Venuespace — início">
            <VenuespaceLogo className={cn("h-5 w-auto", onHero ? "text-primary-foreground" : "text-brand")} />
          </Link>
        </div>

        {/* Centro: "Cadastrar empresa" no mobile, Explore no desktop. Na /para-empresas mobile mostra logo centralizada. */}
        <div className="min-w-0 justify-self-center">
          {pathname === "/para-empresas" || pathname === "/auth" ? (
            <Link to="/" className="flex sm:hidden" aria-label="Venuespace — início">
              <VenuespaceLogo className="h-5 w-auto text-brand" />
            </Link>
          ) : showAuthActions ? (
            <Link to="/para-empresas" className="sm:hidden">
              <Button
                size="sm"
                variant={onHero ? "secondary" : "default"}
                className="h-10 rounded-full px-4 whitespace-nowrap"
              >
                Cadastrar empresa
              </Button>
            </Link>
          ) : null}
          <div className="hidden sm:block">{exploreMenu}</div>
        </div>

        {/* Direita: "Cadastrar empresa" no desktop + login */}
        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          {showAuthActions ? (
            <Link to="/para-empresas" className="hidden sm:block">
              <Button
                size="sm"
                variant={onHero ? "secondary" : "default"}
                className="rounded-full px-4 whitespace-nowrap"
              >
                Cadastrar empresa
              </Button>
            </Link>
          ) : null}

          {/* Mobile: casa fora da home, login na home. Desktop: sempre login. */}
          <Link to={isHome ? "/auth" : "/"} aria-label={isHome ? "Entrar" : "Início"} className="sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isHome ? "Entrar" : "Início"}
              className={cn(
                "h-10 w-10",
                onHero ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" : "",
              )}
            >
              {isHome ? <CircleUserRound className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            </Button>
          </Link>
          <Link to="/auth" aria-label="Entrar" className="hidden sm:block">
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
