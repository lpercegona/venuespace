import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/home-config")({
  server: {
    handlers: {
      GET: async () => {
        const { listHomeGroupingsPublic } = await import("@/lib/home-config.functions");
        try {
          const payload = await listHomeGroupingsPublic();
          return new Response(JSON.stringify(payload), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
