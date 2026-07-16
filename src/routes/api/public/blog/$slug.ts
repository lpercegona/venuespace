import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/blog/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getPublicBlogPostBySlug } = await import("@/lib/blog-public.server");
        try {
          const post = await getPublicBlogPostBySlug(String(params.slug));
          if (!post) return Response.json({ error: "not_found" }, { status: 404 });
          return new Response(JSON.stringify({ post }), {
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
