import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConversationThread, type ThreadMessage } from "@/components/venue/conversation-thread";
import { EmptyState } from "@/components/venue/empty-state";
import { PublicHeader } from "@/components/venue/public-header";
import { useFormatContext } from "@/hooks/use-instance-context";
import { formatCurrency } from "@/lib/formatting";

type Payload = {
  conversation: { id: string; title: string; lead_email: string };
  organization: { slug: string; name: string } | null;
  record: { id: string; deal_status: string; agreed_value: number | null; data: Record<string, any> } | null;
  messages: ThreadMessage[];
};

async function fetchLead(token: string): Promise<Payload> {
  const res = await fetch(`/api/public/lead/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Token inválido");
  return res.json();
}

export const Route = createFileRoute("/lead/$token")({
  head: () => ({ meta: [{ title: "Sua conversa — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: LeadPage,
});

function LeadPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lead", token],
    queryFn: () => fetchLead(token),
    refetchInterval: 5000,
  });
  const formatCtx = useFormatContext(null);


  const [body, setBody] = useState("");
  const [type, setType] = useState<"text" | "proposal">("text");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/public/lead/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          type,
          proposed_value: type === "proposal" ? Number(amount) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar");
      setBody("");
      setAmount("");
      setType("text");
      qc.invalidateQueries({ queryKey: ["lead", token] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (q.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (q.error || !q.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title="Link inválido" description={(q.error as Error | undefined)?.message ?? "Este link expirou ou não é válido."} />
      </div>
    );
  }

  const { conversation, organization, record, messages } = q.data;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{organization?.name}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{conversation.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{conversation.lead_email}</p>
          {record ? (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline">Status: {record.deal_status}</Badge>
              {record.agreed_value != null ? (
                <Badge variant="secondary">
                  Valor acordado: {formatCurrency(record.agreed_value, formatCtx)}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <ConversationThread messages={messages} currentRole="lead" formatCtx={formatCtx} />

        <Card>
          <CardHeader><CardTitle className="font-display text-base">Nova mensagem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setType("text")}
                className={`rounded-md border px-3 py-1 ${type === "text" ? "border-primary bg-primary/10" : "border-input"}`}>
                Texto
              </button>
              <button type="button" onClick={() => setType("proposal")}
                className={`rounded-md border px-3 py-1 ${type === "proposal" ? "border-primary bg-primary/10" : "border-input"}`}>
                Proposta
              </button>
            </div>
            {type === "proposal" ? (
              <Input type="number" step="0.01" placeholder="Valor proposto (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            ) : null}
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva sua mensagem..." rows={4} />
            <div className="flex justify-end">
              <Button onClick={send} disabled={sending || !body.trim()}>
                <Send className="h-4 w-4" />
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
