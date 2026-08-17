// Modelo configurável do PDF de orçamento por categoria (client-safe).
// Substitui a configuração antiga em `category_modules.config.pdf` (Iteração 41).

import { normalizeBookingsConfig, type BookingsPdfConfig } from "@/lib/modules";

export type PdfWidth = 25 | 50 | 75 | 100;

export type PdfLayoutField = {
  id?: string;
  field_key: string;
  label_override: string | null;
  width_percent: PdfWidth;
  font_size: number;
  order_index: number;
  section_title: string | null;
};

export type CategoryPdfLayout = {
  config: BookingsPdfConfig;
  fields: PdfLayoutField[];
};

export const PDF_WIDTHS: PdfWidth[] = [25, 50, 75, 100];

export function normalizePdfLayoutField(raw: unknown, index = 0): PdfLayoutField {
  const f = (raw ?? {}) as any;
  const width = Number(f.width_percent);
  const size = Number(f.font_size);
  return {
    id: typeof f.id === "string" ? f.id : undefined,
    field_key: String(f.field_key ?? ""),
    label_override: f.label_override ? String(f.label_override) : null,
    width_percent: (PDF_WIDTHS.includes(width as PdfWidth) ? width : 100) as PdfWidth,
    font_size: Number.isFinite(size) ? Math.min(24, Math.max(8, Math.round(size))) : 10,
    order_index: Number.isFinite(f.order_index) ? Number(f.order_index) : index,
    section_title: f.section_title ? String(f.section_title) : null,
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
  };
}
