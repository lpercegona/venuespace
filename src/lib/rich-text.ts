import sanitizeHtml from "sanitize-html";

/** Limite de caracteres (texto puro) para descrições ricas. */
export const RICH_TEXT_MAX = 2500;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h4", "ul", "li", "strong", "em", "br"],
  allowedAttributes: {},
  allowedSchemes: [],
};

/** Sanitiza HTML de descrição, permitindo apenas texto, título (h4) e bullets. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}

/** Converte HTML em texto puro (metas, cards, contagem de caracteres). */
export function richTextToPlainText(html: string): string {
  return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Heurística simples para detectar conteúdo já formatado em HTML. */
export function isRichTextHtml(value: string): boolean {
  return /<(p|h4|ul|ol|li|br|strong|em|div|span)\b[^>]*>/i.test(value ?? "");
}

/** Garante HTML renderizável: texto puro vira parágrafos preservando quebras. */
export function toRichTextHtml(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (isRichTextHtml(v)) return sanitizeRichText(v);
  return v
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</p>`)
    .join("");
}
