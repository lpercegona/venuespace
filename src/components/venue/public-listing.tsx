import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { PublicFilterSidebar } from "@/components/venue/public-filter-sidebar";
import { MobileFilterDock } from "@/components/venue/mobile-filter-dock";
import type { PublicFilterDef } from "@/components/venue/public-filter-bar";
import type { LayoutItem } from "@/components/venue/public-card-renderer";

export const PUBLIC_LISTING_PAGE_SIZE = 24;

type OrgItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  data: Record<string, any>;
  layout?: any[];
  fields?: any[];
};

type Props = {
  title: string;
  description?: string;
  /** Conteúdo extra entre o título e a listagem (ex.: abas de categoria). */
  aboveContent?: React.ReactNode;
  beforeTitle?: React.ReactNode;
  term: string;
  onTermChange: (v: string) => void;
  filters: PublicFilterDef[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClear: () => void;
  items: OrgItem[];
  isLoading: boolean;
  layout?: LayoutItem[] | null;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
};

const GRID_CLS = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

/** Listagem pública unificada (explorar e páginas de categoria). */
export function PublicListing({
  title,
  description,
  aboveContent,
  beforeTitle,
  term,
  onTermChange,
  filters,
  values,
  onFilterChange,
  onClear,
  items,
  isLoading,
  layout,
  total,
  page,
  onPageChange,
}: Props) {
  const pageSize = PUBLIC_LISTING_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  return (
    <section className="mx-auto w-full max-w-6xl grow px-4 py-10 pb-28 sm:px-6 lg:pb-10">
      {beforeTitle}
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {aboveContent}

      <div className="mt-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <PublicFilterSidebar
          className="hidden lg:sticky lg:top-24 lg:block"
          term={term}
          onTermChange={onTermChange}
          filters={filters}
          values={values}
          onFilterChange={onFilterChange}
          onClear={onClear}
        />

        <div className="min-w-0">
          {isLoading ? (
            <PublicCardSkeletonGrid count={6} withLogo layout={layout} className={GRID_CLS} />
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            <div className={GRID_CLS}>
              {items.map((o, i) => (
                <PublicOrgCard key={o.id} org={o} priority={i < 3} />
              ))}
            </div>
          )}

          {total > pageSize ? (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + pageSize, total)} de {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + pageSize >= total}
                onClick={() => onPageChange(page + 1)}
              >
                Próxima
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <MobileFilterDock
        term={term}
        onTermChange={onTermChange}
        filters={filters}
        values={values}
        onFilterChange={onFilterChange}
        onClear={onClear}
        total={total}
      />
    </section>
  );
}

export function PublicOrgCard({ org, priority }: { org: OrgItem; priority?: boolean }) {
  return (
    <Link
      to="/public/$slug"
      params={{ slug: org.slug }}
      preload="intent"
      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
        {org.layout && org.layout.length > 0 ? (
          <div className="p-4">
            <PublicCardBody
              layout={org.layout as any}
              fields={org.fields as any}
              data={org.data}
              orgName={org.name}
              priority={priority}
            />
          </div>
        ) : (
          <>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <OrgLogo src={org.logo_url ?? null} alt={`Logo ${org.name}`} className="h-10 w-10" />
                <CardTitle className="font-display text-lg line-clamp-2">{org.name}</CardTitle>
              </div>
            </CardHeader>
            {org.description ? (
              <CardContent>
                <p className="line-clamp-2 text-sm text-muted-foreground">{org.description}</p>
              </CardContent>
            ) : null}
          </>
        )}
      </Card>
    </Link>
  );
}
