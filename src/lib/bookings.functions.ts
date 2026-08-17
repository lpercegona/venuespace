import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===================== Iteração 32 — Gestão de reservas =====================
// Estágios: negotiating (negociação) → accepted (fechada) → closed (encerrada).
// declined + status='archived' = recusada/arquivada.
// As transições de deal_status continuam em setDealStatus (Iteração 4).
//
// Correção/extensão: a reserva vive numa tabela dedicada ("Reservas de <X>"),
// apartada do catálogo da tabela reservável.

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
    .select("id, name, organization_id, bookable, system_data")
    .eq("id", tableId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Tabela não encontrada.");
  return data as {
    id: string; name: string; organization_id: string; bookable: boolean;
    system_data: Record<string, any> | null;
  };
}

/** Resolve (criando se preciso) a tabela de reservas de uma tabela reservável. */
async function resolveBookings(supabase: any, tableId: string) {
  const table = await tableOrg(supabase, tableId);
  const sd = (table.system_data ?? {}) as any;
  if (sd.kind === "bookings") {
    const source = await tableOrg(supabase, String(sd.source_table_id));
    return { source, bookingsTableId: table.id };
  }
  const { data, error } = await supabase.rpc("ensure_bookings_table", { _source_table_id: tableId });
  if (error) throw new Error(error.message);
  return { source: table, bookingsTableId: data as string };
}

const itemInput = z.object({
  record_id: z.string().uuid(),
  daily_value: z.number().nonnegative().optional(),
  days: z.number().int().min(1).max(3650).optional(),
  discount: z.number().min(0).optional(),
  discount_type: z.enum(["amount", "percent"]).optional(),
  note: z.string().max(600).nullable().optional(),
  courtesy: z.string().max(160).nullable().optional(),
});

/** Contexto do formulário de reserva: período, itens selecionáveis e contatos. */
export const getBookingContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadBookableItems, loadContactSetup, loadContacts } =
      await import("./bookings.server");
    const { loadOrgModule } = await import("./modules.server");
    const { applyFormConfig } = await import("./modules");
    const { source, bookingsTableId } = await resolveBookings(context.supabase, data.table_id);
    const meta = await loadBookingMeta(context.supabase, bookingsTableId);
    const items = await loadBookableItems(context.supabase, source.id);
    const setup = await loadContactSetup(context.supabase, source.organization_id);
    const contacts = await loadContacts(context.supabase, setup.contactsTableId, setup.fields);
    const mod = await loadOrgModule(context.supabase, source.organization_id, "bookings");

    // Campos livres do formulário: tudo da tabela de reservas, menos período,
    // relação de recurso e campos computados (itens e contato têm seletor próprio).
    const reserved = new Set([meta.startKey, meta.endKey, meta.relKey].filter(Boolean) as string[]);
    const formFields = applyFormConfig(
      meta.fields
        .filter((f) => !reserved.has(f.key) && f.type !== "computed" && f.type !== "relation")
        .map((f) => ({ ...f, required: !!(f.config as any)?.required })),
      mod.config.form,
    );

    return {
      table: { id: source.id, name: source.name, organization_id: source.organization_id },
      bookings_table_id: bookingsTableId,
      meta,
      items,
      periodFields: meta.periodFields,
      module: { enabled: mod.enabled },
      formFields,
      contacts,
      contactSchema: (() => {
        // Vinculado à tabela de Contatos da organização (campos padrão da categoria).
        const fromTable = setup.fields
          .filter((f) => f.key !== "__origem" && f.type !== "computed" && f.type !== "relation")
          .map((f) => ({
            key: f.key, label: f.label, type: f.type, required: !!f.required,
            config: f.config, position: f.position,
          }))
          .sort((a, b) => a.position - b.position);
        if (fromTable.length > 0) return fromTable;
        return setup.standard;
      })(),
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
    const { loadBookingMeta, loadContactSetup, loadContacts, overlaps, quoteTotal } =
      await import("./bookings.server");
    const { source, bookingsTableId } = await resolveBookings(context.supabase, data.table_id);
    const meta = await loadBookingMeta(context.supabase, bookingsTableId);
    const setup = await loadContactSetup(context.supabase, source.organization_id);
    const contacts = await loadContacts(context.supabase, setup.contactsTableId, setup.fields);
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    const { data: rows, error } = await context.supabase
      .from("records")
      .select("id, data, system_data, status, deal_status, agreed_value, created_at")
      .eq("table_id", bookingsTableId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const from = data.from ?? null;
    const to = data.to ?? from;

    const items = ((rows ?? []) as any[])
      .filter((r) => (data.include_archived ? true : r.status !== "archived"))
      .map((r) => {
        const sd = (r.system_data ?? {}) as any;
        const start = meta.startKey ? (r.data?.[meta.startKey] ?? null) : null;
        const end = meta.endKey ? (r.data?.[meta.endKey] ?? null) : null;
        const bookingItems = (Array.isArray(sd.items) ? sd.items : []).map((i: any) => ({
          record_id: String(i.record_id),
          label: String(i.label ?? ""),
          daily_value: Number(i.daily_value ?? i.value ?? 0) || 0,
          days: Number(i.days ?? 1) || 1,
          discount: Number(i.discount ?? 0) || 0,
          discount_type: (i.discount_type === "percent" ? "percent" : "amount") as "amount" | "percent",
          note: (i.note ?? null) as string | null,
          courtesy: (i.courtesy ?? null) as string | null,
        }));
        const contact = sd.contact_record_id ? (contactMap.get(sd.contact_record_id) ?? null) : null;
        const itemsLabel =
          bookingItems.length > 0
            ? bookingItems.slice(0, 2).map((i: any) => i.label).join(", ") +
              (bookingItems.length > 2 ? ` +${bookingItems.length - 2}` : "")
            : null;
        return {
          id: r.id as string,
          start,
          end,
          resource_label: itemsLabel,
          items: bookingItems,
          items_total: quoteTotal(bookingItems) + (Math.max(0, Number(r.data?.travel_fee ?? 0) || 0)),
          travel_fee: Math.max(0, Number(r.data?.travel_fee ?? 0) || 0),
          contact,
          deal_status: r.deal_status as string,
          status: r.status as string,
          agreed_value: r.agreed_value as number | null,
          quotes: (sd.quotes ?? []) as any[],
          conversation_id: null as string | null,
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

    const ids = items.map((r) => r.id).slice(0, 500);
    if (ids.length > 0) {
      const { data: convs } = await context.supabase
        .from("conversations")
        .select("id, record_id")
        .in("record_id", ids);
      const convMap = new Map<string, string>();
      for (const c of (convs ?? []) as any[]) convMap.set(c.record_id, c.id);
      for (const it of items) it.conversation_id = convMap.get(it.id) ?? null;
    }

    return { meta, bookings_table_id: bookingsTableId, items };
  });


/** Itens do catálogo sem reserva aceita/fechada sobreposta ao período informado. */
export const listAvailableResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table_id: z.string().uuid(),
      from: z.string().min(1),
      to: z.string().min(1),
      exclude_record_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadBookableItems, overlaps } = await import("./bookings.server");
    const { source, bookingsTableId } = await resolveBookings(context.supabase, data.table_id);
    const meta = await loadBookingMeta(context.supabase, bookingsTableId);
    const resources = (await loadBookableItems(context.supabase, source.id))
      .map((i) => ({ id: i.id, label: i.label }));
    if (!meta.startKey || !meta.endKey || resources.length === 0) return { available: [], busy: [] };

    let query = context.supabase
      .from("records")
      .select("id, data, system_data, deal_status, status")
      .eq("table_id", bookingsTableId)
      .in("deal_status", ["accepted", "closed"]);
    if (data.exclude_record_id) query = query.neq("id", data.exclude_record_id);
    const { data: rows } = await query;

    const busyIds = new Set<string>();
    for (const r of (rows ?? []) as any[]) {
      if (r.status === "archived") continue;
      const s = r.data?.[meta.startKey];
      const e = r.data?.[meta.endKey];
      if (!s || !e) continue;
      if (!overlaps(String(s), String(e), data.from, data.to + "\uffff")) continue;
      for (const it of ((r.system_data as any)?.items ?? []) as any[]) {
        if (it?.record_id) busyIds.add(String(it.record_id));
      }
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
      data: z.record(z.string(), z.any()).optional(),
      items: z.array(itemInput).min(1, "Selecione ao menos um item."),
      contact_record_id: z.string().uuid().nullable().optional(),
      title: z.string().max(160).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadBookableItems, daysBetween, buildItems, assertNoConflict } = await import("./bookings.server");
    const { assertModuleEnabled } = await import("./modules.server");
    const { source, bookingsTableId } = await resolveBookings(context.supabase, data.table_id);
    await assertCanEdit(context.supabase, source.organization_id, context.userId);
    await assertModuleEnabled(context.supabase, source.organization_id, "bookings");

    const meta = await loadBookingMeta(context.supabase, bookingsTableId);
    const values = (data.data ?? {}) as Record<string, any>;
    const start = meta.startKey ? values[meta.startKey] : null;
    const end = meta.endKey ? values[meta.endKey] : null;

    if (start && end && String(start) > String(end)) {
      throw new Error("A data final deve ser posterior à data inicial.");
    }

    const catalog = await loadBookableItems(context.supabase, source.id);
    const bookingItems = buildItems(catalog, data.items, daysBetween(start, end));
    await assertNoConflict(
      context.supabase, bookingsTableId, meta, start, end,
      bookingItems.map((i) => ({ id: i.record_id, label: i.label })),
    );

    const { data: row, error } = await context.supabase
      .from("records")
      .insert({
        table_id: bookingsTableId,
        organization_id: source.organization_id,
        data: values as any,
        system_data: {
          items: bookingItems,
          contact_record_id: data.contact_record_id ?? null,
        } as any,
        deal_status: "negotiating",
        created_by: context.userId,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const label = bookingItems.map((c) => c.label).slice(0, 2).join(", ") || source.name;
    const { data: conv } = await context.supabase
      .from("conversations")
      .insert({
        organization_id: source.organization_id,
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

/** Edição de uma reserva existente: período, itens do orçamento e contato. */
export const updateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      data: z.record(z.string(), z.any()).optional(),
      items: z.array(itemInput).min(1, "Selecione ao menos um item."),
      contact_record_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadBookingMeta, loadBookableItems, daysBetween, buildItems, assertNoConflict } = await import("./bookings.server");

    const { data: rec, error: recErr } = await context.supabase
      .from("records")
      .select("id, table_id, organization_id, data, system_data")
      .eq("id", data.id)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!rec) throw new Error("Reserva não encontrada.");
    await assertCanEdit(context.supabase, rec.organization_id, context.userId);
    const { assertModuleEnabled } = await import("./modules.server");
    await assertModuleEnabled(context.supabase, rec.organization_id, "bookings");

    const { source, bookingsTableId } = await resolveBookings(context.supabase, rec.table_id);
    const meta = await loadBookingMeta(context.supabase, bookingsTableId);
    const values = { ...((rec.data ?? {}) as Record<string, any>), ...((data.data ?? {}) as Record<string, any>) };
    const start = meta.startKey ? values[meta.startKey] : null;
    const end = meta.endKey ? values[meta.endKey] : null;
    if (start && end && String(start) > String(end)) {
      throw new Error("A data final deve ser posterior à data inicial.");
    }

    const catalog = await loadBookableItems(context.supabase, source.id);
    const bookingItems = buildItems(catalog, data.items, daysBetween(start, end));
    await assertNoConflict(
      context.supabase, bookingsTableId, meta, start, end,
      bookingItems.map((i) => ({ id: i.record_id, label: i.label })),
      rec.id,
    );

    const sd = (rec.system_data ?? {}) as any;
    const { error } = await context.supabase
      .from("records")
      .update({
        data: values as any,
        system_data: {
          ...sd,
          items: bookingItems,
          contact_record_id: data.contact_record_id ?? null,
        } as any,
      })
      .eq("id", rec.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclusão definitiva de uma reserva: mensagens, conversa, orçamentos e registro. */
export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rec, error: recErr } = await context.supabase
      .from("records")
      .select("id, organization_id, system_data")
      .eq("id", data.id)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!rec) throw new Error("Reserva não encontrada.");
    await assertCanEdit(context.supabase, rec.organization_id, context.userId);

    const paths = (((rec.system_data as any)?.quotes ?? []) as any[])
      .map((q) => String(q?.path ?? ""))
      .filter((p) => p.startsWith("orcamentos/"));
    if (paths.length > 0) {
      await context.supabase.storage.from("venue-uploads").remove(paths);
    }

    const { data: convs } = await context.supabase
      .from("conversations")
      .select("id")
      .eq("record_id", rec.id);
    const convIds = ((convs ?? []) as any[]).map((c) => c.id as string);
    if (convIds.length > 0) {
      await context.supabase.from("messages").delete().in("conversation_id", convIds);
      await context.supabase.from("lead_access_tokens").delete().in("conversation_id", convIds);
      await context.supabase.from("conversations").delete().in("id", convIds);
    }

    const { error } = await context.supabase.from("records").delete().eq("id", rec.id);
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
    const { loadBookingMeta, loadContactSetup, loadContacts, buildQuotePdf } =
      await import("./bookings.server");

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
      .select("name, logo_url, system_data, address")
      .eq("id", rec.organization_id)
      .maybeSingle();
    const orgSys = ((org?.system_data ?? {}) as any).quote ?? {};

    const meta = await loadBookingMeta(context.supabase, rec.table_id);
    const recData = (rec.data ?? {}) as Record<string, any>;
    const sdRec = (rec.system_data ?? {}) as any;

    const items = (Array.isArray(sdRec.items) ? sdRec.items : []).map((i: any) => ({
      record_id: String(i.record_id),
      label: String(i.label ?? ""),
      daily_value: Number(i.daily_value ?? i.value ?? 0) || 0,
      days: Number(i.days ?? 1) || 1,
      discount: Number(i.discount ?? 0) || 0,
      discount_type: (i.discount_type === "percent" ? "percent" : "amount") as "amount" | "percent",
      note: (i.note ?? null) as string | null,
      courtesy: (i.courtesy ?? null) as string | null,
    }));

    let contactText: string | null = null;
    let clientCompany: string | null = null;
    let clientCnpj: string | null = null;
    let clientAddress: string | null = null;
    if (sdRec.contact_record_id) {
      const setup = await loadContactSetup(context.supabase, rec.organization_id);
      const contacts = await loadContacts(context.supabase, setup.contactsTableId, setup.fields);
      const c = contacts.find((x) => x.id === sdRec.contact_record_id);
      if (c) {
        contactText = c.email ? `${c.label} — ${c.email}` : c.label;
        clientCompany = c.company;
        clientCnpj = c.cnpj;
        clientAddress = c.address;
      }
    }
    if (!contactText) {
      const contactField = meta.fields.find(
        (f) => f.type === "email" || f.key.includes("email") || f.key.includes("contato"),
      );
      contactText = contactField ? (recData[contactField.key] ?? null) : null;
    }

    const locationKey = meta.fields.find((f) => f.key === "event_location")?.key ?? null;
    const notesKey = meta.fields.find((f) => f.key === "booking_notes")?.key ?? null;
    const bookingNotes = notesKey ? String(recData[notesKey] ?? "") : "";
    const extraNotes = (data.notes ?? "").trim();
    const notes = [bookingNotes, extraNotes]
      .join("\n")
      .split("\n")
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    const paymentTerms = String(orgSys.payment_terms ?? "")
      .split("\n")
      .map((s: string) => s.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    const { loadCategoryPdfLayout, loadOrgCategoryId, buildQuoteFieldValues } =
      await import("./pdf-layout.server");
    const { loadOrgLogoBytes } = await import("./bookings.server");
    const categoryId = await loadOrgCategoryId(context.supabase, rec.organization_id);
    const pdfLayout = await loadCategoryPdfLayout(context.supabase, categoryId);

    const { bytes, total } = await buildQuotePdf({
      org: {
        name: org?.name ?? "Venuespace",
        cnpj: orgSys.cnpj ?? null,
        site: orgSys.site ?? null,
        logoUrl: (org?.logo_url as string | null) ?? null,
        logoBytes: await loadOrgLogoBytes(context.supabase, (org?.logo_url as string | null) ?? null),
      },
      recordId: rec.id,
      client: contactText,
      clientCompany,
      clientCnpj,
      clientAddress,
      location: locationKey ? (recData[locationKey] ?? null) : null,
      periodStart: meta.startKey ? (recData[meta.startKey] ?? null) : null,
      periodEnd: meta.endKey ? (recData[meta.endKey] ?? null) : null,
      items,
      travelFee: Math.max(0, Number(recData["travel_fee"] ?? 0) || 0),
      paymentTerms,
      notes,
      validityDays: Number(orgSys.validity_days ?? 15) || 15,
      layout: pdfLayout.config,
      layoutFields: pdfLayout.fields,
      fieldValues: buildQuoteFieldValues(meta.fields, recData, pdfLayout.fields),
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
          body: extraNotes ? `Orçamento enviado. ${extraNotes}` : "Orçamento enviado em PDF.",
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
