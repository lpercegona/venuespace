import { createFileRoute } from "@tanstack/react-router";
import { getCategorySchemaPublic } from "@/lib/category-cascade.functions";

export const Route = createFileRoute("/api/public/category-schema/$categoryId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const data = await getCategorySchemaPublic({ data: { category_id: params.categoryId } });
          return Response.json(data, {
            headers: { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }
      },
    },
  },
});
