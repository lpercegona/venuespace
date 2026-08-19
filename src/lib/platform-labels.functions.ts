import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/require-auth-middleware";

export type PlatformLabel = { key: string; label: string; icon: string | null };

export const listPlatformLabelsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_labels")
    .select("key, label, icon")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformLabel[];
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

// ---------- Rótulos por categoria (Iteração 27) ----------

export type CategoryLabel = { category_id: string; key: string; label: string; icon: string | null };

/** Todos os rótulos por categoria (público; usado para resolver a cascata no cliente). */
export const listCategoryLabelsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("category_labels")
    .select("category_id, key, label, icon")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryLabel[];
});

export const upsertCategoryLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      category_id: z.string().uuid(),
      key: z.string().min(1).max(80),
      label: z.string().min(1).max(120),
      icon: z.string().max(60).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("category_labels")
      .upsert(
        { category_id: data.category_id, key: data.key, label: data.label, icon: data.icon ?? null },
        { onConflict: "category_id,key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ category_id: z.string().uuid(), key: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("category_labels")
      .delete()
      .eq("category_id", data.category_id)
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
