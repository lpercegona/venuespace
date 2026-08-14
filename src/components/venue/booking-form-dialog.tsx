import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingContactPicker, type ContactOption } from "@/components/venue/booking-contact-picker";
import { getBookingContext, createBooking, updateBooking, listAvailableResources } from "@/lib/bookings.functions";

export type BookingItemValue = {
  record_id: string;
  daily_value: number;
  days: number;
  discount: number;
  discount_type: "amount" | "percent";
  note: string | null;
  courtesy: string | null;
};

export type BookingEditTarget = {
  id: string;
  data: Record<string, any>;
  items: BookingItemValue[];
  contact: { id: string } | null;
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 1;
  const a = new Date(String(start).slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(String(end).slice(0, 10) + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function itemTotal(v: BookingItemValue) {
  const sub = (Number(v.daily_value) || 0) * Math.max(1, Number(v.days) || 1);
  const d = Number(v.discount) || 0;
  const disc = d <= 0 ? 0 : v.discount_type === "percent" ? Math.min(sub, (sub * d) / 100) : Math.min(sub, d);
  return Math.max(0, sub - disc);
}

/** Dialog de reserva manual (criação e edição): período, itens disponíveis, valores e contato. */
export function BookingFormDialog({
  open,
  onOpenChange,
  tableId,
  tableName,
  onCreated,
  booking,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableId: string;
  tableName: string;
  onCreated: () => void;
  booking?: BookingEditTarget | null;
}) {
  const editing = !!booking;
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<Record<string, any>>(() => ({ ...(booking?.data ?? {}) }));
  const [values, setValues] = useState<Record<string, BookingItemValue>>(() =>
    Object.fromEntries((booking?.items ?? []).map((i) => [i.record_id, i])),
  );
  const [term, setTerm] = useState("");
  const [contactId, setContactId] = useState<string | null>(booking?.contact?.id ?? null);
  const [extraContacts, setExtraContacts] = useState<ContactOption[]>([]);

  const ctx = useQuery({
    queryKey: ["booking-context", tableId],
    queryFn: () => getBookingContext({ data: { table_id: tableId } }),
    enabled: open,
  });

  const items = ctx.data?.items ?? [];
  const periodFields = ctx.data?.periodFields ?? [];
  const meta = ctx.data?.meta;
  const start = meta?.startKey ? period[meta.startKey] : null;
  const end = meta?.endKey ? period[meta.endKey] : null;
  const hasPeriod = !!start && !!end;
  const days = daysBetween(start, end);

  const availability = useQuery({
    queryKey: ["booking-availability-form", tableId, start, end, booking?.id ?? null],
    queryFn: () =>
      listAvailableResources({
        data: { table_id: tableId, from: String(start), to: String(end), exclude_record_id: booking?.id ?? null },
      }),
    enabled: open && hasPeriod,
  });

  const busyIds = useMemo(
    () => new Set((availability.data?.busy ?? []).map((r: any) => r.id)),
    [availability.data],
  );

  // Ao mudar o período, desmarca itens que ficaram indisponíveis.
  useEffect(() => {
    if (!availability.data) return;
    const conflicting = Object.keys(values).filter((id) => busyIds.has(id));
    if (conflicting.length > 0) {
      setValues((prev) => {
        const copy = { ...prev };
        for (const id of conflicting) delete copy[id];
        return copy;
      });
      toast.warning("Itens indisponíveis no novo período foram desmarcados.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.data]);

  const contacts = useMemo(
    () => [...extraContacts, ...((ctx.data?.contacts ?? []) as ContactOption[])],
    [extraContacts, ctx.data],
  );

  const visible = useMemo(() => {
    const t = term.trim().toLowerCase();
    const base = items.filter((i) => !busyIds.has(i.id) || !!values[i.id]);
    return t ? base.filter((i) => i.label.toLowerCase().includes(t)) : base;
  }, [items, term, busyIds, values]);

  const selected = Object.values(values);
  const itemsTotal = selected.reduce((s, v) => s + itemTotal(v), 0);
  const travelFee = Math.max(0, Number(period["travel_fee"] ?? 0) || 0);
  const total = itemsTotal + travelFee;

  function toggle(id: string, defaultValue: number) {
    setValues((prev) => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id];
      else
        copy[id] = {
          record_id: id,
          daily_value: defaultValue,
          days,
          discount: 0,
          discount_type: "amount",
          note: null,
          courtesy: null,
        };
      return copy;
    });
  }

  function patch(id: string, part: Partial<BookingItemValue>) {
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...part } }));
  }

  async function submit() {
    if (periodFields.length > 0 && !hasPeriod) {
      toast.error("Informe o período da reserva (início e término).");
      return;
    }
    if (selected.length === 0) {
      toast.error("Selecione ao menos um item para o orçamento.");
      return;
    }
    setSaving(true);
    try {
      const payloadItems = selected.map((v) => ({
        record_id: v.record_id,
        daily_value: Number(v.daily_value) || 0,
        days: Math.max(1, Number(v.days) || 1),
        discount: Number(v.discount) || 0,
        discount_type: v.discount_type,
        note: v.note?.trim() ? v.note.trim() : null,
        courtesy: v.courtesy?.trim() ? v.courtesy.trim() : null,
      }));
      if (editing) {
        await updateBooking({
          data: { id: booking!.id, data: period, items: payloadItems, contact_record_id: contactId },
        });
      } else {
        await createBooking({
          data: { table_id: tableId, data: period, items: payloadItems, contact_record_id: contactId },
        });
      }
      toast.success(editing ? "Reserva atualizada." : "Reserva criada em negociação.");
      onOpenChange(false);
      setValues({});
      setPeriod({});
      setContactId(null);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const otherFields = (meta?.fields ?? []).filter(
    (f: any) => f.key === "event_location" || f.key === "booking_notes",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Editar reserva" : "Nova reserva"} — {tableName}
          </DialogTitle>
          <DialogDescription>
            Informe o período: apenas os itens disponíveis nessas datas ficam selecionáveis.
          </DialogDescription>
        </DialogHeader>

        {ctx.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ctx.isError ? (
          <p className="text-sm text-destructive">{(ctx.error as Error).message}</p>
        ) : (
          <div className="space-y-6">
            {periodFields.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Período</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {periodFields.map((f: any) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label htmlFor={`bkp-${f.key}`} className="text-xs text-muted-foreground">{f.label}</Label>
                      <Input
                        id={`bkp-${f.key}`}
                        type={f.type === "datetime" ? "datetime-local" : "date"}
                        className="h-11 sm:h-10"
                        value={period[f.key] ?? ""}
                        onChange={(e) => setPeriod((p) => ({ ...p, [f.key]: e.target.value || null }))}
                      />
                    </div>
                  ))}
                </div>
                {hasPeriod ? (
                  <p className="text-xs text-muted-foreground">{days} diária(s) no período selecionado.</p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h3 className="min-w-0 truncate text-sm font-medium">Itens do orçamento</h3>
                <Badge variant="secondary" className="shrink-0">{selected.length} selecionado(s)</Badge>
              </div>

              {!hasPeriod && periodFields.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Informe o período para listar os itens disponíveis.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 pl-9 sm:h-10"
                      placeholder={`Buscar em ${tableName}`}
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      aria-label="Buscar item"
                    />
                  </div>
                  {availability.isFetching ? (
                    <p className="text-xs text-muted-foreground">Verificando disponibilidade...</p>
                  ) : null}
                  {visible.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum item disponível no período selecionado.
                    </p>
                  ) : (
                    <ScrollArea className="max-h-80 rounded-lg border border-border">
                      <ul className="divide-y divide-border">
                        {visible.map((i) => {
                          const v = values[i.id];
                          return (
                            <li key={i.id} className="space-y-3 px-3 py-2">
                              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                                <Checkbox checked={!!v} onCheckedChange={() => toggle(i.id, i.value)} />
                                <span className="min-w-0 flex-1 truncate text-sm">{i.label}</span>
                                <span className="shrink-0 text-sm text-muted-foreground">{brl(i.value)}</span>
                              </label>

                              {v ? (
                                <div className="space-y-3 rounded-md border border-border p-3">
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Valor diária</Label>
                                      <Input
                                        type="number" min={0} step="0.01" className="h-10"
                                        value={v.daily_value}
                                        onChange={(e) => patch(i.id, { daily_value: Number(e.target.value) || 0 })}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Diárias</Label>
                                      <Input
                                        type="number" min={1} step="1" className="h-10"
                                        value={v.days}
                                        onChange={(e) => patch(i.id, { days: Math.max(1, Number(e.target.value) || 1) })}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Desconto</Label>
                                      <div className="flex gap-2">
                                        <Input
                                          type="number" min={0} step="0.01" className="h-10"
                                          value={v.discount}
                                          onChange={(e) => patch(i.id, { discount: Number(e.target.value) || 0 })}
                                        />
                                        <Select
                                          value={v.discount_type}
                                          onValueChange={(x) => patch(i.id, { discount_type: x as "amount" | "percent" })}
                                        >
                                          <SelectTrigger className="h-10 w-20"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="amount">R$</SelectItem>
                                            <SelectItem value="percent">%</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Observações do item</Label>
                                    <Textarea
                                      rows={2}
                                      value={v.note ?? ""}
                                      onChange={(e) => patch(i.id, { note: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Cortesia (opcional)</Label>
                                    <Input
                                      className="h-10"
                                      placeholder="Suporte tripé sem custo adicional"
                                      value={v.courtesy ?? ""}
                                      onChange={(e) => patch(i.id, { courtesy: e.target.value })}
                                    />
                                  </div>
                                  <p className="text-right text-sm">
                                    <span className="text-muted-foreground">Total do item: </span>
                                    <span className="font-medium">{brl(itemTotal(v))}</span>
                                  </p>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  )}
                </>
              )}
            </section>

            {otherFields.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Detalhes da reserva</h3>
                {otherFields.map((f: any) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label htmlFor={`bkf-${f.key}`} className="text-xs text-muted-foreground">{f.label}</Label>
                    <Textarea
                      id={`bkf-${f.key}`}
                      rows={f.key === "booking_notes" ? 4 : 2}
                      value={period[f.key] ?? ""}
                      onChange={(e) => setPeriod((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-medium">Contato</h3>
              <BookingContactPicker
                organizationId={ctx.data!.table.organization_id}
                contacts={contacts}
                schema={(ctx.data?.contactSchema ?? []) as any}
                value={contactId}
                onChange={setContactId}
                onCreated={(c) => setExtraContacts((prev) => [c, ...prev])}
              />
            </section>

            <DialogFooter className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
              <p className="min-w-0 truncate text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">{brl(total)}</span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="button" className="h-11 sm:h-10" disabled={saving} onClick={submit}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar reserva"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
