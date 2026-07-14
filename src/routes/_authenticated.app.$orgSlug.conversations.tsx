import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOrganizationBySlug } from "@/lib/orgs.functions";
import { listConversations } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/conversations")({
  head: () => ({ meta: [{ title: "Conversas — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const { orgSlug } = Route.useParams();
  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => getOrganizationBySlug({ data: { slug: orgSlug } }) });
  const list = useQuery({
    queryKey: ["conversations", org.data?.id],
    queryFn: () => listConversations({ data: { organization_id: org.data!.id } }),
    enabled: !!org.data?.id,
    refetchInterval: 5000,
  });

  return (
    <AppShell
      title="Conversas"
      subtitle={org.data?.name ?? undefined}
      actions={
        <Link to="/app/$orgSlug" params={{ orgSlug }}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
      }
    >
      {list.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-5 w-5" />}
          title="Sem conversas ainda"
          description="Assim que alguém enviar um formulário público, a conversa aparecerá aqui."
        />
      ) : (
        <ul className="grid gap-3">
          {(list.data ?? []).map((c: any) => (
            <li key={c.id}>
              <Link to="/app/$orgSlug/conversations/$conversationId" params={{ orgSlug, conversationId: c.id }}>
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lead_email ?? "—"} · atualizada {new Date(c.updated_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <MessageCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
