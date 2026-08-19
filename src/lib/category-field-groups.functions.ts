import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/require-auth-middleware";

export type FieldGroupScope = "org" | "table" | "record";

export type CategoryFieldGroup = {
  id: string;
  category_id: string;
  scope: FieldGroupScope;
  key: string;
  title: string;
  description: string | null;
  order_index: number;
};

const scopeSchema = z.enum(["org", "table", "record"]);

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

export const listCategoryFieldGroups = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ category_id: z.string().uuid(), scope: scopeSchema.optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("category_field_groups")
      .select("id, category_id, scope, key, title, description, order_index")
      .eq("category_id", data.category_id);
    if (data.scope) q = q.eq("scope", data.scope);
    const { data: rows, error } = await q.order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryFieldGroup[];
  });

export const listAllCategoryFieldGroups = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("category_field_groups")
    .select("id, category_id, scope, key, title, description, order_index")
    .order("category_id", { ascending: true })
    .order("scope", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (rows ?? []) as CategoryFieldGroup[];
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  scope: scopeSchema,
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  title: z.string().min(1).max(120),
  description: z.string().max(400).nullable().optional(),
  order_index: z.number().int().min(0).max(999).optional(),
});

export const upsertCategoryFieldGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const row: Record<string, any> = {
      category_id: data.category_id,
      scope: data.scope,
      key: data.key,
      title: data.title,
      description: data.description ?? null,
      order_index: data.order_index ?? 0,
    };
    if (data.id) row.id = data.id;
    const { error } = await (context.supabase as any)
      .from("category_field_groups")
      .upsert(row, { onConflict: "category_id,scope,key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryFieldGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("category_field_groups")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
