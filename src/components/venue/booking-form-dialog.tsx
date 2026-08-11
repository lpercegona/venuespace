import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { getBookingContext, createBooking } from "@/lib/bookings.functions";

/** Dialog de nova reserva manual: usa todos os campos configurados da tabela reservável. */
export function BookingFormDialog({
  open,
  onOpenChange,
  tableId,
  tableName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableId: string;
  tableName: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const ctx = useQuery({
    queryKey: ["booking-context", tableId],
    queryFn: () => getBookingContext({ data: { table_id: tableId } }),
    enabled: open,
  });

  async function submit(values: Record<string, any>) {
    setSaving(true);
    try {
      await createBooking({ data: { table_id: tableId, data: values } });
      toast.success("Reserva criada em negociação.");
      onOpenChange(false);
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
          <DialogTitle className="font-display">Nova reserva — {tableName}</DialogTitle>
          <DialogDescription>
            A reserva nasce em negociação. O conflito de datas é verificado antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {ctx.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ctx.isError ? (
          <p className="text-sm text-destructive">{(ctx.error as Error).message}</p>
        ) : (
          <DynamicForm
            fields={(ctx.data?.meta.fields ?? []) as any}
            submitLabel={saving ? "Salvando..." : "Criar reserva"}
            onCancel={() => onOpenChange(false)}
            onSubmit={submit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
