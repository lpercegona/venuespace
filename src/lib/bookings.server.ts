// Server-only helpers for the bookings module (Iteração 32).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type BookingMeta = {
  startKey: string | null;
  endKey: string | null;
  relKey: string | null;
  targetTableId: string | null;
  fields: Array<{ id: string; key: string; label: string; type: string; config: any }>;
};

export async function loadBookingMeta(supabase: any, tableId: string): Promise<BookingMeta> {
  const { data } = await supabase
    .from("fields")
    .select("id, key, label, type, config, position")
    .eq("table_id", tableId)
    .order("position", { ascending: true });
  const fields = ((data ?? []) as any[]).map((f) => ({
    id: f.id, key: f.key, label: f.label, type: f.type, config: f.config ?? {},
  }));
  let startF = fields.find((f) => f.config?.booking_role === "start");
  let endF = fields.find((f) => f.config?.booking_role === "end");
  // Fallback: sem papéis configurados, usa os campos de data/hora da tabela.
  if (!startF || !endF) {
    const dateFields = fields.filter((f) => f.type === "date" || f.type === "datetime");
    startF = startF ?? dateFields[0];
    endF = endF ?? dateFields.find((f) => f.key !== startF?.key);
  }
  // Última garantia: período virtual, salvo no próprio `data` do registro.
  if (!startF || !endF) {
    const virtualType = startF?.type ?? endF?.type ?? "datetime";
    startF = startF ?? {
      id: "virtual-booking-start", key: "booking_start", label: "Início",
      type: virtualType, config: { booking_role: "start", virtual: true },
    };
    endF = endF ?? {
      id: "virtual-booking-end", key: "booking_end", label: "Término",
      type: virtualType, config: { booking_role: "end", virtual: true },
    };
  }
  const relF =
    fields.find((f) => f.config?.is_resource_relation === true) ??
    fields.find((f) => f.type === "relation");
  return {
    startKey: startF?.key ?? null,
    endKey: endF?.key ?? null,
    relKey: relF?.key ?? null,
    targetTableId: (relF?.config?.target_table_id as string) ?? null,
    fields,
    periodFields: [startF, endF].filter(Boolean) as BookingMeta["fields"],
  };
}


/** Rótulos legíveis dos registros de recurso da tabela alvo. */
export async function loadResourceLabels(
  supabase: any,
  targetTableId: string | null,
): Promise<Array<{ id: string; label: string }>> {
  if (!targetTableId) return [];
  const { data: tFields } = await supabase
    .from("fields")
    .select("key, type, position")
    .eq("table_id", targetTableId)
    .order("position", { ascending: true });
  const labelKey = ((tFields ?? []) as any[]).find((f) => f.type === "text")?.key ?? null;
  const { data: rows } = await supabase
    .from("records")
    .select("id, data")
    .eq("table_id", targetTableId)
    .order("created_at", { ascending: true });
  return ((rows ?? []) as any[]).map((r) => ({
    id: r.id,
    label: String((labelKey ? r.data?.[labelKey] : null) ?? r.id).slice(0, 120),
  }));
}

/** Dois períodos [aStart, aEnd) e [bStart, bEnd) se sobrepõem? Comparação lexicográfica ISO. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/** pdf-lib com fontes padrão usa WinAnsi: remove o que estiver fora do Latin-1. */
function latin1(s: string) {
  return String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x09\x0A\x20-\xFF]/g, "");
}

export type QuoteInput = {
  orgName: string;
  recordId: string;
  resourceLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  contact: string | null;
  items: Array<{ label: string; value: number }>;
  notes?: string | null;
};

export async function buildQuotePdf(input: QuoteInput): Promise<{ bytes: Uint8Array; total: number }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.13, 0.17);
  const soft = rgb(0.45, 0.47, 0.53);
  const line = rgb(0.85, 0.86, 0.89);

  let y = 790;
  const left = 48;
  const right = 595.28 - 48;

  const text = (s: string, opts: { x?: number; size?: number; f?: any; color?: any } = {}) => {
    page.drawText(latin1(s), {
      x: opts.x ?? left,
      y,
      size: opts.size ?? 10,
      font: opts.f ?? font,
      color: opts.color ?? ink,
    });
  };
  const rule = () => {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color: line });
  };

  text(input.orgName, { size: 18, f: bold });
  y -= 18;
  text("Orçamento de reserva", { size: 11, color: soft });
  y -= 8;
  rule();
  y -= 22;

  const emitted = new Date();
  const rows: Array<[string, string]> = [
    ["Documento", `#${input.recordId.slice(0, 8).toUpperCase()}`],
    ["Emissão", emitted.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    ["Recurso", input.resourceLabel ?? "-"],
    ["Período", input.periodStart && input.periodEnd ? `${input.periodStart} até ${input.periodEnd}` : "-"],
    ["Contato", input.contact ?? "-"],
  ];
  for (const [k, v] of rows) {
    text(k, { size: 9, color: soft });
    text(v, { x: left + 110, size: 10 });
    y -= 16;
  }

  y -= 10;
  rule();
  y -= 20;
  text("Itens", { size: 11, f: bold });
  y -= 18;

  let total = 0;
  if (input.items.length === 0) {
    text("Nenhum valor informado nos campos monetários da reserva.", { size: 9, color: soft });
    y -= 16;
  }
  for (const item of input.items) {
    total += Number(item.value) || 0;
    text(item.label, { size: 10 });
    const value = latin1(brl(Number(item.value) || 0));
    page.drawText(value, {
      x: right - font.widthOfTextAtSize(value, 10),
      y,
      size: 10,
      font,
      color: ink,
    });
    y -= 16;
  }

  y -= 6;
  rule();
  y -= 20;
  text("Total", { size: 12, f: bold });
  const totalStr = latin1(brl(total));
  page.drawText(totalStr, {
    x: right - bold.widthOfTextAtSize(totalStr, 12),
    y,
    size: 12,
    font: bold,
    color: ink,
  });
  y -= 30;

  if (input.notes) {
    text("Observações", { size: 11, f: bold });
    y -= 16;
    for (const chunk of wrap(latin1(input.notes), 95)) {
      text(chunk, { size: 9, color: soft });
      y -= 13;
    }
  }

  page.drawText(latin1("Documento gerado automaticamente pelo Venuespace."), {
    x: left,
    y: 40,
    size: 8,
    font,
    color: soft,
  });

  const bytes = await doc.save();
  return { bytes, total };
}

function wrap(s: string, max: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) out.push(cur.trim());
      cur = w;
    } else cur = `${cur} ${w}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.slice(0, 12);
}

// ============ Correção/extensão da Iteração 32 — itens e contato ============

export type ItemMeta = { labelKey: string | null; valueKey: string | null; imageKey: string | null };

export function pickItemMeta(fields: Array<{ key: string; type: string }>): ItemMeta {
  return {
    labelKey: fields.find((f) => f.type === "text")?.key ?? null,
    valueKey: fields.find((f) => f.type === "currency")?.key
      ?? fields.find((f) => f.type === "number")?.key
      ?? null,
    imageKey: fields.find((f) => f.type === "image")?.key ?? null,
  };
}

export type BookableItem = { id: string; label: string; value: number; image: string | null };

/** Registros da própria tabela reservável, usados como itens do orçamento. */
export async function loadBookableItems(supabase: any, tableId: string): Promise<BookableItem[]> {
  const { data: fields } = await supabase
    .from("fields").select("key, type, position").eq("table_id", tableId)
    .order("position", { ascending: true });
  const m = pickItemMeta((fields ?? []) as any[]);
  const { data: rows } = await supabase
    .from("records").select("id, data, system_data").eq("table_id", tableId)
    .order("created_at", { ascending: true });
  return ((rows ?? []) as any[])
    // uma reserva também é um registro desta tabela: itens são só os registros "puros"
    .filter((r) => !Array.isArray((r.system_data as any)?.items))
    .map((r) => ({
      id: r.id as string,
      label: String((m.labelKey ? r.data?.[m.labelKey] : null) ?? "Sem título").slice(0, 140),
      value: Number(m.valueKey ? r.data?.[m.valueKey] : 0) || 0,
      image: (m.imageKey ? (r.data?.[m.imageKey] ?? null) : null) as string | null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export type ContactFieldDef = {
  id: string; key: string; label: string; type: string; required: boolean; position: number; config: any;
};

/** Tabela de contatos da organização + campos do formulário padrão da categoria. */
export async function loadContactSetup(supabase: any, orgId: string): Promise<{
  contactsTableId: string | null;
  fields: ContactFieldDef[];
  standard: Array<{ key: string; label: string; type: string; required: boolean; config: any; position: number }>;
}> {
  const { data: tbl } = await supabase
    .from("tables").select("id, system_data").eq("organization_id", orgId);
  const contactsTableId =
    ((tbl ?? []) as any[]).find((t) => (t.system_data ?? {}).kind === "contacts")?.id ?? null;

  let fields: ContactFieldDef[] = [];
  if (contactsTableId) {
    const { data: fl } = await supabase
      .from("fields").select("id, key, label, type, required, position, config")
      .eq("table_id", contactsTableId).order("position", { ascending: true });
    fields = ((fl ?? []) as any[]).map((f) => ({ ...f, config: f.config ?? {} }));
  }

  const { data: org } = await supabase
    .from("organizations").select("category_id").eq("id", orgId).maybeSingle();
  let standard: any[] = [];
  if (org?.category_id) {
    const { data: forms } = await supabase
      .from("category_standard_forms")
      .select("id, scope, is_active")
      .eq("category_id", org.category_id)
      .eq("scope", "organization")
      .eq("is_active", true)
      .limit(1);
    const formId = ((forms ?? []) as any[])[0]?.id ?? null;
    if (formId) {
      const { data: ff } = await supabase
        .from("category_standard_form_fields")
        .select("field_key, label, field_type, required, config, order_index")
        .eq("form_id", formId)
        .order("order_index", { ascending: true });
      standard = ((ff ?? []) as any[]).map((f, i) => ({
        key: f.field_key, label: f.label, type: f.field_type,
        required: !!f.required, config: f.config ?? {}, position: f.order_index ?? i,
      }));
    }
  }
  return { contactsTableId, fields, standard };
}

export type ContactRow = { id: string; label: string; email: string | null };

export function contactLabel(fields: ContactFieldDef[], data: Record<string, any>) {
  const nameKey =
    fields.find((f) => /nome|name/i.test(f.key) && f.type === "text")?.key ??
    fields.find((f) => f.type === "text")?.key ?? null;
  const emailKey =
    fields.find((f) => f.type === "email")?.key ??
    fields.find((f) => /email/i.test(f.key))?.key ?? null;
  const label = String((nameKey ? data?.[nameKey] : null) ?? (emailKey ? data?.[emailKey] : null) ?? "Contato");
  return { label: label.slice(0, 140), email: (emailKey ? (data?.[emailKey] ?? null) : null) as string | null };
}

export async function loadContacts(
  supabase: any, contactsTableId: string | null, fields: ContactFieldDef[],
): Promise<ContactRow[]> {
  if (!contactsTableId) return [];
  const { data: rows } = await supabase
    .from("records").select("id, data").eq("table_id", contactsTableId)
    .order("created_at", { ascending: false }).limit(500);
  return ((rows ?? []) as any[]).map((r) => {
    const { label, email } = contactLabel(fields, (r.data ?? {}) as any);
    return { id: r.id as string, label, email };
  });
}
