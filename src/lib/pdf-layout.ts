// Modelo configurável do PDF de orçamento por categoria (client-safe).
// Iteração 44: modelo "Padrão" global, tipos de bloco e estilo por bloco.

import { normalizeBookingsConfig, type BookingsPdfConfig } from "@/lib/modules";

export type PdfWidth = 25 | 50 | 75 | 100;

/** Tipos de bloco suportados na folha do orçamento. */
export type PdfBlockType = "field" | "text" | "heading" | "divider" | "table";

export const PDF_BLOCK_TYPES: PdfBlockType[] = ["field", "text", "heading", "divider", "table"];

export const PDF_BLOCK_TYPE_LABELS: Record<PdfBlockType, string> = {
  field: "Campo da reserva",
  text: "Texto livre",
  heading: "Título",
  divider: "Linha",
  table: "Tabela",
};

export type PdfBlockStyle = {
  color: string | null;
  background: string | null;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  border: boolean;
};

export const DEFAULT_BLOCK_STYLE: PdfBlockStyle = {
  color: null,
  background: null,
  align: "left",
  bold: false,
  italic: false,
  uppercase: false,
  border: false,
};

export type PdfLayoutField = {
  id?: string;
  field_key: string;
  block_type: PdfBlockType;
  label_override: string | null;
  width_percent: PdfWidth;
  font_size: number;
  order_index: number;
  section_title: string | null;
  /** Conteúdo livre com variáveis; quando vazio, usa o valor do campo vinculado. */
  content: string | null;
  style: PdfBlockStyle;
};

export type CategoryPdfLayout = {
  config: BookingsPdfConfig;
  fields: PdfLayoutField[];
  /** true quando a categoria ainda não tem modelo próprio e herda o Padrão. */
  inherited?: boolean;
};

export const PDF_WIDTHS: PdfWidth[] = [25, 50, 75, 100];

/** Prefixo reservado para blocos sem campo vinculado. */
export const TEXT_BLOCK_PREFIX = "texto:";

export function isTextBlock(fieldKey: string): boolean {
  return fieldKey.startsWith(TEXT_BLOCK_PREFIX);
}

export function newTextBlockKey(): string {
  return `${TEXT_BLOCK_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeBlockStyle(raw: unknown): PdfBlockStyle {
  const s = (raw ?? {}) as any;
  const align = s.align === "center" || s.align === "right" ? s.align : "left";
  const hex = (v: unknown) =>
    typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v.trim())
      ? (v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`)
      : null;
  return {
    color: hex(s.color),
    background: hex(s.background),
    align,
    bold: s.bold === true,
    italic: s.italic === true,
    uppercase: s.uppercase === true,
    border: s.border === true,
  };
}

export function normalizePdfLayoutField(raw: unknown, index = 0): PdfLayoutField {
  const f = (raw ?? {}) as any;
  const width = Number(f.width_percent);
  const size = Number(f.font_size);
  const key = String(f.field_key ?? "");
  const type: PdfBlockType = PDF_BLOCK_TYPES.includes(f.block_type)
    ? f.block_type
    : isTextBlock(key)
      ? "text"
      : "field";
  return {
    id: typeof f.id === "string" ? f.id : undefined,
    field_key: key,
    block_type: type,
    label_override: f.label_override ? String(f.label_override) : null,
    width_percent: (PDF_WIDTHS.includes(width as PdfWidth) ? width : 100) as PdfWidth,
    font_size: Number.isFinite(size) ? Math.min(24, Math.max(8, Math.round(size))) : 10,
    order_index: Number.isFinite(f.order_index) ? Number(f.order_index) : index,
    section_title: f.section_title ? String(f.section_title) : null,
    content: f.content ? String(f.content) : null,
    style: normalizeBlockStyle(f.style),
  };
}

export function normalizePdfLayout(raw: unknown): CategoryPdfLayout {
  const l = (raw ?? {}) as any;
  return {
    config: normalizeBookingsConfig({ pdf: l.config ?? l.pdf ?? {} }).pdf,
    fields: (Array.isArray(l.fields) ? l.fields : [])
      .map((f: unknown, i: number) => normalizePdfLayoutField(f, i))
      .filter((f: PdfLayoutField) => !!f.field_key)
      .sort((a: PdfLayoutField, b: PdfLayoutField) => a.order_index - b.order_index),
    inherited: l.inherited === true,
  };
}

/** Linhas de uma tabela livre: "col | col | col" por linha. */
export function parseTableContent(content: string | null): string[][] {
  return String(content ?? "")
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter((cells) => cells.some((c) => c.length > 0));
}
