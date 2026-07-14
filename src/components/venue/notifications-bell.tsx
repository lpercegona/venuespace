import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listUnreadForOrg } from "@/lib/applications.functions";

export function NotificationsBell({ organizationId, orgSlug }: { organizationId: string; orgSlug: string }) {
  const q = useQuery({
    queryKey: ["unread", organizationId],
    queryFn: () => listUnreadForOrg({ data: { organization_id: organizationId } }),
    refetchInterval: 15000,
  });
  const count = q.data?.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {count > 0 ? (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">{count}</Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-3">
          <p className="font-display text-sm font-semibold">Mensagens não lidas</p>
        </div>
        <ScrollArea className="max-h-80">
          {q.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : count === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nada novo.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((m: any) => (
                <li key={m.id}>
                  <Link
                    to="/app/$orgSlug/conversations/$conversationId"
                    params={{ orgSlug, conversationId: m.conversation_id }}
                    className="block p-3 hover:bg-accent"
                  >
                    <p className="truncate text-xs text-muted-foreground">{m.conversation?.title ?? "Conversa"}</p>
                    <p className="line-clamp-2 text-sm text-foreground">{m.type === "proposal" ? "Nova proposta" : m.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
