// Server-only helper computing explore filter definitions + distinct option values.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ExploreFilterDef = {
  key: string;
  label: string;
  filter_type: "search" | "select";
  options: string[]; // only for select
};

function resolveOrgValue(org: any, key: string): unknown {
  if (key === "name") return org.name;
  if (key === "slug") return org.slug;
  if (key === "description") return org.description;
  if (key.startsWith("address.")) {
    const k = key.slice("address.".length);
    return (org.address ?? {})[k];
  }
  return (org.category_data ?? {})[key];
}

function resolveRecordValue(rec: any, key: string): unknown {
  return (rec.data ?? {})[key];
}

const ORG_BASE_LABELS: Record<string, string> = {
  name: "Nome",
  slug: "Slug",
  description: "Descrição",
  "address.cep": "CEP",
  "address.street": "Logradouro",
  "address.number": "Número",
  "address.complement": "Complemento",
  "address.neighborhood": "Bairro",
  "address.city": "Cidade",
  "address.state": "UF",
};

export async function listExploreFilters(opts: {
  scope: "organization" | "record";
  category_id?: string;
}): Promise<{ filters: ExploreFilterDef[] }> {
  const sb = supabaseAdmin as any;

  // If no category is chosen, aggregate filters across all categories that have entries.
  let filterRows: any[] = [];
  if (opts.category_id) {
    const { data } = await sb
      .from("category_filter_fields")
      .select("field_key, filter_type, label_override, order_index, scope, category_id")
      .eq("category_id", opts.category_id)
      .eq("scope", opts.scope)
      .order("order_index");
    filterRows = data ?? [];
  } else {
    const { data } = await sb
      .from("category_filter_fields")
      .select("field_key, filter_type, label_override, order_index, scope, category_id")
      .eq("scope", opts.scope)
      .order("order_index");
    filterRows = data ?? [];
  }

  if (filterRows.length === 0) return { filters: [] };

  // Deduplicate by key (keep first).
  const seen = new Map<string, any>();
  for (const r of filterRows) if (!seen.has(r.field_key)) seen.set(r.field_key, r);
  const uniq = Array.from(seen.values());

  // Load label references from category default fields.
  const catIds = Array.from(new Set(filterRows.map((r) => r.category_id)));
  const labelMap: Record<string, string> = {};
  if (opts.scope === "organization") {
    const { data: orgFields } = await sb
      .from("category_org_fields")
      .select("field_key, label")
      .in("category_id", catIds);
    for (const f of orgFields ?? []) if (!labelMap[f.field_key]) labelMap[f.field_key] = f.label;
  } else {
    const { data: recFields } = await sb
      .from("organization_category_default_fields")
      .select("field_key, label")
      .in("category_id", catIds);
    for (const f of recFields ?? []) if (!labelMap[f.field_key]) labelMap[f.field_key] = f.label;
  }

  // Compute distinct values for select filters by scanning published items.
  const selectKeys = uniq.filter((r) => r.filter_type === "select").map((r) => r.field_key);
  const distinct = new Map<string, Set<string>>();
  if (selectKeys.length > 0) {
    if (opts.scope === "organization") {
      const { data: pubRecs } = await sb
        .from("records")
        .select("table:tables!inner(organization_id)")
        .eq("status", "published")
        .limit(5000);
      const orgIds = Array.from(
        new Set((pubRecs ?? []).map((r: any) => r.table?.organization_id).filter(Boolean)),
      );
      if (orgIds.length > 0) {
        let q = sb.from("organizations").select("name, slug, description, address, category_data, category_id").in("id", orgIds);
        if (opts.category_id) q = q.eq("category_id", opts.category_id);
        const { data: orgs } = await q;
        for (const key of selectKeys) {
          const set = new Set<string>();
          for (const o of orgs ?? []) {
            const v = resolveOrgValue(o, key);
            if (typeof v === "string" && v.trim()) set.add(v.trim());
            else if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && x.trim()) set.add(x.trim());
          }
          distinct.set(key, set);
        }
      }
    } else {
      let q = sb
        .from("records")
        .select("data, table:tables!inner(organization:organizations!inner(category_id))")
        .eq("status", "published")
        .limit(5000);
      const { data: recs } = await q;
      for (const key of selectKeys) {
        const set = new Set<string>();
        for (const r of recs ?? []) {
          if (opts.category_id && r.table?.organization?.category_id !== opts.category_id) continue;
          const v = resolveRecordValue(r, key);
          if (typeof v === "string" && v.trim()) set.add(v.trim());
          else if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && x.trim()) set.add(x.trim());
        }
        distinct.set(key, set);
      }
    }
  }

  const filters: ExploreFilterDef[] = uniq.map((r) => ({
    key: r.field_key,
    label: r.label_override ?? labelMap[r.field_key] ?? ORG_BASE_LABELS[r.field_key] ?? r.field_key,
    filter_type: r.filter_type,
    options: Array.from(distinct.get(r.field_key) ?? []).sort((a, b) => a.localeCompare(b, "pt-BR")),
  }));

  return { filters };
}

/** Load filter definitions (search + select keys) for list-side filtering. */
export async function loadFilterKeys(
  scope: "organization" | "record",
  categoryId?: string,
): Promise<{ searchKeys: string[]; selectKeys: string[] }> {
  const sb = supabaseAdmin as any;
  let q = sb.from("category_filter_fields").select("field_key, filter_type, scope, category_id").eq("scope", scope);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data } = await q;
  const searchKeys = new Set<string>();
  const selectKeys = new Set<string>();
  for (const r of (data ?? []) as any[]) {
    if (r.filter_type === "search") searchKeys.add(r.field_key);
    else if (r.filter_type === "select") selectKeys.add(r.field_key);
  }
  return { searchKeys: Array.from(searchKeys), selectKeys: Array.from(selectKeys) };
}
