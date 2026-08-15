import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrganizationCategory = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  allow_custom_tables?: boolean;
};

export type CategoryDefaultField = {
  id: string;
  category_id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  config: Record<string, any>;
  order_index: number;
  group_id?: string | null;
  is_base?: boolean;
};

/** Public list — used in /explore filter, org creation dropdown, admin panel. */
export const listOrganizationCategoriesPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("organization_categories")
    .select("id, name, icon, description, allow_custom_tables")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationCategory[];
});

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

const catCreate = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(60).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  allow_custom_tables: z.boolean().optional(),
});

const catUpdate = catCreate.partial().extend({ id: z.string().uuid() });

export const createOrganizationCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => catCreate.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("organization_categories")
      .insert({
        name: data.name,
        icon: data.icon ?? null,
        description: data.description ?? null,
        allow_custom_tables: data.allow_custom_tables ?? true,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateOrganizationCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => catUpdate.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { id, ...rest } = data;
    const patch: Record<string, any> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.icon !== undefined) patch.icon = rest.icon;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.allow_custom_tables !== undefined) patch.allow_custom_tables = rest.allow_custom_tables;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("organization_categories")
      .update(patch as any)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrganizationCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await context.supabase.from("organization_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Count organizations attached to each category (for admin UI). */
export const countOrganizationsByCategory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSA(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("organizations")
      .select("category_id");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as any[]) {
      if (r.category_id) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
    }
    return counts;
  });

// -------- Category default fields --------

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;

export const listCategoryDefaultFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("organization_category_default_fields")
      .select("id, category_id, field_key, label, field_type, required, config, order_index, group_id, is_base")
      .eq("category_id", data.category_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryDefaultField[];
  });

const cdfUpsert = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  field_key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(120),
  field_type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  order_index: z.number().int().min(0).max(999).optional(),
  group_id: z.string().uuid().nullable().optional(),
  is_base: z.boolean().optional(),
});

export const upsertCategoryDefaultField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cdfUpsert.parse(d))
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
      group_id: data.group_id ?? null,
      is_base: data.is_base ?? false,
    };
    if (data.id) row.id = data.id;
    const { error } = await context.supabase
      .from("organization_category_default_fields")
      .upsert(row as any, { onConflict: "category_id,field_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryDefaultField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("organization_category_default_fields")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
