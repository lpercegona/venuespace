// Server-only helpers for the bookings module (Iteração 32 + correção/extensão).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type BookingField = { id: string; key: string; label: string; type: string; config: any };

export type BookingMeta = {
  startKey: string | null;
  endKey: string | null;
  relKey: string | null;
  targetTableId: string | null;
  fields: BookingField[];
  periodFields: BookingField[];
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

// ============ Itens do orçamento: diárias e desconto ============

export type QuoteItem = {
  record_id: string;
  label: string;
  daily_value: number;
  days: number;
  discount: number;
  discount_type: "amount" | "percent";
  note?: string | null;
  courtesy?: string | null;
};

/** Nº de diárias derivado do período (mínimo 1, contando dias inclusive). */
export function daysBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 1;
  const a = new Date(String(start).slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(String(end).slice(0, 10) + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function itemSubtotal(i: Pick<QuoteItem, "daily_value" | "days">) {
  return (Number(i.daily_value) || 0) * Math.max(1, Number(i.days) || 1);
}

export function itemDiscountValue(i: QuoteItem) {
  const sub = itemSubtotal(i);
  const d = Number(i.discount) || 0;
  if (d <= 0) return 0;
  return i.discount_type === "percent" ? Math.min(sub, (sub * d) / 100) : Math.min(sub, d);
}

export function itemTotal(i: QuoteItem) {
  return Math.max(0, itemSubtotal(i) - itemDiscountValue(i));
}

export function quoteTotal(items: QuoteItem[]) {
  return items.reduce((s, i) => s + itemTotal(i), 0);
}

// ============ Datas por extenso ============

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parts(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map((n) => Number(n));
  return { y, m, d };
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const { y, m, d } = parts(iso);
  if (!y || !m || !d) return String(iso);
  return `${String(d).padStart(2, "0")} de ${MONTHS[m - 1]} de ${y}`;
}

/** "25 e 26 de Julho de 2026" / "28 de Julho a 02 de Agosto de 2026". */
export function longPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return start ? longDate(start) : "-";
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return longDate(start);
  if (a.y === b.y && a.m === b.m) {
    const sep = b.d - a.d === 1 ? " e " : " a ";
    return `${String(a.d).padStart(2, "0")}${sep}${String(b.d).padStart(2, "0")} de ${MONTHS[a.m - 1]} de ${a.y}`;
  }
  if (a.y === b.y) {
    return `${String(a.d).padStart(2, "0")} de ${MONTHS[a.m - 1]} a ${String(b.d).padStart(2, "0")} de ${MONTHS[b.m - 1]} de ${a.y}`;
  }
  return `${longDate(start)} a ${longDate(end)}`;
}

export function addDays(iso: string, days: number): string {
  const t = new Date(String(iso).slice(0, 10) + "T00:00:00Z").getTime() + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

// ============ PDF do orçamento ============

export type QuoteOrg = {
  name: string;
  cnpj?: string | null;
  site?: string | null;
  logoUrl?: string | null;
};

export type QuoteInput = {
  org: QuoteOrg;
  recordId: string;
  client: string | null;
  clientCompany?: string | null;
  clientCnpj?: string | null;
  clientAddress?: string | null;
  location: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  items: QuoteItem[];
  travelFee?: number;
  paymentTerms: string[];
  notes: string[];
  validityDays: number;
  layout?: import("@/lib/modules").BookingsPdfConfig;
};

const INK = rgb(0.11, 0.12, 0.14);
const DARK = rgb(0.13, 0.13, 0.15);
const SOFT = rgb(0.42, 0.44, 0.5);
const LINE = rgb(0.85, 0.86, 0.89);
const ACCENT = rgb(0.42, 0.31, 0.64);
const AMBER = rgb(0.9, 0.56, 0.1);
const PAPER = rgb(0.97, 0.97, 0.98);
const CREAM = rgb(0.99, 0.97, 0.93);
const GREEN_BG = rgb(0.9, 0.96, 0.92);
const GREEN = rgb(0.11, 0.42, 0.27);
const WHITE = rgb(1, 1, 1);

const PW = 595.28;
const PH = 841.89;
const L = 48;
const R = PW - 48;

type Ctx = {
  doc: PDFDocument;
  page: any;
  y: number;
  font: any;
  bold: any;
  pages: any[];
};

function wrapText(s: string, font: any, size: number, maxWidth: number): string[] {
  const words = latin1(s).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PW, PH]);
  ctx.pages.push(ctx.page);
  ctx.y = PH - 64;
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < 70) newPage(ctx);
}

function draw(ctx: Ctx, s: string, x: number, y: number, size: number, f: any, color: any) {
  ctx.page.drawText(latin1(s), { x, y, size, font: f, color });
}

function drawRight(ctx: Ctx, s: string, xRight: number, y: number, size: number, f: any, color: any) {
  const t = latin1(s);
  draw(ctx, t, xRight - f.widthOfTextAtSize(t, size), y, size, f, color);
}

function sectionTitle(ctx: Ctx, title: string, accent: any = ACCENT) {
  ensure(ctx, 40);
  ctx.page.drawRectangle({ x: L, y: ctx.y - 3, width: 4, height: 16, color: accent });
  draw(ctx, title.toUpperCase(), L + 12, ctx.y, 12, ctx.bold, INK);
  ctx.y -= 22;
}

async function drawHeader(ctx: Ctx, org: QuoteOrg, logo: any, accent: any, logoSize: number) {
  const h = 96;
  ctx.page.drawRectangle({ x: 0, y: PH - h, width: PW, height: h, color: DARK });
  ctx.page.drawRectangle({ x: 0, y: PH - h - 5, width: PW, height: 5, color: accent });

  if (logo) {
    const box = Math.max(24, Math.min(90, logoSize));
    const dims = logo.scale(1);
    const scale = Math.min(box / dims.width, box / dims.height);
    ctx.page.drawImage(logo, {
      x: L,
      y: PH - h / 2 - (dims.height * scale) / 2,
      width: dims.width * scale,
      height: dims.height * scale,
    });
  }

  let ty = PH - 40;
  drawRight(ctx, org.name, R, ty, 15, ctx.bold, WHITE);
  ty -= 16;
  if (org.cnpj) {
    drawRight(ctx, `CNPJ: ${org.cnpj}`, R, ty, 9, ctx.font, rgb(0.82, 0.83, 0.86));
    ty -= 13;
  }
  if (org.site) {
    drawRight(ctx, `Site: ${org.site}`, R, ty, 9, ctx.font, rgb(0.82, 0.83, 0.86));
  }
  ctx.y = PH - h - 42;
}

async function loadLogo(doc: PDFDocument, url: string | null | undefined) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);
  } catch {
    return null;
  }
}

function hexColor(hex: string, fallback: any) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildQuotePdf(input: QuoteInput): Promise<{ bytes: Uint8Array; total: number }> {
  const { DEFAULT_PDF_CONFIG, applyTemplate } = await import("@/lib/modules");
  const layout = input.layout ?? DEFAULT_PDF_CONFIG;
  const accent = hexColor(layout.accent, ACCENT);
  const cols = layout.item_columns;
  const enabled = new Map(layout.blocks.map((b) => [b.key, b.enabled !== false]));
  const order = layout.blocks.map((b) => b.key);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: null, y: 0, font, bold, pages: [] };
  newPage(ctx);

  const emitted = new Date().toISOString().slice(0, 10);
  const period = longPeriod(input.periodStart, input.periodEnd);
  const itemsTotal = quoteTotal(input.items);
  const travelFee = Math.max(0, Number(input.travelFee) || 0);
  const total = itemsTotal + travelFee;
  const vars: Record<string, string> = {
    organizacao: input.org.name,
    cliente: input.client ?? "-",
    periodo: period,
    total: brl(total),
    numero: input.recordId.slice(0, 8).toUpperCase(),
    data: longDate(emitted),
  };
  const tpl = (s: string) => applyTemplate(s, vars);

  const logo = await loadLogo(doc, input.org.logoUrl);

  const drawTitle = () => {
    draw(ctx, tpl(layout.texts.title || DEFAULT_PDF_CONFIG.texts.title), L, ctx.y, 21, bold, INK);
    ctx.y -= 14;
    ctx.page.drawLine({ start: { x: L, y: ctx.y }, end: { x: R, y: ctx.y }, thickness: 0.8, color: LINE });
    ctx.y -= 28;
    const intro = tpl(layout.texts.intro ?? "").trim();
    if (intro) {
      for (const ln of wrapText(intro, font, 10, R - L)) {
        ensure(ctx, 16);
        draw(ctx, ln, L, ctx.y, 10, font, SOFT);
        ctx.y -= 14;
      }
      ctx.y -= 12;
    }
  };

  const drawClient = () => {
    sectionTitle(ctx, "Dados do cliente e evento", accent);
    const valueW = R - (L + 150) - 12;
    const rows: Array<[string, string[]]> = [
      ["Cliente:", [input.client ?? "-"]],
      ...(input.clientCompany ? ([["Empresa:", wrapText(input.clientCompany, font, 10, valueW)]] as Array<[string, string[]]>) : []),
      ...(input.clientCnpj ? ([["CNPJ:", [input.clientCnpj]]] as Array<[string, string[]]>) : []),
      ...(input.clientAddress ? ([["Endereço:", wrapText(input.clientAddress, font, 10, valueW)]] as Array<[string, string[]]>) : []),
      ["Local de Instalação:", wrapText(input.location ?? "-", font, 10, valueW)],
      ["Data de Emissão:", [longDate(emitted)]],
      ["Validade:", [`${input.validityDays} dias (a partir da data de emissão) — até ${longDate(addDays(emitted, input.validityDays))}`]],
    ];
    const labelW = 150;
    for (const [k, lines] of rows) {
      const h = 12 + lines.length * 13;
      ensure(ctx, h);
      ctx.page.drawRectangle({ x: L, y: ctx.y - h + 12, width: labelW, height: h, color: PAPER });
      ctx.page.drawRectangle({
        x: L, y: ctx.y - h + 12, width: R - L, height: h,
        borderColor: LINE, borderWidth: 0.7,
      });
      draw(ctx, k, L + 10, ctx.y, 9.5, bold, INK);
      let ly = ctx.y;
      for (const ln of lines) {
        draw(ctx, ln, L + labelW + 12, ly, 10, font, INK);
        ly -= 13;
      }
      ctx.y -= h;
    }
    ctx.y -= 22;
  };

  const colPeriod = L + 250;
  const colDaily = L + 372;

  const drawItems = () => {
    sectionTitle(ctx, "Especificação dos serviços / itens", accent);
    const headerH = 26;
    const drawTableHead = () => {
      ensure(ctx, headerH + 24);
      ctx.page.drawRectangle({ x: L, y: ctx.y - 8, width: R - L, height: headerH, color: DARK });
      draw(ctx, "DESCRIÇÃO DO ITEM", L + 10, ctx.y, 8.5, bold, WHITE);
      if (cols.period) draw(ctx, "PERÍODO DE LOCAÇÃO", colPeriod, ctx.y, 8.5, bold, WHITE);
      if (cols.daily) draw(ctx, "VALOR DIÁRIA", colDaily, ctx.y, 8.5, bold, WHITE);
      drawRight(ctx, "VALOR TOTAL", R - 10, ctx.y, 8.5, bold, WHITE);
      ctx.y -= headerH + 8;
    };
    drawTableHead();

    for (const item of input.items) {
      const descW = colPeriod - L - 20;
      const titleLines = wrapText(item.label, bold, 10, descW);
      const noteLines = cols.note && item.note ? wrapText(item.note, font, 8.5, descW) : [];
      const periodLines = cols.period
        ? wrapText(`${period} (${item.days} diária${item.days === 1 ? "" : "s"})`, font, 9, colDaily - colPeriod - 10)
        : [];
      const discount = cols.discount ? itemDiscountValue(item) : 0;
      const showCourtesy = cols.courtesy && !!item.courtesy;
      const rowH =
        Math.max(
          titleLines.length * 13 + noteLines.length * 11 + (showCourtesy ? 18 : 0),
          periodLines.length * 12,
          14,
        ) + (discount > 0 ? 12 : 0) + 14;

      ensure(ctx, rowH + 10);
      const top = ctx.y;
      let dy = top;
      for (const ln of titleLines) {
        draw(ctx, ln, L + 10, dy, 10, bold, INK);
        dy -= 13;
      }
      for (const ln of noteLines) {
        draw(ctx, ln, L + 10, dy, 8.5, font, SOFT);
        dy -= 11;
      }
      if (showCourtesy) {
        const txt = latin1(`CORTESIA: ${String(item.courtesy).toUpperCase()}`);
        const w = bold.widthOfTextAtSize(txt, 8) + 12;
        ctx.page.drawRectangle({ x: L + 10, y: dy - 4, width: Math.min(w, descW), height: 15, color: GREEN_BG });
        draw(ctx, txt, L + 16, dy, 8, bold, GREEN);
        dy -= 18;
      }
      if (discount > 0) {
        draw(
          ctx,
          `Desconto: ${item.discount_type === "percent" ? `${item.discount}% (${brl(discount)})` : brl(discount)}`,
          L + 10, dy, 8.5, font, SOFT,
        );
        dy -= 12;
      }

      let py = top;
      for (const ln of periodLines) {
        draw(ctx, ln, colPeriod, py, 9, font, INK);
        py -= 12;
      }
      if (cols.daily) draw(ctx, brl(item.daily_value), colDaily, top, 10, font, INK);
      drawRight(ctx, brl(itemTotal(item)), R - 10, top, 10, bold, INK);

      ctx.y = Math.min(dy, py) - 8;
      ctx.page.drawLine({ start: { x: L, y: ctx.y + 4 }, end: { x: R, y: ctx.y + 4 }, thickness: 0.6, color: LINE });
      ctx.y -= 8;
    }

    if (input.items.length === 0) {
      draw(ctx, "Nenhum item selecionado para esta reserva.", L + 10, ctx.y, 9, font, SOFT);
      ctx.y -= 18;
    }
  };

  const drawTotals = () => {
    const maxDays = input.items.reduce((m, i) => Math.max(m, Number(i.days) || 1), 1);
    if (travelFee > 0) {
      ensure(ctx, 44);
      drawRight(ctx, "Subtotal dos itens:", R - 120, ctx.y, 10, font, INK);
      drawRight(ctx, brl(itemsTotal), R - 10, ctx.y, 10, font, INK);
      ctx.y -= 16;
      drawRight(ctx, "Deslocamento:", R - 120, ctx.y, 10, font, INK);
      drawRight(ctx, brl(travelFee), R - 10, ctx.y, 10, font, INK);
      ctx.y -= 20;
    }
    ensure(ctx, 40);
    ctx.page.drawRectangle({ x: L, y: ctx.y - 10, width: R - L, height: 28, color: PAPER });
    drawRight(ctx, `Valor Total do Orçamento (${maxDays} diária${maxDays === 1 ? "" : "s"}):`, R - 120, ctx.y, 10.5, bold, INK);
    drawRight(ctx, brl(total), R - 10, ctx.y, 11.5, bold, INK);
    ctx.y -= 46;
  };

  const drawTerms = () => {
    const extra = tpl(layout.texts.terms ?? "")
      .split("\n")
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    const all = [...input.paymentTerms, ...extra];
    if (all.length === 0) return;
    sectionTitle(ctx, "Condições de pagamento", accent);
    const lines: string[] = [];
    for (const t of all) lines.push(...wrapText(`• ${t}`, font, 10, R - L - 40));
    const h = lines.length * 15 + 18;
    ensure(ctx, h + 10);
    ctx.page.drawRectangle({ x: L, y: ctx.y - h + 12, width: R - L, height: h, color: CREAM });
    ctx.page.drawRectangle({ x: L, y: ctx.y - h + 12, width: 4, height: h, color: AMBER });
    let ly = ctx.y;
    for (const ln of lines) {
      draw(ctx, ln, L + 20, ly, 10, font, INK);
      ly -= 15;
    }
    ctx.y -= h + 22;
  };

  const drawNotes = () => {
    if (input.notes.length === 0) return;
    sectionTitle(ctx, "Observações e cortesias", accent);
    for (const n of input.notes) {
      const lines = wrapText(`• ${n}`, font, 9.5, R - L - 16);
      ensure(ctx, lines.length * 13 + 8);
      for (const ln of lines) {
        draw(ctx, ln, L + 8, ctx.y, 9.5, font, INK);
        ctx.y -= 13;
      }
      ctx.y -= 5;
    }
  };

  const drawClosing = () => {
    const msg = tpl(layout.texts.closing ?? "").trim();
    ensure(ctx, 40);
    ctx.y -= 10;
    if (msg) {
      for (const ln of wrapText(msg, font, 9.5, R - L)) {
        draw(ctx, ln, L, ctx.y, 9.5, font, SOFT);
        ctx.y -= 14;
      }
    }
    ctx.y -= 1;
    draw(ctx, input.org.name, L, ctx.y, 10, bold, INK);
  };

  for (const key of order) {
    if (!enabled.get(key)) continue;
    if (key === "header") await drawHeader(ctx, input.org, logo, accent, layout.logo_size);
    else if (key === "title") drawTitle();
    else if (key === "client") drawClient();
    else if (key === "items") drawItems();
    else if (key === "totals") drawTotals();
    else if (key === "terms") drawTerms();
    else if (key === "notes") drawNotes();
    else if (key === "closing") drawClosing();
  }

  if (enabled.get("footer")) {
    const totalPages = ctx.pages.length;
    ctx.pages.forEach((p, i) => {
      const txt = latin1(`Página ${i + 1} de ${totalPages}`);
      p.drawText(txt, { x: R - font.widthOfTextAtSize(txt, 8), y: 36, size: 8, font, color: SOFT });
      p.drawText(latin1(`Orçamento #${input.recordId.slice(0, 8).toUpperCase()}`), {
        x: L, y: 36, size: 8, font, color: SOFT,
      });
    });
  }

  const bytes = await doc.save();
  return { bytes, total };
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

/** Registros do catálogo (tabela reservável), usados como itens do orçamento. */
export async function loadBookableItems(supabase: any, tableId: string): Promise<BookableItem[]> {
  const { data: fields } = await supabase
    .from("fields").select("key, type, position").eq("table_id", tableId)
    .order("position", { ascending: true });
  const m = pickItemMeta((fields ?? []) as any[]);
  const { data: rows } = await supabase
    .from("records").select("id, data").eq("table_id", tableId)
    .order("created_at", { ascending: true });
  return ((rows ?? []) as any[])
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

export const CONTACT_COMPANY_KEY = "contact_company";
export const CONTACT_CNPJ_KEY = "contact_cnpj";
export const CONTACT_ADDRESS_KEY = "contact_address";
const CLIENT_KEYS = [CONTACT_COMPANY_KEY, CONTACT_CNPJ_KEY, CONTACT_ADDRESS_KEY];

export type ContactRow = {
  id: string;
  label: string;
  email: string | null;
  company: string | null;
  cnpj: string | null;
  address: string | null;
};

export function contactLabel(fields: ContactFieldDef[], data: Record<string, any>) {
  const base = fields.filter((f) => !CLIENT_KEYS.includes(f.key));
  const nameKey =
    base.find((f) => /nome|name/i.test(f.key) && f.type === "text")?.key ??
    base.find((f) => f.type === "text")?.key ?? null;
  const emailKey =
    base.find((f) => f.type === "email")?.key ??
    base.find((f) => /email/i.test(f.key))?.key ?? null;
  const label = String((nameKey ? data?.[nameKey] : null) ?? (emailKey ? data?.[emailKey] : null) ?? "Contato");
  const str = (k: string) => {
    const v = data?.[k];
    return v === undefined || v === null || String(v).trim() === "" ? null : String(v).slice(0, 400);
  };
  return {
    label: label.slice(0, 140),
    email: (emailKey ? (data?.[emailKey] ?? null) : null) as string | null,
    company: str(CONTACT_COMPANY_KEY),
    cnpj: str(CONTACT_CNPJ_KEY),
    address: str(CONTACT_ADDRESS_KEY),
  };
}

export async function loadContacts(
  supabase: any, contactsTableId: string | null, fields: ContactFieldDef[],
): Promise<ContactRow[]> {
  if (!contactsTableId) return [];
  const { data: rows } = await supabase
    .from("records").select("id, data").eq("table_id", contactsTableId)
    .order("created_at", { ascending: false }).limit(500);
  return ((rows ?? []) as any[]).map((r) => ({
    id: r.id as string,
    ...contactLabel(fields, (r.data ?? {}) as any),
  }));
}

// ============ Conflito de datas e normalização de itens ============

export type ItemInput = {
  record_id: string;
  daily_value?: number;
  days?: number;
  discount?: number;
  discount_type?: "amount" | "percent";
  note?: string | null;
  courtesy?: string | null;
};

/** Lança erro quando algum item escolhido já está reservado (accepted/closed) no período. */
export async function assertNoConflict(
  supabase: any,
  bookingsTableId: string,
  meta: { startKey: string | null; endKey: string | null },
  start: any,
  end: any,
  chosen: Array<{ id: string; label: string }>,
  excludeId?: string,
) {
  if (!start || !end || !meta.startKey || !meta.endKey) return;
  const chosenIds = new Set(chosen.map((c) => c.id));
  let query = supabase
    .from("records")
    .select("id, data, system_data, status")
    .eq("table_id", bookingsTableId)
    .in("deal_status", ["accepted", "closed"]);
  if (excludeId) query = query.neq("id", excludeId);
  const { data: others } = await query;
  for (const o of (others ?? []) as any[]) {
    if (o.status === "archived") continue;
    const os = o.data?.[meta.startKey];
    const oe = o.data?.[meta.endKey];
    if (!os || !oe) continue;
    if (!overlaps(String(start), String(end), String(os), String(oe))) continue;
    const busy = (((o.system_data as any)?.items ?? []) as any[]).map((i) => String(i?.record_id ?? ""));
    const clash = busy.find((id) => chosenIds.has(id));
    if (clash) {
      const label = chosen.find((c) => c.id === clash)?.label ?? "Item";
      throw new Error(`Conflito de reserva: "${label}" já está reservado entre ${os} e ${oe}.`);
    }
  }
}

/** Normaliza os itens enviados pelo formulário contra o catálogo. */
export function buildItems(
  catalog: Array<{ id: string; label: string; value: number }>,
  input: ItemInput[],
  days: number,
): QuoteItem[] {
  const chosen = input
    .map((i) => ({ input: i, cat: catalog.find((c) => c.id === i.record_id) }))
    .filter((x) => !!x.cat) as Array<{ input: ItemInput; cat: { id: string; label: string; value: number } }>;
  if (chosen.length === 0) throw new Error("Itens inválidos para esta tabela.");
  return chosen.map(({ input: i, cat }) => ({
    record_id: cat.id,
    label: cat.label,
    daily_value: Number(i.daily_value ?? cat.value) || 0,
    days: Number(i.days ?? days) || 1,
    discount: Number(i.discount ?? 0) || 0,
    discount_type: (i.discount_type ?? "amount") as "amount" | "percent",
    note: i.note ?? null,
    courtesy: i.courtesy ?? null,
  }));
}
