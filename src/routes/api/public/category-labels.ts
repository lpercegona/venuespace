import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/category-labels")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listCategoryLabelsPublic } = await import("@/lib/platform-labels.functions");
          const data = await listCategoryLabelsPublic();
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
