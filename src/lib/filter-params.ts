/**
 * Filtros públicos multivalor na URL: `f_<campo>=Valor1|Valor2`.
 * Vários valores do mesmo campo combinam em OU; campos diferentes, em E.
 */
export const FILTER_SEP = "|";

export function parseFilterValues(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(FILTER_SEP)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function joinFilterValues(values: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.join(FILTER_SEP);
}

/** Marca/desmarca uma opção e devolve o novo valor serializado (vazio = sem filtro). */
export function toggleFilterValue(current: string | undefined, option: string): string {
  const values = parseFilterValues(current);
  const idx = values.findIndex((v) => v.toLowerCase() === option.trim().toLowerCase());
  if (idx >= 0) values.splice(idx, 1);
  else values.push(option.trim());
  return joinFilterValues(values);
}

/** Total de valores selecionados em todos os filtros. */
export function countSelectedFilters(values: Record<string, string>): number {
  return Object.values(values).reduce((acc, v) => acc + parseFilterValues(v).length, 0);
}

/* ---------- Faixa numérica (`min:100|max:300`) ---------- */

export type RangeValue = { min?: number; max?: number };

/** Converte texto em número tolerando prefixos/sufixos ("até 200 pessoas", "1.500"). */
export function toFilterNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const cleaned = s.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseRangeValue(raw: string | undefined | null): RangeValue {
  const out: RangeValue = {};
  for (const part of parseFilterValues(raw)) {
    const [k, v] = part.split(":");
    const n = toFilterNumber(v);
    if (n == null) continue;
    if (k === "min") out.min = n;
    else if (k === "max") out.max = n;
  }
  return out;
}

export function serializeRangeValue(value: RangeValue): string {
  const parts: string[] = [];
  if (value.min != null) parts.push(`min:${value.min}`);
  if (value.max != null) parts.push(`max:${value.max}`);
  return parts.join(FILTER_SEP);
}

/** Um valor de faixa é reconhecido pelo prefixo `min:`/`max:`. */
export function isRangeValue(raw: string | undefined | null): boolean {
  return parseFilterValues(raw).some((p) => p.startsWith("min:") || p.startsWith("max:"));
}

