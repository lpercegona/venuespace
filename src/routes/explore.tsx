import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Building2, FileText } from "lucide-react";
import type { PublicOrganizationSummary, PublicRecordSummary } from "@/lib/public.server";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { getPublicCardTitle, PublicCardBody } from "@/components/venue/public-card-renderer";

import { useLabels } from "@/hooks/use-instance-context";

const searchSchema = z.object({
  tab: fallback(z.string(), "orgs").default("orgs"),
});

export const Route = createFileRoute("/explore")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Explorar — Venuespace" },
      { name: "description", content: "Descubra espaços de eventos e ambientes publicados no Venuespace." },
      { property: "og:title", content: "Explorar — Venuespace" },
      { property: "og:description", content: "Descubra espaços de eventos e ambientes publicados no Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorePage,
});

const PAGE_SIZE = 24;

async function fetchOrgs(q: string, offset: number): Promise<{ items: PublicOrganizationSummary[]; total: number }> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (q) params.set("q", q);
  const res = await fetch(`/api/public/organizations?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

async function fetchRecords(q: string, offset: number): Promise<{ items: PublicRecordSummary[]; total: number }> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (q) params.set("q", q);
  const res = await fetch(`/api/public/records?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

function ExplorePage() {
  const { t } = useLabels();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = tab === "records" ? "records" : "orgs";

  const orgLabel = t("organization", "organização").toLowerCase();
  const recordLabel = t("record", "registro").toLowerCase();

  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  const orgsQ = useQuery({
    queryKey: ["explore-orgs", q, offset],
    queryFn: () => fetchOrgs(q, offset),
    enabled: activeTab === "orgs",
    staleTime: 30_000,
  });
  const recsQ = useQuery({
    queryKey: ["explore-records", q, offset],
    queryFn: () => fetchRecords(q, offset),
    enabled: activeTab === "records",
    staleTime: 30_000,
  });

  const active = activeTab === "orgs" ? orgsQ : recsQ;
  const total = active.data?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <BackLink to="/" label="Início" />
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Explorar</h1>
        <p className="mt-2 text-sm text-muted-foreground">Navegue por espaços de eventos e ambientes publicados.</p>

        <Tabs
          value={activeTab}
          onValueChange={(v) => { setOffset(0); navigate({ search: { tab: v } }); }}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="orgs"><Building2 className="h-4 w-4" />Espaços</TabsTrigger>
            <TabsTrigger value="records"><FileText className="h-4 w-4" />Ambientes</TabsTrigger>
          </TabsList>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setOffset(0); setQ(term.trim()); }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <Button type="submit">Buscar</Button>
          </form>

          <TabsContent value="orgs" className="mt-6">
            {orgsQ.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (orgsQ.data?.items ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Nenhum espaço encontrado.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(orgsQ.data?.items ?? []).map((o) => (
                  <Link
                    key={o.id}
                    to="/public/$slug"
                    params={{ slug: o.slug }}
                    className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card className="h-full transition-shadow hover:shadow-elegant">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="truncate">/{o.slug}</span>
                        </div>
                        <CardTitle className="font-display text-lg">{o.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {o.layout && o.layout.length > 0 ? (
                          <PublicCardBody layout={o.layout as any} fields={o.fields as any} data={o.data} />
                        ) : o.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{o.description}</p>
                        ) : null}
                      </CardContent>

                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="records" className="mt-6">
            {recsQ.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (recsQ.data?.items ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Nenhum ambiente encontrado.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(recsQ.data?.items ?? []).map((r) => {
                  const title = getPublicCardTitle({ layout: r.layout ?? [], fields: r.fields ?? [], data: r.data, fallback: "Ambiente" });
                  return (
                    <Link
                      key={r.record_id}
                      to="/public/$slug/$tableId/$recordId"
                      params={{ slug: r.org_slug, tableId: r.table_id, recordId: r.record_id }}
                      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className="h-full transition-shadow hover:shadow-elegant">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="truncate">{r.org_name} · {r.table_name}</span>
                          </div>
                          <CardTitle className="font-display text-lg line-clamp-2">{title || "Ambiente"}</CardTitle>
                        </CardHeader>
                        {(r.layout ?? []).length > 0 ? (
                          <CardContent>
                            <PublicCardBody layout={r.layout as any} fields={r.fields as any} data={r.data} />
                          </CardContent>
                        ) : (
                          <CardContent>
                            <Badge variant="secondary">{new Date(r.created_at).toLocaleDateString("pt-BR")}</Badge>
                          </CardContent>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

        </Tabs>

        {total > PAGE_SIZE ? (
          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Próxima
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
