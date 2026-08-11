import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { getOrganizationBySlug, listTables } from "@/lib/orgs.functions";
import { listBookings, listAvailableResources } from "@/lib/bookings.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedToggle } from "@/components/venue/segmented-toggle";
import { BookingFormDialog } from "@/components/venue/booking-form-dialog";
import { BookingAvailabilityFilter, todayISO, type BookingRange } from "@/components/venue/booking-availability-filter";
import { BookingStatusActions, DealBadge } from "@/components/venue/booking-status-actions";
import { useLabels } from "@/hooks/use-instance-context";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/calendar")({
  head: ({ params }) => ({
    meta: [
      { title: `Reservas — ${params.orgSlug} — Venuespace` },
      { name: "description", content: "Gestão de reservas: agenda, disponibilidade, orçamentos e ciclo de negociação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
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

  const bookable = (tables.data ?? []).filter((tb: any) => tb.bookable);
  const canEdit = org.data?.myRole === "owner" || org.data?.myRole === "editor" || !!(org.data as any)?.isSuperAdmin;

  return (
    <AppShell
      title="Gestão de reservas"
      subtitle="Agenda, disponibilidade por data, orçamento em PDF e ciclo de negociação → fechamento → encerramento."
    >
      {tables.isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : bookable.length === 0 ? (
        <EmptyState
          title={`Nenhuma ${tableLabel} reservável`}
          description={`Marque uma ${tableLabel} como 'com ${bookingsLabel}' para gerenciar aqui.`}
        />
      ) : (
        <div className="space-y-6">
          {bookable.map((tb: any) => (
            <BookingTablePanel key={tb.id} tableId={tb.id} tableName={tb.name} orgSlug={orgSlug} canEdit={canEdit} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function BookingTablePanel({
  tableId, tableName, orgSlug, canEdit,
}: { tableId: string; tableName: string; orgSlug: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [range, setRange] = useState<BookingRange>({ mode: "single", from: todayISO(), to: todayISO() });
  const [filtering, setFiltering] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [stage, setStage] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);

  const from = filtering ? range.from : null;
  const to = filtering ? (range.mode === "single" ? range.from : range.to) : null;

  const bookings = useQuery({
    queryKey: ["bookings", tableId, from, to, includeArchived],
    queryFn: () => listBookings({ data: { table_id: tableId, from, to, include_archived: includeArchived } }),
    placeholderData: keepPreviousData,
  });

  const availability = useQuery({
    queryKey: ["booking-availability", tableId, from, to],
    queryFn: () => listAvailableResources({ data: { table_id: tableId, from: from!, to: to! } }),
    enabled: filtering && !!from && !!to,
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => {
    const all = bookings.data?.items ?? [];
    if (stage === "all") return all;
    if (stage === "archived") return all.filter((b) => b.status === "archived");
    return all.filter((b) => b.deal_status === stage);
  }, [bookings.data, stage]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bookings", tableId] });
    qc.invalidateQueries({ queryKey: ["booking-availability", tableId] });
  };

  return (
    <Card>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <CardTitle className="flex min-w-0 items-center gap-2 font-display text-base">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{tableName}</span>
        </CardTitle>
        {canEdit ? (
          <Button size="sm" className="h-11 shrink-0 sm:h-9" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4" />Nova reserva
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-lg border border-border p-3">
          <BookingAvailabilityFilter
            value={range}
            onChange={(next) => { setRange(next); setFiltering(true); }}
            onClear={() => setFiltering(false)}
          />
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedToggle
              ariaLabel="Estágio da reserva"
              value={stage}
              onValueChange={setStage}
              options={[
                { value: "all", label: "Todas" },
                { value: "negotiating", label: "Negociação" },
                { value: "accepted", label: "Fechadas" },
                { value: "closed", label: "Encerradas" },
                { value: "archived", label: "Arquivadas" },
              ]}
            />
            <div className="flex items-center gap-2">
              <Switch
                id={`arch-${tableId}`}
                checked={includeArchived}
                onCheckedChange={(v) => { setIncludeArchived(v); if (v === false && stage === "archived") setStage("all"); }}
              />
              <Label htmlFor={`arch-${tableId}`} className="text-sm text-muted-foreground">Mostrar arquivadas</Label>
            </div>
          </div>
        </div>

        {filtering ? (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium">
              Disponibilidade {range.mode === "single" ? `em ${range.from}` : `de ${range.from} a ${range.to}`}
            </p>
            {availability.isPending ? (
              <Skeleton className="h-6 w-64" />
            ) : (availability.data?.available.length ?? 0) === 0 && (availability.data?.busy.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta tabela não tem campos de reserva configurados (data de início, data de fim e recurso).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availability.data?.available.map((r) => (
                  <Badge key={r.id} variant="secondary">{r.label} · livre</Badge>
                ))}
                {availability.data?.busy.map((r) => (
                  <Badge key={r.id} variant="outline" className="text-muted-foreground">{r.label} · ocupado</Badge>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {bookings.isPending ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : bookings.isError ? (
          <p className="text-sm text-destructive">{(bookings.error as Error).message}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma reserva"
            description={filtering ? "Nenhuma reserva no período selecionado." : "Crie a primeira reserva manualmente."}
          />
        ) : (
          <ScrollArea className="w-full">
            <ul className="grid gap-3">
              {items.map((b) => (
                <li key={b.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{b.resource_label ?? "Recurso não informado"}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.start && b.end ? `${b.start} → ${b.end}` : "Período não informado"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <DealBadge dealStatus={b.deal_status} archived={b.status === "archived"} />
                      {b.agreed_value != null ? (
                        <Badge variant="secondary">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.agreed_value)}
                        </Badge>
                      ) : null}
                      {b.quotes.length > 0 ? (
                        <Badge variant="outline">{b.quotes.length} orçamento(s)</Badge>
                      ) : null}
                    </div>
                  </div>
                  <BookingStatusActions booking={b as any} orgSlug={orgSlug} canEdit={canEdit} onChanged={refresh} />
                </li>
              ))}
            </ul>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>

      {openNew ? (
        <BookingFormDialog
          open={openNew}
          onOpenChange={setOpenNew}
          tableId={tableId}
          tableName={tableName}
          onCreated={refresh}
        />
      ) : null}
    </Card>
  );
}
