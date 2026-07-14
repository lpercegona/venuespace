import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getOrganizationBySlug, listTables, createTable, updateTable, deleteTable, listMembers, addMemberByEmail } from "@/lib/orgs.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { EditOrgDialog } from "@/components/venue/edit-org-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table as TableIcon, Plus, Loader2, UserPlus, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.orgSlug} — Venuespace` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrgDashboard,
});

function OrgDashboard() {
  const { orgSlug } = Route.useParams();
  const navigate = useNavigate();
  const fetchOrg = (getOrganizationBySlug);
  const fetchTables = (listTables);
  const doCreateTable = (createTable);
  const fetchMembers = (listMembers);
  const doAddMember = (addMemberByEmail);

  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => fetchOrg({ data: { slug: orgSlug } }) });
  const tables = useQuery({
    queryKey: ["tables", org.data?.id],
    queryFn: () => fetchTables({ data: { organization_id: org.data!.id } }),
    enabled: !!org.data?.id,
  });
  const members = useQuery({
    queryKey: ["members", org.data?.id],
    queryFn: () => fetchMembers({ data: { organization_id: org.data!.id } }),
    enabled: !!org.data?.id,
  });

  const canEdit = org.data?.myRole === "owner" || org.data?.myRole === "editor";
  const isOwner = org.data?.myRole === "owner";

  const [openTable, setOpenTable] = useState(false);
  const [openEditOrg, setOpenEditOrg] = useState(false);
  const [tName, setTName] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tBookable, setTBookable] = useState(false);
  const [savingT, setSavingT] = useState(false);

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault();
    if (!org.data) return;
    setSavingT(true);
    try {
      const row = await doCreateTable({
        data: {
          organization_id: org.data.id,
          name: tName,
          description: tDesc || undefined,
          bookable: tBookable,
        },
      });
      toast.success("Tabela criada");
      setOpenTable(false);
      setTName(""); setTDesc(""); setTBookable(false);
      await tables.refetch();
      navigate({ to: "/app/$orgSlug/tables/$tableId/schema", params: { orgSlug, tableId: row.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingT(false);
    }
  }

  const [openMember, setOpenMember] = useState(false);
  const [mEmail, setMEmail] = useState("");
  const [mRole, setMRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [savingM, setSavingM] = useState(false);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!org.data) return;
    setSavingM(true);
    try {
      await doAddMember({ data: { organization_id: org.data.id, email: mEmail, role: mRole } });
      toast.success("Membro adicionado");
      setOpenMember(false);
      setMEmail(""); setMRole("editor");
      await members.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingM(false);
    }
  }

  if (org.isLoading) {
    return (
      <AppShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>
    );
  }
  if (!org.data) {
    return <AppShell title="Organização não encontrada" />;
  }

  return (
    <AppShell
      title={org.data.name}
      subtitle={org.data.description || `/${org.data.slug}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isOwner ? (
            <Button variant="outline" size="sm" onClick={() => setOpenEditOrg(true)}>
              <Pencil className="h-4 w-4" />Editar organização
            </Button>
          ) : null}
          {canEdit ? (
            <Dialog open={openTable} onOpenChange={setOpenTable}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4" />Nova tabela</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Nova tabela</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateTable} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="t-name">Nome</Label>
                    <Input id="t-name" required value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Imóveis" />
                    {tName ? <p className="text-xs text-muted-foreground">Slug: <span className="font-mono">{slugify(tName)}</span></p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-desc">Descrição</Label>
                    <Textarea id="t-desc" rows={3} value={tDesc} onChange={(e) => setTDesc(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <Label htmlFor="t-book" className="text-sm">Tabela com reservas</Label>
                      <p className="text-xs text-muted-foreground">Ative para recursos com data de início e fim.</p>
                    </div>
                    <Switch id="t-book" checked={tBookable} onCheckedChange={setTBookable} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpenTable(false)}>Cancelar</Button>
                    <Button type="submit" disabled={savingT}>{savingT ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      }
    >
      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Tabelas</h2>
        </div>
        {tables.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !tables.data || tables.data.length === 0 ? (
          <EmptyState
            icon={<TableIcon className="h-5 w-5" />}
            title="Nenhuma tabela ainda"
            description="Crie sua primeira tabela para começar a modelar seus dados."
            action={canEdit ? <Button onClick={() => setOpenTable(true)}><Plus className="h-4 w-4" />Nova tabela</Button> : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables.data.map((t: any) => (
              <TableCard
                key={t.id}
                t={t}
                orgSlug={orgSlug}
                canEdit={canEdit}
                onSaved={() => tables.refetch()}
              />
            ))}
          </div>

        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Membros</h2>
          </div>
          {isOwner ? (
            <Dialog open={openMember} onOpenChange={setOpenMember}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><UserPlus className="h-4 w-4" />Adicionar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Adicionar membro</DialogTitle></DialogHeader>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="m-email">E-mail</Label>
                    <Input id="m-email" type="email" required value={mEmail} onChange={(e) => setMEmail(e.target.value)} />
                    <p className="text-xs text-muted-foreground">A pessoa precisa ter conta no Venuespace.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select value={mRole} onValueChange={(v) => setMRole(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner — controle total</SelectItem>
                        <SelectItem value="editor">Editor — edita dados</SelectItem>
                        <SelectItem value="viewer">Viewer — apenas lê</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpenMember(false)}>Cancelar</Button>
                    <Button type="submit" disabled={savingM}>{savingM ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-card">
          {members.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {(members.data ?? []).map((m: any) => (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:flex sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>{(m.profile?.display_name ?? m.profile?.email ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.profile?.display_name ?? m.profile?.email ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                    </div>
                  </div>
                  <Badge variant={m.role === "owner" ? "default" : "secondary"} className="shrink-0">{m.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function TableCard({
  t, orgSlug, canEdit, onSaved,
}: { t: any; orgSlug: string; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  const [desc, setDesc] = useState(t.description ?? "");
  const [bookable, setBookable] = useState(!!t.bookable);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTable({ data: { id: t.id, name, description: desc || null, bookable } });
      toast.success("Tabela atualizada");
      setEditing(false);
      onSaved();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="relative">
      <Link to="/app/$orgSlug/tables/$tableId" params={{ orgSlug, tableId: t.id }}>
        <Card className="h-full transition-shadow hover:shadow-elegant">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base pr-8">{t.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{t.description || "Sem descrição."}</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">/{t.slug}</Badge>
              {t.bookable ? <Badge>reservas</Badge> : null}
            </div>
          </CardContent>
        </Card>
      </Link>
      {canEdit ? (
        <>
          <Button
            type="button" variant="ghost" size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            aria-label="Editar tabela"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
          ><Pencil className="h-4 w-4" /></Button>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Editar tabela</DialogTitle></DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`e-n-${t.id}`}>Nome</Label>
                  <Input id={`e-n-${t.id}`} required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`e-d-${t.id}`}>Descrição</Label>
                  <Textarea id={`e-d-${t.id}`} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor={`e-b-${t.id}`} className="text-sm">Tabela com reservas</Label>
                  <Switch id={`e-b-${t.id}`} checked={bookable} onCheckedChange={setBookable} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

