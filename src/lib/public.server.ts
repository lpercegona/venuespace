// Server-only helpers for public (anon) data access.
// Uses the service-role admin client since anon RLS reads on org/tables/fields/views
// were removed; scoping (published status, org/table match) is enforced in code here.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    .select("table_id, created_at, table:tables!inner(id, slug, name, icon, organization:organizations!inner(id, slug, name, category_id))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1000);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, PublicTableSummary>();
  for (const r of (data ?? []) as any[]) {
    const t = r.table;
    if (!t?.organization) continue;
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

export async function loadPublicTable(slug: string, tableId: string): Promise<PublicTablePayload> {
  const sb = supabaseAdmin;

  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("id, slug, name, description, logo_url, category_id")
    .eq("slug", slug)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org) throw new Error("Organização não encontrada");

  const { data: table, error: tErr } = await sb
    .from("tables")
    .select("id, slug, name, description, icon, bookable, organization_id")
    .eq("id", tableId)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!table || table.organization_id !== org.id) throw new Error("Tabela não encontrada");

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
    public_form_view,
    record_card_layout,
  };
}

export async function loadPublicLayout(categoryId: string | null, scope: "organization_card" | "record_card"): Promise<PublicLayoutField[]> {
  if (!categoryId) return [];
  const sb = supabaseAdmin;
  const { data: parent } = await (sb as any)
    .from("category_public_layouts")
    .select("id")
    .eq("category_id", categoryId)
    .eq("scope", scope)
    .maybeSingle();
  if (!parent) return [];
  const { data: rows } = await (sb as any)
    .from("category_public_layout_fields")
    .select("id, field_key, width_percent, order_index, config")
    .eq("layout_id", (parent as any).id)
    .order("order_index", { ascending: true });
  return ((rows ?? []) as any[]).map((r) => ({
    id: r.id,
    field_key: r.field_key,
    width_percent: r.width_percent,
    order_index: r.order_index,
    config: r.config ?? {},
  }));
}

export type PublicRendererField = { key: string; label: string; type: string };

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
  { key: "description", label: "Descrição", type: "text" },
  { key: "logo_url", label: "Logo", type: "image" },
];

async function loadLayoutsBatch(categoryIds: string[], scope: "organization_card" | "record_card"): Promise<Map<string, PublicLayoutField[]>> {
  const out = new Map<string, PublicLayoutField[]>();
  if (categoryIds.length === 0) return out;
  const sb = supabaseAdmin;
  const { data: parents } = await (sb as any)
    .from("category_public_layouts")
    .select("id, category_id")
    .in("category_id", categoryIds)
    .eq("scope", scope);
  const parentList = (parents ?? []) as Array<{ id: string; category_id: string }>;
  if (parentList.length === 0) return out;
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
      config: r.config ?? {},
    });
    byLayout.set(r.layout_id, arr);
  }
  for (const p of parentList) out.set(p.category_id, byLayout.get(p.id) ?? []);
  return out;
}

async function loadOrgCategoryFieldsBatch(categoryIds: string[]): Promise<Map<string, PublicRendererField[]>> {
  const out = new Map<string, PublicRendererField[]>();
  if (categoryIds.length === 0) return out;
  const { data } = await (supabaseAdmin as any)
    .from("category_org_fields")
    .select("category_id, field_key, label, field_type, order_index")
    .in("category_id", categoryIds)
    .order("order_index", { ascending: true });
  for (const r of ((data ?? []) as any[])) {
    const arr = out.get(r.category_id) ?? [];
    arr.push({ key: r.field_key, label: r.label, type: r.field_type });
    out.set(r.category_id, arr);
  }
  return out;
}

export async function listPublicOrganizations(opts: { limit?: number; offset?: number; q?: string; category_id?: string } = {}): Promise<{ items: PublicOrganizationSummary[]; total: number }> {
  const sb = supabaseAdmin;
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = (opts.q ?? "").trim().toLowerCase();
  const categoryId = opts.category_id?.trim() || undefined;

  // Only organizations with ≥1 published record.
  const { data: pubRecs } = await sb.from("records").select("table:tables!inner(organization_id)").eq("status", "published").limit(5000);
  const orgIds = new Set<string>();
  for (const r of (pubRecs ?? []) as any[]) if (r.table?.organization_id) orgIds.add(r.table.organization_id);
  if (orgIds.size === 0) return { items: [], total: 0 };

  let query = sb.from("organizations")
    .select("id, slug, name, description, logo_url, category_id, category_data, updated_at")
    .in("id", Array.from(orgIds))
    .order("updated_at", { ascending: false });
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let base = ((data ?? []) as any[]).map((o) => ({
    id: o.id, slug: o.slug, name: o.name,
    description: o.description ?? null, logo_url: o.logo_url ?? null,
    category_id: o.category_id ?? null, category_data: o.category_data ?? {},
    updated_at: o.updated_at,
  }));
  if (q) base = base.filter((i) =>
    i.name.toLowerCase().includes(q) ||
    (i.description ?? "").toLowerCase().includes(q),
  );
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
    const data: Record<string, any> = {
      name: o.name,
      slug: o.slug,
      description: o.description,
      logo_url: o.logo_url,
      ...o.category_data,
    };
    return { ...o, data, fields, layout };
  });
  await signImagePathsInItems(items);
  return { items, total };
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

export async function listPublicRecords(opts: { limit?: number; offset?: number; q?: string; category_id?: string; slug?: string } = {}): Promise<{ items: PublicRecordSummary[]; total: number }> {
  const sb = supabaseAdmin;
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = (opts.q ?? "").trim().toLowerCase();
  const categoryId = opts.category_id?.trim() || undefined;
  const slug = opts.slug?.trim() || undefined;

  const { data, error } = await sb.from("records")
    .select("id, data, created_at, table:tables!inner(id, slug, name, icon, organization:organizations!inner(slug, name, category_id))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  let base = ((data ?? []) as any[]).map((r) => ({
    record_id: r.id,
    data: r.data ?? {},
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
  if (q) {
    base = base.filter((i) => {
      if (i.table_name.toLowerCase().includes(q) || i.org_name.toLowerCase().includes(q)) return true;
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
      ? sb.from("fields").select("table_id, key, label, type, position").in("table_id", tableIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] as any[] } as any),
    loadLayoutsBatch(catIds, "record_card"),
  ]);
  const fieldsByTable = new Map<string, PublicRendererField[]>();
  for (const f of (((fieldsRes as any).data ?? []) as any[])) {
    const arr = fieldsByTable.get(f.table_id) ?? [];
    arr.push({ key: f.key, label: f.label, type: f.type });
    fieldsByTable.set(f.table_id, arr);
  }

  const items: PublicRecordSummary[] = paged.map((r) => ({
    ...r,
    fields: fieldsByTable.get(r.table_id) ?? [],
    layout: (r.org_category_id && layouts.get(r.org_category_id)) || [],
  }));
  await signImagePathsInItems(items);
  return { items, total };
}

// Batch-sign image/gallery paths across items so listing cards can render <img>.
async function signImagePathsInItems(items: Array<{ data: Record<string, any>; fields: PublicRendererField[] }>) {
  type Ref =
    | { kind: "single"; data: Record<string, any>; key: string }
    | { kind: "gallery"; data: Record<string, any>; key: string; index: number };
  const refs: Ref[] = [];
  const paths: string[] = [];
  for (const it of items) {
    for (const f of it.fields) {
      if (f.type === "image") {
        const v = it.data?.[f.key];
        if (typeof v !== "string" || !v) continue;
        if (/^https?:\/\//i.test(v)) continue;
        refs.push({ kind: "single", data: it.data, key: f.key });
        paths.push(v);
      } else if (f.type === "gallery") {
        const arr = it.data?.[f.key];
        if (!Array.isArray(arr)) continue;
        arr.forEach((p, i) => {
          if (typeof p !== "string" || !p) return;
          if (/^https?:\/\//i.test(p)) return;
          refs.push({ kind: "gallery", data: it.data, key: f.key, index: i });
          paths.push(p);
        });
      }
    }
  }
  if (paths.length === 0) return;
  const { data: signed } = await supabaseAdmin.storage.from("venue-uploads").createSignedUrls(paths, 60 * 60);
  (signed ?? []).forEach((s, i) => {
    const ref = refs[i];
    if (!s?.signedUrl || !ref) return;
    if (ref.kind === "single") {
      ref.data[ref.key] = s.signedUrl;
    } else {
      const arr = ref.data[ref.key];
      if (Array.isArray(arr)) arr[ref.index] = s.signedUrl;
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
    .select("id, slug, name, description, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) throw new Error("Organização não encontrada");

  const { data: table } = await sb
    .from("tables")
    .select("id, slug, name, description, icon, bookable, organization_id")
    .eq("id", tableId)
    .maybeSingle();
  if (!table || table.organization_id !== org.id) throw new Error("Tabela não encontrada");

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
  const public_form_view = v
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


