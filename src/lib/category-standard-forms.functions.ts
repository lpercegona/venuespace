import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file",
] as const;

export type CategoryStandardForm = {
  id: string;
  category_id: string;
  scope: "organization" | "record";
  standard_table_id: string | null;
  target_standard_table_id: string | null;
  name: string;
  submit_label: string;
  target_table_name: string;
  is_active: boolean;
};

export type CategoryStandardFormField = {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  config: Record<string, any>;
  order_index: number;
  visible: boolean;
  source_standard_field_key: string | null;
};


async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

/** Instancia/atualiza os formulários padrão em todas as orgs da categoria. */
async function syncForms(supabase: any, category_id: string) {
  const { error } = await supabase.rpc("sync_category_standard_forms", { _category_id: category_id });
  if (error) throw new Error(error.message);
}

async function categoryOfForm(admin: any, form_id: string) {
  const { data, error } = await admin
    .from("category_standard_forms").select("category_id").eq("id", form_id).single();
  if (error) throw new Error(error.message);
  return (data as any).category_id as string;
}

export const listCategoryStandardForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("category_standard_forms")
      .select("id, category_id, scope, standard_table_id, name, submit_label, target_table_name, is_active")
      .eq("category_id", data.category_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryStandardForm[];
  });

const upsertForm = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  scope: z.enum(["organization", "record"]),
  standard_table_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(80),
  submit_label: z.string().min(1).max(40).optional(),
  target_table_name: z.string().min(1).max(60).optional(),
  is_active: z.boolean().optional(),
});

export const upsertCategoryStandardForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertForm.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    if (data.scope === "record" && !data.standard_table_id) {
      throw new Error("Escolha a tabela padrão de origem.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      category_id: data.category_id,
      scope: data.scope,
      standard_table_id: data.scope === "record" ? data.standard_table_id : null,
      name: data.name,
      submit_label: data.submit_label ?? "Enviar",
      target_table_name: data.target_table_name ?? "Contatos",
      is_active: data.is_active ?? true,
    };
    let id = data.id;
    if (id) {
      const { error } = await (supabaseAdmin as any)
        .from("category_standard_forms").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await (supabaseAdmin as any)
        .from("category_standard_forms").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      id = (row as any).id as string;
    }
    await syncForms(context.supabase, data.category_id);
    return { id: id! };
  });

export const deleteCategoryStandardForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const category_id = await categoryOfForm(supabaseAdmin, data.id);
    const { error } = await (supabaseAdmin as any)
      .from("category_standard_forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncForms(context.supabase, category_id);
    return { ok: true };
  });

export const listCategoryStandardFormFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ form_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("category_standard_form_fields")
      .select("id, form_id, field_key, label, field_type, required, config, order_index")
      .eq("form_id", data.form_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CategoryStandardFormField[];
  });

const upsertField = z.object({
  id: z.string().uuid().optional(),
  form_id: z.string().uuid(),
  field_key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(80),
  field_type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  config: z.record(z.string(), z.any()).optional(),
  order_index: z.number().int().min(0),
});

export const upsertCategoryStandardFormField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertField.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      form_id: data.form_id,
      field_key: data.field_key,
      label: data.label,
      field_type: data.field_type,
      required: data.required,
      config: (data.config ?? {}) as any,
      order_index: data.order_index,
    };
    let id = data.id;
    if (id) {
      const { error } = await (supabaseAdmin as any)
        .from("category_standard_form_fields").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await (supabaseAdmin as any)
        .from("category_standard_form_fields").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      id = (row as any).id as string;
    }
    await syncForms(context.supabase, await categoryOfForm(supabaseAdmin, data.form_id));
    return { id: id! };
  });

export const deleteCategoryStandardFormField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: selErr } = await (supabaseAdmin as any)
      .from("category_standard_form_fields").select("form_id").eq("id", data.id).single();
    if (selErr) throw new Error(selErr.message);
    const category_id = await categoryOfForm(supabaseAdmin, (row as any).form_id);
    const { error } = await (supabaseAdmin as any)
      .from("category_standard_form_fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncForms(context.supabase, category_id);
    return { ok: true };
  });
