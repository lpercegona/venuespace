import { queryOptions } from "@tanstack/react-query";
import type { LayoutItem } from "@/components/venue/public-card-renderer";
import {
  getCategoryLayoutFn,
  getExploreFiltersFn,
  getHomeGroupingDataFn,
  getHomeGroupingsFn,
  getPublicCategoriesFn,
  listPublicOrganizationsFn,
} from "@/lib/public-catalog.functions";

const FIVE_MIN = 5 * 60_000;

export const homeGroupingsQuery = () =>
  queryOptions({
    queryKey: ["home-groupings"],
    queryFn: () => getHomeGroupingsFn(),
    staleTime: FIVE_MIN,
  });

export const homeGroupingDataQuery = (groupingId: string | undefined) =>
  queryOptions({
    queryKey: ["home-grouping-data", groupingId],
    queryFn: () => getHomeGroupingDataFn({ data: { groupingId: groupingId! } }),
    enabled: !!groupingId,
    staleTime: FIVE_MIN,
  });

export const publicCategoriesQuery = () =>
  queryOptions({
    queryKey: ["public-org-categories"],
    queryFn: () => getPublicCategoriesFn(),
    staleTime: FIVE_MIN,
  });

export const categoryLayoutQuery = (
  categoryId: string | undefined | null,
  scope: "organization_card" | "record_card" | "organization_page",
) =>
  queryOptions({
    queryKey: ["public-category-layout", categoryId ?? null, scope],
    queryFn: async () => (await getCategoryLayoutFn({ data: { categoryId: categoryId ?? null, scope } })) as LayoutItem[],
    staleTime: FIVE_MIN,
  });

/** Filtros dinâmicos: as opções variam conforme busca e demais filtros ativos. */
export const exploreFiltersQuery = (args: {
  scope?: "organization" | "record";
  categoryId: string | undefined;
  q?: string;
  filters?: Record<string, string>;
  enabled?: boolean;
}) => {
  const scope = args.scope ?? "organization";
  const q = args.q ?? "";
  const filters = args.filters ?? {};
  return queryOptions({
    queryKey: ["explore-filters", scope, args.categoryId, q, filters],
    queryFn: () => getExploreFiltersFn({ data: { scope, categoryId: args.categoryId, q, filters } }),
    enabled: args.enabled ?? true,
    staleTime: 60_000,
  });
};

export const categoryFiltersQuery = (
  categoryId: string | undefined,
  q = "",
  filters: Record<string, string> = {},
) => exploreFiltersQuery({ scope: "organization", categoryId, q, filters, enabled: !!categoryId });


export const categoryOrganizationsQuery = (args: {
  categoryId: string | undefined;
  q: string;
  limit: number;
  offset: number;
  filters: Record<string, string>;
}) =>
  queryOptions({
    queryKey: ["category-orgs", args.categoryId, args.q, args.offset, args.filters],
    queryFn: () =>
      listPublicOrganizationsFn({
        data: {
          limit: args.limit,
          offset: args.offset,
          q: args.q || undefined,
          category_id: args.categoryId,
          filters: args.filters,
        },
      }),
    enabled: !!args.categoryId,
    staleTime: 60_000,
  });
