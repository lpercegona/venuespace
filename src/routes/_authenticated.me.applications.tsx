import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle } from "lucide-react";
import { getMyApplications } from "@/lib/applications.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormatContext, useLabels } from "@/hooks/use-instance-context";
import { formatCurrency, formatDateTime } from "@/lib/formatting";

export const Route = createFileRoute("/_authenticated/me/applications")({
  head: () => ({ meta: [{ title: "Minhas candidaturas — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: MyApplicationsPage,
});

function MyApplicationsPage() {
  const q = useQuery({ queryKey: ["my-applications"], queryFn: () => getMyApplications() });
  const formatCtx = useFormatContext(null);
  const { t } = useLabels();

  return (
    <AppShell title="Minhas candidaturas" subtitle="Tudo o que você enviou por formulários públicos.">
      {q.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState title="Você ainda não enviou nada" description="Ao manifestar interesse em algum registro público, ele aparecerá aqui." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {q.data.map((r: any) => (
            <li key={r.id}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {r.table?.organization?.name}
                  </p>
                  <CardTitle className="font-display text-base">{r.table?.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{r.deal_status}</Badge>
                    {r.agreed_value ? <Badge>{formatCurrency(Number(r.agreed_value), formatCtx)}</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enviado em {formatDateTime(r.created_at, formatCtx)}
                  </p>
                  {r.conversation_id ? (
                    <Link to="/lead/$token" params={{ token: `applicant-${r.conversation_id}` }} className="pointer-events-none">
                      {/* placeholder — applicants use in-app auth */}
                    </Link>
                  ) : null}
                  {r.conversation_id ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={`/app/${r.table?.organization?.slug}/conversations/${r.conversation_id}`}>
                        <MessageCircle className="h-4 w-4" /> Ver conversa
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
