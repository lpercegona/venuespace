import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Database, MessageSquare, Sparkles, Loader2, Building2, FileText } from "lucide-react";
import { useLabels } from "@/hooks/use-instance-context";
import { PublicHeader } from "@/components/venue/public-header";
import { getPublicCardTitle, PublicCardBody } from "@/components/venue/public-card-renderer";
import type { PublicOrganizationSummary, PublicRecordSummary } from "@/lib/public.server";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Venuespace — espaços para eventos" },
      {
        name: "description",
        content:
          "Liste espaços de eventos, publique ambientes disponíveis, receba interessados e conduza negociações em um só lugar.",
      },
      { property: "og:title", content: "Venuespace — espaços para eventos" },
      { property: "og:description", content: "Liste espaços de eventos, publique ambientes disponíveis, receba interessados e conduza negociações em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

async function fetchOrgs(): Promise<{ items: PublicOrganizationSummary[] }> {
  const res = await fetch("/api/public/organizations?limit=8");
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}
async function fetchRecords(): Promise<{ items: PublicRecordSummary[] }> {
  const res = await fetch("/api/public/records?limit=8");
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}
function Landing() {
  const { t } = useLabels();
  const orgsPlural = t("organizations", "Organizações");
  const recordsPlural = t("records", "Registros");
  const orgs = useQuery({ queryKey: ["landing-orgs"], queryFn: fetchOrgs, staleTime: 60_000 });
  const recs = useQuery({ queryKey: ["landing-records"], queryFn: fetchRecords, staleTime: 60_000 });
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Espaços</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Encontre e publique espaços de eventos.
          </h1>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-6">
                Cadastrar meu espaço
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/explore">
              <Button size="lg" variant="outline" className="h-12 px-6">
                Explorar espaços
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 space-y-12">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                <Building2 className="h-5 w-5 text-primary" />
                {orgsPlural} recentes
              </h2>
              <Link to="/explore" className="text-sm text-primary hover:underline">
                Ver todas
              </Link>
            </div>
            {orgs.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (orgs.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum espaço publicado ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(orgs.data?.items ?? []).map((o) => (
                  <Link
                    key={o.id}
                    to="/public/$slug"
                    params={{ slug: o.slug }}
                    className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card className="h-full transition-shadow hover:shadow-elegant">
                      <CardHeader className="pb-2">
                        <CardTitle className="font-display text-base">{o.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {o.layout && o.layout.length > 0 ? (
                          <PublicCardBody layout={o.layout as any} fields={o.fields as any} data={o.data} />
                        ) : o.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{o.description}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">/{o.slug}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                <FileText className="h-5 w-5 text-primary" />
                Ambientes publicados
              </h2>
              <Link to="/explore" search={{ tab: "records" }} className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            {recs.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (recs.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ambiente publicado ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(recs.data?.items ?? []).map((r) => {
                  const title = getPublicCardTitle({
                    layout: r.layout ?? [],
                    fields: r.fields ?? [],
                    data: r.data,
                    fallback: "Ambiente",
                  });
                  return (
                    <Link
                      key={r.record_id}
                      to="/public/$slug/$tableId/$recordId"
                      params={{ slug: r.org_slug, tableId: r.table_id, recordId: r.record_id }}
                      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className="h-full transition-shadow hover:shadow-elegant">
                        <CardHeader className="pb-2">
                          <p className="text-xs text-muted-foreground truncate">
                            {r.org_name} · {r.table_name}
                          </p>
                          <CardTitle className="font-display text-base line-clamp-2">{title || "Ambiente"}</CardTitle>
                        </CardHeader>
                        {(r.layout ?? []).length > 0 ? (
                          <CardContent>
                            <PublicCardBody layout={r.layout as any} fields={r.fields as any} data={r.data} />
                          </CardContent>
                        ) : null}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Database,
              title: "Perfis de espaços",
              body: "Cada local pode apresentar dados, endereço, capacidade, fotos e ambientes.",
            },
            {
              icon: Sparkles,
              title: "Vitrine pública",
              body: "Cards seguem o layout definido para a categoria, sem depender de página manual.",
            },
            {
              icon: MessageSquare,
              title: "Interesse e negociação",
              body: "Visitantes enviam solicitações e a conversa continua vinculada ao ambiente.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} VENUESPACE
        </div>
      </footer>
    </div>
  );
}
