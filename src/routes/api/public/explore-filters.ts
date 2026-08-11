import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/explore-filters")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const scope = (url.searchParams.get("scope") ?? "organization") as "organization" | "record";
        const category_id = url.searchParams.get("category") ?? undefined;
        const q = url.searchParams.get("q") ?? undefined;
        const filters: Record<string, string> = {};
        for (const [k, v] of url.searchParams.entries()) {
          if (k.startsWith("f_") && v) filters[k.slice(2)] = v;
        }
        const { listExploreFilters } = await import("@/lib/explore-filters.server");
        try {
          const data = await listExploreFilters({ scope, category_id, q, filters });

          return Response.json(data, {
            headers: { "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
