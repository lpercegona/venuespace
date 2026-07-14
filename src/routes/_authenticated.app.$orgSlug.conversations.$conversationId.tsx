import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { AppShell } from "@/components/venue/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConversationThread, type ThreadMessage } from "@/components/venue/conversation-thread";
import { getOrganizationBySlug } from "@/lib/orgs.functions";
import {
  getConversation, listMessages, sendMessage, setProposalStatus, setDealStatus,
} from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/conversations/$conversationId")({
  head: () => ({ meta: [{ title: "Conversa — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { orgSlug, conversationId } = Route.useParams();
  const qc = useQueryClient();

  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => getOrganizationBySlug({ data: { slug: orgSlug } }) });
  const conv = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation({ data: { id: conversationId } }),
  });
  const msgs = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => listMessages({ data: { conversation_id: conversationId } }),
    refetchInterval: 5000,
  });

  const [body, setBody] = useState("");
  const [type, setType] = useState<"text" | "proposal">("text");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim() || !org.data?.id) return;
    setSending(true);
    try {
      await sendMessage({
        data: {
          conversation_id: conversationId,
          organization_id: org.data.id,
          body,
          type,
          proposed_value: type === "proposal" ? Number(amount) : null,
        },
      });
      setBody(""); setAmount(""); setType("text");
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSending(false); }
  }

  async function accept(id: string) {
    try {
      await setProposalStatus({ data: { message_id: id, status: "accepted" } });
      if (conv.data?.record?.id) {
        await setDealStatus({ data: { record_id: conv.data.record.id, status: "accepted" } });
      }
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch (err) { toast.error((err as Error).message); }
  }
  async function decline(id: string) {
    try {
      await setProposalStatus({ data: { message_id: id, status: "declined" } });
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function moveDeal(status: "negotiating" | "accepted" | "declined" | "closed") {
    if (!conv.data?.record?.id) return;
    try {
      await setDealStatus({ data: { record_id: conv.data.record.id, status } });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  const record = conv.data?.record;
  const canEdit = org.data?.myRole === "owner" || org.data?.myRole === "editor";

  return (
    <AppShell
      title={conv.data?.conversation.title ?? "Conversa"}
      subtitle={conv.data?.conversation.lead_email ?? undefined}
      actions={
        <Link to="/app/$orgSlug/conversations" params={{ orgSlug }}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
      }
    >
      {record ? (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-2 py-4">
            <span className="text-sm text-muted-foreground">Negociação:</span>
            <Badge variant="outline">{record.deal_status}</Badge>
            {record.agreed_value != null ? (
              <Badge variant="secondary">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(record.agreed_value)}
              </Badge>
            ) : null}
            {canEdit ? (
              <div className="ml-auto flex flex-wrap gap-2">
                {record.deal_status !== "negotiating" ? (
                  <Button size="sm" variant="outline" onClick={() => moveDeal("negotiating")}>Reabrir</Button>
                ) : null}
                {record.deal_status !== "accepted" ? (
                  <Button size="sm" variant="outline" onClick={() => moveDeal("accepted")}>Marcar aceita</Button>
                ) : null}
                {record.deal_status !== "declined" ? (
                  <Button size="sm" variant="outline" onClick={() => moveDeal("declined")}>Marcar recusada</Button>
                ) : null}
                {record.deal_status === "accepted" ? (
                  <Button size="sm" onClick={() => moveDeal("closed")}>Fechar</Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {msgs.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <ConversationThread
          messages={(msgs.data ?? []) as ThreadMessage[]}
          currentRole="member"
          onAcceptProposal={canEdit ? accept : undefined}
          onDeclineProposal={canEdit ? decline : undefined}
        />
      )}

      <Card className="mt-4">
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
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva uma mensagem..." rows={4} />
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending || !body.trim()}>
              <Send className="h-4 w-4" />{sending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
