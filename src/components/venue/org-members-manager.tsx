import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listMembers, addMemberByEmail } from "@/lib/orgs.functions";
import { updateMembershipRole, removeMembership } from "@/lib/applications.functions";

type Role = "owner" | "editor" | "viewer";

/** Member management embedded in the organization edit dialog (super admin). */
export function OrgMembersManager({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);

  const members = useQuery({
    queryKey: ["members", organizationId],
    queryFn: () => listMembers({ data: { organization_id: organizationId } }),
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["members", organizationId] });
  }

  async function handleAdd() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await addMemberByEmail({ data: { organization_id: organizationId, email: email.trim(), role } });
      toast.success("Membro adicionado");
      setEmail("");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRole(id: string, r: Role) {
    try {
      await updateMembershipRole({ data: { id, role: r } });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeMembership({ data: { id } });
      toast.success("Membro removido");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Membros</p>

      {members.isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (members.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum membro vinculado.</p>
      ) : (
        <ul className="space-y-2">
          {(members.data ?? []).map((m: any) => (
            <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.profile?.display_name || m.profile?.email || m.user_id}</p>
                {m.profile?.email ? <p className="truncate text-xs text-muted-foreground">{m.profile.email}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {m.role === "owner" ? <Badge variant="secondary">proprietário</Badge> : null}
                <Select value={m.role} onValueChange={(v) => handleRole(m.id, v as Role)}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Proprietário</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Leitor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button" variant="ghost" size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  aria-label="Remover membro"
                  onClick={() => handleRemove(m.id)}
                ><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="m-email">Adicionar por e-mail</Label>
          <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="h-11 w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">Proprietário</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Leitor</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" onClick={handleAdd} disabled={busy} className="h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Adicionar
        </Button>
      </div>
    </div>
  );
}
