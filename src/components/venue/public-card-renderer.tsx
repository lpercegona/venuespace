"use client";

import { IconByName } from "@/components/venue/lucide-icon";
import { GalleryCarousel } from "@/components/venue/gallery-carousel";
import { LazyImage } from "@/components/venue/lazy-image";
import { OrgLogo } from "@/components/venue/org-logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isImageSource } from "@/lib/public-image";
import { isRichTextHtml, richTextToPlainText } from "@/lib/rich-text";


export type LayoutItem = {
  id: string;
  field_key: string;
  width_percent: number;
  order_index: number;
  config: Record<string, any>;
};

export type RendererField = { key: string; label: string; type: string; config?: Record<string, any> };



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
  if (Array.isArray(raw)) return raw.filter((x) => x != null && x !== "").join(", ");
  const str = String(raw);
  return isRichTextHtml(str) ? richTextToPlainText(str) : str;
}

function isUrl(v: unknown): v is string {
  return isImageSource(v) || (typeof v === "string" && /^https?:\/\//i.test(v));
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

/** Prefixo configurável pelo super admin, aplicado antes do valor formatado. */
function withPrefix(it: LayoutItem, text: string): string {
  const prefix = typeof it.config?.prefix === "string" ? it.config.prefix.trim() : "";
  if (!text || !prefix) return text;
  return `${prefix} ${text}`;
}

type CellStyle = "title" | "subtitle" | "normal";

function styleFor(it: LayoutItem): CellStyle {
  const s = it.config?.style;
  if (s === "title" || s === "subtitle" || s === "normal") return s;
  return it.field_key === "name" ? "title" : "normal";
}

export function isImmersiveLayout(layout: LayoutItem[] | undefined | null) {
  return (layout ?? []).some((it) => it.config?.__card_style === "immersive");
}

export function PublicCardBody({
  layout,
  fields,
  data,
  orgName,
  padding = 4,
}: {
  layout: LayoutItem[];
  fields: RendererField[];
  data: Record<string, any>;
  /** Used as `alt` for the `logo_url` special field. Defaults to data.name or "Logo". */
  orgName?: string;
  /** Padding (in Tailwind spacing units) of the card container, used for bleed offsets. */
  padding?: 4 | 6;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  if (!layout || layout.length === 0) return null;
  if (isImmersiveLayout(layout)) {
    return <ImmersiveCardBody layout={layout} fields={fields} data={data} orgName={orgName} padding={padding} />;
  }

  type Cell = {
    id: string;
    width_percent: number;
    span: string;
    label: string;
    iconName: string | null;
    imgAspect: string;
    bleed: boolean;
    style: CellStyle;
    kind: "single-image" | "gallery" | "text" | "logo" | "icons";
    urls?: string[];
    values?: string[];
    iconMap?: Record<string, string>;
    labelMap?: Record<string, string>;
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
    const style = styleFor(it);

    // Special: logo_url → OrgLogo (with fallback icon when empty)
    if (it.field_key === "logo_url") {
      const url = typeof raw === "string" && isUrl(raw) ? raw : null;
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed, style, kind: "logo", urls: url ? [url] : [] });
      continue;
    }

    const mediaUrls = mediaUrlsFor(f, it.field_key, label, raw);
    if (mediaUrls.length === 1) {
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed, style, kind: "single-image", urls: mediaUrls });
      continue;
    }
    if (mediaUrls.length > 1) {
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed, style, kind: "gallery", urls: mediaUrls });
      continue;
    }
    // Multiselect com ícones definidos nas opções → apenas ícones com tooltip.
    const optionIcons = (f?.config?.option_icons ?? {}) as Record<string, string>;
    const optionLabelMap = optionLabelMapFor(f);
    const listValues = sortValuesByLabel(valuesOf(raw), optionLabelMap);
    if (listValues.length > 0 && listValues.some((v) => optionIcons[v])) {
      cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed: false, style, kind: "icons", values: listValues, iconMap: optionIcons, labelMap: optionLabelMap });
      continue;
    }
    const text = withPrefix(it, formatValue(f, raw));
    if (!text) continue;
    cells.push({ id: it.id, width_percent: width, span, label, iconName, imgAspect, bleed: false, style, kind: "text", text });
  }

  if (cells.length === 0) return null;

  // Pack cells into rows without ever exceeding 100% (4 columns) per row.
  // A bleed cell always occupies a row of its own.
  const rows: Cell[][] = [];
  let current: Cell[] = [];
  let acc = 0;
  const flush = () => { if (current.length) { rows.push(current); current = []; acc = 0; } };
  for (const c of cells) {
    if (c.bleed) { flush(); rows.push([c]); continue; }
    if (acc + c.width_percent > 100) flush();
    current.push(c);
    acc += c.width_percent;
    if (acc >= 100) flush();
  }
  flush();

  const logoAlt = orgName ?? (typeof data?.name === "string" ? data.name : "Logo");
  const mx = padding === 6 ? "-mx-6" : "-mx-4";
  const mt = padding === 6 ? "-mt-6" : "-mt-4";
  const mb = padding === 6 ? "-mb-6" : "-mb-4";

  return (
    <TooltipProvider>
    <div className="space-y-2">

      {rows.map((row, i) => {
        // Bleed rows are always single-cell 100% width.
        if (row.length === 1 && row[0].bleed && row[0].kind !== "text") {
          const c = row[0];
          const isFirst = i === 0;
          const isLast = i === rows.length - 1;
          const bleedCls = [
            mx,
            isFirst ? mt : "",
            isLast ? mb : "",
            isFirst ? "rounded-t-xl" : "",
            isLast ? "rounded-b-xl" : "",
          ].filter(Boolean).join(" ");
          if (c.kind === "single-image") {
            return (
              <div key={c.id} className={`${bleedCls} overflow-hidden`}>
                <LazyImage src={c.urls![0]} alt={c.label} containerClassName="aspect-video w-full" className="h-full w-full object-cover" />
              </div>
            );
          }
          if (c.kind === "gallery") {
            return (
              <div key={c.id} className={`${bleedCls} overflow-hidden`}>
                <GalleryCarousel urls={c.urls!} alt={c.label} aspectClassName="aspect-video" roundedClassName="" showCounter={false} />
              </div>
            );
          }
          // logo bleed → still use OrgLogo (with fallback) at full width
          return (
            <div key={c.id} className={`${bleedCls} overflow-hidden`}>
              <OrgLogo src={c.urls && c.urls[0] ? c.urls[0] : null} alt={logoAlt} className="aspect-video w-full rounded-none border-0" iconClassName="h-16 w-16" />
            </div>
          );
        }

        return (
          <div key={i} className="grid grid-cols-4 gap-2">

            {row.map((c) => {
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
                    <GalleryCarousel urls={c.urls!} alt={c.label} aspectClassName={aspect} showCounter={false} />
                  </div>
                );
              }
              if (c.style === "title") {
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground line-clamp-2">
                      {c.text}
                    </h3>
                  </div>
                );
              }
              if (c.style === "subtitle") {
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <p className="mb-0 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <IconByName name={c.iconName} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.text}</span>
                    </p>
                  </div>
                );
              }

              if (c.kind === "icons") {
                return (
                  <div key={c.id} className={`${c.span} min-w-0`}>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <IconByName name={c.iconName} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </div>
                    <div className="mt-1">
                      <OptionIconList values={c.values ?? []} iconMap={c.iconMap ?? {}} labelMap={c.labelMap ?? {}} />
                    </div>
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
    </TooltipProvider>
  );
}

/**
 * Lista de valores de multiselect renderizada como ícones com tooltip no hover/foco.
 * Compartilhada entre cards públicos e a página da organização.
 */
export function OptionIconList({
  values,
  iconMap,
  labelMap,
  className,
  iconClassName = "h-4 w-4",
}: {
  values: string[];
  iconMap: Record<string, string>;
  labelMap?: Record<string, string>;
  className?: string;
  iconClassName?: string;
}) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  return (
    <TooltipProvider>
      <div className={className ?? "flex flex-wrap items-center gap-2"}>
        {sorted.map((v) => (
          <Tooltip key={v}>
            <TooltipTrigger asChild>
              <span
                aria-label={v}
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="pointer-events-auto inline-flex h-8 w-8 cursor-default items-center justify-center rounded-full bg-muted text-foreground outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <IconByName name={iconMap[v] ?? "Check"} className={`${iconClassName} shrink-0`} />
              </span>
            </TooltipTrigger>

            <TooltipContent side="top"><p>{labelMap?.[v] ?? v}</p></TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}


// ---------- Estilo imersivo (Iteração 27) ----------

type ImmersiveSlot = "background" | "badge" | "top_right" | "rating" | "title" | "features" | "location";

function slotFor(it: LayoutItem): ImmersiveSlot {
  const s = it.config?.slot;
  const allowed: ImmersiveSlot[] = ["background", "badge", "top_right", "rating", "title", "features", "location"];
  return allowed.includes(s) ? (s as ImmersiveSlot) : "title";
}

/** Lista de valores de um campo (multiselect/array/texto). */
function valuesOf(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string" && v).map(String);
  if (typeof raw === "string" && raw) return [raw];
  return [];
}

/** Mapa value → label a partir de field.config.options (Iteração 30). */
function optionLabelMapFor(f: RendererField | undefined): Record<string, string> {
  const options = (f?.config?.options ?? []) as Array<{ value?: string; label?: string }>;
  const map: Record<string, string> = {};
  for (const o of options) {
    if (o && typeof o.value === "string") map[o.value] = typeof o.label === "string" && o.label ? o.label : o.value;
  }
  return map;
}

/** Ordena valores alfabeticamente pelo label exibido (fallback: o próprio valor). */
function sortValuesByLabel(values: string[], labelMap: Record<string, string>): string[] {
  return [...values].sort((a, b) => (labelMap[a] ?? a).localeCompare(labelMap[b] ?? b, "pt-BR", { sensitivity: "base" }));
}

/**
 * Card público no estilo imersivo: imagem de fundo com informações fixas em
 * cantos definidos. O super admin escolhe qual campo ocupa cada posição.
 */
function ImmersiveCardBody({
  layout,
  fields,
  data,
  orgName,
  padding = 4,
}: {
  layout: LayoutItem[];
  fields: RendererField[];
  data: Record<string, any>;
  orgName?: string;
  padding?: 4 | 6;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const bySlot = new Map<ImmersiveSlot, Array<{ it: LayoutItem; f?: RendererField }>>();
  for (const it of layout) {
    const slot = slotFor(it);
    const arr = bySlot.get(slot) ?? [];
    arr.push({ it, f: byKey.get(it.field_key) });
    bySlot.set(slot, arr);
  }

  const bg = (bySlot.get("background") ?? [])[0];
  const bgLabel = (bg?.it.config?.label_override as string) ?? bg?.f?.label ?? "";
  const bgUrls = bg ? mediaUrlsFor(bg.f, bg.it.field_key, bgLabel, data?.[bg.it.field_key]) : [];

  const textOf = (entry?: { it: LayoutItem; f?: RendererField }) =>
    entry ? withPrefix(entry.it, formatValue(entry.f, data?.[entry.it.field_key]).trim()) : "";

  const badge = (bySlot.get("badge") ?? [])[0];
  const badgeText = textOf(badge);
  const topRight = (bySlot.get("top_right") ?? [])[0];
  const topRightText = textOf(topRight);
  const rating = (bySlot.get("rating") ?? [])[0];
  const ratingText = textOf(rating);
  const title = (bySlot.get("title") ?? [])[0];
  const titleText = textOf(title) || orgName || "";
  const location = (bySlot.get("location") ?? [])[0];
  const locationText = textOf(location);
  const features = bySlot.get("features") ?? [];

  const m = padding === 6 ? "-m-6" : "-m-4";

  return (
    <TooltipProvider>
    <div className={`${m} relative isolate overflow-hidden rounded-xl`}>
      <div className="relative aspect-4/3 w-full bg-muted">
        {bgUrls.length > 1 ? (
          <GalleryCarousel urls={bgUrls} alt={bgLabel} aspectClassName="aspect-4/3" roundedClassName="" showCounter={false} />
        ) : bgUrls.length === 1 ? (
          <LazyImage
            src={bgUrls[0]}
            alt={bgLabel || titleText}
            containerClassName="aspect-4/3 w-full"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <IconByName name="Image" className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Overlay para leitura do texto sobre a imagem */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-black/35" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          {badgeText ? (
            <span className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-elegant">
              <IconByName name={(badge?.it.config?.icon as string) ?? null} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{badgeText}</span>
            </span>
          ) : <span />}
          <div className="flex min-w-0 items-center gap-2">
            {topRightText ? (
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary-foreground drop-shadow">
                {topRightText}
              </span>
            ) : null}
            {ratingText ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary-foreground drop-shadow">
                <IconByName name={(rating?.it.config?.icon as string) ?? "Star"} className="h-3.5 w-3.5 shrink-0" />
                {ratingText}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {titleText ? (
            <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-primary-foreground drop-shadow line-clamp-2">
              {titleText}
            </h3>
          ) : null}
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {features.map(({ it, f }) => {
                const iconMap = (f?.config?.option_icons ?? {}) as Record<string, string>;
                const labelMap = optionLabelMapFor(f);
                const vals = sortValuesByLabel(valuesOf(data?.[it.field_key]), labelMap);
                if (vals.length === 0) return null;
                if (it.config?.display === "text") {
                  return (
                    <span key={it.id} className="truncate text-[11px] text-primary-foreground/90 drop-shadow">
                      {vals.join(" · ")}
                    </span>
                  );
                }
                return vals.map((v) => {
                  const iconName = iconMap[v] ?? (it.config?.icon as string) ?? "Check";
                  return (
                    <Tooltip key={`${it.id}-${v}`}>
                      <TooltipTrigger asChild>
                        <span
                          aria-label={v}
                          tabIndex={0}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          className="pointer-events-auto inline-flex min-w-0 cursor-default items-center gap-1 text-[11px] text-primary-foreground drop-shadow outline-hidden focus-visible:ring-3 focus-visible:ring-ring"
                        >
                          <IconByName name={iconName} className="h-4 w-4 shrink-0" />
                        </span>
                      </TooltipTrigger>

                      <TooltipContent side="top">
                        <p>{labelMap[v] ?? v}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                });

              })}
            </div>
            {locationText ? (
              <span className="shrink-0 truncate text-[11px] text-primary-foreground/90 drop-shadow">
                {locationText}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
