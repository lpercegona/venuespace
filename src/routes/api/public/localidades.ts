import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/localidades")({
  server: {
    handlers: {
      GET: async () => {
        const { listPublicLocalities } = await import("@/lib/public.server");
        try {
          const payload = await listPublicLocalities();
          return new Response(JSON.stringify(payload), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
