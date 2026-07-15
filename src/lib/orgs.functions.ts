import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "./slug";

const currencyDisplaySchema = z
  .object({
    symbol: z.string().max(6),
    position: z.enum(["before", "after"]),
    decimal: z.string().max(2),
    thousand: z.string().max(2),
  })
  .nullable()
  .optional();

const orgCreate = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  category_id: z.string().uuid({ message: "Categoria é obrigatória." }),
  timezone: z.string().max(64).nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  currency_display: currencyDisplaySchema,
  system_data: z.record(z.string(), z.any()).optional(),
  category_data: z.record(z.string(), z.any()).optional(),
});


export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memberships")
      .select("role, organization:organizations(id, slug, name, description, logo_url, category_id, timezone, currency, currency_display, system_data, created_at)")
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
    // Create via SECURITY DEFINER RPC (bypasses org SELECT during insert-and-return).
    const { data: rows, error } = await context.supabase
      .rpc("create_organization", { _name: data.name, _slug: slug, _description: data.description ?? undefined });
    if (error) throw new Error(error.message);
    const org = Array.isArray(rows) ? rows[0] : rows;
    if (!org) throw new Error("Falha ao criar organização");
    // Apply category + overrides via update (owner policy, caller is owner).
    const patch: Record<string, any> = {};
    if (data.category_id !== undefined) patch.category_id = data.category_id;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.currency_display !== undefined) patch.currency_display = data.currency_display;
    if (data.system_data !== undefined) patch.system_data = data.system_data;
    if (Object.keys(patch).length > 0) {
      const { error: uErr } = await context.supabase.from("organizations").update(patch as any).eq("id", (org as any).id);
      if (uErr) throw new Error(uErr.message);
    }
    return org as { id: string; slug: string; name: string };
  });

export const getOrganizationBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, slug, name, description, logo_url, category_id, timezone, currency, currency_display, system_data, created_at")
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

const orgUpdate = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  logo_url: z.string().url().max(2000).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  currency_display: currencyDisplaySchema,
  system_data: z.record(z.string(), z.any()).optional(),
});

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: rErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: data.id, _role: "owner" });
    if (rErr) throw new Error(rErr.message);
    if (!isOwner) throw new Error("Sem permissão para editar esta organização.");
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
    if (data.category_id !== undefined) patch.category_id = data.category_id;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.currency_display !== undefined) patch.currency_display = data.currency_display;
    if (data.system_data !== undefined) patch.system_data = data.system_data;
    const { error } = await context.supabase.from("organizations").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), confirm_slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error: gErr } = await context.supabase
      .from("organizations").select("id, slug").eq("id", data.id).maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!org) throw new Error("Organização não encontrada");
    if (org.slug !== data.confirm_slug) throw new Error("Confirmação não confere.");
    const { data: isOwner, error: rErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: data.id, _role: "owner" });
    if (rErr) throw new Error(rErr.message);
    if (!isOwner) throw new Error("Sem permissão para excluir esta organização.");
    const { error } = await context.supabase.from("organizations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), confirm_name: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: table, error: gErr } = await context.supabase
      .from("tables").select("id, name, organization_id").eq("id", data.id).maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!table) throw new Error("Tabela não encontrada");
    if (table.name !== data.confirm_name) throw new Error("Confirmação não confere.");
    const { data: isOwner, error: rErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: table.organization_id, _role: "owner" });
    if (rErr) throw new Error(rErr.message);
    if (!isOwner) throw new Error("Apenas owners podem excluir tabelas.");
    const { error } = await context.supabase.from("tables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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

    // Seed default fields from org's category, if any.
    try {
      const { data: org } = await context.supabase
        .from("organizations")
        .select("category_id")
        .eq("id", data.organization_id)
        .maybeSingle();
      const catId = (org as any)?.category_id as string | undefined;
      if (catId) {
        const { data: defs } = await context.supabase
          .from("organization_category_default_fields")
          .select("field_key, label, field_type, required, config, order_index")
          .eq("category_id", catId)
          .order("order_index", { ascending: true });
        const list = (defs ?? []) as any[];
        if (list.length > 0) {
          const rows = list.map((f, idx) => ({
            table_id: (row as any).id,
            key: f.field_key,
            label: f.label,
            type: f.field_type,
            required: !!f.required,
            position: f.order_index ?? idx,
            config: (f.config ?? {}) as any,
            source: "category",
            category_field_key: f.field_key,
          }));
          await context.supabase.from("fields").insert(rows as any);
        }
      }

      // Seed category_table_fields definitions as tables.category_data schema is loaded elsewhere;
      // here we just leave category_data default {} — validated on update via cascade schema.
    } catch {
      // Seeding failure must not block table creation.
    }

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
    const { error } = await context.supabase.from("tables").update(patch as any).eq("id", id);
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

/** Blocks non-super-admin mutation when the instance-wide toggle is off. */
async function checkFieldManagementAllowed(supabase: any, userId: string) {
  const [{ data: setting }, { data: isSA }] = await Promise.all([
    supabase.from("instance_settings").select("allow_user_field_management").eq("id", 1).maybeSingle(),
    supabase.rpc("is_super_admin", { _user_id: userId }),
  ]);
  if (isSA) return;
  const allowed = (setting as any)?.allow_user_field_management ?? true;
  if (!allowed) {
    throw new Error("Gestão de campos por usuários está desativada nas configurações da instância.");
  }
}

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
    await checkFieldManagementAllowed(context.supabase, context.userId);
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
    await checkFieldManagementAllowed(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("fields").update(rest as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await checkFieldManagementAllowed(context.supabase, context.userId);
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
      .select("id, role, user_id, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = list.map((r) => r.user_id);
    let profiles: Record<string, { email: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (ids.length > 0) {
      const { data: prof, error: pErr } = await context.supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url")
        .in("id", ids);
      if (pErr) throw new Error(pErr.message);
      profiles = Object.fromEntries((prof ?? []).map((p: any) => [p.id, { email: p.email, display_name: p.display_name, avatar_url: p.avatar_url }]));
    }
    return list.map((r) => ({ ...r, profile: profiles[r.user_id] ?? null }));
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
    const { data: canManage, error: chkErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: data.organization_id, _role: "owner" });
    if (chkErr) throw new Error(chkErr.message);
    if (!canManage) throw new Error("Sem permissão para adicionar membros.");

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


// Field options (select/multiselect): append a new option to fields.config.options
// Owner/editor of the org that owns the field only.

export const addFieldOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      field_id: z.string().uuid(),
      option: z.string().min(1).max(80),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: field, error: fErr } = await context.supabase
      .from("fields")
      .select("id, type, config, table:tables(organization_id)")
      .eq("id", data.field_id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!field) throw new Error("Campo não encontrado");
    if (field.type !== "select" && field.type !== "multiselect") {
      throw new Error("Campo não aceita opções");
    }
    const orgId = (field as any).table?.organization_id as string | undefined;
    if (!orgId) throw new Error("Organização não encontrada");

    const { data: canOwner } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: orgId, _role: "owner" });
    const { data: canEditor } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _org_id: orgId, _role: "editor" });
    if (!canOwner && !canEditor) throw new Error("Sem permissão");

    const cfg = ((field as any).config ?? {}) as Record<string, any>;
    const current: string[] = Array.isArray(cfg.options) ? cfg.options : [];
    const trimmed = data.option.trim();
    const existsCi = current.some((o) => o.toLowerCase() === trimmed.toLowerCase());
    const next = existsCi ? current : [...current, trimmed];
    if (!existsCi) {
      const { error } = await context.supabase
        .from("fields")
        .update({ config: { ...cfg, options: next } as any })
        .eq("id", data.field_id);
      if (error) throw new Error(error.message);
    }
    return { options: next };
  });
