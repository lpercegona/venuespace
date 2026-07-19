import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;

export type CategoryCascadeField = {
  id: string;
  category_id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  config: Record<string, any>;
  order_index: number;
};

export type BaseFieldConfig = {
  organization: Record<string, { visible: boolean; required: boolean }>;
  table: Record<string, { visible: boolean; required: boolean }>;
};

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

const scopeSchema = z.enum(["org", "table"]);
export type CascadeScope = z.infer<typeof scopeSchema>;
function tableFor(scope: CascadeScope) {
  return scope === "org" ? "category_org_fields" : "category_table_fields";
}

// -------- List --------

export const listCategoryCascadeFields = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ category_id: z.string().uuid(), scope: scopeSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from(tableFor(data.scope) as any)
      .select("id, category_id, field_key, label, field_type, required, config, order_index")
      .eq("category_id", data.category_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryCascadeField[];
  });

// -------- Upsert --------

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  scope: scopeSchema,
  category_id: z.string().uuid(),
  field_key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(120),
  field_type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  order_index: z.number().int().min(0).max(999).optional(),
});

export const upsertCategoryCascadeField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const row: Record<string, any> = {
      category_id: data.category_id,
      field_key: data.field_key,
      label: data.label,
      field_type: data.field_type,
      required: data.required ?? false,
      config: data.config ?? {},
      order_index: data.order_index ?? 0,
    };
    if (data.id) row.id = data.id;
    const { error } = await (context.supabase as any)
      .from(tableFor(data.scope))
      .upsert(row, { onConflict: "category_id,field_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryCascadeField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scope: scopeSchema, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from(tableFor(data.scope))
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Base field config --------

const baseCfgSchema = z.object({
  category_id: z.string().uuid(),
  base_field_config: z.object({
    organization: z.record(z.string(), z.object({ visible: z.boolean(), required: z.boolean() })),
    table: z.record(z.string(), z.object({ visible: z.boolean(), required: z.boolean() })),
  }),
});

export const updateCategoryBaseFieldConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => baseCfgSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("organization_categories")
      .update({ base_field_config: data.base_field_config })
      .eq("id", data.category_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCategoryBaseFieldConfig = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("organization_categories")
      .select("base_field_config")
      .eq("id", data.category_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ((row as any)?.base_field_config ?? null) as BaseFieldConfig | null;
  });


// -------- Reconcile --------

export const reconcileOrganizationCategoryFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: isOwner }, { data: isSA }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _org_id: data.organization_id, _role: "owner" }),
      context.supabase.rpc("is_super_admin", { _user_id: context.userId }),
    ]);
    if (!isOwner && !isSA) throw new Error("Sem permissão para reconciliar campos.");
    const { data: result, error } = await context.supabase.rpc("reconcile_org_category_fields", { _org_id: data.organization_id });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return {
      tables_touched: (row as any)?.tables_touched ?? 0,
      fields_added: (row as any)?.fields_added ?? 0,
    };
  });

export const reconcileCategoryAllOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { data: orgs, error } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("category_id", data.category_id);
    if (error) throw new Error(error.message);
    let tablesTouched = 0;
    let fieldsAdded = 0;
    for (const o of (orgs ?? []) as any[]) {
      const { data: r } = await context.supabase.rpc("reconcile_org_category_fields", { _org_id: o.id });
      const row = Array.isArray(r) ? r[0] : r;
      tablesTouched += (row as any)?.tables_touched ?? 0;
      fieldsAdded += (row as any)?.fields_added ?? 0;
    }
    return { tables_touched: tablesTouched, fields_added: fieldsAdded, organizations: (orgs ?? []).length };
  });

// -------- Public schema (for /explore and dynamic form rendering) --------

export const getCategorySchemaPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cat }, { data: org }, { data: tbl }, { data: rec }] = await Promise.all([
      (supabaseAdmin as any).from("organization_categories").select("id, name, base_field_config").eq("id", data.category_id).maybeSingle(),
      (supabaseAdmin as any).from("category_org_fields").select("id, field_key, label, field_type, required, config, order_index").eq("category_id", data.category_id).order("order_index"),
      (supabaseAdmin as any).from("category_table_fields").select("id, field_key, label, field_type, required, config, order_index").eq("category_id", data.category_id).order("order_index"),
      (supabaseAdmin as any).from("organization_category_default_fields").select("id, field_key, label, field_type, required, config, order_index").eq("category_id", data.category_id).order("order_index"),
    ]);
    return {
      category: cat ?? null,
      org_fields: (org ?? []) as CategoryCascadeField[],
      table_fields: (tbl ?? []) as CategoryCascadeField[],
      record_fields: (rec ?? []) as CategoryCascadeField[],
    };
  });

