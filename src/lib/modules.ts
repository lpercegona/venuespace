// Tipos e defaults dos módulos da plataforma (client-safe).
// Novos módulos entram apenas como uma nova chave no registro.

export type ModuleKey = "bookings";

export type ModuleFormFieldConfig = {
  field_key: string;
  visible: boolean;
  label_override: string | null;
  required: boolean | null;
  order_index: number;
};

export type PdfBlockKey =
  | "header"
  | "title"
  | "client"
  | "items"
  | "totals"
  | "terms"
  | "notes"
  | "closing"
  | "footer";

export type PdfBlock = { key: PdfBlockKey; enabled: boolean };

export type BookingsPdfConfig = {
  accent: string;
  logo_size: number;
  blocks: PdfBlock[];
  item_columns: {
    period: boolean;
    daily: boolean;
    note: boolean;
    courtesy: boolean;
    discount: boolean;
  };
  texts: {
    title: string;
    intro: string;
    terms: string;
    closing: string;
  };
};

export type BookingsModuleConfig = {
  form: ModuleFormFieldConfig[];
  pdf: BookingsPdfConfig;
};

export const PDF_BLOCK_LABELS: Record<PdfBlockKey, string> = {
  header: "Cabeçalho (logo e dados da organização)",
  title: "Título do documento",
  client: "Dados do cliente e evento",
  items: "Tabela de itens",
  totals: "Totais e deslocamento",
  terms: "Condições / termos",
  notes: "Observações e cortesias",
  closing: "Mensagem final",
  footer: "Rodapé com paginação",
};

export const PDF_VARIABLES = [
  "{{organizacao}}",
  "{{cliente}}",
  "{{periodo}}",
  "{{total}}",
  "{{numero}}",
  "{{data}}",
] as const;

export const DEFAULT_PDF_CONFIG: BookingsPdfConfig = {
  accent: "#6b4fa3",
  logo_size: 58,
  blocks: [
    { key: "header", enabled: true },
    { key: "title", enabled: true },
    { key: "client", enabled: true },
    { key: "items", enabled: true },
    { key: "totals", enabled: true },
    { key: "terms", enabled: true },
    { key: "notes", enabled: true },
    { key: "closing", enabled: true },
    { key: "footer", enabled: true },
  ],
  item_columns: { period: true, daily: true, note: true, courtesy: true, discount: true },
  texts: {
    title: "ORÇAMENTO DE LOCAÇÃO",
    intro: "",
    terms: "",
    closing: "Ficamos à disposição para esclarecer qualquer dúvida.",
  },
};

export const DEFAULT_BOOKINGS_CONFIG: BookingsModuleConfig = {
  form: [],
  pdf: DEFAULT_PDF_CONFIG,
};

/** Normaliza a config vinda do banco, preenchendo o que faltar com o padrão. */
export function normalizeBookingsConfig(raw: unknown): BookingsModuleConfig {
  const c = (raw ?? {}) as any;
  const pdf = (c.pdf ?? {}) as any;
  const blocks: PdfBlock[] = Array.isArray(pdf.blocks) && pdf.blocks.length > 0
    ? DEFAULT_PDF_CONFIG.blocks
        .map((d) => {
          const found = pdf.blocks.find((b: any) => b?.key === d.key);
          return { key: d.key, enabled: found ? found.enabled !== false : d.enabled };
        })
        .sort((a, b) => {
          const ia = pdf.blocks.findIndex((x: any) => x?.key === a.key);
          const ib = pdf.blocks.findIndex((x: any) => x?.key === b.key);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        })
    : DEFAULT_PDF_CONFIG.blocks;

  return {
    form: Array.isArray(c.form)
      ? c.form.map((f: any, i: number) => ({
          field_key: String(f?.field_key ?? ""),
          visible: f?.visible !== false,
          label_override: f?.label_override ? String(f.label_override) : null,
          required: typeof f?.required === "boolean" ? f.required : null,
          order_index: Number.isFinite(f?.order_index) ? Number(f.order_index) : i,
        })).filter((f: ModuleFormFieldConfig) => !!f.field_key)
      : [],
    pdf: {
      accent: typeof pdf.accent === "string" ? pdf.accent : DEFAULT_PDF_CONFIG.accent,
      logo_size: Number(pdf.logo_size) > 0 ? Number(pdf.logo_size) : DEFAULT_PDF_CONFIG.logo_size,
      blocks,
      item_columns: { ...DEFAULT_PDF_CONFIG.item_columns, ...(pdf.item_columns ?? {}) },
      texts: { ...DEFAULT_PDF_CONFIG.texts, ...(pdf.texts ?? {}) },
    },
  };
}

/** Substitui as variáveis suportadas nos textos do PDF. */
export function applyTemplate(text: string, vars: Record<string, string>): string {
  return String(text ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");
}

/** Aplica a configuração do módulo sobre os campos reais da tabela. */
export function applyFormConfig<T extends { key: string; label: string; required?: boolean }>(
  fields: T[],
  config: ModuleFormFieldConfig[],
): Array<T & { label: string; required: boolean }> {
  const map = new Map(config.map((c) => [c.field_key, c]));
  return fields
    .filter((f) => (map.get(f.key)?.visible ?? true))
    .map((f) => {
      const c = map.get(f.key);
      return {
        ...f,
        label: c?.label_override?.trim() ? c.label_override : f.label,
        required: typeof c?.required === "boolean" ? c.required : !!f.required,
      };
    })
    .sort((a, b) => {
      const ia = map.get(a.key)?.order_index ?? 500;
      const ib = map.get(b.key)?.order_index ?? 500;
      return ia - ib;
    });
}
