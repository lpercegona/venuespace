// Helpers server-only do modelo de PDF de orçamento por categoria (Iteração 43).
import type { CategoryPdfLayout, PdfLayoutField } from "@/lib/pdf-layout";
import type { QuoteFieldValue } from "@/lib/bookings.server";

/** Lê o modelo salvo da categoria. Sem registro, devolve o padrão. */
export async function loadCategoryPdfLayout(
  supabase: any,
  categoryId: string | null | undefined,
): Promise<CategoryPdfLayout> {
  const { normalizePdfLayout } = await import("@/lib/pdf-layout");
  if (!categoryId) return normalizePdfLayout({});
  const { data: layout } = await supabase
    .from("category_pdf_layout")
    .select("id, config")
    .eq("category_id", categoryId)
    .maybeSingle();
  if (!layout) return normalizePdfLayout({});
  const { data: fields } = await supabase
    .from("category_pdf_layout_fields")
    .select("id, field_key, label_override, width_percent, font_size, order_index, section_title, content")
    .eq("layout_id", (layout as any).id)
    .order("order_index", { ascending: true });
  return normalizePdfLayout({ config: (layout as any).config, fields: fields ?? [] });
}

/** Categoria da organização. */
export async function loadOrgCategoryId(supabase: any, orgId: string): Promise<string | null> {
  const { data } = await supabase.from("organizations").select("category_id").eq("id", orgId).maybeSingle();
  return ((data as any)?.category_id as string) ?? null;
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/** Texto exibido no PDF para um valor bruto, conforme o tipo do campo. */
export function formatFieldValue(type: string, raw: unknown): string {
  if (raw == null || raw === "") return "-";
  if (type === "boolean") return raw ? "Sim" : "Não";
  if (type === "currency") return brl(Number(raw) || 0);
  if (type === "number") return String(raw);
  if (type === "date" || type === "datetime") {
    const iso = String(raw).slice(0, 10);
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : String(raw);
  }
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(", ");
  if (typeof raw === "object") return Object.values(raw as Record<string, unknown>).filter(Boolean).join(", ");
  return String(raw);
}

/** Valores dos campos escolhidos no modelo, a partir do registro da reserva. */
export function buildQuoteFieldValues(
  fields: Array<{ key: string; label: string; type: string }>,
  data: Record<string, any>,
  layoutFields: PdfLayoutField[],
): QuoteFieldValue[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return layoutFields.map((lf) => {
    const f = byKey.get(lf.field_key);
    if (!f) return { key: lf.field_key, label: lf.label_override ?? "", value: "" };
    return {
      key: lf.field_key,
      label: f?.label ?? lf.field_key,
      value: formatFieldValue(f?.type ?? "text", data?.[lf.field_key]),
    };
  });
}

/** Valor fictício coerente com o tipo, usado no preview quando não há registro. */
export function sampleFieldValue(type: string, label: string): string {
  switch (type) {
    case "currency":
      return brl(1500);
    case "number":
      return "12";
    case "boolean":
      return "Sim";
    case "date":
    case "datetime":
      return new Date().toLocaleDateString("pt-BR");
    case "email":
      return "cliente@exemplo.com";
    case "phone":
      return "(11) 90000-0000";
    case "url":
      return "www.exemplo.com.br";
    case "long_text":
      return `Exemplo de conteúdo para o campo ${label}, usado apenas na pré-visualização.`;
    default:
      return `Exemplo de ${label}`;
  }
}
