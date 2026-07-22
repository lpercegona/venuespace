import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTable, listFields, createField, updateField, deleteField, getOrganizationBySlug } from "@/lib/orgs.functions";
import { amISuperAdmin } from "@/lib/instance-settings.functions";
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
import { ArrowLeft, Columns3, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useLabels } from "@/hooks/use-instance-context";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;


export const Route = createFileRoute("/_authenticated/app/$orgSlug/tables/$tableId/schema")({
  head: () => ({ meta: [{ title: "Esquema — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: SchemaPage,
});

function SchemaPage() {
  const { orgSlug, tableId } = Route.useParams();
  const { t } = useLabels();
  const tableLabel = t("table", "tabela").toLowerCase();
  const fieldLabel = t("field", "campo").toLowerCase();
  const fieldsLabel = t("fields", "campos").toLowerCase();
  const fetchOrg = (getOrganizationBySlug);
  const fetchTable = (getTable);
  const fetchFields = (listFields);
  const doCreate = (createField);
  const doUpdate = (updateField);
  const doDelete = (deleteField);

  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => fetchOrg({ data: { slug: orgSlug } }) });
  const table = useQuery({ queryKey: ["table", tableId], queryFn: () => fetchTable({ data: { id: tableId } }) });
  const fields = useQuery({ queryKey: ["fields", tableId], queryFn: () => fetchFields({ data: { table_id: tableId } }) });
  const saGate = useQuery({ queryKey: ["is-super-admin"], queryFn: () => amISuperAdmin() });

  const isSA = !!saGate.data?.is_super_admin;
  const isLocked = !!(table.data as any)?.is_locked;
  const canEdit = (org.data?.myRole === "owner" || org.data?.myRole === "editor") && (!isLocked || isSA);


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
      toast.success(`${t("field", "Campo")} criado`);
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
      toast.success(`${t("field", "Campo")} removido`);
      await fields.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <AppShell
      title={table.data?.name ?? t("table", "Tabela")}
      subtitle={isLocked ? `Estrutura padrão da categoria — travada para edição.` : (table.data?.description ?? `Defina os ${fieldsLabel} desta ${tableLabel}.`)}

      actions={
        <div className="flex items-center gap-2">
          <Link to="/app/$orgSlug" params={{ orgSlug }}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Voltar</Button>
          </Link>
          {isLocked ? <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Travada</Badge> : null}

          {canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4" />Novo {fieldLabel}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Novo {fieldLabel}</DialogTitle></DialogHeader>
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
          title={`Nenhum ${fieldLabel} ainda`}
          description={`Adicione ${fieldsLabel} para definir a estrutura desta ${tableLabel}.`}
          action={canEdit ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Novo {fieldLabel}</Button> : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {fields.data.map((f: any) => {
                const isCategoryField = (f.source ?? "user") === "category";
                const canMutate = canEdit && !isCategoryField;
                return (
                <li key={f.id} className="px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{f.label}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{f.key}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">{f.type}</Badge>
                      {isCategoryField ? <Badge variant="outline">categoria</Badge> : null}
                      {canMutate ? (
                        <>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Switch checked={f.required} onCheckedChange={(v) => handleToggleRequired(f.id, v)} />
                            <span className="hidden sm:inline">obrigatório</span>
                          </label>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Remover ${fieldLabel}`}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{`Remover ${fieldLabel}?`}</AlertDialogTitle>
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
                  </div>
                  {canMutate && (f.type === "select" || f.type === "multiselect") ? (
                    <OptionsManager field={f} onChanged={() => fields.refetch()} />
                  ) : null}
                </li>
                );
              })}

            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function OptionsManager({ field, onChanged }: { field: any; onChanged: () => void }) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<string[]>(((field.config ?? {}).options as string[]) ?? []);

  async function add() {
    if (!val.trim()) return;
    setBusy(true);
    try {
      const { addFieldOption } = await import("@/lib/orgs.functions");
      const res = await addFieldOption({ data: { field_id: field.id, option: val.trim() } });
      setOpts(res.options); setVal(""); onChanged();
      toast.success("Opção adicionada");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Opções</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {opts.length === 0 ? <span className="text-xs text-muted-foreground">Sem opções.</span>
          : opts.map((o) => <Badge key={o} variant="outline">{o}</Badge>)}
      </div>
      <div className="flex items-center gap-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Nova opção" className="h-8 max-w-xs" />
        <Button type="button" size="sm" disabled={busy || !val.trim()} onClick={add}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />Adicionar</>}
        </Button>
      </div>
    </div>
  );
}

