import { cached, TTL_SHORT } from "@/lib/server-cache";
import { parseFilterValues, parseRangeValue, toFilterNumber } from "@/lib/filter-params";
// Server-only helper computing explore filter definitions + distinct option values.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ExploreFilterDef = {
  key: string;
  label: string;
  filter_type: "search" | "select" | "range";
  options: string[]; // only for select
  /** Faixa numérica: chaves vinculadas e opções de cada lado. */
  min_field_key?: string | null;
  max_field_key?: string | null;
  min_options?: number[];
  max_options?: number[];
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

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function valuesOf(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap((v) => valuesOf(v));
  if (typeof raw === "boolean") return [raw ? "true" : "false"];
  if (typeof raw === "object") return Object.values(raw as Record<string, unknown>).flatMap((v) => valuesOf(v));
  const s = String(raw).trim();
  return s === "" ? [] : [s];
}

function matchesText(item: any, resolve: (item: any, key: string) => unknown, keys: string[], q: string): boolean {
  if (!q) return true;
  const needle = norm(q);
  const pool = [...keys.map((k) => resolve(item, k)), item.name, item.description, item.address];
  for (const raw of pool) {
    for (const v of valuesOf(raw)) if (norm(v).includes(needle)) return true;
  }
  return false;
}

export async function listExploreFilters(opts: {
  scope: "organization" | "record";
  category_id?: string;
  /** Termo de busca corrente — restringe as opções às ainda disponíveis. */
  q?: string;
  /** Filtros já selecionados — facetas calculadas ignorando o próprio campo. */
  filters?: Record<string, string>;
}): Promise<{ filters: ExploreFilterDef[] }> {
  const sb = supabaseAdmin as any;
  const q = (opts.q ?? "").trim();
  const selected = Object.fromEntries(
    Object.entries(opts.filters ?? {}).filter(([, v]) => typeof v === "string" && v.trim() !== ""),
  ) as Record<string, string>;

  // If no category is chosen, aggregate filters across all categories that have entries.
  let filterRows: any[] = [];
  if (opts.category_id) {
    const { data } = await sb
      .from("category_filter_fields")
      .select("field_key, filter_type, label_override, order_index, scope, category_id, min_field_key, max_field_key")
      .eq("category_id", opts.category_id)
      .eq("scope", opts.scope)
      .order("order_index");
    filterRows = data ?? [];
  } else {
    const { data } = await sb
      .from("category_filter_fields")
      .select("field_key, filter_type, label_override, order_index, scope, category_id, min_field_key, max_field_key")
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

  const searchKeys = uniq.filter((r) => r.filter_type === "search").map((r) => r.field_key);
  const selectKeys = uniq.filter((r) => r.filter_type === "select").map((r) => r.field_key);
  const distinct = new Map<string, Set<string>>();

  if (selectKeys.length > 0) {
    for (const key of selectKeys) distinct.set(key, new Set<string>());

    // Rótulos configurados (usados para preservar a grafia oficial da opção).
    const configured = new Map<string, string>(); // normalizado -> rótulo
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
          if (label.trim()) configured.set(`${f.field_key}|${norm(label)}`, label.trim());
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
            if (label.trim()) configured.set(`${f.field_key}|${norm(label)}`, label.trim());
          }
        }
      }
    }

    // Base de itens públicos (mesma da listagem).
    let items: any[] = [];
    let resolve: (item: any, key: string) => unknown;
    if (opts.scope === "organization") {
      let iq = sb
        .from("organizations")
        .select("name, slug, description, address, category_data, category_id")
        .eq("is_public", true);
      if (opts.category_id) iq = iq.eq("category_id", opts.category_id);
      const { data: orgs } = await iq;
      items = orgs ?? [];
      resolve = resolveOrgValue;
    } else {
      let iq = sb
        .from("records")
        .select("data, table:tables!inner(organization:organizations!inner(category_id))")
        .eq("status", "published")
        .limit(5000);
      if (opts.category_id) iq = iq.eq("table.organization.category_id", opts.category_id);
      const { data: recs } = await iq;
      items = recs ?? [];
      resolve = resolveRecordValue;
    }

    const matchesFilter = (item: any, key: string, value: string) => {
      const targets = parseFilterValues(value).map(norm);
      if (targets.length === 0) return true;
      return valuesOf(resolve(item, key)).map(norm).some((v) => targets.includes(v));
    };

    // Facetas: para cada campo, aplica busca + os demais filtros selecionados.
    for (const key of selectKeys) {
      const set = distinct.get(key)!;
      const others = Object.entries(selected).filter(([k]) => k !== key);
      for (const item of items) {
        if (!matchesText(item, resolve, searchKeys, q)) continue;
        if (!others.every(([k, v]) => matchesFilter(item, k, v))) continue;
        for (const v of valuesOf(resolve(item, key))) {
          const label = configured.get(`${key}|${norm(v)}`) ?? v.trim();
          if (label) set.add(label);
        }
      }
      // Mantém o valor atualmente selecionado sempre visível.
      for (const current of parseFilterValues(selected[key])) {
        if (![...set].some((v) => norm(v) === norm(current))) set.add(current);
      }
    }

    // Remove duplicidades case-insensitive mantendo a primeira grafia.
    for (const [key, set] of distinct) {
      const seenNorm = new Map<string, string>();
      for (const v of set) {
        if (!seenNorm.has(norm(v))) seenNorm.set(norm(v), v);
      }
      distinct.set(key, new Set(seenNorm.values()));
    }
  }

  const filters: ExploreFilterDef[] = uniq
    .map((r) => ({
      key: r.field_key,
      label: r.label_override ?? labelMap[r.field_key] ?? ORG_BASE_LABELS[r.field_key] ?? r.field_key,
      filter_type: r.filter_type,
      options: Array.from(distinct.get(r.field_key) ?? []).sort((a, b) => a.localeCompare(b, "pt-BR")),
    }))
    // Filtros de seleção sem nenhuma opção disponível são omitidos.
    .filter((f) => f.filter_type !== "select" || f.options.length > 0);

  return { filters };
}


/** Load filter definitions (search + select keys) for list-side filtering. */
export async function loadFilterKeys(
  scope: "organization" | "record",
  categoryId?: string,
): Promise<{ searchKeys: string[]; selectKeys: string[] }> {
  return cached(`filterkeys:${scope}:${categoryId ?? "all"}`, TTL_SHORT, () => loadFilterKeysUncached(scope, categoryId));
}

async function loadFilterKeysUncached(
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
