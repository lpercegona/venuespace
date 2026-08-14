import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/venue/empty-state";
import { PublicBreadcrumbs } from "@/components/venue/public-breadcrumbs";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { useFormatContext } from "@/hooks/use-instance-context";
import { formatCurrency } from "@/lib/formatting";

type Payload = {
  organization: { id: string; slug: string; name: string };
  table: { id: string; name: string };
  campaign: { id: string; data: Record<string, any> };
  fields: Array<{ id: string; key: string; label: string; type: string; config: any }>;
  form: { view_id: string; submissions_table_id: string } | null;
  progress: { confirmed_total: number; count: number };
};

async function fetchCampaign(recordId: string): Promise<Payload> {
  const res = await fetch(`/api/public/campaigns/${encodeURIComponent(recordId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao carregar");
  return res.json();
}

export const Route = createFileRoute("/public/$slug/campaigns/$recordId")({
  head: ({ params }) => ({
    meta: [
      { title: `Campanha — ${params.slug} — Venuespace` },
      { name: "description", content: "Apoie esta campanha no Venuespace." },
      { property: "og:title", content: `Campanha — ${params.slug}` },
      { property: "og:description", content: "Apoie esta campanha no Venuespace." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CampaignPage,
});

function CampaignPage() {
  const { recordId } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["campaign", recordId], queryFn: () => fetchCampaign(recordId) });
  const formatCtx = useFormatContext(null);

  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (q.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (q.error || !q.data) return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState title="Campanha indisponível" description={(q.error as Error | undefined)?.message ?? "Erro"} />
    </div>
  );

  const c = q.data.campaign.data ?? {};
  const title = String(c.title ?? c.nome ?? c.name ?? "Campanha");
  const description = String(c.description ?? c.descricao ?? "");
  const goal = Number(c.goal ?? c.meta ?? 0);
  const pixKey = String(c.pix_key ?? c.chave_pix ?? "");
  const confirmed = q.data.progress.confirmed_total;
  const pct = goal > 0 ? Math.min(100, Math.round((confirmed / goal) * 100)) : 0;

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("Informe um valor válido."); return; }
    if (!/.+@.+\..+/.test(email)) { toast.error("E-mail inválido."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/campaigns/${encodeURIComponent(recordId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, contact_email: email, contact_name: name || undefined, message: msg || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha");
      toast.success("Contribuição registrada. Aguardando confirmação.");
      if (json.lead_token) navigate({ to: "/lead/$token", params: { token: json.lead_token } });
      setAmount(""); setMsg("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <PublicBreadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: q.data.organization.name, to: "/public/$slug", params: { slug: q.data.organization.slug } },
          { label: title },
        ]}
      />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <BackLink to="/explore" label="Explorar" />
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{q.data.organization.name}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle className="font-display">Progresso</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Progress value={pct} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">{formatCurrency(confirmed, formatCtx)} confirmados</span>
              {goal > 0 ? <span className="text-muted-foreground">Meta: {formatCurrency(goal, formatCtx)}</span> : null}
            </div>
            <Badge variant="secondary">{q.data.progress.count} contribuições confirmadas</Badge>
            {pixKey ? (
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chave PIX</p>
                <p className="mt-1 break-all font-mono text-sm">{pixKey}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><HandCoins className="h-5 w-5" /> Contribuir</CardTitle></CardHeader>
          <CardContent>
            {!q.data.form ? (
              <p className="text-sm text-muted-foreground">Formulário indisponível.</p>
            ) : (
              <form onSubmit={handleContribute} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Valor (R$) *</Label>
                  <Input id="amount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-name">Nome</Label>
                  <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-email">E-mail *</Label>
                  <Input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-msg">Mensagem</Label>
                  <Textarea id="c-msg" rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar contribuição"}
                </Button>
                <p className="text-xs text-muted-foreground">Após enviar, o organizador confirma o recebimento manualmente.</p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <PublicFooter />
    </div>
  );
}
