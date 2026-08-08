import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/field-keys")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listAvailableFieldKeys } = await import("@/lib/home-data.server");
          const payload = await listAvailableFieldKeys();
          return Response.json(payload, {
            headers: { "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300" },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
