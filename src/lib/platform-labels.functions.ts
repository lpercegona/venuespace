import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformLabel = { key: string; label: string; icon: string | null };
export type SystemFormField = {
  id: string;
  form_key: "create_organization" | "create_table" | "create_record";
  field_key: string;
  label: string;
  icon: string | null;
  order_index: number;
};

export const listPlatformLabelsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_labels")
    .select("key, label, icon")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformLabel[];
});

export const listSystemFormFieldsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("system_form_fields")
    .select("id, form_key, field_key, label, icon, order_index")
    .order("form_key", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SystemFormField[];
});

const labelUpsertSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  icon: z.string().max(60).nullable().optional(),
});

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

export const upsertPlatformLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => labelUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("platform_labels")
      .upsert({ key: data.key, label: data.label, icon: data.icon ?? null } as any, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const sffUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  form_key: z.enum(["create_organization", "create_table", "create_record"]),
  field_key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  icon: z.string().max(60).nullable().optional(),
  order_index: z.number().int().min(0).max(999).optional(),
});

export const upsertSystemFormField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sffUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const row: Record<string, any> = {
      form_key: data.form_key,
      field_key: data.field_key,
      label: data.label,
      icon: data.icon ?? null,
      order_index: data.order_index ?? 0,
    };
    if (data.id) row.id = data.id;
    const { error } = await context.supabase
      .from("system_form_fields")
      .upsert(row as any, { onConflict: "form_key,field_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
