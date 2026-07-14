import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tables")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? "12");
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const q = url.searchParams.get("q") ?? undefined;
        const { listPublicTables } = await import("@/lib/public.server");
        try {
          const payload = await listPublicTables({
            limit: Number.isFinite(limit) ? limit : 12,
            offset: Number.isFinite(offset) ? offset : 0,
            q,
          });
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
