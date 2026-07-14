// Server-only helpers for public (anon) data access.
// Uses the service-role admin client since anon RLS reads on org/tables/fields/views
// were removed; scoping (published status, org/table match) is enforced in code here.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicTablePayload = {
  organization: { id: string; slug: string; name: string; description: string | null; logo_url: string | null };
  table: { id: string; slug: string; name: string; description: string | null; icon: string | null; bookable: boolean };
  fields: Array<{ id: string; key: string; label: string; type: string; position: number; config: Record<string, any> | null }>;
  records: Array<{ id: string; data: Record<string, any>; deal_status: string; created_at: string }>;
  public_form_view: {
    id: string;
    submissions_table_id: string;
    auto_relation_field_id: string | null;
    form_field_ids: string[] | null;
  } | null;
};

export async function loadPublicTable(slug: string, tableId: string): Promise<PublicTablePayload> {
  const sb = supabaseAdmin;

  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("id, slug, name, description, logo_url")
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

  return {
    organization: {
      id: org.id, slug: org.slug, name: org.name,
      description: org.description ?? null, logo_url: org.logo_url ?? null,
    },
    table: {
      id: table.id, slug: table.slug, name: table.name, description: table.description ?? null,
      icon: table.icon ?? null, bookable: !!table.bookable,
    },
    fields: (fields ?? []) as any,
    records: (records ?? []) as any,
    public_form_view,
  };
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

  // Pre-sign image/file URLs (batched) and resolve relation labels in parallel.
  const paths: Array<{ key: string; path: string }> = [];
  const signed: Record<string, string> = {};
  for (const f of (fields ?? []) as any[]) {
    if (f.type !== "image" && f.type !== "file") continue;
    const path = (record.data as any)?.[f.key];
    if (typeof path !== "string" || !path) continue;
    if (path.startsWith("http://") || path.startsWith("https://")) {
      signed[f.key] = path;
      continue;
    }
    paths.push({ key: f.key, path });
  }
  if (paths.length > 0) {
    const { data: signedList } = await sb.storage
      .from("venue-uploads")
      .createSignedUrls(paths.map((p) => p.path), 60 * 60);
    (signedList ?? []).forEach((s, i) => {
      if (s?.signedUrl) signed[paths[i].key] = s.signedUrl;
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
    relations,
    public_form_view,
  };
}


