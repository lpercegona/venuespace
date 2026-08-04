import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InterestForm } from "@/components/venue/interest-form";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  tableId: string;
  viewId: string;
  recordId?: string;
  tableName?: string;
};

export function InterestFormModal({ open, onOpenChange, slug, tableId, viewId, recordId, tableName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Manifestar interesse</DialogTitle>
          <DialogDescription>
            {tableName ? `Envie seu contato para ${tableName}.` : "Envie seu contato para iniciar a conversa."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2">
          <InterestForm
            slug={slug}
            tableId={tableId}
            viewId={viewId}
            recordId={recordId}
            enabled={open}
            onSubmitted={() => onOpenChange(false)}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
