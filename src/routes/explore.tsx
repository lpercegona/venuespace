import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Table as TableIcon } from "lucide-react";
import type { PublicTableSummary } from "@/lib/public.server";
import { PublicHeader } from "@/components/venue/public-header";
import { useLabels } from "@/hooks/use-instance-context";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explorar tabelas públicas — Venuespace" },
      { name: "description", content: "Descubra tabelas públicas de organizações no Venuespace: imóveis, campanhas, vagas, catálogos e mais." },
      { property: "og:title", content: "Explorar tabelas públicas — Venuespace" },
      { property: "og:description", content: "Descubra tabelas públicas de organizações no Venuespace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorePage,
});

const PAGE_SIZE = 24;

async function fetchTables(q: string, offset: number): Promise<{ items: PublicTableSummary[]; total: number }> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (q) params.set("q", q);
  const res = await fetch(`/api/public/tables?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

function ExplorePage() {
  const { t } = useLabels();
  const organizationLabel = t("organization", "organização").toLowerCase();
  const tableLabel = t("table", "tabela").toLowerCase();
  const tablesLabel = t("tables", "tabelas").toLowerCase();
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["public-tables", q, offset],
    queryFn: () => fetchTables(q, offset),
    staleTime: 30_000,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader back={{ to: "/", label: "Início" }} />


      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Explorar {tablesLabel} públicas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Navegue por catálogos, campanhas e listagens publicadas.</p>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setOffset(0); setQ(term.trim()); }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={`Buscar por ${tableLabel} ou ${organizationLabel}`} value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <Button type="submit">Buscar</Button>
        </form>

        <div className="mt-8">
          {query.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma {tableLabel} encontrada.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <Link
                  key={it.table_id}
                  to="/public/$slug/$tableId"
                  params={{ slug: it.org_slug, tableId: it.table_id }}
                  className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Card className="h-full transition-shadow hover:shadow-elegant">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TableIcon className="h-3.5 w-3.5" />
                        <span className="truncate">{it.org_name}</span>
                      </div>
                      <CardTitle className="font-display text-lg">{it.table_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary">{it.published_count} {it.published_count === 1 ? "publicado" : "publicados"}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

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
