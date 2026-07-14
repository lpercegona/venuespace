import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/platform-labels")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listPlatformLabelsPublic } = await import("@/lib/platform-labels.functions");
          const data = await listPlatformLabelsPublic();
          return new Response(JSON.stringify(data), {
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
