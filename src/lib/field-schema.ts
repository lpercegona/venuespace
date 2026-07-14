import { z } from "zod";

export type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  position: number;
  config: Record<string, any> | null;
};

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "currency",
  "boolean",
  "date",
  "datetime",
  "email",
  "url",
  "select",
  "multiselect",
  "relation",
  "image",
  "file",
  "computed",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export function zodForField(f: FieldRow): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (f.type) {
    case "number":
    case "currency":
      base = z.union([z.number(), z.string().transform((v) => (v === "" ? null : Number(v)))]).nullable();
      break;
    case "boolean":
      base = z.boolean().nullable();
      break;
    case "date":
    case "datetime":
      base = z.string().nullable();
      break;
    case "email":
      base = z.union([z.string().email(), z.literal("")]).nullable();
      break;
    case "url":
      base = z.union([z.string().url(), z.literal("")]).nullable();
      break;
    case "multiselect":
      base = z.array(z.string()).nullable();
      break;
    case "relation":
      base = z.union([z.string().uuid(), z.array(z.string().uuid())]).nullable();
      break;
    case "computed":
      return z.any().optional();
    default:
      base = z.string().nullable();
  }
  if (f.required && f.type !== "computed") {
    base = base.refine((v) => v !== null && v !== undefined && v !== "", { message: `${f.label} é obrigatório` });
  }
  return base.optional();
}

export function buildSchemaFromFields(fields: FieldRow[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === "computed") continue;
    shape[f.key] = zodForField(f);
  }
  return z.object(shape).passthrough();
}
