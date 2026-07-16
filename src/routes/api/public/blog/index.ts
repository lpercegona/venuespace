import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/blog/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? 20);
        const { listPublicBlogPosts } = await import("@/lib/blog-public.server");
        try {
          const items = await listPublicBlogPosts(Number.isFinite(limit) ? limit : 20);
          return new Response(JSON.stringify({ items }), {
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
