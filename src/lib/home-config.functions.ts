import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireSuperAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
  if (!isAdmin) throw new Error("Forbidden");
}

export type HomeBlockRule = {
  field_key: string;
  operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "filled";
  value?: string;
};

export type HomeBlockDTO = {
  id: string;
  title: string;
  source: "organizations" | "records";
  rules: HomeBlockRule[];
  order_by: string | null;
  limit_count: number;
  order_index: number;
};

export type HomeGroupingDTO = {
  id: string;
  label: string;
  slug: string;
  description: string | null;
  order_index: number;
  category_ids: string[];
  blocks: HomeBlockDTO[];
};

/** Public: active home groupings with categories and active blocks. */
export const listHomeGroupingsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin;

  const { data: groupings, error: gErr } = await sb
    .from("home_groupings")
    .select("id, label, slug, description, order_index, is_active")
    .eq("is_active", true)
    .order("order_index", { ascending: true });
  if (gErr) throw new Error(gErr.message);
  const groupingIds = ((groupings ?? []) as any[]).map((g) => g.id);

  const [{ data: cats, error: cErr }, { data: blocks, error: bErr }] = await Promise.all([
    groupingIds.length
      ? sb.from("home_grouping_categories").select("grouping_id, category_id").in("grouping_id", groupingIds)
      : Promise.resolve({ data: [] as any[], error: null } as any),
    groupingIds.length
      ? sb
          .from("home_blocks")
          .select("id, grouping_id, title, source, rules, order_by, limit_count, order_index, is_active")
          .in("grouping_id", groupingIds)
          .eq("is_active", true)
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [] as any[], error: null } as any),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (bErr) throw new Error(bErr.message);

  const catsByGrouping = new Map<string, string[]>();
  for (const c of (cats ?? []) as any[]) {
    const arr = catsByGrouping.get(c.grouping_id) ?? [];
    arr.push(c.category_id);
    catsByGrouping.set(c.grouping_id, arr);
  }
  const blocksByGrouping = new Map<string, HomeBlockDTO[]>();
  for (const b of (blocks ?? []) as any[]) {
    const arr = blocksByGrouping.get(b.grouping_id) ?? [];
    arr.push({
      id: b.id,
      title: b.title,
      source: b.source,
      rules: (b.rules ?? []) as HomeBlockRule[],
      order_by: b.order_by ?? null,
      limit_count: b.limit_count,
      order_index: b.order_index,
    });
    blocksByGrouping.set(b.grouping_id, arr);
  }

  const result: HomeGroupingDTO[] = ((groupings ?? []) as any[]).map((g) => ({
    id: g.id,
    label: g.label,
    slug: g.slug,
    description: g.description ?? null,
    order_index: g.order_index,
    category_ids: catsByGrouping.get(g.id) ?? [],
    blocks: blocksByGrouping.get(g.id) ?? [],
  }));

  return { groupings: result };
});

/** Admin: list all blocks with grouping info for CRUD. */
export const listHomeBlocksAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { data: blocks, error } = await context.supabase
      .from("home_blocks")
      .select("id, grouping_id, title, source, rules, order_by, limit_count, order_index, is_active, created_at, updated_at, grouping:home_groupings(id, label, slug)")
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return { blocks: blocks ?? [] };
  });

const ruleSchema = z.object({
  field_key: z.string().min(1),
  operator: z.enum(["=", "!=", ">", ">=", "<", "<=", "contains", "filled"]),
  value: z.string().optional(),
});

const homeBlockSchema = z.object({
  id: z.string().uuid().optional(),
  grouping_id: z.string().uuid(),
  title: z.string().min(1).max(80),
  source: z.enum(["organizations", "records"]),
  rules: z.array(ruleSchema).default([]),
  order_by: z.string().optional(),
  limit_count: z.number().int().min(1).max(50).default(6),
  order_index: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const saveHomeBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => homeBlockSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const payload = {
      grouping_id: data.grouping_id,
      title: data.title,
      source: data.source,
      rules: data.rules as any,
      order_by: data.order_by ?? null,
      limit_count: data.limit_count,
      order_index: data.order_index,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("home_blocks").update(payload as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("home_blocks").insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteHomeBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { error } = await context.supabase.from("home_blocks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const homeGroupingSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(60),
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  description: z.string().max(500).optional().nullable(),
  order_index: z.number().int().default(0),
  is_active: z.boolean().default(true),
  category_ids: z.array(z.string().uuid()).default([]),
});

export const saveHomeGrouping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => homeGroupingSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const payload = {
      label: data.label,
      slug: data.slug,
      description: data.description ?? null,
      order_index: data.order_index,
      is_active: data.is_active,
    };
    let groupingId = data.id;
    if (groupingId) {
      const { error } = await context.supabase.from("home_groupings").update(payload as any).eq("id", groupingId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase.from("home_groupings").insert(payload as any).select("id").single();
      if (error) throw new Error(error.message);
      groupingId = (row as any).id;
    }

    if (!groupingId) throw new Error("Failed to save grouping");

    const { error: delErr } = await context.supabase.from("home_grouping_categories").delete().eq("grouping_id", groupingId);
    if (delErr) throw new Error(delErr.message);
    if (data.category_ids.length > 0) {
      const rows = data.category_ids.map((category_id) => ({ grouping_id: groupingId, category_id }));
      const { error: insErr } = await context.supabase.from("home_grouping_categories").insert(rows as any);
      if (insErr) throw new Error(insErr.message);
    }

    return { id: groupingId };
  });

export const deleteHomeGrouping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { error } = await context.supabase.from("home_groupings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
