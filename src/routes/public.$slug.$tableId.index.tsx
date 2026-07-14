import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/venue/empty-state";
import { PublicHeader } from "@/components/venue/public-header";
import { InterestFormModal } from "@/components/venue/interest-form-modal";

type Payload = {
  organization: { id: string; slug: string; name: string; description: string | null };
  table: { id: string; name: string; description: string | null };
  fields: Array<{ id: string; key: string; label: string; type: string; position: number }>;
  records: Array<{ id: string; data: Record<string, any>; deal_status: string; created_at: string }>;
  public_form_view: { id: string; auto_relation_field_id: string | null } | null;
};

async function fetchPublic(slug: string, tableId: string): Promise<Payload> {
  const res = await fetch(`/api/public/${encodeURIComponent(slug)}/${encodeURIComponent(tableId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao carregar");
  return res.json();
}

export const Route = createFileRoute("/public/$slug/$tableId/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Venuespace` },
      { name: "description", content: `Publicação pública em Venuespace: ${params.slug}` },
    ],
  }),
  component: PublicListPage,
});

function PublicListPage() {
  const { slug, tableId } = Route.useParams();
  const q = useQuery({ queryKey: ["public", slug, tableId], queryFn: () => fetchPublic(slug, tableId) });
  const [interestFor, setInterestFor] = useState<string | null>(null);



  if (q.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (q.error || !q.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title="Não encontrado" description={(q.error as Error | undefined)?.message ?? "Recurso indisponível"} />
      </div>
    );
  }

  const { organization, table, fields, records, public_form_view } = q.data;
  const displayFields = fields.filter((f) => f.type !== "computed" && f.type !== "relation").slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{organization.name}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">{table.name}</h1>
          {table.description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{table.description}</p> : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {records.length === 0 ? (
          <EmptyState title="Nada publicado ainda" description="Volte em breve." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((r) => {
              const titleField = displayFields[0]?.key;
              const title = titleField ? String(r.data?.[titleField] ?? "Sem título") : "Sem título";
              return (
                <li key={r.id}>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/public/$slug/$tableId/$recordId"
                          params={{ slug, tableId, recordId: r.id }}
                          className="min-w-0 flex-1 hover:underline"
                        >
                          <CardTitle className="line-clamp-2 font-display text-lg">{title}</CardTitle>
                        </Link>
                        {r.deal_status && r.deal_status !== "negotiating" ? (
                          <Badge variant="secondary">{r.deal_status}</Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <dl className="space-y-1 text-sm">
                        {displayFields.slice(1).map((f) => {
                          const v = r.data?.[f.key];
                          if (v == null || v === "") return null;
                          return (
                            <div key={f.key} className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">{f.label}</dt>
                              <dd className="truncate text-right text-foreground">{String(v)}</dd>
                            </div>
                          );
                        })}
                      </dl>
                      <div className="flex flex-col gap-2">
                        <Link to="/public/$slug/$tableId/$recordId" params={{ slug, tableId, recordId: r.id }}>
                          <Button variant="outline" size="sm" className="w-full">Ver detalhes</Button>
                        </Link>
                        {public_form_view ? (
                          <Link
                            to="/public/$slug/$tableId/form"
                            params={{ slug, tableId }}
                            search={{ record: r.id, view: public_form_view.id }}
                          >
                            <Button size="sm" className="w-full">
                              <MessageCircle className="h-4 w-4" />
                              Manifestar interesse
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
