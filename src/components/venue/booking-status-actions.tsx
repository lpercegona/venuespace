import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, FileText, Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setDealStatus } from "@/lib/messages.functions";
import { archiveBooking, deleteBooking, generateBookingQuote, getQuoteUrl } from "@/lib/bookings.functions";

export type BookingItem = {
  id: string;
  deal_status: string;
  status: string;
  conversation_id: string | null;
  quotes: Array<{ path: string; total: number; created_at: string }>;
};

export const DEAL_LABEL: Record<string, string> = {
  none: "Sem negociação",
  negotiating: "Negociação",
  accepted: "Fechada",
  declined: "Recusada",
  closed: "Encerrada",
};

export function DealBadge({ dealStatus, archived }: { dealStatus: string; archived?: boolean }) {
  const variant =
    dealStatus === "accepted" ? "default"
    : dealStatus === "closed" ? "secondary"
    : dealStatus === "declined" ? "destructive"
    : "outline";
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={variant as any}>{DEAL_LABEL[dealStatus] ?? dealStatus}</Badge>
      {archived ? <Badge variant="outline">Arquivada</Badge> : null}
    </span>
  );
}

/** Ações do ciclo de vida da reserva + geração de orçamento em PDF. */
export function BookingStatusActions({
  booking,
  orgSlug,
  canEdit,
  onChanged,
  onEdit,
}: {
  booking: BookingItem;
  orgSlug: string;
  canEdit: boolean;
  onChanged: () => void;
  onEdit?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notes, setNotes] = useState("");

  async function remove() {
    setBusy(true);
    try {
      await deleteBooking({ data: { id: booking.id } });
      toast.success("Reserva excluída.");
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function move(status: "negotiating" | "accepted" | "declined" | "closed") {
    setBusy(true);
    try {
      await setDealStatus({ data: { record_id: booking.id, status } });
      if (status === "declined") {
        await archiveBooking({ data: { id: booking.id, archived: true } });
      }
      toast.success("Situação da reserva atualizada.");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(archived: boolean) {
    setBusy(true);
    try {
      await archiveBooking({ data: { id: booking.id, archived } });
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await generateBookingQuote({
        data: { record_id: booking.id, notes: notes.trim() || null },
      });
      toast.success("Orçamento gerado e enviado como proposta.");
      setQuoteOpen(false);
      setNotes("");
      onChanged();
      const signed = await getQuoteUrl({ data: { path: res.path } });
      if (signed.url) window.open(signed.url, "_blank", "noopener");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openQuote(path: string) {
    try {
      const signed = await getQuoteUrl({ data: { path } });
      if (signed.url) window.open(signed.url, "_blank", "noopener");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const archived = booking.status === "archived";
  const last = booking.quotes.at(-1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {booking.conversation_id ? (
        <Link
          to="/app/$orgSlug/conversations/$conversationId"
          params={{ orgSlug, conversationId: booking.conversation_id }}
        >
          <Button size="sm" variant="ghost" className="h-9">
            <MessageSquare className="h-4 w-4" />Conversa
          </Button>
        </Link>
      ) : null}

      {last ? (
        <Button size="sm" variant="ghost" className="h-9" onClick={() => openQuote(last.path)}>
          <FileText className="h-4 w-4" />Último orçamento
        </Button>
      ) : null}

      {canEdit ? (
        <>
          {onEdit ? (
            <Button size="sm" variant="ghost" className="h-9" disabled={busy} onClick={onEdit}>
              <Pencil className="h-4 w-4" />Editar
            </Button>
          ) : null}

          <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => setQuoteOpen(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Gerar orçamento
          </Button>

          {booking.deal_status !== "accepted" && booking.deal_status !== "closed" ? (
            <Button size="sm" className="h-9" disabled={busy} onClick={() => move("accepted")}>
              Fechar reserva
            </Button>
          ) : null}

          {booking.deal_status === "accepted" ? (
            <Button size="sm" className="h-9" disabled={busy} onClick={() => move("closed")}>
              Encerrar (serviço entregue)
            </Button>
          ) : null}

          {booking.deal_status !== "declined" && booking.deal_status !== "closed" ? (
            <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => move("declined")}>
              Recusar e arquivar
            </Button>
          ) : null}

          {archived ? (
            <Button size="sm" variant="ghost" className="h-9" disabled={busy} onClick={() => toggleArchive(false)}>
              <ArchiveRestore className="h-4 w-4" />Desarquivar
            </Button>
          ) : booking.deal_status === "declined" ? (
            <Button size="sm" variant="ghost" className="h-9" disabled={busy} onClick={() => toggleArchive(true)}>
              <Archive className="h-4 w-4" />Arquivar
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />Excluir
          </Button>
        </>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              A reserva, a conversa vinculada, as mensagens e os orçamentos gerados serão removidos
              definitivamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); remove(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Gerar orçamento em PDF</DialogTitle>
            <DialogDescription>
              O PDF soma os valores monetários da reserva, é salvo em arquivos privados e enviado como
              proposta na conversa.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuoteOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Gerar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
