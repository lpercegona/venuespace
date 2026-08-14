import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Categorias públicas (apenas as que possuem organizações publicadas). */
export const getPublicCategoriesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listOrganizationCategoriesPublic } = await import("@/lib/organization-categories.functions");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [cats, { data: orgs }] = await Promise.all([
    listOrganizationCategoriesPublic(),
    supabaseAdmin.from("organizations").select("category_id").eq("is_public", true),
  ]);
  const withOrgs = new Set(((orgs ?? []) as any[]).map((o) => o.category_id).filter(Boolean));
  return ((cats ?? []) as any[]).filter((c) => withOrgs.has(c.id));
});

/** Agrupamentos + blocos ativos da home. */
export const getHomeGroupingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listHomeGroupingsPublic } = await import("@/lib/home-config.functions");
  return listHomeGroupingsPublic();
});

/** Dados (cards/links) de um agrupamento da home. */
export const getHomeGroupingDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ groupingId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { loadHomeGroupingData } = await import("@/lib/home-data.server");
    return loadHomeGroupingData(data.groupingId);
  });

/** Layout público configurado pelo super admin para a categoria. */
export const getCategoryLayoutFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        categoryId: z.string().nullable().optional(),
        scope: z.enum(["organization_card", "record_card", "organization_page"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadPublicLayout } = await import("@/lib/public.server");
    return loadPublicLayout(data.categoryId ?? null, data.scope);
  });

/** Listagem pública de organizações (busca, filtros e paginação). */
export const listPublicOrganizationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(48).optional(),
        offset: z.number().int().min(0).optional(),
        q: z.string().optional(),
        category_id: z.string().optional(),
        filters: z.record(z.string(), z.string()).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { listPublicOrganizations } = await import("@/lib/public.server");
    return listPublicOrganizations(data);
  });

/** Filtros configurados para a listagem pública (opções calculadas dinamicamente). */
export const getExploreFiltersFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        scope: z.enum(["organization", "record"]).default("organization"),
        categoryId: z.string().optional(),
        q: z.string().optional(),
        filters: z.record(z.string(), z.string()).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { listExploreFilters } = await import("@/lib/explore-filters.server");
    return listExploreFilters({
      scope: data.scope,
      category_id: data.categoryId,
      q: data.q,
      filters: data.filters,
    });
  });


/** Bairros e cidades das organizações públicas (links de localidade da home). */
export const getPublicLocalitiesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listPublicLocalities } = await import("@/lib/public.server");
  return listPublicLocalities();
});
