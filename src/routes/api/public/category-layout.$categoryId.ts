import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/category-layout/$categoryId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const scope = url.searchParams.get("scope");
        if (scope !== "organization_card" && scope !== "record_card") {
          return Response.json({ error: "scope inválido" }, { status: 400 });
        }
        const { loadPublicLayout } = await import("@/lib/public.server");
        try {
          const fields = await loadPublicLayout(String(params.categoryId), scope);
          return new Response(JSON.stringify({ fields }), {
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
