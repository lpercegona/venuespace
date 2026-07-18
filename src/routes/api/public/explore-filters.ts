import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/explore-filters")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const scope = (url.searchParams.get("scope") ?? "organization") as "organization" | "record";
        const category_id = url.searchParams.get("category") ?? undefined;
        const { listExploreFilters } = await import("@/lib/explore-filters.server");
        try {
          const data = await listExploreFilters({ scope, category_id });
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
