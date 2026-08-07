import { createFileRoute } from "@tanstack/react-router";

function parseFilters(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    if (k.startsWith("f_") && v) out[k.slice(2)] = v;
  }
  return out;
}

const ALLOWED_OPERATORS = new Set(["=", "!=", ">", ">=", "<", "<=", "contains", "filled"]);

function parseRules(sp: URLSearchParams): Array<{ field_key: string; operator: string; value?: string }> {
  const raw = sp.get("rules");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.field_key === "string" && ALLOWED_OPERATORS.has(r.operator))
      .map((r) => ({ field_key: r.field_key, operator: r.operator, value: typeof r.value === "string" ? r.value : undefined }));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/public/records")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "12"), 50);
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const q = url.searchParams.get("q") ?? undefined;
        const category_id = url.searchParams.get("category") ?? undefined;
        const slug = url.searchParams.get("slug") ?? undefined;
        const filters = parseFilters(url.searchParams);
        const rules = parseRules(url.searchParams);
        const { listPublicRecords } = await import("@/lib/public.server");
        try {
          const payload = await listPublicRecords({
            rules: rules as any,
            limit: Number.isFinite(limit) ? limit : 12,
            offset: Number.isFinite(offset) ? offset : 0,
            q,
            category_id,
            slug,
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
