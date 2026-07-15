import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { PublicCardBody } from "@/components/venue/public-card-renderer";
import { EmptyState } from "@/components/venue/empty-state";
import type { PublicRecordSummary } from "@/lib/public.server";

export const Route = createFileRoute("/public/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Venuespace` },
      { name: "description", content: `Publicações de ${params.slug} no Venuespace.` },
    ],
  }),
  component: PublicOrgPage,
});

async function fetchRecords(slug: string): Promise<{ items: PublicRecordSummary[]; total: number }> {
  const res = await fetch(`/api/public/records?limit=60&slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

function PublicOrgPage() {
  const { slug } = Route.useParams();
  const q = useQuery({ queryKey: ["public-org-records", slug], queryFn: () => fetchRecords(slug) });

  if (q.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  const items = q.data?.items ?? [];
  const orgName = items[0]?.org_name ?? slug;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <BackLink to="/" label="Início" />
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">/{slug}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{orgName}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {items.length === 0 ? (
          <EmptyState title="Sem publicações" description="Esta organização não tem registros publicados." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => {
              const titleKey = r.layout?.[0]?.field_key;
              const title = titleKey ? String(r.data?.[titleKey] ?? "") : "";
              const fallback = Object.values(r.data).find((v) => typeof v === "string" && v.length > 0) as string | undefined;
              const restLayout = (r.layout ?? []).slice(1);
              return (
                <li key={r.record_id}>
                  <Link
                    to="/public/$slug/$tableId/$recordId"
                    params={{ slug, tableId: r.table_id, recordId: r.record_id }}
                    className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card className="h-full transition-shadow hover:shadow-elegant">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="truncate">{r.table_name}</span>
                        </div>
                        <CardTitle className="font-display text-lg line-clamp-2">{title || fallback || "Registro"}</CardTitle>
                      </CardHeader>
                      {restLayout.length > 0 ? (
                        <CardContent>
                          <PublicCardBody layout={restLayout as any} fields={r.fields as any} data={r.data} />
                        </CardContent>
                      ) : null}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
