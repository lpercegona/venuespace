import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "./slug";
import { RICH_TEXT_MAX, richTextToPlainText, sanitizeRichText } from "./rich-text";

/** Descrição rica: sanitizada e limitada a RICH_TEXT_MAX caracteres de texto puro. */
const richDescription = z
  .string()
  .max(40000)
  .refine((v) => richTextToPlainText(v).length <= RICH_TEXT_MAX, {
    message: `Descrição deve ter até ${RICH_TEXT_MAX} caracteres.`,
  })
  .transform((v) => sanitizeRichText(v));

const currencyDisplaySchema = z
  .object({
    symbol: z.string().max(6),
    position: z.enum(["before", "after"]),
    decimal: z.string().max(2),
    thousand: z.string().max(2),
  })
  .nullable()
  .optional();

const addressSchema = z.object({
  cep: z.string().max(12).optional().nullable(),
  street: z.string().max(200).optional().nullable(),
  number: z.string().max(20).optional().nullable(),
  complement: z.string().max(120).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
}).partial();

const orgCreate = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  description: richDescription.optional(),
  category_id: z.string().uuid({ message: "Categoria é obrigatória." }),
  timezone: z.string().max(64).nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  currency_display: currencyDisplaySchema,
  system_data: z.record(z.string(), z.any()).optional(),
  category_data: z.record(z.string(), z.any()).optional(),
  address: addressSchema.optional(),
});

const ORG_LIST_COLUMNS =
  "id, slug, name, description, logo_url, category_id, timezone, currency, currency_display, system_data, created_at";

/** True when the caller is a platform super admin. */
async function isSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_super_admin", { _user_id: userId });
  return !!data;
}

/** Owner of the org OR super admin. */
async function canManageOrg(supabase: any, userId: string, orgId: string) {
  const { data: isOwner, error } = await supabase
    .rpc("has_role", { _user_id: userId, _org_id: orgId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (isOwner) return true;
  return isSuperAdmin(supabase, userId);
}

function sortByNamePtBr<T extends { name?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" }));
}

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memberships")
      .select(`role, organization:organizations(${ORG_LIST_COLUMNS})`)
      .eq("user_id", context.userId)
      .order("name", { referencedTable: "organizations", ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const mine = sortByNamePtBr((data ?? []).map((m) => ({ role: m.role, ...(m.organization as any) })));

    if (!(await isSuperAdmin(context.supabase, context.userId))) return mine;

    const { data: all, error: aErr } = await context.supabase
      .from("organizations")
      .select(ORG_LIST_COLUMNS)
      .order("name", { ascending: true, nullsFirst: false });
    if (aErr) throw new Error(aErr.message);
    const byId = new Map(mine.map((o: any) => [o.id, o]));
    const merged = (all ?? []).map((o: any) => byId.get(o.id) ?? { ...o, role: "super_admin", is_super_admin_access: true });
    return sortByNamePtBr(merged);
  });


export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgCreate.parse(d))
  .handler(async ({ data, context }) => {
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new Error("Slug inválido");
    // Create via SECURITY DEFINER RPC (bypasses org SELECT during insert-and-return).
    const { data: rows, error } = await context.supabase
      .rpc("create_organization", {
        _name: data.name,
        _slug: slug,
        _category_id: data.category_id,
        _description: data.description ?? undefined,
        _address: (data.address ?? {}) as any,
      });
    if (error) throw new Error(error.message);
    const org = Array.isArray(rows) ? rows[0] : rows;
    if (!org) throw new Error("Falha ao criar organização");
    // Apply optional overrides via update (owner policy, caller is owner).
    const patch: Record<string, any> = {};
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.currency_display !== undefined) patch.currency_display = data.currency_display;
    if (data.system_data !== undefined) patch.system_data = data.system_data;
    if (data.category_data !== undefined) patch.category_data = data.category_data;
    if (Object.keys(patch).length > 0) {
      const { error: uErr } = await context.supabase.from("organizations").update(patch as any).eq("id", (org as any).id);
      if (uErr) throw new Error(uErr.message);
    }
    await (await import("@/lib/sitemap.server")).invalidateSitemapCache();
    return org as { id: string; slug: string; name: string };
  });


export const getOrganizationBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, slug, name, description, logo_url, category_id, category_data, timezone, currency, currency_display, system_data, address, is_public, created_at")
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
    const isSA = await isSuperAdmin(context.supabase, context.userId);

    const [{ data: cat }, { data: setting }] = await Promise.all([
      context.supabase
        .from("organization_categories")
        .select("allow_custom_tables")
        .eq("id", (org as any).category_id)
        .maybeSingle(),
      context.supabase.from("instance_settings").select("allow_user_field_management").eq("id", 1).maybeSingle(),
    ]);
    const categoryAllows = (cat as any)?.allow_custom_tables ?? true;
    const instanceAllows = (setting as any)?.allow_user_field_management ?? true;
    const canCreateTables = isSA || (categoryAllows && instanceAllows);

    return {
      ...org,
      myRole: me?.role ?? (isSA ? "owner" : null),
      isSuperAdmin: isSA,
      canCreateTables,
      categoryAllowsCustomTables: categoryAllows,
    };
  });

const orgUpdate = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  description: richDescription.nullable().optional(),
  logo_url: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().optional(),
  timezone: z.string().max(64).nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  currency_display: currencyDisplaySchema,
  system_data: z.record(z.string(), z.any()).optional(),
  category_data: z.record(z.string(), z.any()).optional(),
  address: addressSchema.optional(),
  is_public: z.boolean().optional(),
});

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const allowed = await canManageOrg(context.supabase, context.userId, data.id);
    if (!allowed) throw new Error("Sem permissão para editar esta organização.");

    // Track category change to reconcile fields retroactively.
    let categoryChanged = false;
    if (data.category_id !== undefined) {
      const { data: cur } = await context.supabase
        .from("organizations").select("category_id").eq("id", data.id).maybeSingle();
      categoryChanged = (cur as any)?.category_id !== data.category_id;
    }

    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
    if (data.category_id !== undefined) patch.category_id = data.category_id;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.currency_display !== undefined) patch.currency_display = data.currency_display;
    if (data.system_data !== undefined) patch.system_data = data.system_data;
    if (data.category_data !== undefined) patch.category_data = data.category_data;
    if (data.address !== undefined) patch.address = data.address;
    if (data.is_public !== undefined) patch.is_public = data.is_public;
    const { error } = await context.supabase.from("organizations").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (categoryChanged) {
      await context.supabase.rpc("reconcile_org_category_fields", { _org_id: data.id });
    }
    await (await import("@/lib/sitemap.server")).invalidateSitemapCache();
    return { ok: true, category_reconciled: categoryChanged };
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
    const allowedDelete = await canManageOrg(context.supabase, context.userId, data.id);
    if (!allowedDelete) throw new Error("Sem permissão para excluir esta organização.");
    const { error } = await context.supabase.from("organizations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await (await import("@/lib/sitemap.server")).invalidateSitemapCache();
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
    await (await import("@/lib/sitemap.server")).invalidateSitemapCache();
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
  is_public: z.boolean().optional(),
  category_data: z.record(z.string(), z.any()).optional(),
});


export const listTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tables")
      .select("id, slug, name, description, icon, bookable, is_public, category_data, updated_at, is_locked, origin_standard_table_id, system_data, is_hidden")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    let list = (rows ?? []) as any[];
    // Tabelas ocultas pelo super admin só aparecem para o super admin.
    if (list.some((t) => t.is_hidden)) {
      const isSA = await isSuperAdmin(context.supabase, context.userId);
      if (!isSA) list = list.filter((t) => !t.is_hidden);
    }
    // Master de reservas definido pelo super admin na tabela padrão de origem (Iteração 24).
    const originIds = Array.from(new Set(list.map((t) => t.origin_standard_table_id).filter(Boolean))) as string[];
    let masters: Record<string, boolean> = {};
    if (originIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: std } = await (supabaseAdmin as any)
        .from("category_standard_tables").select("id, bookable").in("id", originIds);
      for (const s of ((std ?? []) as any[])) masters[s.id] = !!s.bookable;
    }
    return list.map((t) => ({
      ...t,
      bookable_master: t.origin_standard_table_id ? (masters[t.origin_standard_table_id] ?? false) : true,
    }));
  });


/** Bloqueia criação de tabelas quando a categoria ou a instância desativam o recurso. */
async function checkTableCreationAllowed(supabase: any, userId: string, organizationId: string) {
  const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSA) return;
  const [{ data: setting }, { data: org }] = await Promise.all([
    supabase.from("instance_settings").select("allow_user_field_management").eq("id", 1).maybeSingle(),
    supabase.from("organizations").select("category_id").eq("id", organizationId).maybeSingle(),
  ]);
  if (((setting as any)?.allow_user_field_management ?? true) === false) {
    throw new Error("Criação de novas tabelas está desativada nas configurações da instância.");
  }
  const catId = (org as any)?.category_id as string | undefined;
  if (catId) {
    const { data: cat } = await supabase
      .from("organization_categories")
      .select("allow_custom_tables")
      .eq("id", catId)
      .maybeSingle();
    if (((cat as any)?.allow_custom_tables ?? true) === false) {
      throw new Error("Criação de novas tabelas está desativada para esta categoria.");
    }
  }
}

export const createTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tableCreate.parse(d))
  .handler(async ({ data, context }) => {
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new Error("Slug inválido");
    await checkTableCreationAllowed(context.supabase, context.userId, data.organization_id);
    const { data: row, error } = await context.supabase
      .from("tables")
      .insert({
        organization_id: data.organization_id,
        slug,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        bookable: data.bookable ?? false,
        is_public: data.is_public ?? false,
        category_data: (data.category_data ?? {}) as any,
      } as any)
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

    await (await import("@/lib/sitemap.server")).invalidateSitemapCache();
    return row;
  });


const tableUpdate = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  bookable: z.boolean().optional(),
  is_public: z.boolean().optional(),
  category_data: z.record(z.string(), z.any()).optional(),
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
    if (rest.bookable !== undefined) {
      if (rest.bookable === true) {
        const { data: cur } = await context.supabase
          .from("tables").select("origin_standard_table_id").eq("id", id).maybeSingle();
        const originId = (cur as any)?.origin_standard_table_id as string | null;
        if (originId) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: std } = await (supabaseAdmin as any)
            .from("category_standard_tables").select("bookable").eq("id", originId).maybeSingle();
          if (!(std as any)?.bookable) {
            throw new Error("Reservas desabilitadas pelo administrador da plataforma para esta tabela.");
          }
        }
      }
      patch.bookable = rest.bookable;
    }
    if (rest.is_public !== undefined) {
      if (rest.is_public === true) {
        const { data: cur } = await context.supabase
          .from("tables").select("system_data").eq("id", id).maybeSingle();
        if (((cur as any)?.system_data ?? {}).kind === "contacts") {
          throw new Error("A tabela de contatos não pode ser pública.");
        }
      }
      patch.is_public = rest.is_public;
    }
    if (rest.category_data !== undefined) patch.category_data = rest.category_data;
    const { error } = await context.supabase.from("tables").update(patch as any).eq("id", id);
    if (error) throw new Error(error.message);
    await (await import("@/lib/sitemap.server")).invalidateSitemapCache();
    return { ok: true };
  });

export const getTable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tables")
      .select("id, slug, name, description, icon, bookable, is_public, category_data, organization_id, is_locked, origin_standard_table_id, system_data")
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
      .select("id, key, label, type, required, position, config, source, category_field_key")
      .eq("table_id", data.table_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function assertFieldMutable(supabase: any, userId: string, fieldId: string) {
  const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSA) return;
  const { data: f, error } = await supabase.from("fields").select("source").eq("id", fieldId).maybeSingle();
  if (error) throw new Error(error.message);
  const source = (f as any)?.source ?? "user";
  if (source !== "user") {
    throw new Error("Este campo é definido pela categoria da organização e só pode ser alterado pelo super admin.");
  }
}

/** Campos `relation` só podem apontar para tabelas da mesma organização. */
async function assertRelationTargetSameOrg(supabase: any, tableId: string, type?: string, config?: any) {
  const target = (config ?? {})?.target_table_id;
  if (!target || (type && type !== "relation")) return;
  const { data: rows, error } = await supabase
    .from("tables")
    .select("id, organization_id")
    .in("id", [tableId, target]);
  if (error) throw new Error(error.message);
  const own = (rows ?? []).find((r: any) => r.id === tableId);
  const tgt = (rows ?? []).find((r: any) => r.id === target);
  if (!own || !tgt || own.organization_id !== tgt.organization_id) {
    throw new Error("A tabela relacionada precisa pertencer à mesma organização.");
  }
}


export const createField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fieldCreate.parse(d))
  .handler(async ({ data, context }) => {
    await checkFieldManagementAllowed(context.supabase, context.userId);
    await assertRelationTargetSameOrg(context.supabase, data.table_id, data.type, data.config);
    const { data: isSA } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
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
        source: isSA ? "user" : "user",
      } as any)
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
    await assertFieldMutable(context.supabase, context.userId, data.id);
    const { id, ...rest } = data;
    if ((rest as any).config) {
      const { data: cur } = await context.supabase.from("fields").select("table_id, type").eq("id", id).maybeSingle();
      if (cur) {
        await assertRelationTargetSameOrg(
          context.supabase,
          (cur as any).table_id,
          ((rest as any).type ?? (cur as any).type) as string,
          (rest as any).config,
        );
      }
    }
    const { error } = await context.supabase.from("fields").update(rest as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await checkFieldManagementAllowed(context.supabase, context.userId);
    await assertFieldMutable(context.supabase, context.userId, data.id);
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
    const canManage = await canManageOrg(context.supabase, context.userId, data.organization_id);
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
