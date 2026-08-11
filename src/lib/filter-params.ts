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
