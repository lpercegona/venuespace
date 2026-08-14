// Server-only: monta a lista de URLs públicas do sitemap a partir do banco.
// Toda página pública nova (organização, tabela, registro, post, categoria)
// entra automaticamente — nada é mantido em lista fixa.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cachedSWR, cacheDelete } from "@/lib/server-cache";
import { slugify } from "@/lib/slug";

export type SitemapEntry = {
  path: string;
  lastmod?: string | null;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

const CACHE_KEY = "sitemap:entries";
const TTL = 60 * 60_000; // 1h
/** Limite do protocolo é 50.000 URLs; deixamos margem. */
const MAX_URLS = 45_000;

/** Páginas públicas estáticas (rotas autenticadas, de API e de token ficam fora). */
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/explore", changefreq: "daily", priority: "0.9" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/para-empresas", changefreq: "monthly", priority: "0.8" },
  { path: "/politica-de-privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/politica-de-cookies", changefreq: "yearly", priority: "0.3" },
  { path: "/termos-e-condicoes", changefreq: "yearly", priority: "0.3" },
  { path: "/contestacao-de-espacos", changefreq: "yearly", priority: "0.3" },
];

export function invalidateSitemapCache() {
  cacheDelete(CACHE_KEY);
}

async function buildEntries(): Promise<SitemapEntry[]> {
  const sb = supabaseAdmin;

  const [cats, posts, orgs] = await Promise.all([
    sb.from("organization_categories").select("id, name, updated_at"),
    sb.from("blog_posts").select("slug, updated_at").eq("status", "published"),
    sb.from("organizations").select("id, slug, updated_at").eq("is_public", true),
  ]);

  const orgRows = ((orgs.data ?? []) as any[]).filter((o) => o.slug);
  const orgById = new Map<string, { slug: string }>(orgRows.map((o) => [o.id as string, { slug: o.slug as string }]));

  const entries: SitemapEntry[] = [...STATIC_ENTRIES];

  for (const c of (cats.data ?? []) as any[]) {
    entries.push({ path: `/categoria/${slugify(c.name)}`, lastmod: c.updated_at, changefreq: "daily", priority: "0.9" });
  }

  for (const p of (posts.data ?? []) as any[]) {
    if (!p.slug) continue;
    entries.push({ path: `/blog/${p.slug}`, lastmod: p.updated_at, changefreq: "monthly", priority: "0.6" });
  }

  for (const o of orgRows) {
    entries.push({ path: `/public/${o.slug}`, lastmod: o.updated_at, changefreq: "weekly", priority: "0.8" });
  }

  if (orgById.size > 0) {
    const orgIds = Array.from(orgById.keys());
    const { data: tables } = await sb
      .from("tables")
      .select("id, organization_id, updated_at")
      .eq("is_public", true)
      .in("organization_id", orgIds);

    const tableRows = ((tables ?? []) as any[]).filter((t) => orgById.has(t.organization_id));
    const tableById = new Map<string, { orgSlug: string }>();
    for (const t of tableRows) {
      const org = orgById.get(t.organization_id)!;
      tableById.set(t.id as string, { orgSlug: org.slug });
    }

    // Só entram tabelas com pelo menos um registro publicado (mesmo recorte da listagem pública).
    const recordsByTable = new Map<string, Array<{ id: string; updated_at: string }>>();
    if (tableById.size > 0) {
      const ids = Array.from(tableById.keys());
      const CHUNK = 100;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data: recs } = await sb
          .from("records")
          .select("id, table_id, updated_at")
          .eq("status", "published")
          .in("table_id", ids.slice(i, i + CHUNK))
          .order("updated_at", { ascending: false })
          .limit(5000);
        for (const r of (recs ?? []) as any[]) {
          const list = recordsByTable.get(r.table_id) ?? [];
          list.push({ id: r.id, updated_at: r.updated_at });
          recordsByTable.set(r.table_id, list);
        }
      }
    }

    for (const t of tableRows) {
      const recs = recordsByTable.get(t.id) ?? [];
      if (recs.length === 0) continue;
      const meta = tableById.get(t.id)!;
      entries.push({
        path: `/public/${meta.orgSlug}/${t.id}`,
        lastmod: t.updated_at,
        changefreq: "weekly",
        priority: "0.7",
      });
      for (const r of recs) {
        entries.push({
          path: `/public/${meta.orgSlug}/${t.id}/${r.id}`,
          lastmod: r.updated_at,
          changefreq: "weekly",
          priority: "0.6",
        });
      }
    }
  }

  return entries.slice(0, MAX_URLS);
}

export async function loadSitemapEntries(): Promise<SitemapEntry[]> {
  return cachedSWR(CACHE_KEY, TTL, buildEntries);
}
