import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { EmptyState } from "@/components/venue/empty-state";

async function fetchFormFields(viewId: string) {
  const res = await fetch(`/api/public/form-schema/${encodeURIComponent(viewId)}`);
  if (!res.ok) throw new Error("Falha ao carregar formulário");
  return res.json() as Promise<{
    fields: Array<{ id: string; key: string; label: string; type: string; required: boolean; position: number; config: any }>;
  }>;
}

export type InterestFormProps = {
  slug: string;
  tableId: string;
  viewId: string;
  recordId?: string;
  /** Só carrega o schema quando habilitado (usado pelo modal). */
  enabled?: boolean;
  /** Empilha nome e e-mail em coluna única (card lateral). */
  stacked?: boolean;
  submitLabel?: string;
  onSubmitted?: () => void;
};

/**
 * Formulário público de interesse, compartilhado entre o modal (Layout 1)
 * e o card lateral inline (Layout 2).
 */
export function InterestForm({
  slug,
  tableId,
  viewId,
  recordId,
  enabled = true,
  stacked = false,
  submitLabel,
  onSubmitted,
}: InterestFormProps) {
  const navigate = useNavigate();
  const schema = useQuery({
    queryKey: ["public-form", viewId],
    queryFn: () => fetchFormFields(viewId),
    enabled,
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
      onSubmitted?.();
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

  if (schema.isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (schema.error || !schema.data) {
    return (
      <EmptyState
        title="Formulário indisponível"
        description={(schema.error as Error | undefined)?.message ?? "Tente novamente em instantes."}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className={stacked ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        <div className="space-y-1">
          <Label htmlFor={`ifm_name_${viewId}`}>Nome</Label>
          <Input id={`ifm_name_${viewId}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ifm_email_${viewId}`}>E-mail *</Label>
          <Input
            id={`ifm_email_${viewId}`}
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
          submitLabel={submitting ? "Enviando..." : (submitLabel ?? "Enviar")}
          disableUploads
          disableOptionEditing
        />
      </div>
    </div>
  );
}
