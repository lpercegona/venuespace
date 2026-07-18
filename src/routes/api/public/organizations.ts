import { createFileRoute } from "@tanstack/react-router";

function parseFilters(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    if (k.startsWith("f_") && v) out[k.slice(2)] = v;
  }
  return out;
}

export const Route = createFileRoute("/api/public/organizations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? "12");
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const q = url.searchParams.get("q") ?? undefined;
        const category_id = url.searchParams.get("category") ?? undefined;
        const filters = parseFilters(url.searchParams);
        const { listPublicOrganizations } = await import("@/lib/public.server");
        try {
          const payload = await listPublicOrganizations({
            limit: Number.isFinite(limit) ? limit : 12,
            offset: Number.isFinite(offset) ? offset : 0,
            q,
            category_id,
            filters,
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
