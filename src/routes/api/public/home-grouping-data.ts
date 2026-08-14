import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/home-grouping-data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const groupingId = url.searchParams.get("grouping_id");
        if (!groupingId) return Response.json({ error: "grouping_id obrigatório" }, { status: 400 });
        try {
          const { loadHomeGroupingData } = await import("@/lib/home-data.server");
          const payload = await loadHomeGroupingData(groupingId);
          return Response.json(payload, {
            headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
          });

        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
