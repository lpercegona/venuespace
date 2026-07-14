import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getOrganizationBySlug, listMembers, addMemberByEmail } from "@/lib/orgs.functions";
import { updateMembershipRole, removeMembership } from "@/lib/applications.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/members")({
  head: ({ params }) => ({ meta: [{ title: `Membros — ${params.orgSlug} — Venuespace` }, { name: "robots", content: "noindex" }] }),
  component: MembersPage,
});

function MembersPage() {
  const { orgSlug } = Route.useParams();
  const qc = useQueryClient();
  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => getOrganizationBySlug({ data: { slug: orgSlug } }) });
  const members = useQuery({
    queryKey: ["members", org.data?.id],
    queryFn: () => listMembers({ data: { organization_id: org.data!.id } }),
    enabled: !!org.data?.id,
  });

  const isOwner = org.data?.myRole === "owner";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!org.data) return;
    setSaving(true);
    try {
      await addMemberByEmail({ data: { organization_id: org.data.id, email, role } });
      toast.success("Membro adicionado");
      setOpen(false); setEmail(""); setRole("editor");
      qc.invalidateQueries({ queryKey: ["members", org.data.id] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function handleRole(id: string, r: "owner" | "editor" | "viewer") {
    try {
      await updateMembershipRole({ data: { id, role: r } });
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["members", org.data?.id] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover este membro?")) return;
    try {
      await removeMembership({ data: { id } });
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["members", org.data?.id] });
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <AppShell
      title="Membros"
      subtitle={org.data?.name}
      actions={
        isOwner ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="h-4 w-4" />Adicionar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Adicionar membro</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="m-email">E-mail</Label>
                  <Input id="m-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {members.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !members.data || members.data.length === 0 ? (
        <EmptyState title="Sem membros" description="Adicione pessoas para colaborar." />
      ) : (
        <ul className="grid gap-3">
          {members.data.map((m: any) => (
            <li key={m.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback>{(m.profile?.display_name ?? m.profile?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{m.profile?.display_name ?? m.profile?.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isOwner ? (
                      <Select value={m.role} onValueChange={(v) => handleRole(m.id, v as any)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <Badge variant="secondary">{m.role}</Badge>}
                    {isOwner ? (
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(m.id)} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
