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

function toPascal(name: string) {
  return name.split(/[-_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
function resolveLucide(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  const M = LucideIcons as any;
  return (M[name] ?? M[toPascal(name)] ?? M[name.charAt(0).toUpperCase() + name.slice(1)] ?? null) as LucideIcon | null;
}
function IconByName({ name, className }: { name: string | null | undefined; className?: string }) {
  const Cmp = resolveLucide(name);
  if (!Cmp) return null;
  return <Cmp className={className ?? "h-4 w-4 shrink-0"} />;
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

function isUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function hasImageExtension(v: string) {
  try {
    const path = decodeURIComponent(new URL(v).pathname);
    return /\.(avif|gif|jpe?g|png|webp|bmp|svg)$/i.test(path);
  } catch {
    return /\.(avif|gif|jpe?g|png|webp|bmp|svg)(\?.*)?$/i.test(v);
  }
}

function isImageLikeName(key: string, label?: string) {
  return /(avatar|capa|cover|foto|galeria|gallery|imagem|image|logo|photo|picture)/i.test(`${key} ${label ?? ""}`);
}

function mediaUrlsFor(field: RendererField | undefined, key: string, label: string, raw: any) {
  const imageLike = field?.type === "image" || field?.type === "gallery" || isImageLikeName(key, label);
  if (Array.isArray(raw)) return raw.filter((v) => isUrl(v) && (imageLike || hasImageExtension(v)));
  if (!isUrl(raw)) return [];
  if (field?.type === "url" && !imageLike) return [];
  return imageLike || hasImageExtension(raw) ? [raw] : [];
}

export function getPublicCardTitle({
  layout,
  fields,
  data,
  fallback,
}: {
  layout: LayoutItem[];
  fields: RendererField[];
  data: Record<string, any>;
  fallback: string;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  for (const it of layout ?? []) {
    const f = byKey.get(it.field_key);
    const label = (it.config?.label_override as string) ?? f?.label ?? it.field_key;
    const raw = data?.[it.field_key];
    if (mediaUrlsFor(f, it.field_key, label, raw).length > 0) continue;
    const text = formatValue(f, raw).trim();
    if (text && !isUrl(text)) return text;
  }
  return fallback;
}

function ImageCell({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className ?? "aspect-video w-full rounded-md object-cover"}
    />
  );
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
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-4 gap-3">
          {row.map((it) => {
            const f = byKey.get(it.field_key);
            const raw = data?.[it.field_key];
            const span =
              it.width_percent === 25 ? "col-span-1" :
              it.width_percent === 50 ? "col-span-2" :
              it.width_percent === 75 ? "col-span-3" : "col-span-4";
            const label = (it.config?.label_override as string) ?? f?.label ?? it.field_key;
            const iconName = (it.config?.icon as string) ?? null;

            const mediaUrls = mediaUrlsFor(f, it.field_key, label, raw);
            const imgAspect = it.width_percent === 100 ? "aspect-video" : "aspect-square";
            if (mediaUrls.length === 1) {
              return (
                <div key={it.id} className={`${span} min-w-0`}>
                  <img
                    src={mediaUrls[0]}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    className={`${imgAspect} w-full rounded-md object-cover`}
                  />
                </div>
              );
            }
            if (mediaUrls.length > 1) {
              return (
                <div key={it.id} className={`${span} min-w-0`}>
                  <div className="grid grid-cols-3 gap-1">
                    {mediaUrls.slice(0, 3).map((u, idx) => (
                      <img key={idx} src={u} alt={`${label} ${idx + 1}`} loading="lazy" decoding="async" className="aspect-square w-full rounded-sm object-cover" />
                    ))}
                  </div>
                </div>
              );
            }

            const text = formatValue(f, raw);
            if (!text) return null;
            return (
              <div key={it.id} className={`${span} min-w-0`}>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <IconByName name={iconName} className="h-3.5 w-3.5 shrink-0" />
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
