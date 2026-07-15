import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type LayoutItem = {
  id: string;
  field_key: string;
  width_percent: number;
  order_index: number;
  config: Record<string, any>;
};

export type RendererField = { key: string; label: string; type: string };

function IconByName({ name, className }: { name: string | null | undefined; className?: string }) {
  if (!name) return null;
  const Cmp = (LucideIcons as any)[name] as LucideIcon | undefined;
  if (!Cmp) return null;
  return <Cmp className={className ?? "h-3.5 w-3.5"} />;
}

function formatValue(field: RendererField | undefined, raw: any): string {
  if (raw == null || raw === "") return "";
  if (!field) return typeof raw === "string" ? raw : JSON.stringify(raw);
  if (field.type === "boolean") return raw ? "Sim" : "Não";
  if (field.type === "currency") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(raw);
  }
  if (field.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(raw);
  }
  if (field.type === "date") return new Date(raw).toLocaleDateString("pt-BR");
  if (field.type === "datetime") return new Date(raw).toLocaleString("pt-BR");
  if (field.type === "multiselect" && Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

export function PublicCardBody({
  layout,
  fields,
  data,
}: {
  layout: LayoutItem[];
  fields: RendererField[];
  data: Record<string, any>;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  if (!layout || layout.length === 0) return null;

  // Group by rows using width_percent cumulative sum up to 100.
  const rows: LayoutItem[][] = [];
  let current: LayoutItem[] = [];
  let acc = 0;
  for (const it of layout) {
    current.push(it);
    acc += it.width_percent;
    if (acc >= 100) {
      rows.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length) rows.push(current);

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          {row.map((it) => {
            const f = byKey.get(it.field_key);
            const raw = data?.[it.field_key];
            const text = formatValue(f, raw);
            if (!text) return null;
            const basis =
              it.width_percent === 25 ? "basis-1/4" :
              it.width_percent === 50 ? "basis-1/2" :
              it.width_percent === 75 ? "basis-3/4" : "basis-full";
            const label = (it.config?.label_override as string) ?? f?.label ?? it.field_key;
            const iconName = (it.config?.icon as string) ?? null;
            return (
              <div key={it.id} className={`${basis} min-w-0 grow-0`}>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <IconByName name={iconName} />
                  <span className="truncate">{label}</span>
                </div>
                <div className="truncate text-sm text-foreground">{text}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
