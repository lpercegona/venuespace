import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/organizations/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getPublicOrganization } = await import("@/lib/public.server");
        try {
          const item = await getPublicOrganization(String(params.slug));
          return new Response(JSON.stringify(item), {
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
