import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2, FileText, X } from "lucide-react";
import type { PublicOrganizationSummary, PublicRecordSummary } from "@/lib/public.server";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { getPublicCardTitle, PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { CategoryTabs, resolveCategory, usePublicCategories } from "@/components/venue/category-tabs";
import { useCategoryLayout, useHasPublicRecords } from "@/hooks/use-public-catalog";


import { useLabels } from "@/hooks/use-instance-context";

// Filter values are encoded in the URL as f_<key>=value.
const searchSchema = z.object({
  tab: fallback(z.string(), "orgs").default("orgs"),
  categoria: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
}).catchall(fallback(z.string(), "").default(""));

export const Route = createFileRoute("/explore")({
  validateSearch: zodValidator(searchSchema as any),
  head: () => ({
    meta: [
      { title: "Explorar — Venuespace" },
      { name: "description", content: "Descubra espaços de eventos e ambientes publicados no Venuespace." },
      { property: "og:title", content: "Explorar — Venuespace" },
      { property: "og:description", content: "Descubra espaços de eventos e ambientes publicados no Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorePage,
});

const PAGE_SIZE = 24;

type FilterDef = { key: string; label: string; filter_type: "search" | "select"; options: string[] };

function buildQuery(opts: {
  q: string;
  offset: number;
  filters: Record<string, string>;
  extra?: Record<string, string>;
}): string {
  const p = new URLSearchParams();
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(opts.offset));
  if (opts.q) p.set("q", opts.q);
  for (const [k, v] of Object.entries(opts.filters)) if (v) p.set(`f_${k}`, v);
  for (const [k, v] of Object.entries(opts.extra ?? {})) if (v) p.set(k, v);
  return p.toString();
}

async function fetchOrgs(q: string, offset: number, filters: Record<string, string>, categoryId?: string): Promise<{ items: PublicOrganizationSummary[]; total: number }> {
  const res = await fetch(`/api/public/organizations?${buildQuery({ q, offset, filters, extra: { category: categoryId ?? "" } })}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}
async function fetchRecords(q: string, offset: number, filters: Record<string, string>, categoryId?: string): Promise<{ items: PublicRecordSummary[]; total: number }> {
  const res = await fetch(`/api/public/records?${buildQuery({ q, offset, filters, extra: { category: categoryId ?? "" } })}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}
async function fetchFilters(scope: "organization" | "record", categoryId?: string): Promise<{ filters: FilterDef[] }> {
  const res = await fetch(`/api/public/explore-filters?scope=${scope}${categoryId ? `&category=${encodeURIComponent(categoryId)}` : ""}`);
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

function ExplorePage() {
  const { t } = useLabels();
  const search = Route.useSearch() as Record<string, any>;
  const navigate = Route.useNavigate();
  const requestedTab = search.tab === "records" ? "records" : "orgs";


  const orgsPlural = t("organizations", "Organizações");
  const recordsPlural = t("records", "Registros");

  const currentFilters = useMemo(() => extractFilters(search), [search]);
  const q: string = search.q ?? "";
  const page: number = Math.max(1, Number(search.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const [term, setTerm] = useState(q);

  const catsQ = usePublicCategories();
  const activeCat = resolveCategory(catsQ.data, search.categoria || undefined);
  const catId = activeCat?.id;
  // Alternância Organizações/Registros removida temporariamente.
  const activeTab: "orgs" | "records" = "orgs";

  const scope: "organization" | "record" = activeTab === "orgs" ? "organization" : "record";
  const orgLayoutQ = useCategoryLayout(catId, "organization_card");
  const recLayoutQ = useCategoryLayout(catId, "record_card");


  const filtersQ = useQuery({
    queryKey: ["explore-filters", scope, catId],
    queryFn: () => fetchFilters(scope, catId),
    staleTime: 5 * 60_000,
  });

  const orgsQ = useQuery({
    queryKey: ["explore-orgs", q, offset, currentFilters, catId],
    queryFn: () => fetchOrgs(q, offset, currentFilters, catId),
    enabled: activeTab === "orgs",
    staleTime: 30_000,
  });
  const recsQ = useQuery({
    queryKey: ["explore-records", q, offset, currentFilters, catId],
    queryFn: () => fetchRecords(q, offset, currentFilters, catId),
    enabled: activeTab === "records",
    staleTime: 30_000,
  });

  const active = activeTab === "orgs" ? orgsQ : recsQ;
  const total = active.data?.total ?? 0;

  function updateSearch(patch: Record<string, string | undefined>) {
    const next: Record<string, any> = { ...search };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
    navigate({ search: next as any });
  }

  function setTab(v: string) {
    // Reset page + free-text + filters when switching tabs (filters are scope-specific).
    const next: Record<string, any> = { tab: v };
    if (search.q) next.q = search.q;
    if (search.categoria) next.categoria = search.categoria;
    navigate({ search: next as any });
  }

  function setFilter(key: string, value: string) {
    const next: Record<string, any> = { ...search, page: undefined };
    if (value) next[`f_${key}`] = value;
    else delete next[`f_${key}`];
    navigate({ search: next as any });
  }

  function clearFilters() {
    const next: Record<string, any> = { tab: activeTab };
    if (search.categoria) next.categoria = search.categoria;
    navigate({ search: next as any });
    setTerm("");
  }

  const availableFilters = (filtersQ.data?.filters ?? []).filter((f) => f.filter_type === "select");
  const hasFilters = availableFilters.length > 0 || Object.keys(currentFilters).length > 0 || q;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <BackLink to="/" label="Início" />
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Explorar</h1>
        <p className="mt-2 text-sm text-muted-foreground">Navegue por espaços de eventos e ambientes publicados.</p>

        <CategoryTabs
          className="mt-6"
          categories={catsQ.data}
          isLoading={catsQ.isLoading}
          activeSlug={search.categoria || undefined}
          onSelect={(s) => navigate({ search: { tab: activeTab, categoria: s } as any })}
        />

        <Tabs value={activeTab} onValueChange={setTab} className="mt-4">
          {hasRecords ? (
            <TabsList>
              <TabsTrigger value="orgs" className="gap-1">
                <Building2 className="h-4 w-4" /> {orgsPlural}
              </TabsTrigger>
              <TabsTrigger value="records" className="gap-1">
                <FileText className="h-4 w-4" /> {recordsPlural}
              </TabsTrigger>
            </TabsList>
          ) : null}


          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateSearch({ q: term.trim() || undefined, page: undefined });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <Button type="submit">BUSCAR</Button>
          </form>

          {availableFilters.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {availableFilters.map((f) => (
                <Select
                  key={f.key}
                  value={currentFilters[f.key] ?? "__any"}
                  onValueChange={(v) => setFilter(f.key, v === "__any" ? "" : v)}
                >
                  <SelectTrigger className="h-9 w-auto min-w-[160px] gap-2">
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
              ))}
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4" /> Limpar
                </Button>
              ) : null}
            </div>
          ) : null}

          <TabsContent value="orgs" className="mt-6">
            {orgsQ.isLoading ? (
              <PublicCardSkeletonGrid count={6} withLogo layout={orgLayoutQ.data} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
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
          </TabsContent>

          <TabsContent value="records" className="mt-6">
            {recsQ.isLoading ? (
              <PublicCardSkeletonGrid count={6} layout={recLayoutQ.data} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
            ) : (recsQ.data?.items ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(recsQ.data?.items ?? []).map((r) => {
                  const hasLayout = (r.layout ?? []).length > 0;
                  const title = getPublicCardTitle({
                    layout: r.layout ?? [],
                    fields: r.fields ?? [],
                    data: r.data,
                    fallback: "Ambiente",
                  });
                  return (
                    <Link
                      key={r.record_id}
                      to="/public/$slug/$tableId/$recordId"
                      params={{ slug: r.org_slug, tableId: r.table_id, recordId: r.record_id }}
                      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
                        {hasLayout ? (
                          <div className="p-4">
                            <PublicCardBody layout={r.layout as any} fields={r.fields as any} data={r.data} />
                          </div>
                        ) : (
                          <>
                            <CardHeader className="pb-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="truncate">{r.org_name}</span>
                              </div>
                              <CardTitle className="font-display text-lg line-clamp-2">{title || "Ambiente"}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Badge variant="secondary">{new Date(r.created_at).toLocaleDateString("pt-BR")}</Badge>
                            </CardContent>
                          </>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>

            )}
          </TabsContent>
        </Tabs>

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
    </div>
  );
}
