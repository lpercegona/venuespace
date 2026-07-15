import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, RefreshCcw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { listOrganizationCategoriesPublic } from "@/lib/organization-categories.functions";
import {
  listCategoryCascadeFields,
  upsertCategoryCascadeField,
  deleteCategoryCascadeField,
  reconcileCategoryAllOrganizations,
  type CascadeScope,
  type CategoryCascadeField,
} from "@/lib/category-cascade.functions";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","file","relation","computed",
] as const;

function toSnake(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

export function CategoryCascadeSection() {
  const cats = useQuery({ queryKey: ["organization-categories"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selected, setSelected] = useState<string | null>(null);
  const activeCat = selected ?? cats.data?.[0]?.id ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Campos por categoria (cascata)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Definição obrigatória por categoria. Determina os campos exibidos ao criar organização e tabela.
          </p>
        </div>
        <Select value={activeCat ?? ""} onValueChange={(v) => setSelected(v)}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!activeCat ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <Tabs defaultValue="org">
            <TabsList className="mb-4">
              <TabsTrigger value="org">Campos de organização</TabsTrigger>
              <TabsTrigger value="table">Campos de tabela</TabsTrigger>
              <TabsTrigger value="reconcile">Reconciliação</TabsTrigger>
            </TabsList>
            <TabsContent value="org">
              <CascadeEditor categoryId={activeCat} scope="org" />
            </TabsContent>
            <TabsContent value="table">
              <CascadeEditor categoryId={activeCat} scope="table" />
            </TabsContent>
            <TabsContent value="reconcile">
              <ReconcilePanel categoryId={activeCat} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function CascadeEditor({ categoryId, scope }: { categoryId: string; scope: CascadeScope }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["category-cascade", scope, categoryId],
    queryFn: () => listCategoryCascadeFields({ data: { category_id: categoryId, scope } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryCascadeField | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [required, setRequired] = useState(false);
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditing(null); setLabel(""); setKey(""); setKeyTouched(false);
    setType("text"); setRequired(false); setOrder(0);
  }

  function uniqueKey(base: string) {
    const existing = new Set((list.data ?? []).map((f) => f.field_key).filter((k) => k !== editing?.field_key));
    if (!existing.has(base)) return base;
    let i = 2; while (existing.has(`${base}_${i}`)) i++; return `${base}_${i}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const finalKey = key || uniqueKey(toSnake(label));
      await upsertCategoryCascadeField({ data: {
        id: editing?.id, scope, category_id: categoryId,
        field_key: finalKey, label, field_type: type, required, order_index: order,
      } });
      toast.success(editing ? "Campo atualizado" : "Campo criado");
      setOpen(false); reset();
      qc.invalidateQueries({ queryKey: ["category-cascade", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCategoryCascadeField({ data: { scope, id } });
      toast.success("Campo removido");
      qc.invalidateQueries({ queryKey: ["category-cascade", scope, categoryId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  function openEdit(f: CategoryCascadeField) {
    setEditing(f); setLabel(f.label); setKey(f.field_key); setKeyTouched(true);
    setType(f.field_type as any); setRequired(f.required); setOrder(f.order_index);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Novo campo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editing ? "Editar campo" : "Novo campo"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cc-label">Rótulo</Label>
                <Input id="cc-label" required value={label} onChange={(e) => {
                  setLabel(e.target.value);
                  if (!keyTouched && !editing) setKey(uniqueKey(toSnake(e.target.value)));
                }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-key">Chave</Label>
                <Input id="cc-key" required pattern="^[a-z][a-z0-9_]*$" value={key}
                  readOnly={!!editing}
                  onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="cc-req" className="text-sm">Obrigatório</Label>
                  <Switch id="cc-req" checked={required} onCheckedChange={setRequired} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cc-order" className="text-xs">Ordem</Label>
                  <Input id="cc-order" type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Salvar" : "Criar")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum campo definido ainda.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(list.data ?? []).map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{f.label}</span>
                  <Badge variant="secondary">{f.field_type}</Badge>
                  {f.required ? <Badge variant="outline">obrigatório</Badge> : null}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{f.field_key} · ordem {f.order_index}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>Editar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover campo?</AlertDialogTitle>
                      <AlertDialogDescription>Ação irreversível.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(f.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReconcilePanel({ categoryId }: { categoryId: string }) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ organizations: number; tables_touched: number; fields_added: number } | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await reconcileCategoryAllOrganizations({ data: { category_id: categoryId } });
      setLast(r);
      toast.success(`Reconciliação: ${r.fields_added} campos em ${r.tables_touched} tabelas de ${r.organizations} organizações.`);
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Aplica retroativamente os campos padrão desta categoria em todas as tabelas de todas as organizações vinculadas. Idempotente: não sobrescreve campos existentes com a mesma chave.
      </p>
      <Button onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        Reconciliar todas as organizações
      </Button>
      {last ? (
        <p className="text-xs text-muted-foreground">
          Última execução: {last.fields_added} campos adicionados em {last.tables_touched} tabelas de {last.organizations} organizações.
        </p>
      ) : null}
    </div>
  );
}
