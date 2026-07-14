import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
