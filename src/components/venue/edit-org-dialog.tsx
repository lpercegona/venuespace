import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateOrganization, deleteOrganization } from "@/lib/orgs.functions";
import { listOrganizationCategoriesPublic } from "@/lib/organization-categories.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  org: {
    id: string; slug: string; name: string;
    description: string | null; logo_url: string | null;
    category_id?: string | null;
    timezone?: string | null;
    currency?: string | null;
  };
};

export function EditOrgDialog({ open, onOpenChange, org }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "");
  const [categoryId, setCategoryId] = useState<string>(org.category_id ?? "__none__");
  const [timezone, setTimezone] = useState(org.timezone ?? "");
  const [currency, setCurrency] = useState(org.currency ?? "");
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deleting, setDeleting] = useState(false);

  const cats = useQuery({
    queryKey: ["public-org-categories"],
    queryFn: () => listOrganizationCategoriesPublic(),
    staleTime: 60_000,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateOrganization({ data: {
        id: org.id,
        name,
        description: description || null,
        logo_url: logoUrl || null,
        category_id: categoryId === "__none__" ? null : categoryId,
        timezone: timezone.trim() ? timezone.trim() : null,
        currency: currency.trim() ? currency.trim().toUpperCase() : null,
      } });
      toast.success("Organização atualizada");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["org", org.slug] }),
        qc.invalidateQueries({ queryKey: ["my-orgs"] }),
      ]);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteOrganization({ data: { id: org.id, confirm_slug: confirmSlug } });
      toast.success("Organização excluída");
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });
      setConfirmDelete(false);
      onOpenChange(false);
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Editar organização</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="o-name">Nome</Label>
            <Input id="o-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-desc">Descrição</Label>
            <Textarea id="o-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-logo">Logo (URL)</Label>
            <Input id="o-logo" type="url" placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="o-tz">Fuso horário (override)</Label>
              <Input id="o-tz" placeholder="America/Sao_Paulo" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-cur">Moeda (override)</Label>
              <Input id="o-cur" placeholder="BRL" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Deixe fuso e moeda em branco para herdar o padrão da instância.</p>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />Excluir organização
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir organização?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é permanente e remove todas as tabelas, registros, conversas e mensagens.
                    Para confirmar, digite o slug <span className="font-mono">{org.slug}</span>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={org.slug} />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmSlug !== org.slug || deleting}
                    onClick={(e) => { e.preventDefault(); handleDelete(); }}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
