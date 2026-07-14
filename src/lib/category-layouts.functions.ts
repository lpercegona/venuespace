import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FieldSourceKind = "org_field" | "table_field" | "record_field" | "record_data_field";

export type PublicLayoutItem = {
  id: string;
  category_id: string;
  field_source: FieldSourceKind;
  field_ref: string;
  icon: string | null;
  label_override: string | null;
  order_index: number;
};

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

export const listCategoryPublicLayoutPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("organization_category_public_layouts")
      .select("id, category_id, field_source, field_ref, icon, label_override, order_index")
      .eq("category_id", data.category_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as PublicLayoutItem[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  field_source: z.enum(["org_field", "table_field", "record_field", "record_data_field"]),
  field_ref: z.string().min(1).max(120),
  icon: z.string().max(60).nullable().optional(),
  label_override: z.string().max(120).nullable().optional(),
  order_index: z.number().int().min(0).max(1000),
});

export const upsertCategoryPublicLayoutItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const row: any = {
      category_id: data.category_id,
      field_source: data.field_source,
      field_ref: data.field_ref,
      icon: data.icon ?? null,
      label_override: data.label_override ?? null,
      order_index: data.order_index,
    };
    if (data.id) row.id = data.id;
    const { error } = await context.supabase.from("organization_category_public_layouts").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryPublicLayoutItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await context.supabase.from("organization_category_public_layouts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Retroactively seed category default fields into every existing table of every org in this category. */
export const seedCategoryDefaultsRetroactive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: defaults } = await supabaseAdmin
      .from("organization_category_default_fields")
      .select("field_key, label, field_type, required, config, order_index")
      .eq("category_id", data.category_id)
      .order("order_index", { ascending: true });
    const defs = (defaults ?? []) as any[];
    if (defs.length === 0) return { ok: true, tables_touched: 0, fields_created: 0 };

    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("category_id", data.category_id);
    const orgIds = (orgs ?? []).map((o: any) => o.id);
    if (orgIds.length === 0) return { ok: true, tables_touched: 0, fields_created: 0 };

    const { data: tables } = await supabaseAdmin
      .from("tables")
      .select("id")
      .in("organization_id", orgIds);
    const tableIds = (tables ?? []).map((t: any) => t.id);
    if (tableIds.length === 0) return { ok: true, tables_touched: 0, fields_created: 0 };

    let created = 0;
    for (const tableId of tableIds) {
      const { data: existing } = await supabaseAdmin.from("fields").select("key, position").eq("table_id", tableId);
      const existingKeys = new Set(((existing ?? []) as any[]).map((f) => f.key));
      const startPos = ((existing ?? []) as any[]).reduce((m, f: any) => Math.max(m, f.position ?? 0), -1) + 1;
      const toInsert = defs
        .filter((d) => !existingKeys.has(d.field_key))
        .map((d, i) => ({
          table_id: tableId,
          key: d.field_key,
          label: d.label,
          type: d.field_type,
          required: !!d.required,
          config: d.config ?? {},
          position: startPos + i,
        }));
      if (toInsert.length > 0) {
        const { error } = await supabaseAdmin.from("fields").insert(toInsert as any);
        if (!error) created += toInsert.length;
      }
    }
    return { ok: true, tables_touched: tableIds.length, fields_created: created };
  });
