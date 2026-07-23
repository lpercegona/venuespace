import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "./slug";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;

export type CategoryStandardTable = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  order_index: number;
  is_public: boolean;
};

export type CategoryStandardTableField = {
  id: string;
  standard_table_id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  config: Record<string, any>;
  order_index: number;
};

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

// -------- Standard tables --------

export const listCategoryStandardTables = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("category_standard_tables")
      .select("id, category_id, name, slug, icon, description, order_index")
      .eq("category_id", data.category_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryStandardTable[];
  });

const upsertTable = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  icon: z.string().max(40).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  order_index: z.number().int().min(0),
});

export const upsertCategoryStandardTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertTable.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new Error("Slug inválido");
    const payload = {
      category_id: data.category_id,
      name: data.name,
      slug,
      icon: data.icon ?? null,
      description: data.description ?? null,
      order_index: data.order_index,
    };
    if (data.id) {
      const { error } = await (supabaseAdmin as any)
        .from("category_standard_tables").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await (supabaseAdmin as any)
        .from("category_standard_tables").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { id: (row as any).id };
    }
  });

export const deleteCategoryStandardTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("category_standard_tables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Standard table fields --------

export const listCategoryStandardTableFields = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ standard_table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("category_standard_table_fields")
      .select("id, standard_table_id, field_key, label, field_type, required, config, order_index")
      .eq("standard_table_id", data.standard_table_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryStandardTableField[];
  });

const upsertField = z.object({
  id: z.string().uuid().optional(),
  standard_table_id: z.string().uuid(),
  field_key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(80),
  field_type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  config: z.record(z.string(), z.any()).optional(),
  order_index: z.number().int().min(0),
});

export const upsertCategoryStandardTableField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertField.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      standard_table_id: data.standard_table_id,
      field_key: data.field_key,
      label: data.label,
      field_type: data.field_type,
      required: data.required,
      config: (data.config ?? {}) as any,
      order_index: data.order_index,
    };
    if (data.id) {
      const { error } = await (supabaseAdmin as any)
        .from("category_standard_table_fields").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await (supabaseAdmin as any)
        .from("category_standard_table_fields").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { id: (row as any).id };
    }
  });

export const deleteCategoryStandardTableField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("category_standard_table_fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
