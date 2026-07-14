import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "./slug";

const orgCreate = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
});

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memberships")
      .select("role, organization:organizations(id, slug, name, description, logo_url, created_at)")
      .eq("user_id", context.userId)
      .order("created_at", { referencedTable: "organizations", ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((m) => ({ role: m.role, ...(m.organization as any) }));
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgCreate.parse(d))
  .handler(async ({ data, context }) => {
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new Error("Slug inválido");
    const { data: rows, error } = await context.supabase
      .rpc("create_organization", { _name: data.name, _slug: slug, _description: data.description ?? undefined });
    if (error) throw new Error(error.message);
    const org = Array.isArray(rows) ? rows[0] : rows;
    if (!org) throw new Error("Falha ao criar organização");
    return org as { id: string; slug: string; name: string };
  });

export const getOrganizationBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, slug, name, description, logo_url, created_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("Organização não encontrada");

    const { data: me, error: meErr } = await context.supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    return { ...org, myRole: me?.role ?? null };
  });

// Tables

const tableCreate = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(40).optional(),
  bookable: z.boolean().optional(),
});

export const listTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tables")
      .select("id, slug, name, description, icon, bookable, updated_at")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tableCreate.parse(d))
  .handler(async ({ data, context }) => {
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new Error("Slug inválido");
    const { data: row, error } = await context.supabase
      .from("tables")
      .insert({
        organization_id: data.organization_id,
        slug,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        bookable: data.bookable ?? false,
      })
      .select("id, slug, name")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const tableUpdate = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  bookable: z.boolean().optional(),
});

export const updateTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tableUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Record<string, any> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.icon !== undefined) patch.icon = rest.icon;
    if (rest.bookable !== undefined) patch.bookable = rest.bookable;
    const { error } = await context.supabase.from("tables").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tables")
      .select("id, slug, name, description, icon, bookable, organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Tabela não encontrada");
    return row;
  });

// Fields

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","file","relation","computed",
] as const;

const fieldCreate = z.object({
  table_id: z.string().uuid(),
  key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "use snake_case"),
  label: z.string().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  position: z.number().int().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const fieldUpdate = fieldCreate.partial().extend({ id: z.string().uuid() });

export const listFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("fields")
      .select("id, key, label, type, required, position, config")
      .eq("table_id", data.table_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fieldCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("fields")
      .insert({
        table_id: data.table_id,
        key: data.key,
        label: data.label,
        type: data.type,
        required: data.required ?? false,
        position: data.position ?? 0,
        config: (data.config ?? {}) as any,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fieldUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("fields").update(rest as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Memberships (basic)

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("memberships")
      .select("id, role, user_id, created_at, profile:profiles(email, display_name, avatar_url)")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addMemberByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["owner", "editor", "viewer"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify caller can manage members of this org (must be owner).
    const { data: canManage, error: chkErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: data.organization_id, _role: "owner" });
    if (chkErr) throw new Error(chkErr.message);
    if (!canManage) throw new Error("Sem permissão para adicionar membros.");

    // Look up target profile with the admin client (restricted profile RLS
    // would hide users who aren't yet co-members of this org).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Usuário não encontrado. Peça para a pessoa criar conta primeiro.");

    const { error } = await context.supabase
      .from("memberships")
      .insert({ organization_id: data.organization_id, user_id: profile.id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
