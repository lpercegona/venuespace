import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===================== Iteração 32 — Gestão de reservas =====================
// Estágios: negotiating (negociação) → accepted (fechada) → closed (encerrada).
// declined + status='archived' = recusada/arquivada.
// As transições de deal_status continuam em setDealStatus (Iteração 4).

async function assertCanEdit(supabase: any, organizationId: string, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data.role !== "owner" && data.role !== "editor")) {
    const { data: sa } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!sa) throw new Error("Sem permissão para gerenciar reservas nesta organização.");
  }
}

async function tableOrg(supabase: any, tableId: string) {
  const { data, error } = await supabase
    .from("tables")
    .select("id, name, organization_id, bookable")
    .eq("id", tableId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Tabela não encontrada.");
  return data as { id: string; name: string; organization_id: string; bookable: boolean };
}

/** Contexto do formulário de reserva: período, itens selecionáveis e contatos. */
export const getBookingContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadResourceLabels, loadBookableItems, loadContactSetup, loadContacts } =
      await import("./bookings.server");
    const table = await tableOrg(context.supabase, data.table_id);
    const meta = await loadBookingMeta(context.supabase, data.table_id);
    const resources = await loadResourceLabels(context.supabase, meta.targetTableId);
    const items = await loadBookableItems(context.supabase, data.table_id);
    const setup = await loadContactSetup(context.supabase, table.organization_id);
    const contacts = await loadContacts(context.supabase, setup.contactsTableId, setup.fields);
    const periodFields = meta.fields.filter(
      (f) => f.config?.booking_role === "start" || f.config?.booking_role === "end",
    );
    return {
      table,
      meta,
      resources,
      items,
      periodFields,
      contacts,
      contactSchema: setup.standard.length > 0 ? setup.standard : setup.fields.map((f) => ({
        key: f.key, label: f.label, type: f.type, required: f.required, config: f.config, position: f.position,
      })),
    };
  });

/** Cria um contato na tabela de Contatos da organização (campos do formulário padrão da categoria). */
export const createBookingContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      values: z.record(z.string(), z.any()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadContactSetup, contactLabel } = await import("./bookings.server");
    await assertCanEdit(context.supabase, data.organization_id, context.userId);

    let setup = await loadContactSetup(context.supabase, data.organization_id);
    let contactsTableId = setup.contactsTableId;
    if (!contactsTableId) {
      const { data: ensured, error: ensureErr } = await context.supabase
        .rpc("ensure_contacts_table", { _org_id: data.organization_id });
      if (ensureErr) throw new Error(ensureErr.message);
      contactsTableId = ensured as string;
      setup = await loadContactSetup(context.supabase, data.organization_id);
      setup.contactsTableId = contactsTableId;
    }

    // garante os campos do formulário padrão na tabela de contatos
    const existing = new Set(setup.fields.map((f) => f.key));
    const missing = setup.standard.filter((f) => !existing.has(f.key));
    if (missing.length > 0) {
      const base = setup.fields.length;
      const { error: fErr } = await context.supabase.from("fields").insert(
        missing.map((f, i) => ({
          table_id: contactsTableId,
          key: f.key,
          label: f.label,
          type: f.type,
          required: false,
          position: base + i,
          config: f.config ?? {},
        })) as any,
      );
      if (fErr) throw new Error(fErr.message);
      setup = await loadContactSetup(context.supabase, data.organization_id);
    }

    const { data: row, error } = await context.supabase
      .from("records")
      .insert({
        table_id: contactsTableId,
        organization_id: data.organization_id,
        data: data.values as any,
        created_by: context.userId,
      } as any)
      .select("id, data")
      .single();
    if (error) throw new Error(error.message);
    const { label, email } = contactLabel(setup.fields, (row.data ?? {}) as any);
    return { id: row.id as string, label, email };
  });


const rangeSchema = z.object({
  table_id: z.string().uuid(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  include_archived: z.boolean().optional(),
});

/** Reservas que tocam o período informado (ou todas, se sem filtro). */
export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadResourceLabels, overlaps } = await import("./bookings.server");
    const meta = await loadBookingMeta(context.supabase, data.table_id);
    const resources = await loadResourceLabels(context.supabase, meta.targetTableId);
    const labels = new Map(resources.map((r) => [r.id, r.label]));

    const { data: rows, error } = await context.supabase
      .from("records")
      .select("id, data, system_data, status, deal_status, agreed_value, created_at")
      .eq("table_id", data.table_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = ((rows ?? []) as any[]).map((r) => r.id).slice(0, 500);
    const convMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: convs } = await context.supabase
        .from("conversations")
        .select("id, record_id")
        .in("record_id", ids);
      for (const c of (convs ?? []) as any[]) convMap.set(c.record_id, c.id);
    }

    const from = data.from ?? null;
    const to = data.to ?? from;

    const items = ((rows ?? []) as any[])
      .filter((r) => (data.include_archived ? true : r.status !== "archived"))
      .map((r) => {
        const start = meta.startKey ? (r.data?.[meta.startKey] ?? null) : null;
        const end = meta.endKey ? (r.data?.[meta.endKey] ?? null) : null;
        const resourceId = meta.relKey ? (r.data?.[meta.relKey] ?? null) : null;
        return {
          id: r.id as string,
          start,
          end,
          resource_id: typeof resourceId === "string" ? resourceId : null,
          resource_label: typeof resourceId === "string" ? (labels.get(resourceId) ?? null) : null,
          deal_status: r.deal_status as string,
          status: r.status as string,
          agreed_value: r.agreed_value as number | null,
          quotes: ((r.system_data as any)?.quotes ?? []) as any[],
          conversation_id: convMap.get(r.id) ?? null,
          data: r.data as Record<string, any>,
          created_at: r.created_at as string,
        };
      })
      .filter((b) => {
        if (!from || !to) return true;
        if (!b.start || !b.end) return false;
        return overlaps(String(b.start), String(b.end), String(from), String(to) + "\uffff");
      })
      .sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? "")));

    return { meta, resources, items };
  });

/** Recursos sem reserva aceita/fechada sobreposta ao período informado. */
export const listAvailableResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table_id: z.string().uuid(), from: z.string().min(1), to: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadResourceLabels, overlaps } = await import("./bookings.server");
    const meta = await loadBookingMeta(context.supabase, data.table_id);
    const resources = await loadResourceLabels(context.supabase, meta.targetTableId);
    if (!meta.startKey || !meta.endKey || !meta.relKey) return { available: [], busy: [] };

    const { data: rows } = await context.supabase
      .from("records")
      .select("id, data, deal_status, status")
      .eq("table_id", data.table_id)
      .in("deal_status", ["accepted", "closed"]);

    const busyIds = new Set<string>();
    for (const r of (rows ?? []) as any[]) {
      if (r.status === "archived") continue;
      const s = r.data?.[meta.startKey];
      const e = r.data?.[meta.endKey];
      const res = r.data?.[meta.relKey];
      if (!s || !e || typeof res !== "string") continue;
      if (overlaps(String(s), String(e), data.from, data.to + "\uffff")) busyIds.add(res);
    }
    return {
      available: resources.filter((r) => !busyIds.has(r.id)),
      busy: resources.filter((r) => busyIds.has(r.id)),
    };
  });

/** Criação manual de reserva pelo administrador. Valida conflito antes de gravar. */
export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table_id: z.string().uuid(),
      data: z.record(z.string(), z.any()),
      title: z.string().max(160).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadResourceLabels, overlaps } = await import("./bookings.server");
    const table = await tableOrg(context.supabase, data.table_id);
    await assertCanEdit(context.supabase, table.organization_id, context.userId);

    const meta = await loadBookingMeta(context.supabase, data.table_id);
    const start = meta.startKey ? data.data?.[meta.startKey] : null;
    const end = meta.endKey ? data.data?.[meta.endKey] : null;
    const resourceId = meta.relKey ? data.data?.[meta.relKey] : null;

    if (start && end && String(start) >= String(end)) {
      throw new Error("A data final deve ser posterior à data inicial.");
    }

    if (start && end && typeof resourceId === "string" && meta.startKey && meta.endKey && meta.relKey) {
      const { data: others } = await context.supabase
        .from("records")
        .select("id, data, status")
        .eq("table_id", data.table_id)
        .in("deal_status", ["accepted", "closed"])
        .contains("data", { [meta.relKey]: resourceId } as any);
      for (const o of (others ?? []) as any[]) {
        if (o.status === "archived") continue;
        const os = o.data?.[meta.startKey];
        const oe = o.data?.[meta.endKey];
        if (!os || !oe) continue;
        if (overlaps(String(start), String(end), String(os), String(oe))) {
          throw new Error(`Conflito de reserva: o recurso já está ocupado entre ${os} e ${oe}.`);
        }
      }
    }

    const { data: row, error } = await context.supabase
      .from("records")
      .insert({
        table_id: data.table_id,
        organization_id: table.organization_id,
        data: data.data as any,
        deal_status: "negotiating",
        created_by: context.userId,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const resources = await loadResourceLabels(context.supabase, meta.targetTableId);
    const label = resources.find((r) => r.id === resourceId)?.label ?? table.name;
    const { data: conv } = await context.supabase
      .from("conversations")
      .insert({
        organization_id: table.organization_id,
        record_id: row.id,
        title: (data.title ?? `Reserva — ${label}`).slice(0, 160),
      } as any)
      .select("id")
      .maybeSingle();

    return { id: row.id as string, conversation_id: conv?.id ?? null };
  });

/** Arquivar / desarquivar reservas recusadas. */
export const archiveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("records")
      .update({ status: data.archived ? "archived" : "draft" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Gera o orçamento em PDF, salva no bucket privado e registra a proposta na conversa. */
export const generateBookingQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      record_id: z.string().uuid(),
      notes: z.string().max(1200).nullable().optional(),
      send_proposal: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadResourceLabels, buildQuotePdf } = await import("./bookings.server");

    const { data: rec, error } = await context.supabase
      .from("records")
      .select("id, table_id, organization_id, data, system_data")
      .eq("id", data.record_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rec) throw new Error("Reserva não encontrada.");
    await assertCanEdit(context.supabase, rec.organization_id, context.userId);

    const { data: org } = await context.supabase
      .from("organizations")
      .select("name")
      .eq("id", rec.organization_id)
      .maybeSingle();

    const meta = await loadBookingMeta(context.supabase, rec.table_id);
    const resources = await loadResourceLabels(context.supabase, meta.targetTableId);
    const recData = (rec.data ?? {}) as Record<string, any>;
    const resourceId = meta.relKey ? recData[meta.relKey] : null;

    const items = meta.fields
      .filter((f) => f.type === "currency" || f.type === "number")
      .map((f) => ({ label: f.label, value: Number(recData[f.key]) || 0 }))
      .filter((i) => i.value > 0);

    const contactField = meta.fields.find(
      (f) => f.type === "email" || f.key.includes("email") || f.key.includes("contato"),
    );

    const { bytes, total } = await buildQuotePdf({
      orgName: org?.name ?? "Venuespace",
      recordId: rec.id,
      resourceLabel:
        typeof resourceId === "string" ? (resources.find((r) => r.id === resourceId)?.label ?? null) : null,
      periodStart: meta.startKey ? (recData[meta.startKey] ?? null) : null,
      periodEnd: meta.endKey ? (recData[meta.endKey] ?? null) : null,
      contact: contactField ? (recData[contactField.key] ?? null) : null,
      items,
      notes: data.notes ?? null,
    });

    const path = `orcamentos/${rec.organization_id}/${rec.id}/${Date.now()}.pdf`;
    const { error: upErr } = await context.supabase.storage
      .from("venue-uploads")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const sd = (rec.system_data as any) ?? {};
    const quotes = Array.isArray(sd.quotes) ? [...sd.quotes] : [];
    quotes.push({ path, total, created_at: new Date().toISOString(), created_by: context.userId });
    const { error: sdErr } = await context.supabase
      .from("records")
      .update({ system_data: { ...sd, quotes } as any })
      .eq("id", rec.id);
    if (sdErr) throw new Error(sdErr.message);

    if (data.send_proposal !== false) {
      const { data: conv } = await context.supabase
        .from("conversations")
        .select("id")
        .eq("record_id", rec.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (conv?.id) {
        await context.supabase.from("messages").insert({
          conversation_id: conv.id,
          organization_id: rec.organization_id,
          sender_user_id: context.userId,
          sender_role: "member",
          type: "proposal",
          body: data.notes?.trim() ? `Orçamento enviado. ${data.notes.trim()}` : "Orçamento enviado em PDF.",
          proposed_value: total,
          proposal_status: "pending",
        } as any);
        await context.supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conv.id);
      }
    }

    return { path, total, quotes };
  });

/** URL assinada temporária para baixar um orçamento gerado. */
export const getQuoteUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith("orcamentos/")) throw new Error("Caminho inválido.");
    const { data: signed, error } = await context.supabase.storage
      .from("venue-uploads")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });
