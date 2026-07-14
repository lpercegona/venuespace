import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/$slug/$tableId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { loadPublicTable } = await import("@/lib/public.server");
        try {
          const payload = await loadPublicTable(params.slug, params.tableId);
          return new Response(JSON.stringify(payload), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 404 });
        }
      },
    },
  },
});
