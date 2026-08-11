import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { PublicFilterBar } from "@/components/venue/public-filter-bar";
import { PublicFilterSidebar } from "@/components/venue/public-filter-sidebar";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { categorySlug } from "@/components/venue/category-tabs";
import {
  categoryFiltersQuery,
  categoryLayoutQuery,
  categoryOrganizationsQuery,
  publicCategoriesQuery,
} from "@/lib/public-queries";


const searchSchema = z
  .object({
    q: fallback(z.string(), "").default(""),
    page: fallback(z.number().int(), 1).default(1),
  })
  .catchall(fallback(z.string(), "").default(""));

const PAGE_SIZE = 24;

function extractFilters(search: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(search)) {
    if (k.startsWith("f_") && typeof v === "string" && v) out[k.slice(2)] = v;
  }
  return out;
}

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: zodValidator(searchSchema as any),
  loaderDeps: ({ search }) => ({ search: search as Record<string, any> }),
  head: () => ({
    meta: [
      { title: "Categoria — Venuespace" },
      { name: "description", content: "Listagem de organizações publicadas por categoria no Venuespace." },
      { property: "og:title", content: "Categoria — Venuespace" },
      { property: "og:description", content: "Listagem de organizações publicadas por categoria no Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params, deps }) => {
    const qc = context.queryClient;
    const cats = (await qc.ensureQueryData(publicCategoriesQuery())) as Array<{ id: string; name: string }>;
    const category = cats.find((c) => categorySlug(c as any) === params.slug);
    if (!category) return;
    const search = deps.search ?? {};
    const page = Math.max(1, Number(search.page ?? 1));
    qc.prefetchQuery(categoryLayoutQuery(category.id, "organization_card"));
    qc.prefetchQuery(categoryFiltersQuery(category.id, String(search.q ?? ""), extractFilters(search)));
    await qc.ensureQueryData(
      categoryOrganizationsQuery({
        categoryId: category.id,
        q: String(search.q ?? ""),
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        filters: extractFilters(search),
      }),
    );
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      {(error as Error).message}
    </div>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch() as Record<string, any>;
  const navigate = Route.useNavigate();

  const catsQ = useQuery(publicCategoriesQuery());
  const category = (catsQ.data ?? []).find((c: any) => categorySlug(c) === slug) ?? null;
  const catId = (category as any)?.id as string | undefined;

  const currentFilters = useMemo(() => extractFilters(search), [search]);
  const q: string = search.q ?? "";
  const page: number = Math.max(1, Number(search.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;
  const [term, setTerm] = useState(q);
  const debouncedTerm = useDebouncedValue(term, 300);

  const layoutQ = useQuery(categoryLayoutQuery(catId, "organization_card"));
  const filtersQ = useQuery({ ...categoryFiltersQuery(catId, q, currentFilters), placeholderData: keepPreviousData });
  const orgsQ = useQuery({
    ...categoryOrganizationsQuery({ categoryId: catId, q, limit: PAGE_SIZE, offset, filters: currentFilters }),
    placeholderData: keepPreviousData,
  });

  const total = orgsQ.data?.total ?? 0;

  function updateSearch(patch: Record<string, string | number | undefined>) {
    const next: Record<string, any> = { ...search };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
    navigate({ search: next as any, replace: true });
  }

  // Busca instantânea: sincroniza o termo com a URL após o debounce.
  useEffect(() => {
    const value = debouncedTerm.trim();
    if (value === q) return;
    updateSearch({ q: value || undefined, page: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  function setFilter(key: string, value: string) {
    const next: Record<string, any> = { ...search, page: undefined };
    if (value) next[`f_${key}`] = value;
    else delete next[`f_${key}`];
    navigate({ search: next as any });
  }

  function clearFilters() {
    navigate({ search: {} as any });
    setTerm("");
  }

  const availableFilters = (filtersQ.data?.filters ?? []).filter((f) => f.filter_type === "select");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader activeCategorySlug={slug} />

      <section className="mx-auto w-full max-w-6xl grow px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {category?.name ?? "Categoria"}
        </h1>

        <div className="mt-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <PublicFilterSidebar
            className="hidden lg:sticky lg:top-24 lg:block"
            term={term}
            onTermChange={setTerm}
            filters={availableFilters as any}
            values={currentFilters}
            onFilterChange={setFilter}
            onClear={clearFilters}
          />

          <div className="min-w-0">
            <PublicFilterBar
              className="lg:hidden"
              term={term}
              onTermChange={setTerm}
              filters={availableFilters as any}
              values={currentFilters}
              onFilterChange={setFilter}
              onClear={clearFilters}
            />

            <div className="mt-8">
              {catsQ.isLoading || orgsQ.isPending ? (
                <PublicCardSkeletonGrid
                  count={6}
                  withLogo
                  layout={layoutQ.data}
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                />
              ) : (orgsQ.data?.items ?? []).length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {(orgsQ.data?.items ?? []).map((o) => (
                    <Link
                      key={o.id}
                      to="/public/$slug"
                      params={{ slug: o.slug }}
                      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
                        {o.layout && o.layout.length > 0 ? (
                          <div className="p-4">
                            <PublicCardBody layout={o.layout as any} fields={o.fields as any} data={o.data} orgName={o.name} />
                          </div>
                        ) : (
                          <>
                            <CardHeader className="pb-2">
                              <div className="flex items-center gap-2">
                                <OrgLogo src={(o as any).logo_url} alt={`Logo ${o.name}`} className="h-10 w-10" />
                                <CardTitle className="font-display text-lg line-clamp-2">{o.name}</CardTitle>
                              </div>
                            </CardHeader>
                            {o.description ? (
                              <CardContent>
                                <p className="line-clamp-2 text-sm text-muted-foreground">{o.description}</p>
                              </CardContent>
                            ) : null}
                          </>
                        )}
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>


        {total > PAGE_SIZE ? (
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateSearch({ page: page > 2 ? page - 1 : undefined })}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => updateSearch({ page: page + 1 })}
            >
              Próxima
            </Button>
          </div>
        ) : null}

      </section>

      <PublicFooter />
    </div>
  );
}
