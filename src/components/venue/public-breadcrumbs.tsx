import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type PublicCrumb = {
  label: string;
  /** Rota de destino; quando ausente o item é renderizado como texto. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

type Props = {
  items: PublicCrumb[];
  className?: string;
};

/**
 * Trilha de navegação padrão das páginas públicas.
 * Mesma faixa visual usada na página imersiva de organização.
 */
export function PublicBreadcrumbs({ items, className }: Props) {
  const visible = items.filter((i) => i.label && i.label.trim().length > 0);
  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Trilha"
      className={cn("border-b border-border/60 bg-surface", className)}
    >
      <ol className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-hidden px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:px-6">
        {visible.map((item, i) => {
          const isLast = i === visible.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              {i > 0 ? (
                <li aria-hidden className="shrink-0 opacity-60">
                  &gt;
                </li>
              ) : null}
              <li className={cn("min-w-0", isLast ? "shrink" : "shrink-0")}>
                {item.to && !isLast ? (
                  <Link
                    to={item.to as any}
                    params={item.params as any}
                    search={item.search as any}
                    className="block truncate outline-hidden hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn("block truncate", isLast ? "text-foreground" : undefined)}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
