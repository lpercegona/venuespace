import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/instance-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getInstanceSettingsPublic } = await import("@/lib/instance-settings.functions");
          const data = await getInstanceSettingsPublic();
          return new Response(JSON.stringify(data), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
