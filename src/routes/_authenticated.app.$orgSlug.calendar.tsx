import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getOrganizationBySlug, listTables } from "@/lib/orgs.functions";
import { listOccupancy } from "@/lib/applications.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLabels } from "@/hooks/use-instance-context";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/calendar")({
  head: ({ params }) => ({ meta: [{ title: `Calendário — ${params.orgSlug} — Venuespace` }, { name: "robots", content: "noindex" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { orgSlug } = Route.useParams();
  const { t } = useLabels();
  const tableLabel = t("table", "tabela").toLowerCase();
  const bookingsLabel = t("bookings", "reservas").toLowerCase();
  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => getOrganizationBySlug({ data: { slug: orgSlug } }) });
  const tables = useQuery({
    queryKey: ["tables", org.data?.id],
    queryFn: () => listTables({ data: { organization_id: org.data!.id } }),
    enabled: !!org.data?.id,
  });

  return (
    <AppShell title="Calendário de ocupação" subtitle={`${t("bookings", "Reservas")} aceitas ou fechadas por ${tableLabel} reservável.`}>
      {tables.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {(tables.data ?? []).filter((t: any) => t.bookable).length === 0 ? (
            <EmptyState title={`Nenhuma ${tableLabel} reservável`} description={`Marque uma ${tableLabel} como 'com ${bookingsLabel}' para ver ocupação aqui.`} />
          ) : null}
          {(tables.data ?? []).filter((t: any) => t.bookable).map((t: any) => (
            <TableOccupancy key={t.id} tableId={t.id} tableName={t.name} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function TableOccupancy({ tableId, tableName }: { tableId: string; tableName: string }) {
  const { t } = useLabels();
  const bookingsLabel = t("bookings", "reservas").toLowerCase();
  const q = useQuery({ queryKey: ["occupancy", tableId], queryFn: () => listOccupancy({ data: { table_id: tableId } }) });
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">{tableName}</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : !q.data?.entries || q.data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem {bookingsLabel} confirmadas.</p>
        ) : (
          <ul className="grid gap-2">
            {q.data.entries.map((e: any) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">Recurso: <span className="font-mono text-xs">{String(e.resource_id).slice(0, 8)}</span></p>
                  <p className="text-muted-foreground">{e.start} → {e.end}</p>
                </div>
                <Badge variant="secondary">{e.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
