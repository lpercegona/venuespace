// Server-only helpers for public (anon) data access.
// Publishable client + service-role admin client factories.

import { createClient } from "@supabase/supabase-js";

export function createPublicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

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
  const sb = createPublicClient();

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
  const sb = createPublicClient();
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
