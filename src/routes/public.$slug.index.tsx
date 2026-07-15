import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Table as TableIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "@/components/venue/public-header";
import { EmptyState } from "@/components/venue/empty-state";
import type { PublicTableSummary } from "@/lib/public.server";

export const Route = createFileRoute("/public/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Venuespace` },
      { name: "description", content: `Publicações de ${params.slug} no Venuespace.` },
    ],
  }),
  component: PublicOrgPage,
});

async function fetchTables(slug: string): Promise<{ items: PublicTableSummary[] }> {
  const res = await fetch(`/api/public/tables?limit=60&q=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

function PublicOrgPage() {
  const { slug } = Route.useParams();
  const q = useQuery({ queryKey: ["public-org", slug], queryFn: () => fetchTables(slug) });

  if (q.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  const items = (q.data?.items ?? []).filter((i) => i.org_slug === slug);
  const orgName = items[0]?.org_name ?? slug;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader back={{ to: "/", label: "Início" }} />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">/{slug}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{orgName}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {items.length === 0 ? (
          <EmptyState title="Sem publicações" description="Esta organização não tem tabelas publicadas." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <li key={t.table_id}>
                <Link
                  to="/public/$slug/$tableId"
                  params={{ slug, tableId: t.table_id }}
                  className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Card className="h-full transition-shadow hover:shadow-elegant">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TableIcon className="h-3.5 w-3.5" />
                        <span className="truncate">{t.org_name}</span>
                      </div>
                      <CardTitle className="font-display text-lg">{t.table_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary">{t.published_count} {t.published_count === 1 ? "publicado" : "publicados"}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
