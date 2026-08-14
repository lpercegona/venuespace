// Server-only helpers for public (anon) data access.
// Uses the service-role admin client since anon RLS reads on org/tables/fields/views
// were removed; scoping (published status, org/table match) is enforced in code here.

import { parseFilterValues, parseRangeValue, toFilterNumber } from "@/lib/filter-params";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cached, cacheGet, cacheSet, TTL_MEDIUM, TTL_SHORT, TTL_SIGNED } from "@/lib/server-cache";

/** Cards de listagem mostram poucas fotos: assinamos só as primeiras por item. */
const LISTING_GALLERY_LIMIT = 5;

/** Assina caminhos do storage reutilizando URLs já assinadas (cache em memória). */
export async function signPathsCached(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const p of Array.from(new Set(paths.filter(Boolean)))) {
    const hit = cacheGet<string>(`signed:${p}`);
    if (hit) out.set(p, hit);
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data } = await supabaseAdmin.storage.from("venue-uploads").createSignedUrls(missing, 60 * 60);
    (data ?? []).forEach((row: any, i: number) => {
      const path = row?.path ?? missing[i];
      if (!row?.signedUrl || !path) return;
      cacheSet(`signed:${path}`, row.signedUrl as string, TTL_SIGNED);
      out.set(path, row.signedUrl as string);
    });
  }
  return out;
}

export type PublicLayoutField = {
  id: string;
  field_key: string;
  width_percent: 25 | 50 | 75 | 100;
  order_index: number;
  config: Record<string, any>;
};

export type PublicTablePayload = {
  organization: { id: string; slug: string; name: string; description: string | null; logo_url: string | null; category_id: string | null };
  table: { id: string; slug: string; name: string; description: string | null; icon: string | null; bookable: boolean };
  fields: Array<{ id: string; key: string; label: string; type: string; position: number; config: Record<string, any> | null }>;
  records: Array<{ id: string; data: Record<string, any>; deal_status: string; created_at: string }>;
  public_form_view: {
    id: string;
    submissions_table_id: string;
    auto_relation_field_id: string | null;
    form_field_ids: string[] | null;
  } | null;
  record_card_layout: PublicLayoutField[];
};

export type PublicTableSummary = {
  org_slug: string;
  org_name: string;
  org_category_id: string | null;
  table_id: string;
  table_slug: string;
  table_name: string;
  table_icon: string | null;
  published_count: number;
  latest_published_at: string;
};

export async function listPublicTables(opts: { limit?: number; offset?: number; q?: string; category_id?: string } = {}): Promise<{ items: PublicTableSummary[]; total: number }> {
  const sb = supabaseAdmin;
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = (opts.q ?? "").trim().toLowerCase();
  const categoryId = opts.category_id?.trim() || undefined;

  // Fetch published records with joined table + org; aggregate in code.
  const query = sb
    .from("records")
    .select("table_id, created_at, table:tables!inner(id, slug, name, icon, is_public, organization:organizations!inner(id, slug, name, category_id, is_public))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1000);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, PublicTableSummary>();
  for (const r of (data ?? []) as any[]) {
    const t = r.table;
    if (!t?.organization) continue;
    if (t.is_public === false) continue;
    if (t.organization.is_public === false) continue;
    const key = t.id;
    const existing = map.get(key);
    if (existing) {
      existing.published_count += 1;
      if (r.created_at > existing.latest_published_at) existing.latest_published_at = r.created_at;
    } else {
      map.set(key, {
        org_slug: t.organization.slug,
        org_name: t.organization.name,
        org_category_id: t.organization.category_id ?? null,
        table_id: t.id,
        table_slug: t.slug,
        table_name: t.name,
        table_icon: t.icon ?? null,
        published_count: 1,
        latest_published_at: r.created_at,
      });
    }
  }
  let items = Array.from(map.values());
  if (q) items = items.filter((i) => i.table_name.toLowerCase().includes(q) || i.org_name.toLowerCase().includes(q));
  if (categoryId) items = items.filter((i) => i.org_category_id === categoryId);
  items.sort((a, b) => (a.latest_published_at < b.latest_published_at ? 1 : -1));
  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

/** Organização "atribuída": possui membro que não é super admin (Correção Iteração 24). */
// Organização "atribuída" = possui ao menos um membro proprietário (owner)
// que não seja super admin. Sem owner, formulários e chat ficam desativados.
export async function orgHasAssignedUser(orgId: string): Promise<boolean> {
  const sb = supabaseAdmin;
  const { data: members } = await sb
    .from("memberships")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "owner");
  const ids = Array.from(new Set(((members ?? []) as any[]).map((m) => m.user_id)));
  if (ids.length === 0) return false;
  const { data: sa } = await (sb as any).from("super_admins").select("user_id").in("user_id", ids);
  const saIds = new Set(((sa ?? []) as any[]).map((r) => r.user_id));
  return ids.some((id) => !saIds.has(id));
}


export async function loadPublicTable(slug: string, tableId: string): Promise<PublicTablePayload> {
  const sb = supabaseAdmin;

  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("id, slug, name, description, logo_url, category_id, is_public")
    .eq("slug", slug)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org || (org as any).is_public === false) throw new Error("Organização não encontrada");

  const { data: table, error: tErr } = await sb
    .from("tables")
    .select("id, slug, name, description, icon, bookable, is_public, organization_id")
    .eq("id", tableId)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!table || table.organization_id !== org.id) throw new Error("Tabela não encontrada");
  if ((table as any).is_public === false) throw new Error("Tabela não pública");

  const { data: fields, error: fErr } = await sb
    .from("fields")
    .select("id, key, label, type, position, config")
    .eq("table_id", tableId)
    .order("position", { ascending: true });
  if (fErr) throw new Error(fErr.message);

  const { data: records, error: rErr } = await sb
    .from("records")
    .select("id, data, deal_status, created_at")
    .eq("table_id", tableId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (rErr) throw new Error(rErr.message);

  const { data: views } = await sb
    .from("views")
    .select("id, type, config, submissions_table_id")
    .eq("table_id", tableId)
    .eq("type", "public_form")
    .limit(1);
  const v = views?.[0] as any;
  const public_form_view = v
    ? {
        id: v.id,
        submissions_table_id: v.submissions_table_id,
        auto_relation_field_id: (v.config ?? {}).auto_relation_field_id ?? null,
        form_field_ids: (v.config ?? {}).form_field_ids ?? null,
      }
    : null;

  const hasAssignedUser = await orgHasAssignedUser(org.id);

  const record_card_layout = await loadPublicLayout((org as any).category_id ?? null, "record_card");

  return {
    organization: {
      id: org.id, slug: org.slug, name: org.name,
      description: org.description ?? null, logo_url: org.logo_url ?? null,
      category_id: (org as any).category_id ?? null,
    },
    table: {
      id: table.id, slug: table.slug, name: table.name, description: table.description ?? null,
      icon: table.icon ?? null, bookable: !!table.bookable,
    },
    fields: (fields ?? []) as any,
    records: (records ?? []) as any,
    public_form_view: hasAssignedUser ? public_form_view : null,
    record_card_layout,
  };
}

export async function loadPublicLayout(categoryId: string | null, scope: "organization_card" | "record_card" | "organization_page"): Promise<PublicLayoutField[]> {
  if (!categoryId) return [];
  const sb = supabaseAdmin;
  const { data: parent } = await (sb as any)
    .from("category_public_layouts")
    .select("id, card_style")
    .eq("category_id", categoryId)
    .eq("scope", scope)
    .maybeSingle();
  if (!parent) return [];
  const { data: rows } = await (sb as any)
    .from("category_public_layout_fields")
    .select("id, field_key, width_percent, order_index, config")
    .eq("layout_id", (parent as any).id)
    .order("order_index", { ascending: true });
  const cardStyle = (parent as any).card_style ?? "standard";
  return ((rows ?? []) as any[]).map((r) => ({
    id: r.id,
    field_key: r.field_key,
    width_percent: r.width_percent,
    order_index: r.order_index,
    config: { ...(r.config ?? {}), __card_style: cardStyle },
  }));
}

export type PublicRendererField = { key: string; label: string; type: string; config?: Record<string, any> };


export type PublicOrganizationSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  category_id: string | null;
  category_data: Record<string, any>;
  updated_at: string;
  data: Record<string, any>;
  fields: PublicRendererField[];
  layout: PublicLayoutField[];
};

const ORG_BUILTIN_FIELDS: PublicRendererField[] = [
  { key: "name", label: "Nome", type: "text" },
  { key: "slug", label: "Slug", type: "text" },
  { key: "description", label: "Descrição", type: "long_text" },
  { key: "logo_url", label: "Logo", type: "image" },
  { key: "rating", label: "Avaliação média", type: "number" },
  { key: "address.cep", label: "CEP", type: "text" },
  { key: "address.street", label: "Logradouro", type: "text" },
  { key: "address.number", label: "Número", type: "text" },
  { key: "address.complement", label: "Complemento", type: "text" },
  { key: "address.neighborhood", label: "Bairro", type: "text" },
  { key: "address.city", label: "Cidade", type: "text" },
  { key: "address.state", label: "UF", type: "text" },
  { key: "address.city_state_full", label: "Cidade - Estado (extenso)", type: "text" },
];

const STATE_MAP: Record<string, string> = {
  ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas", ba: "Bahia", ce: "Ceará",
  df: "Distrito Federal", es: "Espírito Santo", go: "Goiás", ma: "Maranhão", mt: "Mato Grosso",
  ms: "Mato Grosso do Sul", mg: "Minas Gerais", pa: "Pará", pb: "Paraíba", pr: "Paraná",
  pe: "Pernambuco", pi: "Piauí", rj: "Rio de Janeiro", rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul", ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina",
  sp: "São Paulo", se: "Sergipe", to: "Tocantins",
};

function expandState(uf: string): string {
  return STATE_MAP[uf.trim().toLowerCase()] ?? uf;
}

const RECORD_BUILTIN_FIELDS: PublicRendererField[] = [
  { key: "org_name", label: "Organização", type: "text" },
  { key: "table_name", label: "Tabela", type: "text" },
  { key: "deal_status", label: "Status", type: "text" },
];


// Layouts e campos de categoria são poucos e mudam raramente: carregamos o
// conjunto completo uma única vez (chave de cache estável) em vez de uma
// consulta por combinação de categorias — cada bloco da home usava uma chave
// diferente e provocava falha de cache.
async function loadLayoutsBatch(categoryIds: string[], scope: "organization_card" | "record_card" | "organization_page"): Promise<Map<string, PublicLayoutField[]>> {
  if (categoryIds.length === 0) return new Map<string, PublicLayoutField[]>();
  return cachedSWR(`layouts:all:${scope}`, TTL_MEDIUM, () => loadLayoutsBatchUncached(scope));
}

async function loadLayoutsBatchUncached(scope: "organization_card" | "record_card" | "organization_page"): Promise<Map<string, PublicLayoutField[]>> {
  const out = new Map<string, PublicLayoutField[]>();
  const sb = supabaseAdmin;
  const { data: parents } = await (sb as any)
    .from("category_public_layouts")
    .select("id, category_id, card_style")
    .eq("scope", scope);
  const parentList = (parents ?? []) as Array<{ id: string; category_id: string; card_style?: string | null }>;
  if (parentList.length === 0) return out;
  const styleByLayout = new Map(parentList.map((p) => [p.id, p.card_style ?? "standard"]));
  const { data: rows } = await (sb as any)
    .from("category_public_layout_fields")
    .select("id, layout_id, field_key, width_percent, order_index, config")
    .in("layout_id", parentList.map((p) => p.id))
    .order("order_index", { ascending: true });
  const byLayout = new Map<string, PublicLayoutField[]>();
  for (const r of ((rows ?? []) as any[])) {
    const arr = byLayout.get(r.layout_id) ?? [];
    arr.push({
      id: r.id,
      field_key: r.field_key,
      width_percent: r.width_percent,
      order_index: r.order_index,
      config: { ...(r.config ?? {}), __card_style: styleByLayout.get(r.layout_id) ?? "standard" },
    });
    byLayout.set(r.layout_id, arr);
  }
  for (const p of parentList) out.set(p.category_id, byLayout.get(p.id) ?? []);
  return out;
}

async function loadOrgCategoryFieldsBatch(categoryIds: string[]): Promise<Map<string, PublicRendererField[]>> {
  if (categoryIds.length === 0) return new Map<string, PublicRendererField[]>();
  return cachedSWR("orgfields:all", TTL_MEDIUM, loadOrgCategoryFieldsBatchUncached);
}

async function loadOrgCategoryFieldsBatchUncached(): Promise<Map<string, PublicRendererField[]>> {
  const out = new Map<string, PublicRendererField[]>();
  const { data } = await (supabaseAdmin as any)
    .from("category_org_fields")
    .select("category_id, field_key, label, field_type, config, order_index")
    .order("order_index", { ascending: true });
  for (const r of ((data ?? []) as any[])) {
    const arr = out.get(r.category_id) ?? [];
    arr.push({ key: r.field_key, label: r.label, type: r.field_type, config: r.config ?? {} });
    out.set(r.category_id, arr);
  }
  return out;
}




export type PublicFilterRule = {
  field_key: string;
  operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "filled";
  value?: string;
};

/** Normaliza qualquer valor em lista de strings comparáveis (arrays, booleanos, números). */
function normalizeValues(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap((v) => normalizeValues(v));
  if (typeof raw === "boolean") return [raw ? "true" : "false"];
  if (typeof raw === "object") return Object.values(raw as Record<string, unknown>).flatMap((v) => normalizeValues(v));
  const s = String(raw).trim();
  return s === "" ? [] : [s];
}

/** Comparação insensível a acentos, caixa e espaços extras. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Mapa field_key -> (rótulo/valor normalizado -> valores equivalentes), para que
 * regras escritas com o rótulo da opção casem com o valor armazenado e vice-versa.
 */
export type OptionAliasMap = Map<string, Map<string, string[]>>;

function optionEntries(config: any): Array<{ value: string; label: string }> {
  const opts = Array.isArray(config?.options) ? config.options : [];
  const out: Array<{ value: string; label: string }> = [];
  for (const o of opts) {
    if (typeof o === "string") out.push({ value: o, label: o });
    else if (o && typeof o === "object") {
      const value = String(o.value ?? o.key ?? o.label ?? "");
      const label = String(o.label ?? o.name ?? value);
      if (value) out.push({ value, label });
    }
  }
  return out;
}

async function loadOptionAliases(
  table: "category_org_fields" | "category_standard_table_fields",
  fieldKeys: string[],
): Promise<OptionAliasMap> {
  const keysSorted = Array.from(new Set(fieldKeys.filter(Boolean))).sort();
  if (keysSorted.length === 0) return new Map();
  return cached(`aliases:${table}:${keysSorted.join(",")}`, TTL_SHORT, () => loadOptionAliasesUncached(table, keysSorted));
}

async function loadOptionAliasesUncached(
  table: "category_org_fields" | "category_standard_table_fields",
  fieldKeys: string[],
): Promise<OptionAliasMap> {
  const map: OptionAliasMap = new Map();
  const keys = Array.from(new Set(fieldKeys.filter(Boolean)));
  if (keys.length === 0) return map;
  const { data } = await (supabaseAdmin as any)
    .from(table)
    .select("field_key, field_type, config")
    .in("field_key", keys);
  for (const f of ((data ?? []) as any[])) {
    const entries = optionEntries(f.config);
    if (entries.length === 0) continue;
    const inner = map.get(f.field_key) ?? new Map<string, string[]>();
    for (const e of entries) {
      for (const alias of [e.value, e.label]) {
        const k = norm(alias);
        const arr = inner.get(k) ?? [];
        if (!arr.includes(e.value)) arr.push(e.value);
        if (!arr.includes(e.label)) arr.push(e.label);
        inner.set(k, arr);
      }
    }
    map.set(f.field_key, inner);
  }
  return map;
}

function ruleTargets(rule: PublicFilterRule, aliases?: OptionAliasMap): string[] {
  const base = norm(String(rule.value ?? ""));
  const extra = aliases?.get(rule.field_key)?.get(base) ?? [];
  return Array.from(new Set([base, ...extra.map(norm)]));
}

/** Applies a list of ad-hoc filter rules (Iteração 30 — home blocks) to a value resolver. */
function applyRules<T>(
  items: T[],
  rules: PublicFilterRule[] | undefined,
  resolve: (item: T, key: string) => unknown,
  aliases?: OptionAliasMap,
): T[] {
  if (!rules || rules.length === 0) return items;
  return items.filter((item) =>
    rules.every((rule) => {
      const raw = resolve(item, rule.field_key);
      const values = normalizeValues(raw).map(norm);
      if (rule.operator === "filled") return values.length > 0;
      const targets = ruleTargets(rule, aliases);
      if (rule.operator === "contains") {
        return values.some((v) => targets.some((t) => t !== "" && v.includes(t)));
      }
      if (rule.operator === "=") return values.some((v) => targets.includes(v));
      if (rule.operator === "!=") return !values.some((v) => targets.includes(v));
      const b = Number(rule.value);
      if (Number.isNaN(b)) return false;
      const nums = values.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
      if (nums.length === 0) return false;
      if (rule.operator === ">") return nums.some((a) => a > b);
      if (rule.operator === ">=") return nums.some((a) => a >= b);
      if (rule.operator === "<") return nums.some((a) => a < b);
      if (rule.operator === "<=") return nums.some((a) => a <= b);
      return true;
    })
  );
}



export async function listPublicOrganizations(opts: { limit?: number; offset?: number; q?: string; category_id?: string; filters?: Record<string, string>; rules?: PublicFilterRule[]; exclude_ids?: string[] } = {}): Promise<{ items: PublicOrganizationSummary[]; total: number }> {
  const sb = supabaseAdmin;
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = (opts.q ?? "").trim().toLowerCase();
  const categoryId = opts.category_id?.trim() || undefined;
  const filters = opts.filters ?? {};

  // Toda organização pública é listada, mesmo sem registros publicados.
  let query = sb.from("organizations")
    .select("id, slug, name, description, logo_url, category_id, category_data, address, updated_at")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await cached(`orgs:public:${categoryId ?? "all"}`, TTL_SHORT, async () => {
    const res = await query;
    return res as { data: any[] | null; error: { message: string } | null };
  });
  if (error) throw new Error(error.message);

  const resolveOrgVal = (o: any, key: string): unknown => {
    if (key === "name") return o.name;
    if (key === "slug") return o.slug;
    if (key === "description") return o.description;
    if (key === "address.city_state_full") {
      const addr = o.address ?? {};
      return [addr.city, expandState(addr.state ?? "")].filter(Boolean).join(" - ");
    }
    if (key.startsWith("address.")) return (o.address ?? {})[key.slice("address.".length)];
    return (o.category_data ?? {})[key];
  };

  const { loadFilterKeys } = await import("@/lib/explore-filters.server");
  const { searchKeys, ranges } = await loadFilterKeys("organization", categoryId);
  const rangeByKey = new Map(ranges.map((r) => [r.key, r]));

  let base = ((data ?? []) as any[]).map((o) => ({
    id: o.id, slug: o.slug, name: o.name,
    description: o.description ?? null, logo_url: o.logo_url ?? null,
    category_id: o.category_id ?? null, category_data: o.category_data ?? {},
    address: o.address ?? {},
    updated_at: o.updated_at,
  }));

  const orgAliases = await loadOptionAliases(
    "category_org_fields",
    [...Object.keys(filters), ...((opts.rules ?? []).map((r) => r.field_key))],
  );

  for (const [key, val] of Object.entries(filters)) {
    // Faixa numérica vinculada a dois campos: exige a faixa do item contida na pedida.
    const rangeDef = rangeByKey.get(key);
    if (rangeDef) {
      const { min, max } = parseRangeValue(String(val));
      if (min == null && max == null) continue;
      base = base.filter((o) => {
        const lo = toFilterNumber(resolveOrgVal(o, rangeDef.min_field_key));
        const hi = toFilterNumber(resolveOrgVal(o, rangeDef.max_field_key));
        if (min != null && (lo == null || lo < min)) return false;
        if (max != null && (hi == null || hi > max)) return false;
        return true;
      });
      continue;
    }
    // Multivalor: `A|B` combina em OU dentro do mesmo campo.
    const parts = parseFilterValues(String(val));
    if (parts.length === 0) continue;
    const targets = parts.flatMap((p) => ruleTargets({ field_key: key, operator: "=", value: p }, orgAliases));
    base = base.filter((o) => normalizeValues(resolveOrgVal(o, key)).map(norm).some((v) => targets.includes(v)));
  }

  base = applyRules(base, opts.rules, resolveOrgVal, orgAliases);

  if (opts.exclude_ids && opts.exclude_ids.length > 0) {
    const skip = new Set(opts.exclude_ids);
    base = base.filter((o) => !skip.has(o.id));
  }

  if (q) base = base.filter((i) => {
    if (i.name.toLowerCase().includes(q)) return true;
    if ((i.description ?? "").toLowerCase().includes(q)) return true;
    for (const k of searchKeys) {
      const v = resolveOrgVal(i, k);
      if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
    }
    for (const v of Object.values(i.address ?? {})) {
      if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
    }
    return false;
  });
  const total = base.length;
  const paged = base.slice(offset, offset + limit);

  const catIds = Array.from(new Set(paged.map((o) => o.category_id).filter(Boolean))) as string[];
  const [layouts, catFields] = await Promise.all([
    loadLayoutsBatch(catIds, "organization_card"),
    loadOrgCategoryFieldsBatch(catIds),
  ]);

  const items: PublicOrganizationSummary[] = paged.map((o) => {
    const layout = (o.category_id && layouts.get(o.category_id)) || [];
    const catF = (o.category_id && catFields.get(o.category_id)) || [];
    const fields = [...ORG_BUILTIN_FIELDS, ...catF];
    const addr = (o.address ?? {}) as Record<string, any>;
    const data: Record<string, any> = {
      name: o.name,
      slug: o.slug,
      description: o.description,
      logo_url: o.logo_url,
      rating: null,
      "address.cep": addr.cep ?? "",
      "address.street": addr.street ?? "",
      "address.number": addr.number ?? "",
      "address.complement": addr.complement ?? "",
      "address.neighborhood": addr.neighborhood ?? "",
      "address.city": addr.city ?? "",
      "address.state": addr.state ?? "",
      "address.city_state_full": [addr.city, expandState(addr.state ?? "")].filter(Boolean).join(" - "),
      ...o.category_data,
    };
    return { id: o.id, slug: o.slug, name: o.name, description: o.description, logo_url: o.logo_url, category_id: o.category_id, category_data: o.category_data, updated_at: o.updated_at, data, fields, layout };
  });
  await signImagePathsInItems(items, LISTING_GALLERY_LIMIT);
  return { items, total };
}

export async function getPublicOrganization(slug: string): Promise<any> {
  const sb = supabaseAdmin;
  const { data: o, error } = await sb
    .from("organizations")
    .select("id, slug, name, description, logo_url, category_id, category_data, system_data, address, updated_at, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) throw new Error("Organização não encontrada");

  const catId = (o as any).category_id ?? null;
  const [layouts, pageStyleRow, catFields, catRow, reviewsAgg] = await Promise.all([
    loadLayoutsBatch(catId ? [catId] : [], "organization_card"),
    catId
      ? (sb as any).from("category_public_layouts").select("card_style").eq("category_id", catId).eq("scope", "organization_page").maybeSingle()
      : Promise.resolve({ data: null }),
    loadOrgCategoryFieldsBatch(catId ? [catId] : []),
    catId ? (sb as any).from("organization_categories").select("name").eq("id", catId).maybeSingle() : Promise.resolve({ data: null }),
    (sb as any).from("organization_reviews")
      .select("rating, status")
      .eq("organization_id", (o as any).id)
      .eq("status", "approved"),
  ]);
  const layout = (catId && layouts.get(catId)) || [];
  const pageStyle = (((pageStyleRow as any)?.data?.card_style as string) ?? "standard") as "standard" | "immersive";
  const approvedReviews = (reviewsAgg?.data ?? []) as Array<{ rating: number }>;
  const avgRating = approvedReviews.length
    ? Number((approvedReviews.reduce((a, b) => a + b.rating, 0) / approvedReviews.length).toFixed(1))
    : null;
  const catF = (catId && catFields.get(catId)) || [];
  const fields = [...ORG_BUILTIN_FIELDS, ...catF];
  const addr = ((o as any).address ?? {}) as Record<string, any>;
  const data: Record<string, any> = {
    name: (o as any).name,
    slug: (o as any).slug,
    description: (o as any).description,
    logo_url: (o as any).logo_url,
    rating: avgRating,
    "address.cep": addr.cep ?? "",
    "address.street": addr.street ?? "",
    "address.number": addr.number ?? "",
    "address.complement": addr.complement ?? "",
    "address.neighborhood": addr.neighborhood ?? "",
    "address.city": addr.city ?? "",
    "address.state": addr.state ?? "",
    "address.city_state_full": [addr.city, expandState(addr.state ?? "")].filter(Boolean).join(" - "),
    ...((o as any).system_data ?? {}),
    ...((o as any).category_data ?? {}),
  };
  // Formulário público padrão de escopo organização (Iteração 24).
  const { data: orgForm } = await (sb as any)
    .from("views")
    .select("id, config, submissions_table_id, table_id")
    .eq("organization_id", (o as any).id)
    .eq("type", "public_form")
    .not("origin_standard_form_id", "is", null)
    .limit(20);
  const hasAssignedUser = await orgHasAssignedUser((o as any).id);
  const orgFormView = hasAssignedUser
    ? (((orgForm ?? []) as any[]).find((v) => v.table_id === v.submissions_table_id) ?? null)
    : null;
  // Contatos: campos-base (system_data) com fallback para campos de categoria.
  const pickContact = (...keys: string[]) => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const contact = {
    phone: pickContact("phone", "telefone", "telephone", "tel"),
    whatsapp: pickContact("whatsapp", "whats_app", "whatsapp_number", "zap"),
    email: pickContact("email", "e_mail", "contact_email"),
    website: pickContact("website", "site", "url", "web_site"),
  };
  const item = {
    id: (o as any).id,
    slug: (o as any).slug,
    name: (o as any).name,
    description: (o as any).description ?? null,
    logo_url: (o as any).logo_url ?? null,
    category_id: catId,
    category_data: ((o as any).category_data ?? {}) as Record<string, any>,
    updated_at: (o as any).updated_at,
    data,
    fields,
    layout,
    address: addr,
    category_name: (catRow as any)?.data?.name ?? null,
    has_assigned_user: hasAssignedUser,
    contact,
    public_form_view: orgFormView
      ? { id: orgFormView.id as string, table_id: orgFormView.table_id as string, submit_label: (orgFormView.config ?? {}).submit_label ?? "Enviar" }
      : null,
    page_style: pageStyle,
    avg_rating: avgRating,
    total_reviews: approvedReviews.length,
  };
  await signImagePathsInItems([item as any]);
  return item as any;
}


export type PublicRecordSummary = {
  record_id: string;
  data: Record<string, any>;
  created_at: string;
  org_slug: string;
  org_name: string;
  org_category_id: string | null;
  table_id: string;
  table_slug: string;
  table_name: string;
  table_icon: string | null;
  fields: PublicRendererField[];
  layout: PublicLayoutField[];
};

export async function listPublicRecords(opts: { limit?: number; offset?: number; q?: string; category_id?: string; slug?: string; filters?: Record<string, string>; rules?: PublicFilterRule[]; exclude_ids?: string[] } = {}): Promise<{ items: PublicRecordSummary[]; total: number }> {
  const sb = supabaseAdmin;
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = (opts.q ?? "").trim().toLowerCase();
  const categoryId = opts.category_id?.trim() || undefined;
  const slug = opts.slug?.trim() || undefined;
  const filters = opts.filters ?? {};

  const { data, error } = await sb.from("records")
    .select("id, data, deal_status, created_at, table:tables!inner(id, slug, name, icon, is_public, organization:organizations!inner(slug, name, category_id, is_public))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  let base = ((data ?? []) as any[])
    .filter((r) => r.table?.organization?.is_public !== false && r.table?.is_public !== false)
    .map((r) => ({
      record_id: r.id,
      data: r.data ?? {},
      deal_status: r.deal_status ?? null,
      created_at: r.created_at,
      org_slug: r.table.organization.slug,
      org_name: r.table.organization.name,
      org_category_id: r.table.organization.category_id ?? null,
      table_id: r.table.id,
      table_slug: r.table.slug,
      table_name: r.table.name,
      table_icon: r.table.icon ?? null,
    }));
  if (categoryId) base = base.filter((i) => i.org_category_id === categoryId);
  if (slug) base = base.filter((i) => i.org_slug === slug);

  const { loadFilterKeys: loadRecFilterKeys } = await import("@/lib/explore-filters.server");
  const recFilterKeys = await loadRecFilterKeys("record", categoryId);
  const recRangeByKey = new Map(recFilterKeys.ranges.map((r) => [r.key, r]));

  const recAliases = await loadOptionAliases(
    "category_standard_table_fields",
    [...Object.keys(filters), ...((opts.rules ?? []).map((r) => r.field_key))],
  );

  for (const [key, val] of Object.entries(filters)) {
    const rangeDef = recRangeByKey.get(key);
    if (rangeDef) {
      const { min, max } = parseRangeValue(String(val));
      if (min == null && max == null) continue;
      base = base.filter((r) => {
        const lo = toFilterNumber((r.data ?? {})[rangeDef.min_field_key]);
        const hi = toFilterNumber((r.data ?? {})[rangeDef.max_field_key]);
        if (min != null && (lo == null || lo < min)) return false;
        if (max != null && (hi == null || hi > max)) return false;
        return true;
      });
      continue;
    }
    const parts = parseFilterValues(String(val));
    if (parts.length === 0) continue;
    const targets = parts.flatMap((p) => ruleTargets({ field_key: key, operator: "=", value: p }, recAliases));
    base = base.filter((r) => normalizeValues((r.data ?? {})[key]).map(norm).some((v) => targets.includes(v)));
  }

  base = applyRules(base, opts.rules, (r, key) => (r.data ?? {})[key], recAliases);

  if (opts.exclude_ids && opts.exclude_ids.length > 0) {
    const skip = new Set(opts.exclude_ids);
    base = base.filter((r) => !skip.has(r.record_id));
  }

  const { searchKeys } = recFilterKeys;

  if (q) {
    base = base.filter((i) => {
      if (i.table_name.toLowerCase().includes(q) || i.org_name.toLowerCase().includes(q)) return true;
      if (searchKeys.length > 0) {
        for (const k of searchKeys) {
          const v = i.data?.[k];
          if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
        }
      }
      for (const v of Object.values(i.data)) {
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }
  const total = base.length;
  const paged = base.slice(offset, offset + limit);

  const tableIds = Array.from(new Set(paged.map((r) => r.table_id)));
  const catIds = Array.from(new Set(paged.map((r) => r.org_category_id).filter(Boolean))) as string[];
  const [fieldsRes, layouts] = await Promise.all([
    tableIds.length
      ? sb.from("fields").select("table_id, key, label, type, position, config").in("table_id", tableIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] as any[] } as any),
    loadLayoutsBatch(catIds, "record_card"),
  ]);
  const fieldsByTable = new Map<string, PublicRendererField[]>();
  for (const f of (((fieldsRes as any).data ?? []) as any[])) {
    const arr = fieldsByTable.get(f.table_id) ?? [];
    arr.push({ key: f.key, label: f.label, type: f.type, config: (f as any).config ?? {} });
    fieldsByTable.set(f.table_id, arr);
  }

  const items: PublicRecordSummary[] = paged.map((r) => ({
    ...r,
    // Expose the previously hardcoded card header values as regular layout fields.
    data: { ...r.data, org_name: r.org_name, table_name: r.table_name, deal_status: (r as any).deal_status ?? null },
    fields: [...RECORD_BUILTIN_FIELDS, ...(fieldsByTable.get(r.table_id) ?? [])],
    layout: (r.org_category_id && layouts.get(r.org_category_id)) || [],
  }));

  await signImagePathsInItems(items, LISTING_GALLERY_LIMIT);
  return { items, total };
}

// Batch-sign image/gallery paths across items so listing cards can render <img>.
// `maxGallery` limita quantas imagens de cada galeria são assinadas e enviadas:
// nas listagens o card mostra poucas, então não faz sentido assinar o álbum todo.
async function signImagePathsInItems(
  items: Array<{ data: Record<string, any>; fields: PublicRendererField[] }>,
  maxGallery?: number,
) {
  type Ref =
    | { kind: "single"; data: Record<string, any>; key: string }
    | { kind: "gallery"; data: Record<string, any>; key: string; index: number };
  const refs: Ref[] = [];
  const paths: string[] = [];
  const isHttp = (v: string) => /^https?:\/\//i.test(v);
  const hasImageExtension = (v: string) => /\.(avif|gif|jpe?g|png|webp|bmp|svg)(\?.*)?$/i.test(v);
  const isImageLikeName = (key: string, label?: string) => /(avatar|capa|cover|foto|galeria|gallery|imagem|image|logo|photo|picture)/i.test(`${key} ${label ?? ""}`);
  for (const it of items) {
    for (const f of it.fields) {
      const imageLike = f.type === "image" || f.type === "gallery" || isImageLikeName(f.key, f.label);
      let v = it.data?.[f.key];
      // Single-value image (string path)
      if ((f.type === "image" || imageLike) && typeof v === "string" && v && !isHttp(v)) {
        if (imageLike || hasImageExtension(v)) {
          refs.push({ kind: "single", data: it.data, key: f.key });
          paths.push(v);
        }
      }
      // Gallery / array of paths — evaluated independently, so a non-string
      // value on the single branch never blocks the gallery branch.
      if ((f.type === "gallery" || imageLike) && Array.isArray(v)) {
        if (maxGallery != null && v.length > maxGallery) {
          v = v.slice(0, maxGallery);
          it.data[f.key] = v;
        }
        (v as any[]).forEach((p, i) => {
          if (typeof p !== "string" || !p) return;
          if (isHttp(p)) return;
          if (!imageLike && !hasImageExtension(p)) return;
          refs.push({ kind: "gallery", data: it.data, key: f.key, index: i });
          paths.push(p);
        });
      }
    }
  }
  if (paths.length === 0) return;

  const signed = await signPathsCached(paths);
  refs.forEach((ref, i) => {
    const url = signed.get(paths[i] as string);
    if (!url || !ref) return;
    if (ref.kind === "single") {
      ref.data[ref.key] = url;
    } else {
      const arr = ref.data[ref.key];
      if (Array.isArray(arr)) arr[ref.index] = url;
    }
  });
}


export async function loadPublicFormSchema(viewId: string) {
  const sb = supabaseAdmin;
  const { data: view, error } = await sb
    .from("views")
    .select("id, type, config, submissions_table_id, table_id, organization_id")
    .eq("id", viewId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!view || view.type !== "public_form" || !view.submissions_table_id) {
    throw new Error("Formulário público não encontrado");
  }
  const { data: fields } = await sb
    .from("fields")
    .select("id, key, label, type, required, position, config")
    .eq("table_id", view.submissions_table_id)
    .order("position", { ascending: true });
  const cfg = (view.config ?? {}) as any;
  const included: string[] | null = cfg.form_field_ids ?? null;
  const autoRelationFieldId: string | null = cfg.auto_relation_field_id ?? null;
  let effective = (fields ?? []) as any[];
  if (included) effective = effective.filter((f) => included.includes(f.id));
  // Exclude the auto-relation field from the form; it's filled server-side.
  if (autoRelationFieldId) effective = effective.filter((f) => f.id !== autoRelationFieldId);
  // Exclude computed
  effective = effective.filter((f) => f.type !== "computed");
  return {
    view: {
      id: view.id,
      submissions_table_id: view.submissions_table_id as string,
      source_table_id: view.table_id as string,
      organization_id: view.organization_id as string,
      auto_relation_field_id: autoRelationFieldId,
    },
    fields: effective,
  };
}

export async function loadPublicRecord(slug: string, tableId: string, recordId: string) {
  const sb = supabaseAdmin;

  const { data: org } = await sb
    .from("organizations")
    .select("id, slug, name, description, logo_url, is_public")
    .eq("slug", slug)
    .maybeSingle();
  if (!org || (org as any).is_public === false) throw new Error("Organização não encontrada");

  const { data: table } = await sb
    .from("tables")
    .select("id, slug, name, description, icon, bookable, is_public, organization_id")
    .eq("id", tableId)
    .maybeSingle();
  if (!table || table.organization_id !== org.id) throw new Error("Tabela não encontrada");
  if ((table as any).is_public === false) throw new Error("Tabela não pública");

  const { data: record } = await sb
    .from("records")
    .select("id, data, deal_status, created_at")
    .eq("id", recordId)
    .eq("table_id", tableId)
    .eq("status", "published")
    .maybeSingle();
  if (!record) throw new Error("Registro não encontrado");

  const { data: fields } = await sb
    .from("fields")
    .select("id, key, label, type, position, config")
    .eq("table_id", tableId)
    .order("position", { ascending: true });

  const { data: views } = await sb
    .from("views")
    .select("id, type, config, submissions_table_id")
    .eq("table_id", tableId)
    .eq("type", "public_form")
    .limit(1);
  const v = views?.[0] as any;
  const hasAssignedUser = await orgHasAssignedUser((org as any).id);
  const public_form_view = v && hasAssignedUser
    ? { id: v.id, auto_relation_field_id: (v.config ?? {}).auto_relation_field_id ?? null }
    : null;

  // Pre-sign image/file/gallery URLs (batched).
  const paths: Array<{ key: string; path: string }> = [];
  const signed: Record<string, string> = {};
  const galleries: Record<string, string[]> = {};
  const galleryPaths: Array<{ key: string; index: number; path: string }> = [];
  for (const f of (fields ?? []) as any[]) {
    if (f.type === "image" || f.type === "file") {
      const path = (record.data as any)?.[f.key];
      if (typeof path !== "string" || !path) continue;
      if (path.startsWith("http://") || path.startsWith("https://")) { signed[f.key] = path; continue; }
      paths.push({ key: f.key, path });
    } else if (f.type === "gallery") {
      const arr = (record.data as any)?.[f.key];
      if (!Array.isArray(arr)) continue;
      galleries[f.key] = new Array(arr.length).fill("");
      arr.forEach((p, i) => {
        if (typeof p !== "string" || !p) return;
        if (p.startsWith("http")) { galleries[f.key][i] = p; return; }
        galleryPaths.push({ key: f.key, index: i, path: p });
      });
    }
  }
  const allPaths = [...paths.map((p) => p.path), ...galleryPaths.map((p) => p.path)];
  if (allPaths.length > 0) {
    const { data: signedList } = await sb.storage
      .from("venue-uploads")
      .createSignedUrls(allPaths, 60 * 60);
    (signedList ?? []).forEach((s, i) => {
      if (!s?.signedUrl) return;
      if (i < paths.length) signed[paths[i].key] = s.signedUrl;
      else {
        const gp = galleryPaths[i - paths.length];
        galleries[gp.key][gp.index] = s.signedUrl;
      }
    });
  }

  // Resolve relation labels so the detail page shows names instead of UUIDs.
  const relations: Record<string, Record<string, { id: string; label: string }>> = {};
  const relFields = ((fields ?? []) as any[]).filter((f) => f.type === "relation");
  await Promise.all(relFields.map(async (f) => {
    const raw = (record.data as any)?.[f.key];
    const ids = Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : typeof raw === "string" ? [raw] : [];
    if (ids.length === 0) return;
    const target = (f.config ?? {}).target_table_id as string | undefined;
    if (!target) return;
    const [{ data: tFields }, { data: targets }] = await Promise.all([
      sb.from("fields").select("key, type, position").eq("table_id", target).order("position", { ascending: true }),
      sb.from("records").select("id, data").eq("table_id", target).in("id", ids),
    ]);
    const labelKey = ((tFields ?? []) as any[]).find((x) => x.type === "text")?.key ?? "id";
    const map: Record<string, { id: string; label: string }> = {};
    for (const t of (targets ?? []) as any[]) {
      map[t.id] = { id: t.id, label: String(t.data?.[labelKey] ?? t.id).slice(0, 80) };
    }
    relations[f.id] = map;
  }));

  return {
    organization: { id: org.id, slug: org.slug, name: org.name, description: org.description ?? null, logo_url: org.logo_url ?? null },
    table: { id: table.id, slug: table.slug, name: table.name, description: table.description ?? null, icon: table.icon ?? null, bookable: !!table.bookable },
    fields: (fields ?? []) as any[],
    record: record as { id: string; data: Record<string, any>; deal_status: string; created_at: string },
    signed_urls: signed,
    galleries,
    relations,
    public_form_view,
  };
}



export type PublicLocalities = {
  bairros: Array<{ value: string; count: number }>;
  cidades: Array<{ value: string; count: number }>;
};

/**
 * Bairros e cidades distintos das organizações públicas existentes.
 * Sem paginação de cards: lê direto o endereço das organizações publicadas.
 */
export async function listPublicLocalities(): Promise<PublicLocalities> {
  return cached("localities:v1", TTL_MEDIUM, async () => {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("address")
      .eq("is_public", true);
    if (error) throw new Error(error.message);
    const bairros = new Map<string, number>();
    const cidades = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ address: any }>) {
      const addr = (row.address ?? {}) as Record<string, any>;
      const bairro = String(addr.neighborhood ?? "").trim();
      const cidade = String(addr.city ?? "").trim();
      if (bairro) bairros.set(bairro, (bairros.get(bairro) ?? 0) + 1);
      if (cidade) cidades.set(cidade, (cidades.get(cidade) ?? 0) + 1);
    }
    const toList = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, "pt-BR"));
    return { bairros: toList(bairros), cidades: toList(cidades) };
  });
}
