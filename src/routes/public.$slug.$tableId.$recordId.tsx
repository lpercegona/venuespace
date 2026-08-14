import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/venue/empty-state";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicBreadcrumbs } from "@/components/venue/public-breadcrumbs";

import { InterestFormModal } from "@/components/venue/interest-form-modal";

type Payload = {
  organization: { id: string; slug: string; name: string; description: string | null };
  table: { id: string; name: string; description: string | null };
  fields: Array<{ id: string; key: string; label: string; type: string; position: number; config: any }>;
  record: { id: string; data: Record<string, any>; deal_status: string; created_at: string };
  signed_urls: Record<string, string>;
  galleries?: Record<string, string[]>;
  relations: Record<string, Record<string, { id: string; label: string }>>;
  public_form_view: { id: string; auto_relation_field_id: string | null } | null;
};

async function fetchDetail(slug: string, tableId: string, recordId: string): Promise<Payload> {
  const res = await fetch(`/api/public/${encodeURIComponent(slug)}/${encodeURIComponent(tableId)}/${encodeURIComponent(recordId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao carregar");
  return res.json();
}

export const Route = createFileRoute("/public/$slug/$tableId/$recordId")({
  head: ({ params }) => ({
    meta: [
      { title: `Detalhe — ${params.slug} · Venuespace` },
      { name: "description", content: `Detalhes do registro em ${params.slug}.` },
    ],
  }),
  component: PublicRecordDetail,
});

function formatValue(field: Payload["fields"][number], raw: any, relations: Payload["relations"]): string {
  if (raw == null || raw === "") return "—";
  if (field.type === "boolean") return raw ? "Sim" : "Não";
  if (field.type === "currency" || (field.type === "computed" && (field.config ?? {}).kind !== "count")) {
    const n = Number(raw); if (Number.isNaN(n)) return String(raw);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (field.type === "number" || field.type === "computed") {
    const n = Number(raw); if (Number.isNaN(n)) return String(raw);
    return n.toLocaleString("pt-BR");
  }
  if (field.type === "date") return new Date(raw).toLocaleDateString("pt-BR");
  if (field.type === "datetime") return new Date(raw).toLocaleString("pt-BR");
  if (field.type === "multiselect") {
    if (Array.isArray(raw)) return raw.length ? raw.join(", ") : "—";
    return String(raw);
  }
  if (field.type === "relation") {
    const map = relations[field.id] ?? {};
    if (Array.isArray(raw)) return raw.map((id) => map[id]?.label ?? id).join(", ");
    return map[raw]?.label ?? String(raw);
  }
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

function PublicRecordDetail() {
  const { slug, tableId, recordId } = Route.useParams();
  const q = useQuery({ queryKey: ["public-record", slug, tableId, recordId], queryFn: () => fetchDetail(slug, tableId, recordId) });
  const [interestOpen, setInterestOpen] = useState(false);


  if (q.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (q.error || !q.data) {
    return <div className="mx-auto max-w-2xl px-4 py-16"><EmptyState title="Não encontrado" description={(q.error as Error | undefined)?.message ?? "Recurso indisponível"} /></div>;
  }

  const { organization, table, fields, record, signed_urls, galleries, relations, public_form_view } = q.data;
  const visible = fields.filter((f) => f.key && !f.key.startsWith("__"));
  const titleField = visible.find((f) => f.type === "text" || f.type === "long_text") ?? visible[0];
  const title = titleField ? String(record.data?.[titleField.key] ?? "Detalhes") : "Detalhes";

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <PublicBreadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: organization.name, to: "/public/$slug", params: { slug } },
          { label: table.name, to: "/public/$slug/$tableId", params: { slug, tableId } },
          { label: title },
        ]}
      />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <BackLink to="/public/$slug" params={{ slug }} label={`Voltar para ${organization.name}`} />
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{organization.name}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
            {record.deal_status && record.deal_status !== "negotiating" ? (
              <Badge variant="secondary">{record.deal_status}</Badge>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {visible.filter((f) => f.type === "image").map((f) => {
            const url = signed_urls[f.key];
            if (!url) return null;
            return (
              <Card key={f.id}>
                <CardContent className="p-0">
                  <img src={url} alt={f.label} className="w-full rounded-lg object-cover" loading="lazy" decoding="async" />
                </CardContent>
              </Card>
            );
          })}
          {visible.filter((f) => f.type === "gallery").map((f) => {
            const urls = galleries?.[f.key] ?? [];
            const filtered = urls.filter((u) => !!u);
            if (filtered.length === 0) return null;
            return (
              <Card key={f.id}>
                <CardContent className="p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {filtered.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                        <img src={url} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" decoding="async" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Informações</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {visible.filter((f) => f.type !== "image" && f.type !== "file" && f.type !== "gallery").map((f) => {
                  const raw = record.data?.[f.key];
                  if (raw == null || raw === "") return null;
                  return (
                    <div key={f.id} className="min-w-0 space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-sm text-foreground">{formatValue(f, raw, relations)}</dd>
                    </div>
                  );
                })}
              </dl>
              {visible.filter((f) => f.type === "file").map((f) => {
                const url = signed_urls[f.key];
                if (!url) return null;
                return (
                  <div key={f.id} className="mt-4 border-t border-border/60 pt-4">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
                    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Abrir arquivo</a>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-3">
          {public_form_view ? (
            <Button size="lg" className="w-full" onClick={() => setInterestOpen(true)}>
              <MessageCircle className="h-4 w-4" />
              Manifestar interesse
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Publicado em {new Date(record.created_at).toLocaleDateString("pt-BR")}.
          </p>
        </aside>
      </main>
      {public_form_view ? (
        <InterestFormModal
          open={interestOpen}
          onOpenChange={setInterestOpen}
          slug={slug}
          tableId={tableId}
          viewId={public_form_view.id}
          recordId={record.id}
          tableName={table.name}
        />
      ) : null}
      <PublicFooter />
    </div>
  );
}
