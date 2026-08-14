import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicListing, PUBLIC_LISTING_PAGE_SIZE } from "@/components/venue/public-listing";
import { ListingHero } from "@/components/venue/listing-hero";
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

const PAGE_SIZE = PUBLIC_LISTING_PAGE_SIZE;

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
    await qc.ensureQueryData(categoryLayoutQuery(category.id, "organization_card"));
    await qc.ensureQueryData(categoryFiltersQuery(category.id, String(search.q ?? ""), extractFilters(search)));
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

  const availableFilters = (filtersQ.data?.filters ?? []).filter((f: any) => f.filter_type !== "search");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader activeCategorySlug={slug} />

      <PublicListing
        hero={<ListingHero title={`${category?.name ?? "Categoria"} do jeito que você busca!`} />}
        term={term}
        onTermChange={setTerm}
        filters={availableFilters as any}
        values={currentFilters}
        onFilterChange={setFilter}
        onClear={clearFilters}
        items={(orgsQ.data?.items ?? []) as any}
        isLoading={catsQ.isLoading || orgsQ.isPending}
        layout={layoutQ.data}
        total={orgsQ.data?.total ?? 0}
        page={page}
        onPageChange={(p) => updateSearch({ page: p > 1 ? p : undefined })}
      />

      <PublicFooter />
    </div>
  );
}
