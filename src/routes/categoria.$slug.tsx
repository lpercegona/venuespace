import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { PublicOrganizationSummary } from "@/lib/public.server";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { categorySlug, usePublicCategories } from "@/components/venue/category-tabs";
import { useCategoryLayout } from "@/hooks/use-public-catalog";

const searchSchema = z
  .object({
    q: fallback(z.string(), "").default(""),
    page: fallback(z.number().int(), 1).default(1),
  })
  .catchall(fallback(z.string(), "").default(""));

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: zodValidator(searchSchema as any),
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
  component: CategoryPage,
});

const PAGE_SIZE = 24;

type FilterDef = { key: string; label: string; filter_type: "search" | "select"; options: string[] };

async function fetchOrgs(
  q: string,
  offset: number,
  filters: Record<string, string>,
  categoryId?: string,
): Promise<{ items: PublicOrganizationSummary[]; total: number }> {
  const p = new URLSearchParams();
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(offset));
  if (q) p.set("q", q);
  if (categoryId) p.set("category", categoryId);
  for (const [k, v] of Object.entries(filters)) if (v) p.set(`f_${k}`, v);
  const res = await fetch(`/api/public/organizations?${p.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

async function fetchFilters(categoryId?: string): Promise<{ filters: FilterDef[] }> {
  const res = await fetch(
    `/api/public/explore-filters?scope=organization${categoryId ? `&category=${encodeURIComponent(categoryId)}` : ""}`,
  );
  if (!res.ok) return { filters: [] };
  return res.json();
}

function extractFilters(search: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(search)) {
    if (k.startsWith("f_") && typeof v === "string" && v) out[k.slice(2)] = v;
  }
  return out;
}

function CategoryPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch() as Record<string, any>;
  const navigate = Route.useNavigate();

  const catsQ = usePublicCategories();
  const category = (catsQ.data ?? []).find((c) => categorySlug(c) === slug) ?? null;
  const catId = category?.id;

  const currentFilters = useMemo(() => extractFilters(search), [search]);
  const q: string = search.q ?? "";
  const page: number = Math.max(1, Number(search.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;
  const [term, setTerm] = useState(q);

  const layoutQ = useCategoryLayout(catId, "organization_card");
  const filtersQ = useQuery({
    queryKey: ["category-filters", catId],
    queryFn: () => fetchFilters(catId),
    enabled: !!catId,
    staleTime: 5 * 60_000,
  });
  const orgsQ = useQuery({
    queryKey: ["category-orgs", catId, q, offset, currentFilters],
    queryFn: () => fetchOrgs(q, offset, currentFilters, catId),
    enabled: !!catId,
    staleTime: 30_000,
  });

  const total = orgsQ.data?.total ?? 0;

  function updateSearch(patch: Record<string, string | undefined>) {
    const next: Record<string, any> = { ...search };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
    navigate({ search: next as any });
  }

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
  const hasActive = Object.keys(currentFilters).length > 0 || !!q;

  const filterSelects = availableFilters.map((f) => (
    <Select
      key={f.key}
      value={currentFilters[f.key] ?? "__any"}
      onValueChange={(v) => setFilter(f.key, v === "__any" ? "" : v)}
    >
      <SelectTrigger className="h-10 w-full gap-2 sm:w-auto sm:min-w-[150px]">
        <SelectValue placeholder={f.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__any">{f.label}: todos</SelectItem>
        {f.options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader activeCategorySlug={slug} />

      <section className="mx-auto w-full max-w-6xl grow px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {category?.name ?? "Categoria"}
        </h1>

        {/* Busca + filtros em uma única linha (desktop); filtros em dropdown no mobile */}
        <div className="mt-6 flex items-center gap-2">
          <form
            className="flex min-w-0 grow items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateSearch({ q: term.trim() || undefined, page: undefined });
            }}
          >
            <div className="relative min-w-0 grow">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                placeholder="Buscar"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-10 shrink-0">
              Buscar
            </Button>
          </form>

          {availableFilters.length > 0 ? (
            <>
              <div className="hidden items-center gap-2 lg:flex">{filterSelects}</div>
              <div className="lg:hidden">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Filtros">
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 space-y-2">
                    {filterSelects}
                    {hasActive ? (
                      <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                        <X className="h-4 w-4" /> Limpar
                      </Button>
                    ) : null}
                  </PopoverContent>
                </Popover>
              </div>
            </>
          ) : null}

          {hasActive ? (
            <Button variant="ghost" size="sm" className="hidden h-10 shrink-0 lg:inline-flex" onClick={clearFilters}>
              <X className="h-4 w-4" /> Limpar
            </Button>
          ) : null}
        </div>

        <div className="mt-8">
          {catsQ.isLoading || orgsQ.isLoading ? (
            <PublicCardSkeletonGrid
              count={6}
              withLogo
              layout={layoutQ.data}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            />
          ) : (orgsQ.data?.items ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {total > PAGE_SIZE ? (
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateSearch({ page: page > 2 ? String(page - 1) : undefined })}
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
              onClick={() => updateSearch({ page: String(page + 1) })}
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
