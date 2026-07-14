import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTable, listFields, createField, updateField, deleteField, getOrganizationBySlug } from "@/lib/orgs.functions";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Columns3, Loader2, Plus, Trash2 } from "lucide-react";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","file","relation","computed",
] as const;

export const Route = createFileRoute("/_authenticated/app/$orgSlug/tables/$tableId/schema")({
  head: () => ({ meta: [{ title: "Esquema — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: SchemaPage,
});

function SchemaPage() {
  const { orgSlug, tableId } = Route.useParams();
  const fetchOrg = (getOrganizationBySlug);
  const fetchTable = (getTable);
  const fetchFields = (listFields);
  const doCreate = (createField);
  const doUpdate = (updateField);
  const doDelete = (deleteField);

  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => fetchOrg({ data: { slug: orgSlug } }) });
  const table = useQuery({ queryKey: ["table", tableId], queryFn: () => fetchTable({ data: { id: tableId } }) });
  const fields = useQuery({ queryKey: ["fields", tableId], queryFn: () => fetchFields({ data: { table_id: tableId } }) });

  const canEdit = org.data?.myRole === "owner" || org.data?.myRole === "editor";

  const [open, setOpen] = useState(false);
  const [fLabel, setFLabel] = useState("");
  const [fKey, setFKey] = useState("");
  const [fType, setFType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [fRequired, setFRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  function autoKey(label: string) {
    return label
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const key = fKey || autoKey(fLabel);
      await doCreate({
        data: {
          table_id: tableId,
          key,
          label: fLabel,
          type: fType,
          required: fRequired,
          position: (fields.data?.length ?? 0),
        },
      });
      toast.success("Campo criado");
      setOpen(false);
      setFLabel(""); setFKey(""); setFType("text"); setFRequired(false);
      await fields.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleRequired(id: string, required: boolean) {
    try {
      await doUpdate({ data: { id, required } });
      await fields.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await doDelete({ data: { id } });
      toast.success("Campo removido");
      await fields.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <AppShell
      title={table.data?.name ?? "Tabela"}
      subtitle={table.data?.description ?? "Defina os campos desta tabela."}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/app/$orgSlug" params={{ orgSlug }}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Voltar</Button>
          </Link>
          {canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4" />Novo campo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Novo campo</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="f-label">Rótulo</Label>
                    <Input id="f-label" required value={fLabel} onChange={(e) => { setFLabel(e.target.value); if (!fKey) setFKey(autoKey(e.target.value)); }} placeholder="Endereço" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-key">Chave (snake_case)</Label>
                    <Input id="f-key" required pattern="^[a-z][a-z0-9_]*$" value={fKey} onChange={(e) => setFKey(e.target.value)} placeholder="endereco" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={fType} onValueChange={(v) => setFType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <Label htmlFor="f-req" className="text-sm">Obrigatório</Label>
                    <Switch id="f-req" checked={fRequired} onCheckedChange={setFRequired} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      }
    >
      {fields.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !fields.data || fields.data.length === 0 ? (
        <EmptyState
          icon={<Columns3 className="h-5 w-5" />}
          title="Nenhum campo ainda"
          description="Adicione campos para definir a estrutura desta tabela."
          action={canEdit ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Novo campo</Button> : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {fields.data.map((f: any) => (
                <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:flex sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{f.key}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{f.type}</Badge>
                    {canEdit ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch checked={f.required} onCheckedChange={(v) => handleToggleRequired(f.id, v)} />
                          <span className="hidden sm:inline">obrigatório</span>
                        </label>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover campo?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(f.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      f.required ? <Badge variant="outline">obrigatório</Badge> : null
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
