"use client";

import { Link } from "@tanstack/react-router";
import { MapPin, Star, MessageCircle, ChevronRight } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GalleryCarousel } from "@/components/venue/gallery-carousel";
import { LazyImage } from "@/components/venue/lazy-image";
import { OrgLogo } from "@/components/venue/org-logo";
import { ContactActions } from "@/components/venue/contact-actions";
import { OrganizationReviews } from "@/components/venue/organization-reviews";
import { EmptyState } from "@/components/venue/empty-state";
import { getPublicCardTitle, PublicCardBody } from "@/components/venue/public-card-renderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PublicLayoutField = { id: string; field_key: string; width_percent: number; order_index: number; config: Record<string, any> };
type PublicRendererField = { key: string; label: string; type: string; config?: Record<string, any> };

function IconByName({ name, className }: { name: string; className?: string }) {
  const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase()) as keyof typeof LucideIcons;
  const Icon = (LucideIcons[key] ?? LucideIcons.Check) as LucideIcon;
  return <Icon className={className} />;
}

function getField(fields: PublicRendererField[], key: string) {
  return fields.find((f) => f.key === key);
}

function getValue(data: Record<string, any>, key: string): any {
  if (key in data) return data[key];
  const parts = key.split(".");
  let cur = data;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function formatValue(v: any): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.map(formatValue).filter(Boolean).join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

function extractIconMap(config: Record<string, any>): Record<string, string> {
  const raw = config?.options ?? [];
  const map: Record<string, string> = {};
  for (const opt of raw) {
    const parts = String(opt).split("|").map((s) => s.trim());
    if (parts.length >= 2) map[parts[0]] = parts[1];
  }
  return map;
}

function AmenityIcons({ values, iconMap }: { values: string[]; iconMap: Record<string, string> }) {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        {values.map((v) => (
          <Tooltip key={v}>
            <TooltipTrigger asChild>
              <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconByName name={iconMap[v] ?? "Check"} className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{v}</p></TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

export function OrganizationPageImmersive({
  org,
  slug,
  records,
  contactOpen,
  setContactOpen,
}: {
  org: any;
  slug: string;
  records: any[];
  contactOpen: boolean;
  setContactOpen: (v: boolean) => void;
}) {
  const layout: PublicLayoutField[] = org.page_layout ?? [];
  const fields: PublicRendererField[] = org.fields ?? [];
  const data = org.data ?? {};

  const slots = new Map<string, PublicLayoutField[]>();
  for (const it of layout) {
    const pos = (it.config?.position as string) || "default";
    if (!slots.has(pos)) slots.set(pos, []);
    slots.get(pos)!.push(it);
  }
  const slot = (key: string) => slots.get(key) ?? [];

  const backgroundField = slot("background")[0];
  const badgeField = slot("badge")[0];
  const titleField = slot("title")[0];
  const subtitleField = slot("subtitle")[0];
  const ratingField = slot("rating")[0];
  const addressField = slot("address")[0];
  const featuresField = slot("features")[0];
  const descriptionField = slot("description")[0];

  const galleryImages = (() => {
    const imgs: string[] = [];
    if (backgroundField) {
      const v = getValue(data, backgroundField.field_key);
      if (Array.isArray(v)) imgs.push(...v.filter((x) => typeof x === "string"));
      else if (typeof v === "string" && v) imgs.push(v);
    }
    return imgs;
  })();

  const badgeValue = badgeField ? formatValue(getValue(data, badgeField.field_key)) : null;
  const addressValue = addressField ? formatValue(getValue(data, addressField.field_key)) : null;
  const descriptionValue = descriptionField ? formatValue(getValue(data, descriptionField.field_key)) : null;
  const featuresValue = featuresField ? getValue(data, featuresField.field_key) : null;
  const featuresArray = Array.isArray(featuresValue) ? featuresValue.filter((x) => typeof x === "string") : [];
  const featuresIconMap = featuresField ? extractIconMap(getField(fields, featuresField.field_key)?.config ?? {}) : {};

  const avgRating = org.avg_rating ?? null;
  const totalReviews = org.total_reviews ?? 0;

  const logoUrl = typeof data.logo_url === "string" && /^https?:\/\//i.test(data.logo_url) ? data.logo_url : (org.logo_url ?? null);

  const detailsLayout = layout.filter((it) => {
    const pos = (it.config?.position as string) || "default";
    return !["background", "badge", "title", "subtitle", "rating", "address", "features", "description"].includes(pos);
  });

  const addressForMap = [org.address?.street, org.address?.number, org.address?.neighborhood, org.address?.city, org.address?.state, org.address?.cep]
    .filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative isolate h-72 sm:h-96">
        {galleryImages.length > 0 ? (
          <GalleryCarousel
            images={galleryImages}
            alt={org.name}
            className="absolute inset-0 h-full w-full"
            aspectClass="aspect-auto h-full w-full"
            roundedClass="rounded-none"
            showDots={galleryImages.length > 1}
          />
        ) : (
          <div className="absolute inset-0 bg-muted">
            <OrgLogo src={logoUrl} alt={org.name} className="h-full w-full rounded-none object-cover opacity-80" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
          <div className="mx-auto max-w-5xl">
            {badgeValue ? (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                {badgeValue}
              </span>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-semibold sm:text-4xl">
                  {titleField ? formatValue(getValue(data, titleField.field_key)) || org.name : org.name}
                </h1>
                {subtitleField ? (
                  <p className="mt-1 text-sm text-white/80">{formatValue(getValue(data, subtitleField.field_key))}</p>
                ) : null}
                {addressValue ? (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
                    <MapPin className="h-4 w-4" />
                    <span>{addressValue}</span>
                  </div>
                ) : null}
              </div>
              {avgRating != null ? (
                <div className="flex shrink-0 items-center gap-2 rounded-lg bg-black/40 px-3 py-2 backdrop-blur-sm">
                  <Star className="h-5 w-5 fill-warning text-warning" />
                  <div>
                    <div className="text-lg font-semibold leading-none">{avgRating.toFixed(1).replace(".", ",")}</div>
                    <div className="text-[10px] text-white/70">{totalReviews} avaliação{totalReviews === 1 ? "" : "s"}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-5 lg:gap-8 lg:py-8">
        {/* Left column */}
        <div className="space-y-8 lg:col-span-3">
          {descriptionValue ? (
            <section>
              <h2 className="font-display text-lg font-semibold">Sobre</h2>
              <p className="mt-2 whitespace-pre-line text-foreground/90">{descriptionValue}</p>
            </section>
          ) : null}

          {featuresArray.length > 0 ? (
            <section>
              <h2 className="font-display text-lg font-semibold">Comodidades</h2>
              <div className="mt-3">
                <AmenityIcons values={featuresArray} iconMap={featuresIconMap} />
              </div>
            </section>
          ) : null}

          {detailsLayout.length > 0 ? (
            <section>
              <h2 className="font-display text-lg font-semibold">Informações</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
                <div className="p-4 sm:p-6">
                  <PublicCardBody layout={layout} fields={fields} data={data} orgName={org.name} padding={6} />
                </div>
              </div>
            </section>
          ) : null}

          {addressForMap ? (
            <section>
              <h2 className="font-display text-lg font-semibold">Localização</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <iframe
                  title={`Mapa de ${org.name}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(addressForMap)}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full border-0 sm:h-80"
                />
              </div>
            </section>
          ) : null}

          <OrganizationReviews organizationId={org.id} avgRating={avgRating} totalReviews={totalReviews} />

          <section>
            <h2 className="font-display text-lg font-semibold">Ambientes</h2>
            {records.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="Sem publicações" description="Esta organização não tem registros publicados." />
              </div>
            ) : (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {records.map((r) => {
                  const title = getPublicCardTitle({ layout: r.layout ?? [], fields: r.fields ?? [], data: r.data, fallback: "Ambiente" });
                  return (
                    <li key={r.record_id}>
                      <Link
                        to="/public/$slug/$tableId/$recordId"
                        params={{ slug, tableId: r.table_id, recordId: r.record_id }}
                        className="group block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-elegant">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between font-display text-base">
                              <span className="line-clamp-1">{title || "Ambiente"}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(r.layout ?? []).length > 0 ? (
                              <PublicCardBody layout={r.layout} fields={r.fields ?? []} data={r.data} />
                            ) : null}
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Right sticky column */}
        <aside className="space-y-4 lg:col-span-2 lg:self-start lg:sticky lg:top-24">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              {org.public_form_view ? (
                <Button size="lg" className="min-h-11 w-full" onClick={() => setContactOpen(true)}>
                  <MessageCircle className="h-4 w-4" />
                  {org.public_form_view.submit_label || "Manifestar interesse"}
                </Button>
              ) : null}
              <ContactActions contact={org.contact} orgName={org.name} />
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
