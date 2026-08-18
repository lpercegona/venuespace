import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const fieldSchema = z.object({
  field_key: z.string().min(1),
  label_override: z.string().max(120).nullable().optional(),
  width_percent: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  font_size: z.number().int().min(8).max(24),
  order_index: z.number().int().min(0),
  section_title: z.string().max(120).nullable().optional(),
  content: z.string().max(4000).nullable().optional(),
});

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

/** Modelo de PDF salvo para a categoria. */
export const getCategoryPdfLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ category_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadCategoryPdfLayout } = await import("./pdf-layout.server");
    return loadCategoryPdfLayout(context.supabase, data.category_id);
  });

export const saveCategoryPdfLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        category_id: z.string().uuid(),
        config: z.record(z.string(), z.unknown()),
        fields: z.array(fieldSchema).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { normalizeBookingsConfig } = await import("@/lib/modules");
    const config = normalizeBookingsConfig({ pdf: data.config }).pdf;

    const { data: layout, error } = await (context.supabase as any)
      .from("category_pdf_layout")
      .upsert({ category_id: data.category_id, config: config as any }, { onConflict: "category_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const layoutId = (layout as any).id as string;
    const { error: delErr } = await (context.supabase as any)
      .from("category_pdf_layout_fields")
      .delete()
      .eq("layout_id", layoutId);
    if (delErr) throw new Error(delErr.message);

    if (data.fields.length > 0) {
      const rows = data.fields.map((f, i) => ({
        layout_id: layoutId,
        field_key: f.field_key,
        label_override: f.label_override ?? null,
        width_percent: f.width_percent,
        font_size: f.font_size,
        order_index: i,
        section_title: f.section_title ?? null,
        content: f.content ?? null,
      }));
      const { error: insErr } = await (context.supabase as any)
        .from("category_pdf_layout_fields")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

/** Pré-visualização a partir do rascunho, sem persistir nada. */
export const previewBookingQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        category_id: z.string().uuid(),
        config: z.record(z.string(), z.unknown()),
        fields: z.array(fieldSchema).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);
    const { normalizeBookingsConfig } = await import("@/lib/modules");
    const { normalizePdfLayout } = await import("@/lib/pdf-layout");
    const { buildQuotePdf, loadOrgLogoBytes, loadBookingMeta } = await import("./bookings.server");
    const { buildQuoteFieldValues, sampleFieldValue } = await import("./pdf-layout.server");

    const config = normalizeBookingsConfig({ pdf: data.config }).pdf;
    const layoutFields = normalizePdfLayout({ config: data.config, fields: data.fields }).fields;

    const { data: org } = await context.supabase
      .from("organizations")
      .select("id, name, logo_url, system_data")
      .eq("category_id", data.category_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orgSys = (((org as any)?.system_data ?? {}) as any).quote ?? {};

    // Registro real de reserva quando existir; senão, dados fictícios por tipo.
    let fieldValues: Array<{ key: string; label: string; value: string }> = [];
    if (org) {
      const { data: bookingTable } = await context.supabase
        .from("tables")
        .select("id")
        .eq("organization_id", (org as any).id)
        .eq("system_data->>kind", "bookings")
        .limit(1)
        .maybeSingle();
      if (bookingTable) {
        const meta = await loadBookingMeta(context.supabase, (bookingTable as any).id);
        const { data: rec } = await context.supabase
          .from("records")
          .select("data")
          .eq("table_id", (bookingTable as any).id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rec) {
          fieldValues = buildQuoteFieldValues(meta.fields, ((rec as any).data ?? {}) as any, layoutFields);
        } else {
          fieldValues = layoutFields.map((lf) => {
            const f = meta.fields.find((x) => x.key === lf.field_key);
            return {
              key: lf.field_key,
              label: f?.label ?? lf.field_key,
              value: sampleFieldValue(f?.type ?? "text", f?.label ?? lf.field_key),
            };
          });
        }
      }
    }
    if (fieldValues.length === 0) {
      fieldValues = layoutFields.map((lf) => ({
        key: lf.field_key,
        label: lf.label_override ?? lf.field_key,
        value: sampleFieldValue("text", lf.label_override ?? lf.field_key),
      }));
    }

    const today = new Date().toISOString().slice(0, 10);
    const { bytes } = await buildQuotePdf({
      org: {
        name: ((org as any)?.name as string) ?? "Venuespace",
        cnpj: orgSys.cnpj ?? "00.000.000/0001-00",
        site: orgSys.site ?? null,
        logoUrl: ((org as any)?.logo_url as string | null) ?? null,
        logoBytes: await loadOrgLogoBytes(context.supabase, (org as any)?.logo_url ?? null),
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
      layout: config,
      layoutFields,
      fieldValues,
    });

    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return { base64: btoa(bin) };
  });
