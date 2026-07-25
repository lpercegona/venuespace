import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GalleryCarousel } from "@/components/venue/gallery-carousel";
import { LazyImage } from "@/components/venue/lazy-image";
import { OrgLogo } from "@/components/venue/org-logo";


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

export function PublicCardBody({
  layout,
  fields,
  data,
  orgName,
}: {
  layout: LayoutItem[];
  fields: RendererField[];
  data: Record<string, any>;
  /** Used as `alt` for the `logo_url` special field. Defaults to data.name or "Logo". */
  orgName?: string;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  if (!layout || layout.length === 0) return null;

  type Cell = {
    id: string;
    width_percent: number;
    span: string;
    label: string;
    iconName: string | null;
    imgAspect: string;
    bleed: boolean;
    kind: "single-image" | "gallery" | "text" | "name" | "logo";
    urls?: string[];
    text?: string;
  };

  const cells: Cell[] = [];
  for (const it of layout) {
    const f = byKey.get(it.field_key);
    const raw = data?.[it.field_key];
    const label = (it.config?.label_override as string) ?? f?.label ?? it.field_key;
    const iconName = (it.config?.icon as string) ?? null;
    const width = it.width_percent;
    const span =
      width === 25 ? "col-span-1" :
      width === 50 ? "col-span-2" :
      width === 75 ? "col-span-3" : "col-span-4";
    const imgAspect = width === 100 ? "aspect-video" : "aspect-square";
    const bleed = width === 100 && it.config?.bleed === true;

    // Special: name → H3
    if (it.field_key === "name") {
      const text = formatValue(f, raw);
      if (!text) continue;
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed: false, kind: "name", text });
      continue;
    }
    // Special: logo_url → OrgLogo (with fallback icon when empty)
    if (it.field_key === "logo_url") {
      const url = typeof raw === "string" && isUrl(raw) ? raw : null;
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed, kind: "logo", urls: url ? [url] : [] });
      continue;
    }

    const mediaUrls = mediaUrlsFor(f, it.field_key, label, raw);
    if (mediaUrls.length === 1) {
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed, kind: "single-image", urls: mediaUrls });
      continue;
    }
    if (mediaUrls.length > 1) {
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed, kind: "gallery", urls: mediaUrls });
      continue;
    }
    const text = formatValue(f, raw);
    if (!text) continue;
    cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed: false, kind: "text", text });
  }

  if (cells.length === 0) return null;

  // Group into rows summing to 100%.
  const rows: Cell[][] = [];
  let current: Cell[] = [];
  let acc = 0;
  for (const c of cells) {
    current.push(c);
    acc += c.width_percent;
    if (acc >= 100) { rows.push(current); current = []; acc = 0; }
  }
  if (current.length) rows.push(current);

  const logoAlt = orgName ?? (typeof data?.name === "string" ? data.name : "Logo");

  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        // Bleed rows are always single-cell 100% width.
        if (row.length === 1 && row[0].bleed && (row[0].kind === "single-image" || row[0].kind === "gallery" || row[0].kind === "logo")) {
          const c = row[0];
          const isFirst = i === 0;
          const isLast = i === rows.length - 1;
          const bleedCls = [
            "-mx-6",
            isFirst ? "-mt-6" : "",
            isLast ? "-mb-6" : "",
            isFirst ? "rounded-t-xl" : "",
            isLast ? "rounded-b-xl" : "",
          ].filter(Boolean).join(" ");
          if (c.kind === "single-image") {
            return (
              <div key={c.id} className={`${bleedCls} overflow-hidden`}>
                <LazyImage src={c.urls![0]} alt={c.label} containerClassName={`aspect-video w-full`} className="h-full w-full object-cover" />
              </div>
            );
          }
          if (c.kind === "gallery") {
            return (
              <div key={c.id} className={`${bleedCls} overflow-hidden`}>
                <GalleryCarousel urls={c.urls!} alt={c.label} aspectClassName="aspect-video" />
              </div>
            );
          }
          // logo bleed → still use OrgLogo (with fallback) at full width, square-ish
          return (
            <div key={c.id} className={`${bleedCls} overflow-hidden`}>
              <OrgLogo src={c.urls && c.urls[0] ? c.urls[0] : null} alt={logoAlt} className="aspect-video w-full rounded-none border-0" iconClassName="h-16 w-16" />
            </div>
          );
        }

        return (
          <div key={i} className="grid grid-cols-4 gap-3">
            {row.map((c) => {
              if (c.kind === "name") {
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground line-clamp-2">
                      {c.text}
                    </h3>
                  </div>
                );
              }
              if (c.kind === "logo") {
                const size = c.width_percent === 25 ? "h-12 w-12" : c.width_percent === 50 ? "h-16 w-16" : "h-20 w-20";
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <OrgLogo src={c.urls && c.urls[0] ? c.urls[0] : null} alt={logoAlt} className={size} iconClassName="h-1/2 w-1/2" />
                  </div>
                );
              }
              if (c.kind === "single-image") {
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <LazyImage
                      src={c.urls![0]}
                      alt={c.label}
                      containerClassName={`${c.imgAspect} w-full rounded-md`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                );
              }
              if (c.kind === "gallery") {
                const aspect = c.width_percent === 100 ? "aspect-video" : "aspect-square";
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <GalleryCarousel urls={c.urls!} alt={c.label} aspectClassName={aspect} />
                  </div>
                );
              }
              return (
                <div key={c.id} className={`${c.span} min-w-0`}>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <IconByName name={c.iconName} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </div>
                  <div className="truncate text-sm text-foreground">{c.text}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
