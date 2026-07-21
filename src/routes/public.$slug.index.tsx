import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { getPublicCardTitle, PublicCardBody } from "@/components/venue/public-card-renderer";
import { EmptyState } from "@/components/venue/empty-state";

type PublicLayoutField = { id: string; field_key: string; width_percent: number; order_index: number; config: Record<string, any> };
type PublicRendererField = { key: string; label: string; type: string };
type PublicRecordSummary = { record_id: string; table_id: string; data: Record<string, any>; layout?: PublicLayoutField[]; fields?: PublicRendererField[] };
type PublicOrganizationSummary = {
  id: string; slug: string; name: string; description: string | null; logo_url: string | null;
  category_id: string | null; data: Record<string, any>; layout: PublicLayoutField[]; fields: PublicRendererField[];
};

export const Route = createFileRoute("/public/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Venuespace` },
      { name: "description", content: `Perfil público de ${params.slug} no Venuespace.` },
    ],
  }),
  component: PublicOrgPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <EmptyState title="Perfil indisponível" description="Esta organização não existe ou está oculta." />
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <EmptyState title="Não encontrado" description="Este perfil não existe." />
    </div>
  ),
});

type PublicOrg = PublicOrganizationSummary & { category_name: string | null; address: Record<string, any> };

async function fetchOrg(slug: string): Promise<PublicOrg> {
  const res = await fetch(`/api/public/organizations/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Perfil não encontrado");
  return res.json();
}

async function fetchRecords(slug: string): Promise<{ items: PublicRecordSummary[]; total: number }> {
  const res = await fetch(`/api/public/records?limit=60&slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

function formatAddress(a: Record<string, any> | undefined): { line1: string; line2: string } | null {
  if (!a) return null;
  const line1 = [a.street, a.number].filter(Boolean).join(", ") + (a.complement ? ` — ${a.complement}` : "");
  const line2Parts = [];
  if (a.neighborhood) line2Parts.push(a.neighborhood);
  const cityUf = [a.city, a.state].filter(Boolean).join("/");
  if (cityUf) line2Parts.push(cityUf);
  if (a.cep) line2Parts.push(String(a.cep));
  const line2 = line2Parts.join(" — ");
  if (!line1.trim() && !line2.trim()) return null;
  return { line1: line1.trim().replace(/^,\s*/, ""), line2 };
}

function OrgDetailsFallback({
  fields, data, layoutKeys,
}: { fields: PublicRendererField[]; data: Record<string, any>; layoutKeys: Set<string> }) {
  const HIDDEN = new Set(["name", "slug", "description", "logo_url", "address.cep", "address.street", "address.number", "address.complement", "address.neighborhood", "address.city", "address.state"]);
  const items = fields.filter((f) => !layoutKeys.has(f.key) && !HIDDEN.has(f.key));
  const entries: Array<{ label: string; value: string }> = [];
  for (const f of items) {
    const v = data?.[f.key];
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    let text: string;
    if (Array.isArray(v)) text = v.filter((x) => typeof x === "string" && !/^https?:\/\//i.test(x)).join(", ");
    else if (typeof v === "boolean") text = v ? "Sim" : "Não";
    else text = String(v);
    if (!text) continue;
    entries.push({ label: f.label, value: text });
  }
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((e) => (
        <div key={e.label} className="rounded-md border border-border p-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{e.label}</div>
          <div className="mt-1 text-sm text-foreground">{e.value}</div>
        </div>
      ))}
    </div>
  );
}

function PublicOrgPage() {
  const { slug } = Route.useParams();
  const orgQ = useQuery({ queryKey: ["public-org", slug], queryFn: () => fetchOrg(slug) });
  const recordsQ = useQuery({ queryKey: ["public-org-records", slug], queryFn: () => fetchRecords(slug) });

  if (orgQ.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (orgQ.error || !orgQ.data) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <BackLink to="/" label="Início" />
          <div className="mt-6">
            <EmptyState title="Perfil indisponível" description="Esta organização não existe ou está oculta." />
          </div>
        </main>
      </div>
    );
  }
  const org = orgQ.data;
  const records = recordsQ.data?.items ?? [];
  const layout: PublicLayoutField[] = org.layout ?? [];
  const layoutKeys = new Set(layout.map((l) => l.field_key));
  const addr = formatAddress(org.address);
  const logoUrl = typeof org.data?.logo_url === "string" && /^https?:\/\//i.test(org.data.logo_url) ? org.data.logo_url : (org.logo_url ?? null);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <BackLink to="/" label="Início" />
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            {logoUrl ? (
              <img src={logoUrl} alt={`Logo ${org.name}`} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              {org.category_name ? (
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{org.category_name}</p>
              ) : null}
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{org.name}</h1>
              {org.description ? <p className="mt-3 max-w-2xl text-sm text-foreground/90">{org.description}</p> : null}
              {addr ? (
                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    {addr.line1 ? <div>{addr.line1}</div> : null}
                    {addr.line2 ? <div>{addr.line2}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        {(layout.length > 0 || Object.keys(org.data ?? {}).length > 0) ? (
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Informações</h2>
            {layout.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <PublicCardBody layout={layout as any} fields={org.fields as any} data={org.data} />
              </div>
            ) : null}
            <OrgDetailsFallback fields={org.fields} data={org.data} layoutKeys={layoutKeys} />
          </section>
        ) : null}

        {addr ? (() => {
          const q = [org.address?.street, org.address?.number, org.address?.neighborhood, org.address?.city, org.address?.state, org.address?.cep]
            .filter(Boolean).join(", ");
          const src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
          return (
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Localização</h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <iframe
                  title={`Mapa de ${org.name}`}
                  src={src}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full border-0"
                />
              </div>
            </section>
          );
        })() : null}

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Publicações</h2>
          {records.length === 0 ? (
            <EmptyState title="Sem publicações" description="Esta organização não tem registros publicados." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {records.map((r) => {
                const title = getPublicCardTitle({ layout: r.layout ?? [], fields: r.fields ?? [], data: r.data, fallback: "Ambiente" });
                return (
                  <li key={r.record_id}>
                    <Link
                      to="/public/$slug/$tableId/$recordId"
                      params={{ slug, tableId: r.table_id, recordId: r.record_id }}
                      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className="h-full transition-shadow hover:shadow-elegant">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-display text-lg line-clamp-2">{title || "Ambiente"}</CardTitle>
                        </CardHeader>
                        {(r.layout ?? []).length > 0 ? (
                          <CardContent>
                            <PublicCardBody layout={r.layout as any} fields={r.fields as any} data={r.data} />
                          </CardContent>
                        ) : null}
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
