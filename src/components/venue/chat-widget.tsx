import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ConversationThread, type ThreadMessage } from "./conversation-thread";
import {
  listConversations, getConversation, listMessages, sendMessage,
  setProposalStatus, setDealStatus,
} from "@/lib/messages.functions";
import { useFormatContext } from "@/hooks/use-instance-context";
import { formatCurrency, formatDateTime } from "@/lib/formatting";
import type { CurrencyDisplay } from "@/lib/instance-settings.functions";

type OrgOverrides = { timezone?: string | null; currency?: string | null; currency_display?: CurrencyDisplay | null } | null;
type Props = { organizationId: string; org?: OrgOverrides };

export function ChatWidget({ organizationId, org }: Props) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const qc = useQueryClient();
  const formatCtx = useFormatContext(org ?? null);

  const list = useQuery({
    queryKey: ["conversations", organizationId],
    queryFn: () => listConversations({ data: { organization_id: organizationId } }),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir chat"
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-14 sm:w-14"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setActiveId(null); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-2">
              {activeId ? (
                <Button variant="ghost" size="icon" onClick={() => setActiveId(null)} aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <p className="truncate font-display text-base font-semibold">
                {activeId ? "Conversa" : "Conversas"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!activeId ? (
            <div className="flex-1 overflow-y-auto">
              {list.isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (list.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Sem conversas ainda.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(list.data ?? []).map((c: any) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className="block w-full px-4 py-3 text-left hover:bg-accent"
                      >
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lead_email ?? "—"} · {formatDateTime(c.updated_at, formatCtx)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ChatPane
              organizationId={organizationId}
              conversationId={activeId}
              formatCtx={formatCtx}
              onChange={() => qc.invalidateQueries({ queryKey: ["conversations", organizationId] })}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ChatPane({
  organizationId, conversationId, onChange, formatCtx,
}: { organizationId: string; conversationId: string; onChange: () => void; formatCtx: import("@/lib/formatting").FormatContext }) {
  const qc = useQueryClient();
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
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        data: {
          conversation_id: conversationId,
          organization_id: organizationId,
          body,
          type,
          proposed_value: type === "proposal" ? Number(amount) : null,
        },
      });
      setBody(""); setAmount(""); setType("text");
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      onChange();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSending(false); }
  }

  async function accept(id: string) {
    try {
      await setProposalStatus({ data: { message_id: id, status: "accepted" } });
      if (conv.data?.record?.id) await setDealStatus({ data: { record_id: conv.data.record.id, status: "accepted" } });
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

  const record = conv.data?.record;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-2">
        <p className="truncate text-sm font-medium">{conv.data?.conversation.title ?? "Conversa"}</p>
        {record ? (
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            <Badge variant="outline">{record.deal_status}</Badge>
            {record.agreed_value != null ? (
              <Badge variant="secondary">
                {formatCurrency(record.agreed_value, formatCtx)}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {msgs.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ConversationThread
            messages={(msgs.data ?? []) as ThreadMessage[]}
            currentRole="member"
            onAcceptProposal={accept}
            onDeclineProposal={decline}
            formatCtx={formatCtx}
          />
        )}
      </div>
      <div className="space-y-2 border-t border-border p-4">
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setType("text")}
            className={`rounded-md border px-2 py-1 ${type === "text" ? "border-primary bg-primary/10" : "border-input"}`}>Texto</button>
          <button type="button" onClick={() => setType("proposal")}
            className={`rounded-md border px-2 py-1 ${type === "proposal" ? "border-primary bg-primary/10" : "border-input"}`}>Proposta</button>
        </div>
        {type === "proposal" ? (
          <Input type="number" step="0.01" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        ) : null}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensagem..." rows={2} />
        <div className="flex justify-end">
          <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
            <Send className="h-4 w-4" />{sending ? "..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
