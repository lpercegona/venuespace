import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FilterScope = "organization" | "record";
export type FilterType = "search" | "select";

export type CategoryFilterField = {
  id: string;
  category_id: string;
  scope: FilterScope;
  field_key: string;
  filter_type: FilterType;
  label_override: string | null;
  order_index: number;
};

const scopeSchema = z.enum(["organization", "record"]);
const typeSchema = z.enum(["search", "select"]);

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

export const listCategoryFilterFieldsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ category_id: z.string().uuid(), scope: scopeSchema.optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q: any = (supabaseAdmin as any)
      .from("category_filter_fields")
      .select("id, category_id, scope, field_key, filter_type, label_override, order_index")
      .eq("category_id", data.category_id)
      .order("order_index");
    if (data.scope) q = q.eq("scope", data.scope);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryFilterField[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  scope: scopeSchema,
  field_key: z.string().min(1).max(120),
  filter_type: typeSchema,
  label_override: z.string().max(120).nullable().optional(),
  order_index: z.number().int().min(0).max(999).optional(),
});

export const upsertCategoryFilterField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const row: Record<string, any> = {
      category_id: data.category_id,
      scope: data.scope,
      field_key: data.field_key,
      filter_type: data.filter_type,
      label_override: data.label_override ?? null,
      order_index: data.order_index ?? 0,
    };
    if (data.id) row.id = data.id;
    const { error } = await (context.supabase as any)
      .from("category_filter_fields")
      .upsert(row, { onConflict: "category_id,scope,field_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryFilterField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("category_filter_fields")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
