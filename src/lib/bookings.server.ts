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
  const startF = fields.find((f) => f.config?.booking_role === "start");
  const endF = fields.find((f) => f.config?.booking_role === "end");
  const relF =
    fields.find((f) => f.config?.is_resource_relation === true) ??
    fields.find((f) => f.type === "relation");
  return {
    startKey: startF?.key ?? null,
    endKey: endF?.key ?? null,
    relKey: relF?.key ?? null,
    targetTableId: (relF?.config?.target_table_id as string) ?? null,
    fields,
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
