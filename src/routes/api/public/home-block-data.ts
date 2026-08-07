import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/home-block-data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const source = url.searchParams.get("source") ?? "organizations";
        const orderBy = url.searchParams.get("order_by") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "6");
        const categoryIds = url.searchParams.getAll("category_id");
        const rulesParam = url.searchParams.get("rules");
        const rules = (() => {
          try {
            return rulesParam ? (JSON.parse(rulesParam) as any[]) : [];
          } catch {
            return [];
          }
        })();

        try {
          if (source === "records") {
            const { listPublicRecords } = await import("@/lib/public.server");
            const payload = await listPublicRecords({
              limit: Number.isFinite(limit) ? limit : 6,
              offset: 0,
              rules: rules as any,
            });
            return Response.json(payload);
          }

          const { listPublicOrganizations } = await import("@/lib/public.server");
          const payload = await listPublicOrganizations({
            limit: Number.isFinite(limit) ? limit : 6,
            offset: 0,
            rules: rules as any,
          });
          return Response.json(payload);
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
