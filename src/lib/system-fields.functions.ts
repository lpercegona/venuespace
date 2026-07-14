import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FIELD_TYPES } from "./field-schema";

export type SystemFieldScope = "organization" | "table" | "record";

export type SystemFieldRow = {
  id: string;
  scope: SystemFieldScope;
  key: string;
  label: string;
  type: string;
  required: boolean;
  position: number;
  config: Record<string, any> | null;
};

function tableFor(scope: SystemFieldScope): "organization_fields" | "table_fields" | "record_fields" {
  if (scope === "organization") return "organization_fields";
  if (scope === "table") return "table_fields";
  return "record_fields";
}

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

export const listSystemFieldsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ scope: z.enum(["organization", "table", "record"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from(tableFor(data.scope))
      .select("id, key, label, type, required, position, config")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({ ...r, scope: data.scope })) as SystemFieldRow[];
  });

/** Fetch all three scopes at once (used by client-side cache). */
export const listAllSystemFieldsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const scopes: SystemFieldScope[] = ["organization", "table", "record"];
  const out: Record<SystemFieldScope, SystemFieldRow[]> = { organization: [], table: [], record: [] };
  for (const s of scopes) {
    const { data, error } = await supabaseAdmin
      .from(tableFor(s))
      .select("id, key, label, type, required, position, config")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    out[s] = ((data ?? []) as any[]).map((r) => ({ ...r, scope: s })) as SystemFieldRow[];
  }
  return out;
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["organization", "table", "record"]),
  key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(120),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const upsertSystemField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const row: Record<string, any> = {
      key: data.key,
      label: data.label,
      type: data.type,
      required: data.required ?? false,
      position: data.position ?? 0,
      config: data.config ?? {},
    };
    if (data.id) row.id = data.id;
    const { error } = await context.supabase
      .from(tableFor(data.scope))
      .upsert(row as any, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSystemField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scope: z.enum(["organization", "table", "record"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await context.supabase.from(tableFor(data.scope)).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
