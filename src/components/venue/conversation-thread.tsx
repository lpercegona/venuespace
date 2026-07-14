import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  sender_role: string;
  sender_email?: string | null;
  type: string;
  body: string;
  proposed_value?: number | null;
  proposal_status?: string | null;
  created_at: string;
};

export function ConversationThread({
  messages,
  currentRole,
  onAcceptProposal,
  onDeclineProposal,
}: {
  messages: ThreadMessage[];
  currentRole: "member" | "lead";
  onAcceptProposal?: (id: string) => void;
  onDeclineProposal?: (id: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Nenhuma mensagem ainda. Envie a primeira.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine =
          (currentRole === "member" && m.sender_role === "member") ||
          (currentRole === "lead" && m.sender_role === "lead");
        return (
          <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl border px-4 py-3 shadow-soft",
                mine
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border/60 bg-card text-foreground",
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">
                  {m.sender_role === "lead" ? (m.sender_email ?? "Interessado") : "Organização"}
                </span>
                <span>·</span>
                <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString("pt-BR")}</time>
                {m.type === "proposal" ? (
                  <Badge variant="secondary" className="ml-1">Proposta</Badge>
                ) : null}
              </div>

              {m.type === "proposal" ? (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Valor proposto: </span>
                    <span className="font-display text-lg font-semibold">
                      {m.proposed_value != null
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(m.proposed_value)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge
                      className={cn(
                        m.proposal_status === "accepted" && "bg-status-accepted text-white",
                        m.proposal_status === "declined" && "bg-status-declined text-white",
                      )}
                      variant={m.proposal_status === "pending" ? "outline" : "default"}
                    >
                      {m.proposal_status === "accepted" ? "Aceita"
                        : m.proposal_status === "declined" ? "Recusada"
                        : "Pendente"}
                    </Badge>
                    {!mine && m.proposal_status === "pending" && (onAcceptProposal || onDeclineProposal) ? (
                      <div className="ml-auto flex gap-1">
                        {onAcceptProposal ? (
                          <button
                            type="button"
                            onClick={() => onAcceptProposal(m.id)}
                            className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                          >Aceitar</button>
                        ) : null}
                        {onDeclineProposal ? (
                          <button
                            type="button"
                            onClick={() => onDeclineProposal(m.id)}
                            className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                          >Recusar</button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
