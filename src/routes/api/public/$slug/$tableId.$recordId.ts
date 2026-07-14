import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/$slug/$tableId/$recordId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { loadPublicRecord } = await import("@/lib/public.server");
        try {
          const payload = await loadPublicRecord(params.slug, params.tableId, params.recordId);
          return Response.json(payload);
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 404 });
        }
      },
    },
  },
});
