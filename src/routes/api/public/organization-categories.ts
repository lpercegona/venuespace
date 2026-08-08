import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/organization-categories")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listOrganizationCategoriesPublic } = await import("@/lib/organization-categories.functions");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [cats, { data: orgs }] = await Promise.all([
            listOrganizationCategoriesPublic(),
            supabaseAdmin.from("organizations").select("category_id").eq("is_public", true),
          ]);
          // Categorias sem nenhuma organização pública não aparecem na navegação.
          const withOrgs = new Set(((orgs ?? []) as any[]).map((o) => o.category_id).filter(Boolean));
          const data = (cats ?? []).filter((c) => withOrgs.has(c.id));
          return new Response(JSON.stringify(data), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
