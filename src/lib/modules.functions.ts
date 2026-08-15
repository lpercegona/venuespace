import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

/** Módulos disponíveis na plataforma. */
export const listPlatformModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("platform_modules")
      .select("key, name, description, is_active, order_index")
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Estado e configuração do módulo em cada categoria. */
export const listCategoryModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ module_key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { normalizeBookingsConfig } = await import("@/lib/modules");
    const { data: cats, error: cErr } = await context.supabase
      .from("organization_categories")
      .select("id, name")
      .order("name", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    const { data: rows, error } = await context.supabase
      .from("category_modules")
      .select("category_id, is_enabled, config")
      .eq("module_key", data.module_key);
    if (error) throw new Error(error.message);
    const map = new Map(((rows ?? []) as any[]).map((r) => [r.category_id as string, r]));

    return ((cats ?? []) as any[]).map((c) => {
      const row = map.get(c.id as string);
      return {
        category_id: c.id as string,
        category_name: c.name as string,
        is_enabled: row ? row.is_enabled !== false : true,
        config: normalizeBookingsConfig(row?.config ?? null),
      };
    });
  });

/** Campos da tabela-modelo de reservas da categoria (fonte do formulário). */
export const listBookingsModuleFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: model } = await context.supabase
      .from("category_standard_tables")
      .select("id, name")
      .eq("category_id", data.category_id)
      .eq("kind", "bookings")
      .maybeSingle();
    if (!model) return { table: null, fields: [] as any[] };
    const { data: fields, error } = await context.supabase
      .from("category_standard_table_fields")
      .select("field_key, label, field_type, required, order_index")
      .eq("standard_table_id", (model as any).id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return { table: model, fields: (fields ?? []) as any[] };
  });

export const setCategoryModuleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        category_id: z.string().uuid(),
        module_key: z.string().min(1),
        is_enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("category_modules")
      .upsert(
        { category_id: data.category_id, module_key: data.module_key, is_enabled: data.is_enabled },
        { onConflict: "category_id,module_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveCategoryModuleConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        category_id: z.string().uuid(),
        module_key: z.string().min(1),
        config: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { normalizeBookingsConfig } = await import("@/lib/modules");
    const config = normalizeBookingsConfig(data.config);
    const { error } = await (context.supabase as any)
      .from("category_modules")
      .upsert(
        { category_id: data.category_id, module_key: data.module_key, config: config as any },
        { onConflict: "category_id,module_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, config };
  });

/** Pré-visualização do PDF com dados de exemplo (base64), sem gravar nada. */
export const previewBookingsQuotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ category_id: z.string().uuid(), config: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { normalizeBookingsConfig } = await import("@/lib/modules");
    const { buildQuotePdf } = await import("./bookings.server");
    const cfg = normalizeBookingsConfig(data.config);

    const { data: org } = await context.supabase
      .from("organizations")
      .select("name, logo_url, system_data")
      .eq("category_id", data.category_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orgSys = ((org?.system_data ?? {}) as any).quote ?? {};

    const today = new Date().toISOString().slice(0, 10);
    const { bytes } = await buildQuotePdf({
      org: {
        name: (org?.name as string) ?? "Venuespace",
        cnpj: orgSys.cnpj ?? "00.000.000/0001-00",
        site: orgSys.site ?? null,
        logoUrl: (org?.logo_url as string | null) ?? null,
      },
      recordId: "00000000-0000-0000-0000-000000000000",
      client: "Cliente de exemplo — cliente@exemplo.com",
      clientCompany: "Empresa Exemplo LTDA",
      clientCnpj: "00.000.000/0000-00",
      clientAddress: "Rua Exemplo, 000 — Cidade/UF",
      location: "Local de Instalação/Prestação de Serviço",
      periodStart: today,
      periodEnd: today,
      items: [
        {
          record_id: "demo-1",
          label: "Item de exemplo A",
          daily_value: 1000,
          days: 2,
          discount: 10,
          discount_type: "percent",
          note: "Montagem inclusa.",
          courtesy: "Suporte técnico",
        },
        {
          record_id: "demo-2",
          label: "Item de exemplo B",
          daily_value: 500,
          days: 2,
          discount: 0,
          discount_type: "amount",
          note: null,
          courtesy: null,
        },
      ],
      travelFee: 250,
      paymentTerms: ["50% na assinatura", "50% até 2 dias antes do evento"],
      notes: ["Documento de demonstração gerado na administração."],
      validityDays: Number(orgSys.validity_days ?? 15) || 15,
      layout: cfg.pdf,
    });

    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return { base64: btoa(bin) };
  });

/** Estado dos módulos para uma organização (usado pelo app do organizador). */
export const getOrgModuleState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadOrgModule } = await import("./modules.server");
    const bookings = await loadOrgModule(context.supabase, data.organization_id, "bookings");
    return { bookings: bookings.enabled };
  });
