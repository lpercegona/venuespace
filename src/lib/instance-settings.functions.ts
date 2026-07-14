import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CurrencyDisplay = {
  symbol: string;
  position: "before" | "after";
  decimal: string;
  thousand: string;
};

export type InstanceSettings = {
  id: 1;
  default_timezone: string;
  default_currency: string;
  currency_display: CurrencyDisplay;
  allow_user_field_management: boolean;
  updated_at: string;
};

/** Public read — safe to call without auth. Uses admin client for reliability. */
export const getInstanceSettingsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("instance_settings")
    .select("id, default_timezone, default_currency, currency_display, allow_user_field_management, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as InstanceSettings | null;
});

const updateSchema = z.object({
  default_timezone: z.string().min(1).max(64).optional(),
  default_currency: z.string().min(1).max(8).optional(),
  currency_display: z
    .object({
      symbol: z.string().max(6),
      position: z.enum(["before", "after"]),
      decimal: z.string().max(2),
      thousand: z.string().max(2),
    })
    .optional(),
  allow_user_field_management: z.boolean().optional(),
});

export const updateInstanceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSA, error: sErr } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (sErr) throw new Error(sErr.message);
    if (!isSA) throw new Error("Apenas super admin pode editar as configurações da instância.");
    const patch: Record<string, any> = {};
    if (data.default_timezone !== undefined) patch.default_timezone = data.default_timezone;
    if (data.default_currency !== undefined) patch.default_currency = data.default_currency;
    if (data.currency_display !== undefined) patch.currency_display = data.currency_display;
    if (data.allow_user_field_management !== undefined) patch.allow_user_field_management = data.allow_user_field_management;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("instance_settings").update(patch as any).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Whether the current caller is a super admin. */
export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (error) throw new Error(error.message);
    return { is_super_admin: !!data };
  });
