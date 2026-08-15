import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;

export type CatalogScope = "org" | "table" | "record";

const scopeSchema = z.enum(["org", "table", "record"]);

function tableFor(scope: CatalogScope) {
  if (scope === "org") return "category_org_fields";
  if (scope === "table") return "category_table_fields";
  return "organization_category_default_fields";
}

export type FieldUsage = {
  id: string;
  category_id: string;
  scope: CatalogScope;
  label: string;
  field_type: string;
  required: boolean;
  order_index: number;
  group_id: string | null;
  is_base: boolean;
};

export type FieldCatalogEntry = {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  order_index: number;
  config: Record<string, any>;
  is_base: boolean;
  divergent: boolean;
  /** Escopo predominante do campo (um campo pertence a um único escopo). */
  scope: CatalogScope;
  scope_divergent: boolean;
  usages: FieldUsage[];
  dependencies: string[];
};


async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

/** Chaves com dependência fixa em código (PDF de orçamento e motor de reserva). */
const PDF_KEYS = new Set(["contact_company", "contact_cnpj", "contact_address", "travel_fee"]);
const BOOKING_KEYS = new Set(["booking_start", "booking_end", "event_location", "booking_notes"]);

async function loadDependencies(admin: any): Promise<Record<string, string[]>> {
  const out: Record<string, Set<string>> = {};
  const add = (key: string | null | undefined, tag: string) => {
    if (!key) return;
    (out[key] ??= new Set()).add(tag);
  };

  const [filters, layoutFields, blocks, formFields] = await Promise.all([
    admin.from("category_filter_fields").select("field_key, min_field_key, max_field_key"),
    admin.from("category_public_layout_fields").select("field_key"),
    admin.from("home_blocks").select("rules"),
    admin.from("category_standard_form_fields").select("field_key"),
  ]);

  for (const r of (filters.data ?? []) as any[]) {
    add(r.field_key, "Filtro público");
    add(r.min_field_key, "Filtro público");
    add(r.max_field_key, "Filtro público");
  }
  for (const r of (layoutFields.data ?? []) as any[]) add(r.field_key, "Card público");
  for (const r of (blocks.data ?? []) as any[]) {
    const rules = r.rules ?? {};
    const collect = (v: any) => {
      if (!v) return;
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (typeof v === "object") {
        if (typeof v.field_key === "string") add(v.field_key, "Seção da home");
        Object.values(v).forEach(collect);
      }
    };
    collect(rules);
  }
  for (const r of (formFields.data ?? []) as any[]) add(r.field_key, "Formulário público");

  for (const k of PDF_KEYS) add(k, "PDF de orçamento");
  for (const k of BOOKING_KEYS) add(k, "Reserva");

  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(out)) result[k] = [...v].sort();
  return result;
}

export const listFieldCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const sel = "id, category_id, field_key, label, field_type, required, config, order_index, group_id, is_base";

    const [org, tbl, rec, deps] = await Promise.all([
      admin.from("category_org_fields").select(sel),
      admin.from("category_table_fields").select(sel),
      admin.from("organization_category_default_fields").select(sel),
      loadDependencies(admin),
    ]);

    const rows: { scope: CatalogScope; row: any }[] = [
      ...((org.data ?? []) as any[]).map((row) => ({ scope: "org" as const, row })),
      ...((tbl.data ?? []) as any[]).map((row) => ({ scope: "table" as const, row })),
      ...((rec.data ?? []) as any[]).map((row) => ({ scope: "record" as const, row })),
    ];

    const byKey = new Map<string, FieldCatalogEntry>();
    for (const { scope, row } of rows) {
      const key = row.field_key as string;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          field_key: key,
          label: row.label,
          field_type: row.field_type,
          required: !!row.required,
          order_index: row.order_index ?? 0,
          config: (row.config ?? {}) as Record<string, any>,
          is_base: !!row.is_base,
          divergent: false,
          usages: [],
          dependencies: deps[key] ?? [],
        };
        byKey.set(key, entry);
      }
      // Definição canônica: prioriza a linha marcada como base.
      if (row.is_base && !entry.is_base) {
        entry.label = row.label;
        entry.field_type = row.field_type;
        entry.required = !!row.required;
        entry.order_index = row.order_index ?? 0;
        entry.config = (row.config ?? {}) as Record<string, any>;
        entry.is_base = true;
      }
      if (row.label !== entry.label || row.field_type !== entry.field_type) entry.divergent = true;
      entry.usages.push({
        id: row.id,
        category_id: row.category_id,
        scope,
        label: row.label,
        field_type: row.field_type,
        required: !!row.required,
        order_index: row.order_index ?? 0,
        group_id: row.group_id ?? null,
        is_base: !!row.is_base,
      });
    }

    return [...byKey.values()].sort((a, b) => a.field_key.localeCompare(b.field_key));
  });

/** Chaves criadas dentro de organizações que não existem no catálogo por categoria. */
export const listOrphanOrgFieldKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [org, tbl, rec, orgFields] = await Promise.all([
      admin.from("category_org_fields").select("field_key"),
      admin.from("category_table_fields").select("field_key"),
      admin.from("organization_category_default_fields").select("field_key"),
      admin.from("fields").select("key, label, type, tables!inner(organization_id)").limit(5000),
    ]);

    const known = new Set<string>([
      ...((org.data ?? []) as any[]).map((r) => r.field_key),
      ...((tbl.data ?? []) as any[]).map((r) => r.field_key),
      ...((rec.data ?? []) as any[]).map((r) => r.field_key),
    ]);

    const map = new Map<string, { key: string; label: string; type: string; orgs: Set<string> }>();
    for (const r of (orgFields.data ?? []) as any[]) {
      if (known.has(r.key)) continue;
      const cur = map.get(r.key) ?? { key: r.key, label: r.label, type: r.type, orgs: new Set<string>() };
      const orgId = Array.isArray(r.tables) ? r.tables[0]?.organization_id : r.tables?.organization_id;
      if (orgId) cur.orgs.add(orgId);
      map.set(r.key, cur);
    }
    return [...map.values()]
      .map((v) => ({ key: v.key, label: v.label, type: v.type, organizations: v.orgs.size }))
      .sort((a, b) => a.key.localeCompare(b.key));
  });

const applySchema = z.object({
  field_key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(120),
  field_type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  order_index: z.number().int().min(0).max(999),
  config: z.record(z.string(), z.unknown()),
  is_base: z.boolean(),
  targets: z.array(z.object({ category_id: z.string().uuid(), scope: scopeSchema })),
});

export const applyFieldCatalogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applySchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const sb = context.supabase as any;

    let targets = data.targets;
    if (data.is_base) {
      const { data: cats, error: catErr } = await sb.from("organization_categories").select("id");
      if (catErr) throw new Error(catErr.message);
      const scopes = [...new Set(data.targets.map((t) => t.scope))] as CatalogScope[];
      const useScopes: CatalogScope[] = scopes.length > 0 ? scopes : ["org"];
      targets = ((cats ?? []) as any[]).flatMap((c) =>
        useScopes.map((scope) => ({ category_id: c.id as string, scope })),
      );
    }

    const scopes: CatalogScope[] = ["org", "table", "record"];
    for (const scope of scopes) {
      const wanted = targets.filter((t) => t.scope === scope);
      if (wanted.length > 0) {
        const rows = wanted.map((t) => ({
          category_id: t.category_id,
          field_key: data.field_key,
          label: data.label,
          field_type: data.field_type,
          required: data.required,
          config: data.config,
          order_index: data.order_index,
          is_base: data.is_base,
        }));
        const { error } = await sb.from(tableFor(scope)).upsert(rows, { onConflict: "category_id,field_key" });
        if (error) throw new Error(error.message);
      }
      // Remove das categorias que saíram da seleção.
      const keep = wanted.map((t) => t.category_id);
      let del = sb.from(tableFor(scope)).delete().eq("field_key", data.field_key);
      if (keep.length > 0) del = del.not("category_id", "in", `(${keep.join(",")})`);
      const { error: delErr } = await del;
      if (delErr) throw new Error(delErr.message);
    }

    return { ok: true, applied: targets.length };
  });

export const deleteFieldCatalogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ field_key: z.string().min(1).max(60), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    if ((PDF_KEYS.has(data.field_key) || BOOKING_KEYS.has(data.field_key)) && !data.force) {
      throw new Error("Campo com dependência em PDF de orçamento ou reservas. Confirme a remoção forçada.");
    }
    const sb = context.supabase as any;
    for (const scope of ["org", "table", "record"] as CatalogScope[]) {
      const { error } = await sb.from(tableFor(scope)).delete().eq("field_key", data.field_key);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
