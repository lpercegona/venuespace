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

  // Compute distinct values for select filters, unindo os valores presentes nos dados
  // com as opções declaradas na configuração do campo.
  const selectKeys = uniq.filter((r) => r.filter_type === "select").map((r) => r.field_key);
  const distinct = new Map<string, Set<string>>();
  if (selectKeys.length > 0) {
    for (const key of selectKeys) distinct.set(key, new Set<string>());

    const addValue = (key: string, v: unknown) => {
      const set = distinct.get(key);
      if (!set) return;
      if (typeof v === "string" && v.trim()) set.add(v.trim());
      else if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && x.trim()) set.add(x.trim());
    };

    // Opções configuradas (aparecem mesmo sem nenhum item usando o valor).
    if (opts.scope === "organization") {
      let cfgQ = sb
        .from("category_org_fields")
        .select("field_key, field_type, config, category_id")
        .in("field_key", selectKeys);
      if (opts.category_id) cfgQ = cfgQ.eq("category_id", opts.category_id);
      const { data: cfgFields } = await cfgQ;
      for (const f of (cfgFields ?? []) as any[]) {
        for (const o of Array.isArray(f.config?.options) ? f.config.options : []) {
          const label = typeof o === "string" ? o : String(o?.label ?? o?.value ?? "");
          if (label.trim()) addValue(f.field_key, label.trim());
        }
      }
    } else {
      let stQ = sb.from("category_standard_tables").select("id, category_id");
      if (opts.category_id) stQ = stQ.eq("category_id", opts.category_id);
      const { data: stRows } = await stQ;
      const stIds = ((stRows ?? []) as any[]).map((r) => r.id);
      if (stIds.length > 0) {
        const { data: cfgFields } = await sb
          .from("category_standard_table_fields")
          .select("field_key, field_type, config, standard_table_id")
          .in("standard_table_id", stIds)
          .in("field_key", selectKeys);
        for (const f of (cfgFields ?? []) as any[]) {
          for (const o of Array.isArray(f.config?.options) ? f.config.options : []) {
            const label = typeof o === "string" ? o : String(o?.label ?? o?.value ?? "");
            if (label.trim()) addValue(f.field_key, label.trim());
          }
        }
      }
    }

    // Valores efetivamente presentes nos itens públicos (mesma base da listagem).
    if (opts.scope === "organization") {
      let q = sb
        .from("organizations")
        .select("name, slug, description, address, category_data, category_id")
        .eq("is_public", true);
      if (opts.category_id) q = q.eq("category_id", opts.category_id);
      const { data: orgs } = await q;
      for (const key of selectKeys) {
        for (const o of orgs ?? []) addValue(key, resolveOrgValue(o, key));
      }
    } else {
      let q = sb
        .from("records")
        .select("data, table:tables!inner(organization:organizations!inner(category_id))")
        .eq("status", "published")
        .limit(5000);
      if (opts.category_id) q = q.eq("table.organization.category_id", opts.category_id);
      const { data: recs } = await q;
      for (const key of selectKeys) {
        for (const r of recs ?? []) addValue(key, resolveRecordValue(r, key));
      }
    }

    // Remove duplicidades case-insensitive mantendo a primeira grafia.
    for (const [key, set] of distinct) {
      const seenNorm = new Map<string, string>();
      for (const v of set) {
        const k = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (!seenNorm.has(k)) seenNorm.set(k, v);
      }
      distinct.set(key, new Set(seenNorm.values()));
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
