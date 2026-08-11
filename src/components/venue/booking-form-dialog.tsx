import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookingContactPicker, type ContactOption } from "@/components/venue/booking-contact-picker";
import { getBookingContext, createBooking, updateBooking } from "@/lib/bookings.functions";

export type BookingEditTarget = {
  id: string;
  data: Record<string, any>;
  items: Array<{ record_id: string }>;
  contact: { id: string } | null;
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/** Dialog de reserva manual (criação e edição): período, itens do orçamento e contato. */
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
  const [selected, setSelected] = useState<string[]>(
    () => (booking?.items ?? []).map((i) => i.record_id),
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
  const contacts = useMemo(
    () => [...extraContacts, ...((ctx.data?.contacts ?? []) as ContactOption[])],
    [extraContacts, ctx.data],
  );

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.label.toLowerCase().includes(t));
  }, [items, term]);

  const total = useMemo(
    () => items.filter((i) => selected.includes(i.id)).reduce((s, i) => s + (Number(i.value) || 0), 0),
    [items, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (selected.length === 0) {
      toast.error("Selecione ao menos um item para o orçamento.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateBooking({
          data: {
            id: booking!.id,
            data: period,
            item_record_ids: selected,
            contact_record_id: contactId,
          },
        });
      } else {
        await createBooking({
          data: {
            table_id: tableId,
            data: period,
            item_record_ids: selected,
            contact_record_id: contactId,
          },
        });
      }
      toast.success(editing ? "Reserva atualizada." : "Reserva criada em negociação.");
      onOpenChange(false);
      setSelected([]);
      setPeriod({});
      setContactId(null);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Editar reserva" : "Nova reserva"} — {tableName}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Altere período, itens e contato. O conflito de datas é verificado por item antes de salvar."
              : "A reserva nasce em negociação. O conflito de datas é verificado por item antes de salvar."}
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
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h3 className="min-w-0 truncate text-sm font-medium">Itens do orçamento</h3>
                <Badge variant="secondary" className="shrink-0">{selected.length} selecionado(s)</Badge>
              </div>
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
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum registro cadastrado nesta tabela para compor o orçamento.
                </p>
              ) : (
                <ScrollArea className="max-h-64 rounded-lg border border-border">
                  <ul className="divide-y divide-border">
                    {filtered.map((i) => {
                      const active = selected.includes(i.id);
                      return (
                        <li key={i.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                            <Checkbox checked={active} onCheckedChange={() => toggle(i.id)} />
                            <span className="min-w-0 flex-1 truncate text-sm">{i.label}</span>
                            <span className="shrink-0 text-sm text-muted-foreground">{brl(i.value)}</span>
                          </label>
                        </li>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum item encontrado.</li>
                    ) : null}
                  </ul>
                </ScrollArea>
              )}
            </section>

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
