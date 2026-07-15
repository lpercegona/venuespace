import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMyOrganizations, createOrganization } from "@/lib/orgs.functions";
import { listOrganizationCategoriesPublic } from "@/lib/organization-categories.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";
import { useLabels } from "@/hooks/use-instance-context";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Minhas organizações — Venuespace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrgsPage,
});

function OrgsPage() {
  const { t } = useLabels();
  const organizationLabel = t("organization", "organização").toLowerCase();
  const organizationsLabel = t("organizations", "organizações").toLowerCase();
  const tableLabel = t("table", "tabela").toLowerCase();
  const tablesLabel = t("tables", "tabelas").toLowerCase();
  const fetchOrgs = (listMyOrganizations);
  const createOrg = (createOrganization);
  const router = useRouter();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => fetchOrgs(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const cats = useQuery({
    queryKey: ["public-org-categories"],
    queryFn: () => listOrganizationCategoriesPublic(),
    staleTime: 60_000,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      toast.error("Selecione uma categoria.");
      return;
    }
    setSaving(true);
    try {
      const org = await createOrg({ data: {
        name,
        description: description || undefined,
        category_id: categoryId,
      } });
      toast.success("Organização criada");
      setOpen(false);
      setName("");
      setDescription("");
      setCategoryId("");
      await refetch();
      router.invalidate();
      navigate({ to: "/app/$orgSlug", params: { orgSlug: org.slug } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }


  return (
    <AppShell
      title={`Minhas ${organizationsLabel}`}
      subtitle={`Cada ${organizationLabel} é um espaço isolado com suas próprias ${tablesLabel}, membros e páginas públicas.`}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />Nova {organizationLabel}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Nova {organizationLabel}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome</Label>
                <Input id="org-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={`Nome da ${organizationLabel}`} />
                {name ? (
                  <p className="text-xs text-muted-foreground">URL pública: /public/<span className="font-mono">{slugify(name)}</span></p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-desc">Descrição (opcional)</Label>
                <Textarea id="org-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem categoria</SelectItem>
                    {(cats.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={`Você ainda não faz parte de nenhuma ${organizationLabel}`}
          description={`Crie a primeira para começar a modelar suas ${tablesLabel} e páginas.`}
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova {organizationLabel}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((org: any) => (
            <Link key={org.id} to="/app/$orgSlug" params={{ orgSlug: org.slug }}>
              <Card className="h-full transition-shadow hover:shadow-elegant">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg">{org.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{org.description || "Sem descrição."}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">/{org.slug}</span>
                    <Badge variant="secondary">{org.role}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
