"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Globe, Mail, MapPin, MessageSquare, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GalleryCarousel } from "@/components/venue/gallery-carousel";
import { OrgLogo } from "@/components/venue/org-logo";
import { OrganizationReviews } from "@/components/venue/organization-reviews";
import { EmptyState } from "@/components/venue/empty-state";
import { RichTextView } from "@/components/venue/rich-text-view";
import { InterestForm } from "@/components/venue/interest-form";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { getPublicCardTitle, OptionIconList, PublicCardBody } from "@/components/venue/public-card-renderer";
import { isImageSource } from "@/lib/public-image";

type PublicRendererField = { key: string; label: string; type: string; config?: Record<string, any> };

const HIDDEN_KEYS = new Set([
  "name", "slug", "description", "logo_url", "rating",
  "address.cep", "address.street", "address.number", "address.complement",
  "address.neighborhood", "address.city", "address.state", "address.city_state_full",
]);

const CONTACT_KEYS = /^(site|website|url|telefone|phone|whatsapp|email|e_mail)$/i;

function isUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function formatValue(field: PublicRendererField | undefined, raw: any): string {
  if (raw == null || raw === "") return "";
  if (field?.type === "boolean") return raw ? "Sim" : "Não";
  if (field?.type === "currency") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(raw);
  }
  if (field?.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(raw);
  }
  if (field?.type === "date") return new Date(raw).toLocaleDateString("pt-BR");
  if (field?.type === "datetime") return new Date(raw).toLocaleString("pt-BR");
  if (Array.isArray(raw)) return raw.filter((x) => x != null && x !== "").join(", ");
  return String(raw);
}

function valuesOf(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string" && v);
  if (typeof raw === "string" && raw) return [raw];
  return [];
}

function isMediaField(f: PublicRendererField, raw: any) {
  if (f.type === "image" || f.type === "gallery") return true;
  if (Array.isArray(raw) && raw.some((v) => isUrl(v))) return /(capa|cover|foto|galeria|gallery|imagem|image|photo)/i.test(f.key);
  return false;
}

/**
 * Layout 2 da página pública de organização (estrutura fixa).
 * Faixa hero com a galeria, colunas assimétricas e card de interesse sobreposto.
 */
export function OrganizationPageImmersive({
  org,
  slug,
  records,
}: {
  org: any;
  slug: string;
  records: any[];
}) {
  const fields: PublicRendererField[] = org.fields ?? [];
  const data: Record<string, any> = org.data ?? {};

  // Galeria hero: primeiro campo de mídia com imagens.
  const heroUrls: string[] = (() => {
    for (const f of fields) {
      const raw = data[f.key];
      if (!isMediaField(f, raw)) continue;
      const urls = (Array.isArray(raw) ? raw : [raw]).filter((v: any) => isUrl(v));
      if (urls.length > 0) return urls as string[];
    }
    return [];
  })();
  const heroKeys = new Set(fields.filter((f) => isMediaField(f, data[f.key])).map((f) => f.key));

  // Comodidades: multiselect com ícones definidos nas opções.
  const amenityBlocks = fields
    .map((f) => {
      const iconMap = (f.config?.option_icons ?? {}) as Record<string, string>;
      const vals = valuesOf(data[f.key]);
      if (vals.length === 0 || !vals.some((v) => iconMap[v])) return null;
      return { field: f, values: vals, iconMap };
    })
    .filter(Boolean) as Array<{ field: PublicRendererField; values: string[]; iconMap: Record<string, string> }>;
  const amenityKeys = new Set(amenityBlocks.map((b) => b.field.key));

  // Campos em grade: tudo que não é mídia, comodidade, contato ou campo-base oculto.
  const gridEntries: Array<{ label: string; value: string }> = [];
  for (const f of fields) {
    if (HIDDEN_KEYS.has(f.key) || heroKeys.has(f.key) || amenityKeys.has(f.key)) continue;
    if (CONTACT_KEYS.test(f.key)) continue;
    const text = formatValue(f, data[f.key]);
    if (!text || isUrl(text)) continue;
    gridEntries.push({ label: f.label, value: text });
  }

  const description = (org.description ?? data.description ?? "") as string;
  const contact = org.contact ?? {};
  const website = (contact.website ?? "").trim();
  const websiteHref = website && !/^https?:\/\//i.test(website) ? `https://${website}` : website;
  const phone = (contact.phone ?? "").trim();
  const whatsapp = (contact.whatsapp ?? "").trim();
  const email = (contact.email ?? "").trim();
  const digits = (v: string) => v.replace(/\D+/g, "");

  const avgRating: number | null = org.avg_rating ?? null;
  const totalReviews: number = org.total_reviews ?? 0;

  const a = org.address ?? {};
  const addressLine = [
    [a.street, a.number].filter(Boolean).join(", "),
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join("/"),
    a.cep,
  ].filter(Boolean).join(" - ");
  // Versão curta (mobile): rua/número e cidade/UF, para caber em uma linha.
  const addressLineShort = [
    [a.street, a.number].filter(Boolean).join(", "),
    [a.city, a.state].filter(Boolean).join("/"),
  ].filter(Boolean).join(" - ");
  const mapQuery = [a.street, a.number, a.neighborhood, a.city, a.state, a.cep].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Breadcrumb */}
      <nav aria-label="Trilha" className="border-b border-border/60 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:px-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          {org.category_name ? (
            <>
              <span aria-hidden>&gt;</span>
              <span className="truncate text-foreground">{org.category_name}</span>
            </>
          ) : null}
        </div>
      </nav>

      {/* Hero full-bleed */}
      <section className="relative isolate h-72 w-full overflow-hidden sm:h-[26rem]">
        {heroUrls.length > 0 ? (
          <GalleryCarousel
            urls={heroUrls}
            alt={org.name}
            className="absolute inset-0"
            fillContainer
            roundedClassName=""
            preloadCount={5}
            enableLightbox
            itemBasisClassName="basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 2xl:basis-1/5"
          />
        ) : (
          <div className="absolute inset-0 bg-muted">
            <OrgLogo src={org.logo_url ?? null} alt={org.name} className="h-full w-full rounded-none border-0" iconClassName="h-16 w-16" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
            <div className="max-w-3xl text-primary-foreground">
              {avgRating != null ? (
                <span className="mb-1 inline-flex items-center gap-1 text-sm font-semibold drop-shadow">
                  {avgRating.toFixed(1).replace(".", ",")}
                  <Star className="h-4 w-4 shrink-0" />
                </span>
              ) : null}
              <h1 className="font-display text-3xl font-semibold tracking-tight drop-shadow sm:text-4xl">{org.name}</h1>
              {addressLine ? (
                <p className="pointer-events-auto mt-2 flex flex-nowrap items-center gap-1 text-[10px] leading-tight drop-shadow sm:gap-1.5 sm:text-sm">
                  <MapPin className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate sm:hidden">{addressLineShort || addressLine}</span>
                  <span className="hidden truncate sm:inline">{addressLine}</span>
                  {mapQuery ? (
                    <>
                      <span aria-hidden className="opacity-60">|</span>
                      <a href="#localizacao" className="shrink-0 whitespace-nowrap underline underline-offset-2">Ver no mapa</a>
                    </>
                  ) : null}
                </p>
              ) : null}

            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-5">
        {/* Coluna esquerda */}
        <div className="space-y-8 pt-8 lg:col-span-3">
          {gridEntries.length > 0 ? (
            <section className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {gridEntries.map((e) => (
                <div key={e.label} className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{e.label}</div>
                  <div className="mt-1 text-sm text-foreground">{e.value}</div>
                </div>
              ))}
            </section>
          ) : null}

          {description ? (
            <section>
              <RichTextView value={description} />
            </section>
          ) : null}

          {amenityBlocks.map((b) => (
            <section key={b.field.key}>
              <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{b.field.label}</h2>
              <div className="mt-2">
                <OptionIconList values={b.values} iconMap={b.iconMap} />
              </div>
            </section>
          ))}

          {(websiteHref || phone) ? (
            <section className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {websiteHref ? (
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Site</div>
                  <a href={websiteHref} target="_blank" rel="noreferrer noopener" className="mt-1 block truncate text-sm text-foreground underline underline-offset-2">
                    {website}
                  </a>
                </div>
              ) : null}
              {phone ? (
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Telefone</div>
                  <a href={`tel:${digits(phone)}`} className="mt-1 block truncate text-sm text-foreground">{phone}</a>
                </div>
              ) : null}
            </section>
          ) : null}

          <p className="text-xs leading-snug text-muted-foreground">
            Este espaço é seu?{" "}
            <a
              href={`mailto:contato@venuespace.com.br?subject=${encodeURIComponent(`Reivindicação do espaço ${org.name}`)}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Clique aqui
            </a>{" "}
            para reivindicar a propriedade e assumir o perfil.
          </p>

          <p className="text-[10px] leading-snug text-muted-foreground">
            Fotos indexadas de sites de espaços ou de buscadores na internet. Para reivindicar autoria ou solicitar
            remoção,{" "}
            <a
              href={`mailto:contato@venuespace.com.br?subject=${encodeURIComponent(`Autoria de fotos — ${org.name}`)}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              clique aqui
            </a>
            .
          </p>



          {/* Mobile: bloco de contato logo abaixo de Site/Telefone */}
          <div className="lg:hidden">
            <ContactCard org={org} slug={slug} contact={{ email, whatsapp, phone, websiteHref }} collapsible />
          </div>


          <section>
            <h2 className="font-display text-lg font-semibold">Ambientes</h2>
            {records.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="Sem publicações" description="Esta organização não tem registros publicados." />
              </div>
            ) : (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {records.map((r) => {
                  const hasLayout = (r.layout ?? []).length > 0;
                  const title = getPublicCardTitle({ layout: r.layout ?? [], fields: r.fields ?? [], data: r.data, fallback: "Ambiente" });
                  return (
                    <li key={r.record_id}>
                      <Link
                        to="/public/$slug/$tableId/$recordId"
                        params={{ slug, tableId: r.table_id, recordId: r.record_id }}
                        className="group block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-elegant">
                          {hasLayout ? (
                            <div className="p-4">
                              <PublicCardBody layout={r.layout} fields={r.fields ?? []} data={r.data} />
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 p-4">
                              <span className="font-display text-base line-clamp-2">{title || "Ambiente"}</span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>
                          )}
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {mapQuery ? (
            <section id="localizacao" className="scroll-mt-24">
              <h2 className="font-display text-lg font-semibold">Localização</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <iframe
                  title={`Mapa de ${org.name}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full border-0"
                />
              </div>
            </section>
          ) : null}

          <OrganizationReviews organizationId={org.id} avgRating={avgRating} totalReviews={totalReviews} />
        </div>

        {/* Coluna direita: card de interesse sobreposto à faixa hero (desktop) */}
        <aside className="hidden pt-8 lg:col-span-2 lg:-mt-24 lg:block lg:pt-0">
          <ContactCard org={org} slug={slug} contact={{ email, whatsapp, phone, websiteHref }} />
        </aside>

      </main>

      <PublicFooter />
    </div>
  );
}

function ContactCard({
  org,
  slug,
  contact,
  collapsible,
}: {
  org: any;
  slug: string;
  contact: { email: string; whatsapp: string; phone: string; websiteHref: string };
  collapsible?: boolean;
}) {
  const { email, whatsapp, phone, websiteHref } = contact;
  const [open, setOpen] = useState(!collapsible);
  const digits = (v: string) => v.replace(/\D+/g, "");
  const showForm = Boolean(org.public_form_view) && open;

  return (
    <Card className="shadow-elegant lg:sticky lg:top-24">
      <CardContent className="space-y-4 p-4 sm:p-6">
        {org.public_form_view ? (
          <>
            {collapsible ? (
              <Button size="lg" className="min-h-11 w-full" onClick={() => setOpen((v: boolean) => !v)} aria-expanded={open}>
                <MessageSquare className="h-4 w-4" />
                Entrar em contato
              </Button>
            ) : (
              <div>
                <h2 className="font-display text-xl font-semibold">Manifestar interesse</h2>
                <p className="mt-1 text-sm text-muted-foreground">Envie seu contato para {org.name}.</p>
              </div>
            )}
            {showForm ? (
              <InterestForm
                slug={slug}
                tableId={org.public_form_view.table_id}
                viewId={org.public_form_view.id}
                stacked
                submitLabel={org.public_form_view.submit_label || "Enviar"}
              />
            ) : null}
          </>
        ) : (
          <div>
            <h2 className="font-display text-xl font-semibold">Contato</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fale diretamente com {org.name}.</p>
          </div>
        )}

        {(email || whatsapp || phone || websiteHref) ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            {email ? (
              <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0">
                <a href={`mailto:${email}`} aria-label={`Enviar e-mail para ${org.name}`}><Mail className="h-4 w-4" /></a>
              </Button>
            ) : null}
            {whatsapp ? (
              <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0">
                <a href={`https://wa.me/${digits(whatsapp)}`} target="_blank" rel="noreferrer noopener" aria-label={`WhatsApp de ${org.name}`}>
                  <MessageSquare className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {phone ? (
              <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0">
                <a href={`tel:${digits(phone)}`} aria-label={`Telefone de ${org.name}`}><Phone className="h-4 w-4" /></a>
              </Button>
            ) : null}
            {websiteHref ? (
              <Button asChild size="lg" variant="outline" className="min-h-11 flex-1">
                <a href={websiteHref} target="_blank" rel="noreferrer noopener">
                  <Globe className="h-4 w-4" />
                  Acessar o site
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

