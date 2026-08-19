import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/require-auth-middleware";
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
  bookable: boolean;
  is_hidden: boolean;
  kind: "normal" | "contacts" | "bookings";
  is_system: boolean;
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

/** Mirrors category standard tables/fields onto every existing org of the category. */
async function syncCategory(supabase: any, category_id: string) {
  const { error } = await supabase.rpc("sync_category_standard_tables", { _category_id: category_id });
  if (error) throw new Error(error.message);
}

async function resolveCategoryIdByTable(admin: any, standard_table_id: string) {
  const { data, error } = await admin
    .from("category_standard_tables").select("category_id").eq("id", standard_table_id).single();
  if (error) throw new Error(error.message);
  return (data as any).category_id as string;
}

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
      .select("id, category_id, name, slug, icon, description, order_index, is_public, bookable, is_hidden, kind, is_system")
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
  is_public: z.boolean().optional(),
  bookable: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
});

export const upsertCategoryStandardTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertTable.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new Error("Slug inválido");

    if (data.id) {
      const { data: current, error: curErr } = await (supabaseAdmin as any)
        .from("category_standard_tables").select("is_system").eq("id", data.id).single();
      if (curErr) throw new Error(curErr.message);
      const isSystem = !!(current as any).is_system;
      const payload = isSystem
        ? {
            name: data.name,
            description: data.description ?? null,
            icon: data.icon ?? null,
            order_index: data.order_index,
            is_hidden: data.is_hidden ?? false,
          }
        : {
            category_id: data.category_id,
            name: data.name,
            slug,
            icon: data.icon ?? null,
            description: data.description ?? null,
            order_index: data.order_index,
            is_public: data.is_public ?? false,
            bookable: data.bookable ?? false,
            is_hidden: data.is_hidden ?? false,
          };
      const { error } = await (supabaseAdmin as any)
        .from("category_standard_tables").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await syncCategory(context.supabase, data.category_id);
      return { id: data.id };
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("category_standard_tables").insert({
        category_id: data.category_id,
        name: data.name,
        slug,
        icon: data.icon ?? null,
        description: data.description ?? null,
        order_index: data.order_index,
        is_public: data.is_public ?? false,
        bookable: data.bookable ?? false,
        is_hidden: data.is_hidden ?? false,
      }).select("id").single();
    if (error) throw new Error(error.message);
    await syncCategory(context.supabase, data.category_id);
    return { id: (row as any).id };
  });

export const deleteCategoryStandardTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: curErr } = await (supabaseAdmin as any)
      .from("category_standard_tables").select("is_system, category_id").eq("id", data.id).single();
    if (curErr) throw new Error(curErr.message);
    if ((current as any).is_system) {
      throw new Error("Tabelas de sistema não podem ser removidas.");
    }
    const category_id = (current as any).category_id as string;
    const { error } = await (supabaseAdmin as any)
      .from("category_standard_tables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncCategory(context.supabase, category_id);
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
      await syncCategory(context.supabase, await resolveCategoryIdByTable(supabaseAdmin, data.standard_table_id));
      return { id: data.id };
    } else {
      const { data: row, error } = await (supabaseAdmin as any)
        .from("category_standard_table_fields").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      await syncCategory(context.supabase, await resolveCategoryIdByTable(supabaseAdmin, data.standard_table_id));
      return { id: (row as any).id };
    }
  });

export const deleteCategoryStandardTableField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: selErr } = await (supabaseAdmin as any)
      .from("category_standard_table_fields").select("standard_table_id").eq("id", data.id).single();
    if (selErr) throw new Error(selErr.message);
    const category_id = await resolveCategoryIdByTable(supabaseAdmin, (row as any).standard_table_id);
    const { error } = await (supabaseAdmin as any)
      .from("category_standard_table_fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncCategory(context.supabase, category_id);
    return { ok: true };
  });
