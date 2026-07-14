import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { EmptyState } from "@/components/venue/empty-state";

const searchSchema = z.object({
  view: z.string().uuid(),
  record: z.string().uuid().optional(),
});

type Payload = {
  public_form_view: { id: string } | null;
};

async function fetchPublic(slug: string, tableId: string) {
  const res = await fetch(`/api/public/${encodeURIComponent(slug)}/${encodeURIComponent(tableId)}`);
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json() as Promise<Payload & { organization: { name: string }; table: { name: string } }>;
}

// Fetch submissions schema by calling the same endpoint but resolving via view id — we expose fields for the source table only via the payload; for the form we need the submission-table fields, which we resolve server-side. Add a dedicated route.

async function fetchFormFields(viewId: string) {
  const res = await fetch(`/api/public/form-schema/${encodeURIComponent(viewId)}`);
  if (!res.ok) throw new Error("Falha ao carregar formulário");
  return res.json() as Promise<{ fields: Array<{ id: string; key: string; label: string; type: string; required: boolean; position: number; config: any }> }>;
}

export const Route = createFileRoute("/public/$slug/$tableId/form")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Manifestar interesse — Venuespace" }] }),
  component: PublicFormPage,
});

function PublicFormPage() {
  const { slug, tableId } = Route.useParams();
  const { view: viewId, record: recordId } = Route.useSearch();
  const navigate = useNavigate();

  const meta = useQuery({ queryKey: ["public", slug, tableId], queryFn: () => fetchPublic(slug, tableId) });
  const schema = useQuery({ queryKey: ["public-form", viewId], queryFn: () => fetchFormFields(viewId) });

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
      const res = await fetch(`/api/public/${encodeURIComponent(slug)}/${encodeURIComponent(tableId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          view_id: viewId,
          source_record_id: recordId ?? null,
          contact_email: email,
          contact_name: name || undefined,
          data: values,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar");
      toast.success("Enviado! Abrindo sua conversa.");
      if (json.lead_token) {
        navigate({ to: "/lead/$token", params: { token: json.lead_token } });
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (meta.isLoading || schema.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (meta.error || schema.error || !schema.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title="Formulário indisponível" description={(meta.error as Error | undefined)?.message ?? (schema.error as Error | undefined)?.message ?? "Erro"} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{meta.data?.organization.name}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">Manifestar interesse</h1>
          <p className="mt-2 text-sm text-muted-foreground">{meta.data?.table.name}</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader><CardTitle className="font-display">Seus dados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="contact_name">Nome</Label>
                <Input id="contact_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_email">E-mail *</Label>
                <Input id="contact_email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
            </div>
            <div className="border-t border-border/60 pt-4">
              <DynamicForm
                fields={schema.data.fields as any}
                onSubmit={handleSubmit}
                submitLabel={submitting ? "Enviando..." : "Enviar"}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
