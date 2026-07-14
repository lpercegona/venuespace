import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { EmptyState } from "@/components/venue/empty-state";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  tableId: string;
  viewId: string;
  recordId?: string;
  tableName?: string;
};

async function fetchFormFields(viewId: string) {
  const res = await fetch(`/api/public/form-schema/${encodeURIComponent(viewId)}`);
  if (!res.ok) throw new Error("Falha ao carregar formulário");
  return res.json() as Promise<{
    fields: Array<{ id: string; key: string; label: string; type: string; required: boolean; position: number; config: any }>;
  }>;
}

export function InterestFormModal({ open, onOpenChange, slug, tableId, viewId, recordId, tableName }: Props) {
  const navigate = useNavigate();
  const schema = useQuery({
    queryKey: ["public-form", viewId],
    queryFn: () => fetchFormFields(viewId),
    enabled: open,
    staleTime: 60_000,
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: Record<string, any>) {
    if (!email || !/.+@.+\..+/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSubmitting(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/${encodeURIComponent(tableId)}/submit`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            view_id: viewId,
            source_record_id: recordId ?? null,
            contact_email: email,
            contact_name: name || undefined,
            data: values,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar");
      toast.success("Enviado! Abrindo sua conversa.");
      onOpenChange(false);
      if (json.lead_token) {
        navigate({ to: "/lead/$token", params: { token: json.lead_token } });
      } else {
        toast.message("Acompanhe em Minhas candidaturas.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Manifestar interesse</DialogTitle>
          <DialogDescription>
            {tableName ? `Envie seu contato para ${tableName}.` : "Envie seu contato para iniciar a conversa."}
          </DialogDescription>
        </DialogHeader>
        {schema.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : schema.error || !schema.data ? (
          <EmptyState
            title="Formulário indisponível"
            description={(schema.error as Error | undefined)?.message ?? "Tente novamente em instantes."}
          />
        ) : (
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="ifm_name">Nome</Label>
                  <Input id="ifm_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ifm_email">E-mail *</Label>
                  <Input
                    id="ifm_email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
              </div>
              <div className="border-t border-border/60 pt-4">
                <DynamicForm
                  fields={schema.data.fields as any}
                  onSubmit={handleSubmit}
                  submitLabel={submitting ? "Enviando..." : "Enviar"}
                  disableUploads
                  disableOptionEditing
                />
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
