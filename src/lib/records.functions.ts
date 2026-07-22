import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Types

export type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  position: number;
  config: Record<string, any> | null;
};

// ---- Dynamic Zod validator from fields

function zodForField(f: FieldRow): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (f.type) {
    case "number":
    case "currency":
      base = z.union([z.number(), z.string().transform((v) => (v === "" ? null : Number(v)))]).nullable();
      break;
    case "boolean":
      base = z.boolean().nullable();
      break;
    case "date":
    case "datetime":
      base = z.string().nullable();
      break;
    case "email":
      base = z.union([z.string().email(), z.literal("")]).nullable();
      break;
    case "url":
      base = z.union([z.string().url(), z.literal("")]).nullable();
      break;
    case "multiselect":
    case "gallery":
      base = z.array(z.string()).nullable();
      break;

    case "relation":
      base = z.union([z.string().uuid(), z.array(z.string().uuid())]).nullable();
      break;
    case "computed":
      // Not writable
      return z.any().optional();
    default:
      base = z.string().nullable();
  }
  if (f.required && f.type !== "computed") {
    base = base.refine((v) => v !== null && v !== undefined && v !== "", { message: `${f.label} é obrigatório` });
  }
  return base.optional();
}

async function buildValidator(supabase: any, tableId: string) {
  const { data, error } = await supabase
    .from("fields")
    .select("id, key, label, type, required, position, config")
    .eq("table_id", tableId);
  if (error) throw new Error(error.message);
  const fields = (data ?? []) as FieldRow[];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === "computed") continue;
    shape[f.key] = zodForField(f);
  }
  return { schema: z.object(shape).passthrough(), fields };
}

// ---- Computed / relation resolvers

async function resolveComputed(
  supabase: any,
  field: FieldRow,
  record: { id: string; data: Record<string, any> },
): Promise<number | null> {
  const c = field.config ?? {};
  const kind = c.kind as "sum" | "count" | "sum_qty_value" | undefined;
  const sourceTableId = c.source_table_id as string | undefined;
  const backRelKey = c.back_relation_key as string | undefined;
  if (!kind || !sourceTableId || !backRelKey) return null;

  const { data, error } = await supabase
    .from("records")
    .select("data")
    .eq("table_id", sourceTableId)
    .contains("data", { [backRelKey]: record.id } as any);
  if (error) return null;
  const rows = (data ?? []) as Array<{ data: Record<string, any> }>;

  if (kind === "count") return rows.length;
  const valueKey = c.value_key as string | undefined;
  const qtyKey = c.qty_key as string | undefined;
  if (kind === "sum" && valueKey) {
    return rows.reduce((acc, r) => acc + (Number(r.data?.[valueKey]) || 0), 0);
  }
  if (kind === "sum_qty_value" && valueKey && qtyKey) {
    return rows.reduce(
      (acc, r) => acc + (Number(r.data?.[qtyKey]) || 0) * (Number(r.data?.[valueKey]) || 0),
      0,
    );
  }
  return null;
}

async function resolveRelations(
  supabase: any,
  fields: FieldRow[],
  records: Array<{ id: string; data: Record<string, any> }>,
) {
  const rels = fields.filter((f) => f.type === "relation");
  if (rels.length === 0) return {} as Record<string, Record<string, { id: string; label: string }>>;

  const idsByField: Record<string, Set<string>> = {};
  for (const f of rels) {
    idsByField[f.id] = new Set();
    for (const r of records) {
      const v = r.data?.[f.key];
      if (typeof v === "string") idsByField[f.id].add(v);
      else if (Array.isArray(v)) v.forEach((x) => typeof x === "string" && idsByField[f.id].add(x));
    }
  }

  const map: Record<string, Record<string, { id: string; label: string }>> = {};
  for (const f of rels) {
    const targetTableId = (f.config ?? {}).target_table_id as string | undefined;
    map[f.id] = {};
    const ids = Array.from(idsByField[f.id]);
    if (!targetTableId || ids.length === 0) continue;

    const { data: tFields } = await supabase
      .from("fields")
      .select("key, type, position")
      .eq("table_id", targetTableId)
      .order("position", { ascending: true });
    const labelKey =
      ((tFields ?? []) as Array<{ key: string; type: string }>).find((x) => x.type === "text")?.key ??
      "id";

    const { data: targets } = await supabase
      .from("records")
      .select("id, data")
      .eq("table_id", targetTableId)
      .in("id", ids);
    for (const t of (targets ?? []) as Array<{ id: string; data: Record<string, any> }>) {
      map[f.id][t.id] = { id: t.id, label: String(t.data?.[labelKey] ?? t.id).slice(0, 80) };
    }
  }
  return map;
}

// ---- Server functions

export const listRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("records")
      .select("id, data, system_data, status, deal_status, agreed_value, contribution_status, created_at, updated_at")
      .eq("table_id", data.table_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: fields } = await context.supabase
      .from("fields")
      .select("id, key, label, type, required, position, config")
      .eq("table_id", data.table_id)
      .order("position", { ascending: true });
    const fList = (fields ?? []) as FieldRow[];

    const recs = (rows ?? []) as Array<{
      id: string;
      data: Record<string, any>;
      system_data: Record<string, any> | null;
      status: string;
      deal_status: string;
      agreed_value: number | null;
      contribution_status: string | null;
      created_at: string;
      updated_at: string;
    }>;

    // relations
    const relMap = await resolveRelations(context.supabase, fList, recs);
    // computed
    const computedFields = fList.filter((f) => f.type === "computed");
    for (const rec of recs) {
      for (const cf of computedFields) {
        rec.data = { ...rec.data, [cf.key]: await resolveComputed(context.supabase, cf, rec) };
      }
    }

    return { fields: fList, records: recs, relations: relMap };
  });

export const createRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table_id: z.string().uuid(),
      data: z.record(z.string(), z.any()),
      system_data: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: table, error: tErr } = await context.supabase
      .from("tables")
      .select("organization_id")
      .eq("id", data.table_id)
      .maybeSingle();
    if (tErr || !table) throw new Error(tErr?.message ?? "Tabela não encontrada");

    const { schema } = await buildValidator(context.supabase, data.table_id);
    const clean = schema.parse(data.data);

    const insertRow: Record<string, any> = {
      table_id: data.table_id,
      organization_id: table.organization_id,
      data: clean as any,
      created_by: context.userId,
    };
    if (data.system_data !== undefined) insertRow.system_data = data.system_data;

    const { data: row, error } = await context.supabase
      .from("records")
      .insert(insertRow as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      table_id: z.string().uuid(),
      data: z.record(z.string(), z.any()),
      system_data: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { schema } = await buildValidator(context.supabase, data.table_id);
    const clean = schema.parse(data.data);
    const patch: Record<string, any> = { data: clean as any };
    if (data.system_data !== undefined) patch.system_data = data.system_data;
    const { error } = await context.supabase
      .from("records")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRecordStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("records")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Views (grid interna nesta iteração)

const viewCreate = z.object({
  table_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: z.enum(["grid", "public_list", "public_detail", "public_form"]).default("grid"),
  config: z.record(z.string(), z.any()).optional(),
  submissions_table_id: z.string().uuid().nullable().optional(),
});

export const listViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("views")
      .select("id, name, type, config, submissions_table_id, created_at")
      .eq("table_id", data.table_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => viewCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: table, error: tErr } = await context.supabase
      .from("tables")
      .select("organization_id")
      .eq("id", data.table_id)
      .maybeSingle();
    if (tErr || !table) throw new Error(tErr?.message ?? "Tabela não encontrada");
    const { data: row, error } = await context.supabase
      .from("views")
      .insert({
        table_id: data.table_id,
        organization_id: table.organization_id,
        name: data.name,
        type: data.type,
        config: (data.config ?? {}) as any,
        submissions_table_id: data.submissions_table_id ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("views").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Permissions (per-table)

export const listPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("permissions")
      .select("id, user_id, role, created_at, profile:profiles(email, display_name)")
      .eq("table_id", data.table_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPermissionByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table_id: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["owner", "editor", "viewer"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: table, error: tErr } = await context.supabase
      .from("tables")
      .select("organization_id")
      .eq("id", data.table_id)
      .maybeSingle();
    if (tErr || !table) throw new Error(tErr?.message ?? "Tabela não encontrada");
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Usuário não encontrado.");
    const { error } = await context.supabase
      .from("permissions")
      .upsert(
        {
          organization_id: table.organization_id,
          table_id: data.table_id,
          user_id: profile.id,
          role: data.role,
        },
        { onConflict: "table_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("permissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
