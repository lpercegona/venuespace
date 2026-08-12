import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import type { PublicOrganizationSummary } from "@/lib/public.server";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicListing, PUBLIC_LISTING_PAGE_SIZE } from "@/components/venue/public-listing";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CategoryTabs, resolveCategory, usePublicCategories } from "@/components/venue/category-tabs";
import { useCategoryLayout } from "@/hooks/use-public-catalog";

// Filter values are encoded in the URL as f_<key>=value.
const searchSchema = z
  .object({
    tab: fallback(z.string(), "orgs").default("orgs"),
    categoria: fallback(z.string(), "").default(""),
    q: fallback(z.string(), "").default(""),
    page: fallback(z.number().int(), 1).default(1),
  })
  .catchall(fallback(z.string(), "").default(""));

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

const PAGE_SIZE = PUBLIC_LISTING_PAGE_SIZE;

type FilterDef = {
  key: string;
  label: string;
  filter_type: "search" | "select" | "range";
  options: string[];
  min_options?: number[];
  max_options?: number[];
};

function buildQuery(opts: { q: string; offset: number; filters: Record<string, string>; extra?: Record<string, string> }): string {
  const p = new URLSearchParams();
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(opts.offset));
  if (opts.q) p.set("q", opts.q);
  for (const [k, v] of Object.entries(opts.filters)) if (v) p.set(`f_${k}`, v);
  for (const [k, v] of Object.entries(opts.extra ?? {})) if (v) p.set(k, v);
  return p.toString();
}

async function fetchOrgs(
  q: string,
  offset: number,
  filters: Record<string, string>,
  categoryId?: string,
): Promise<{ items: PublicOrganizationSummary[]; total: number }> {
  const res = await fetch(`/api/public/organizations?${buildQuery({ q, offset, filters, extra: { category: categoryId ?? "" } })}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

async function fetchFilters(
  scope: "organization" | "record",
  categoryId: string | undefined,
  q: string,
  filters: Record<string, string>,
): Promise<{ filters: FilterDef[] }> {
  const p = new URLSearchParams();
  p.set("scope", scope);
  if (categoryId) p.set("category", categoryId);
  if (q) p.set("q", q);
  for (const [k, v] of Object.entries(filters)) if (v) p.set(`f_${k}`, v);
  const res = await fetch(`/api/public/explore-filters?${p.toString()}`);
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
  const search = Route.useSearch() as Record<string, any>;
  const navigate = Route.useNavigate();

  const currentFilters = useMemo(() => extractFilters(search), [search]);
  const q: string = search.q ?? "";
  const page: number = Math.max(1, Number(search.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const [term, setTerm] = useState(q);
  const debouncedTerm = useDebouncedValue(term, 300);

  const catsQ = usePublicCategories();
  const activeCat = resolveCategory(catsQ.data, search.categoria || undefined);
  const catId = activeCat?.id;
  const orgLayoutQ = useCategoryLayout(catId, "organization_card");

  const filtersQ = useQuery({
    queryKey: ["explore-filters", "organization", catId, q, currentFilters],
    queryFn: () => fetchFilters("organization", catId, q, currentFilters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const orgsQ = useQuery({
    queryKey: ["explore-orgs", q, offset, currentFilters, catId],
    queryFn: () => fetchOrgs(q, offset, currentFilters, catId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  function updateSearch(patch: Record<string, string | number | undefined>) {
    const next: Record<string, any> = { ...search };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
    navigate({ search: next as any, replace: true });
  }

  // Busca instantânea (debounce).
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
    const next: Record<string, any> = {};
    if (search.categoria) next.categoria = search.categoria;
    navigate({ search: next as any });
    setTerm("");
  }

  const availableFilters = (filtersQ.data?.filters ?? []).filter((f) => f.filter_type !== "search");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <PublicListing
        beforeTitle={<BackLink to="/" label="Início" />}
        title="Explorar"
        description="Navegue por espaços de eventos e ambientes publicados."
        aboveContent={
          <CategoryTabs
            className="mt-6"
            categories={catsQ.data}
            isLoading={catsQ.isLoading}
            activeSlug={search.categoria || undefined}
            onSelect={(s) => navigate({ search: { categoria: s } as any })}
          />
        }
        term={term}
        onTermChange={setTerm}
        filters={availableFilters as any}
        values={currentFilters}
        onFilterChange={setFilter}
        onClear={clearFilters}
        items={(orgsQ.data?.items ?? []) as any}
        isLoading={orgsQ.isPending}
        layout={orgLayoutQ.data}
        total={orgsQ.data?.total ?? 0}
        page={page}
        onPageChange={(p) => updateSearch({ page: p > 1 ? p : undefined })}
      />

      <PublicFooter />
    </div>
  );
}
