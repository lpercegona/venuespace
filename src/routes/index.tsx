import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Database, MessageSquare, Sparkles, Building2, FileText } from "lucide-react";
import { useLabels } from "@/hooks/use-instance-context";
import { PublicHeader } from "@/components/venue/public-header";
import { getPublicCardTitle, PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { CategoryTabs, resolveCategory, usePublicCategories } from "@/components/venue/category-tabs";
import { useCategoryLayout, useHasPublicRecords } from "@/hooks/use-public-catalog";

import type { PublicOrganizationSummary, PublicRecordSummary } from "@/lib/public.server";


const searchSchema = z.object({
  categoria: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
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

async function fetchOrgs(categoryId?: string): Promise<{ items: PublicOrganizationSummary[] }> {
  const p = new URLSearchParams({ limit: "8" });
  if (categoryId) p.set("category", categoryId);
  const res = await fetch(`/api/public/organizations?${p.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}
async function fetchRecords(categoryId?: string): Promise<{ items: PublicRecordSummary[] }> {
  const p = new URLSearchParams({ limit: "8" });
  if (categoryId) p.set("category", categoryId);
  const res = await fetch(`/api/public/records?${p.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}
function Landing() {
  const { t } = useLabels();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const orgsPlural = t("organizations", "Organizações");
  const recordsPlural = t("records", "Registros");
  const catsQ = usePublicCategories();
  const activeCat = resolveCategory(catsQ.data, search.categoria || undefined);
  const catId = activeCat?.id;
  const orgLayoutQ = useCategoryLayout(catId, "organization_card");
  const recLayoutQ = useCategoryLayout(catId, "record_card");
  const { hasRecords } = useHasPublicRecords(catId);
  const orgs = useQuery({
    queryKey: ["landing-orgs", catId],
    queryFn: () => fetchOrgs(catId),
    enabled: !!catId || !catsQ.isLoading,
    staleTime: 60_000,
  });
  const recs = useQuery({
    queryKey: ["landing-records", catId],
    queryFn: () => fetchRecords(catId),
    enabled: (!!catId || !catsQ.isLoading) && hasRecords,
    staleTime: 60_000,
  });


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
            <Link to="/explore" search={{ tab: "orgs", categoria: search.categoria || undefined } as any}>
              <Button size="lg" variant="outline" className="h-12 px-6">
                Explorar espaços
              </Button>
            </Link>
          </div>
        </div>

        <CategoryTabs
          className="mt-12"
          categories={catsQ.data}
          isLoading={catsQ.isLoading}
          activeSlug={search.categoria || undefined}
          onSelect={(s) => navigate({ search: { categoria: s } })}
        />

        <div className="mt-8 space-y-12">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                <Building2 className="h-5 w-5 text-primary" />
                {orgsPlural} recentes
              </h2>
              <Link
                to="/explore"
                search={{ tab: "orgs", categoria: search.categoria || undefined } as any}
                className="text-sm text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>

            {orgs.isLoading ? (
              <PublicCardSkeletonGrid count={3} withLogo layout={orgLayoutQ.data} />
            ) : (orgs.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum espaço publicado ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                {(orgs.data?.items ?? []).map((o) => (
                  <Link
                    key={o.id}
                    to="/public/$slug"
                    params={{ slug: o.slug }}
                    className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
                      {o.layout && o.layout.length > 0 ? (
                        <div className="p-4">
                          <PublicCardBody layout={o.layout as any} fields={o.fields as any} data={o.data} orgName={o.name} />
                        </div>
                      ) : (
                        <>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <OrgLogo src={o.logo_url} alt={`Logo ${o.name}`} className="h-10 w-10" />
                              <CardTitle className="font-display text-base line-clamp-2">{o.name}</CardTitle>
                            </div>
                          </CardHeader>
                          {o.description ? (
                            <CardContent>
                              <p className="line-clamp-2 text-sm text-muted-foreground">{o.description}</p>
                            </CardContent>
                          ) : null}
                        </>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
          {hasRecords ? (
          <section>

            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                <FileText className="h-5 w-5 text-primary" />
                {recordsPlural} recentes
              </h2>
              <Link
                to="/explore"
                search={{ tab: "records", categoria: search.categoria || undefined } as any}
                className="text-sm text-primary hover:underline"
              >
                Ver todos
              </Link>

            </div>
            {recs.isLoading ? (
              <PublicCardSkeletonGrid count={3} layout={recLayoutQ.data} />
            ) : (recs.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ambiente publicado ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(recs.data?.items ?? []).map((r) => {
                  const hasLayout = (r.layout ?? []).length > 0;
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
                      <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
                        {hasLayout ? (
                          <div className="p-4">
                            <PublicCardBody layout={r.layout as any} fields={r.fields as any} data={r.data} />
                          </div>
                        ) : (
                          <CardHeader className="pb-2">
                            <p className="text-xs text-muted-foreground truncate">
                              {r.org_name} · {r.table_name}
                            </p>
                            <CardTitle className="font-display text-base line-clamp-2">{title || "Ambiente"}</CardTitle>
                          </CardHeader>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>

            )}
          </section>
          ) : null}

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
            <div key={title} className="rounded-xl bg-card p-4">
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
