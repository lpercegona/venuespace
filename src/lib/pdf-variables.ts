// Biblioteca de variáveis disponíveis no modelo de orçamento (client-safe).
// As chaves seguem o padrão {{chave}} já usado nos textos do PDF.

export type PdfVariable = { key: string; label: string };
export type PdfVariableGroup = { title: string; items: PdfVariable[] };

export const ORG_VARIABLES: PdfVariable[] = [
  { key: "organizacao", label: "Nome da organização" },
  { key: "organizacao_cnpj", label: "CNPJ da organização" },
  { key: "organizacao_site", label: "Site da organização" },
];

export const CLIENT_VARIABLES: PdfVariable[] = [
  { key: "cliente", label: "Contato (nome e e-mail)" },
  { key: "cliente_empresa", label: "Empresa / razão social" },
  { key: "cliente_cnpj", label: "CNPJ do cliente" },
  { key: "cliente_endereco", label: "Endereço do cliente" },
];

export const TOTALS_VARIABLES: PdfVariable[] = [
  { key: "itens_total", label: "Total dos itens" },
  { key: "deslocamento", label: "Valor de deslocamento" },
  { key: "total", label: "Total geral" },
  { key: "validade", label: "Validade (dias)" },
  { key: "numero", label: "Número do orçamento" },
  { key: "data", label: "Data de emissão" },
];

export const PERIOD_VARIABLES: PdfVariable[] = [
  { key: "periodo", label: "Período por extenso" },
  { key: "inicio", label: "Data de início" },
  { key: "fim", label: "Data de término" },
  { key: "local", label: "Local do serviço" },
];

/** Grupos completos, incluindo os campos da tabela-modelo de reservas da categoria. */
export function buildVariableGroups(
  bookingFields: Array<{ field_key: string; label: string }>,
): PdfVariableGroup[] {
  return [
    { title: "Organização", items: ORG_VARIABLES },
    { title: "Contato / cliente", items: CLIENT_VARIABLES },
    { title: "Período e local", items: PERIOD_VARIABLES },
    { title: "Totais do orçamento", items: TOTALS_VARIABLES },
    {
      title: "Campos da reserva",
      items: bookingFields.map((f) => ({ key: f.field_key, label: f.label })),
    },
  ].filter((g) => g.items.length > 0);
}

export function variableToken(key: string): string {
  return `{{${key}}}`;
}
