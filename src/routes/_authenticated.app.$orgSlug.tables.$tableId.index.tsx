import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Pencil, Plus, Rows3, Settings2, Share2 } from "lucide-react";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { DynamicGrid, type RecordRow } from "@/components/venue/dynamic-grid";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getOrganizationBySlug, getTable, listTables } from "@/lib/orgs.functions";
import {
  listRecords, createRecord, updateRecord, deleteRecord, setRecordStatus,
  listViews, deleteView,
} from "@/lib/records.functions";
import { createPublicFormView, getPublicFormView, updatePublicFormView } from "@/lib/messages.functions";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/app/$orgSlug/tables/$tableId/")({
  head: () => ({ meta: [{ title: "Registros — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: RecordsPage,
});

function RecordsPage() {
  const { orgSlug, tableId } = Route.useParams();
  const qc = useQueryClient();

  const org = useQuery({ queryKey: ["org", orgSlug], queryFn: () => getOrganizationBySlug({ data: { slug: orgSlug } }) });
  const table = useQuery({ queryKey: ["table", tableId], queryFn: () => getTable({ data: { id: tableId } }) });
  const records = useQuery({ queryKey: ["records", tableId], queryFn: () => listRecords({ data: { table_id: tableId } }) });

  const canEdit = org.data?.myRole === "owner" || org.data?.myRole === "editor";
  const fields = records.data?.fields ?? [];
  const rows: RecordRow[] = (records.data?.records ?? []) as RecordRow[];
  const relations = records.data?.relations ?? {};

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);

  async function handleCreate(values: Record<string, any>) {
    try {
      await createRecord({ data: { table_id: tableId, data: values } });
      toast.success("Registro criado");
      setOpenForm(false);
      qc.invalidateQueries({ queryKey: ["records", tableId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function handleUpdate(values: Record<string, any>) {
    if (!editing) return;
    try {
      await updateRecord({ data: { id: editing.id, table_id: tableId, data: values } });
      toast.success("Registro atualizado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["records", tableId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteRecord({ data: { id: deleting.id } });
      toast.success("Registro excluído");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["records", tableId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function handleTogglePublish(r: RecordRow) {
    try {
      await setRecordStatus({ data: { id: r.id, status: r.status === "published" ? "draft" : "published" } });
      qc.invalidateQueries({ queryKey: ["records", tableId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  const hasFields = fields.filter((f) => f.type !== "computed").length > 0;

  // Views + public form dialog
  const views = useQuery({ queryKey: ["views", tableId], queryFn: () => listViews({ data: { table_id: tableId } }) });
  const orgTables = useQuery({
    queryKey: ["tables", org.data?.id],
    queryFn: () => listTables({ data: { organization_id: org.data!.id } }),
    enabled: !!org.data?.id,
  });
  const [openForm2, setOpenForm2] = useState(false);
  const [subTableId, setSubTableId] = useState<string>("");
  const [subFields, setSubFields] = useState<any[]>([]);
  const [autoRel, setAutoRel] = useState<string>("");
  const [savingView, setSavingView] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);

  async function loadSubFields(id: string) {
    setSubTableId(id);
    setSubFields([]);
    setAutoRel("");
    if (!id) return;
    // Reuse listRecords to pull fields
    const res = await listRecords({ data: { table_id: id } });
    setSubFields(res.fields);
  }

  async function handleCreateFormView() {
    if (!subTableId) { toast.error("Escolha a tabela de destino."); return; }
    setSavingView(true);
    try {
      await createPublicFormView({
        data: {
          table_id: tableId,
          submissions_table_id: subTableId,
          name: "Formulário público",
          auto_relation_field_id: autoRel || null,
        },
      });
      toast.success("Formulário público criado");
      setOpenForm2(false);
      setSubTableId(""); setAutoRel(""); setSubFields([]);
      qc.invalidateQueries({ queryKey: ["views", tableId] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingView(false); }
  }

  async function handleDeleteView(id: string) {
    try {
      await deleteView({ data: { id } });
      qc.invalidateQueries({ queryKey: ["views", tableId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  const publicUrl = org.data ? `/public/${org.data.slug}/${tableId}` : null;

  return (
    <AppShell
      title={table.data?.name ?? "Tabela"}
      subtitle={table.data?.description ?? undefined}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/$orgSlug" params={{ orgSlug }}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Voltar</Button>
          </Link>
          <Link to="/app/$orgSlug/tables/$tableId/schema" params={{ orgSlug, tableId }}>
            <Button variant="outline" size="sm"><Settings2 className="h-4 w-4" />Campos</Button>
          </Link>
          {publicUrl ? (
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" />Ver público</Button>
            </a>
          ) : null}
          {canEdit && hasFields ? (
            <Button onClick={() => setOpenForm(true)}><Plus className="h-4 w-4" />Novo registro</Button>
          ) : null}
        </div>
      }
    >
      {records.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !hasFields ? (
        <EmptyState
          icon={<Settings2 className="h-5 w-5" />}
          title="Defina campos primeiro"
          description="Esta tabela ainda não tem campos. Vá para o esquema e adicione ao menos um campo."
          action={
            <Link to="/app/$orgSlug/tables/$tableId/schema" params={{ orgSlug, tableId }}>
              <Button variant="outline"><Settings2 className="h-4 w-4" />Ir para campos</Button>
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Rows3 className="h-5 w-5" />}
          title="Nenhum registro ainda"
          description="Crie o primeiro registro desta tabela."
          action={canEdit ? <Button onClick={() => setOpenForm(true)}><Plus className="h-4 w-4" />Novo registro</Button> : undefined}
        />
      ) : (
        <DynamicGrid
          fields={fields}
          records={rows}
          relations={relations}
          canEdit={canEdit}
          onEdit={(r) => setEditing(r)}
          onDelete={(r) => setDeleting(r)}
          onTogglePublish={handleTogglePublish}
        />
      )}

      {/* Views panel */}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Formulários públicos</h2>
          </div>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setOpenForm2(true)}>
              <Plus className="h-4 w-4" />Novo formulário
            </Button>
          ) : null}
        </div>
        {views.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : ((views.data ?? []) as any[]).filter((v: any) => v.type === "public_form").length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum formulário público. Crie um para permitir que interessados se manifestem.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {((views.data ?? []) as any[]).filter((v: any) => v.type === "public_form").map((v: any) => (
              <li key={v.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.name}</p>
                      <p className="truncate text-xs text-muted-foreground">Destino: {v.submissions_table_id}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary">public_form</Badge>
                        {publicUrl ? (
                          <a
                            href={`${publicUrl}/form?view=${v.id}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-primary underline"
                          >Abrir formulário</a>
                        ) : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Editar formulário" onClick={() => setEditingViewId(v.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteView(v.id)}>Remover</Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={openForm2} onOpenChange={setOpenForm2}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Novo formulário público</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tabela de destino (submissões)</Label>
              <Select value={subTableId} onValueChange={loadSubFields}>
                <SelectTrigger><SelectValue placeholder="Escolha uma tabela para receber envios" /></SelectTrigger>
                <SelectContent>
                  {(orgTables.data ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.id === tableId ? " (esta tabela)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Cada envio cria um registro nessa tabela e uma conversa vinculada.</p>
            </div>
            {subFields.length > 0 ? (
              <div className="space-y-2">
                <Label>Campo relação para o registro de origem (opcional)</Label>
                <Select value={autoRel || "__none__"} onValueChange={(v) => setAutoRel(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {subFields.filter((f) => f.type === "relation").map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se selecionado, o registro criado será vinculado automaticamente ao registro de origem.</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenForm2(false)}>Cancelar</Button>
            <Button onClick={handleCreateFormView} disabled={savingView || !subTableId}>{savingView ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Novo registro</DialogTitle></DialogHeader>
          <DynamicForm fields={fields} onSubmit={handleCreate} onCancel={() => setOpenForm(false)} submitLabel="Criar" />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Editar registro</DialogTitle></DialogHeader>
          {editing ? (
            <DynamicForm fields={fields} initial={editing.data} onSubmit={handleUpdate} onCancel={() => setEditing(null)} submitLabel="Salvar" />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditFormViewDialog
        viewId={editingViewId}
        onClose={() => setEditingViewId(null)}
        onSaved={() => { setEditingViewId(null); qc.invalidateQueries({ queryKey: ["views", tableId] }); }}
      />
    </AppShell>
  );
}

function EditFormViewDialog({ viewId, onClose, onSaved }: { viewId: string | null; onClose: () => void; onSaved: () => void }) {
  const q = useQuery({
    queryKey: ["public-form-view", viewId],
    queryFn: () => getPublicFormView({ data: { id: viewId as string } }),
    enabled: !!viewId,
  });
  const [name, setName] = useState("");
  const [autoRel, setAutoRel] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const view = q.data?.view as any;
  const fields = (q.data?.submission_fields ?? []) as any[];
  const relationFields = fields.filter((f) => f.type === "relation");
  const selectableFields = fields.filter((f) => f.type !== "computed");

  const cfg = (view?.config ?? {}) as any;
  const initializedRef = useState<string | null>(null);
  if (view && initializedRef[0] !== view.id) {
    initializedRef[1](view.id);
    setName(view.name ?? "");
    setAutoRel(cfg.auto_relation_field_id ?? "");
    const included: string[] | null = cfg.form_field_ids ?? null;
    if (included) setSelectedIds(new Set(included));
    else setSelectedIds(new Set(selectableFields.filter((f) => f.id !== (cfg.auto_relation_field_id ?? "")).map((f) => f.id)));
  }

  async function handleSave() {
    if (!viewId) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedIds).filter((id) => id !== autoRel);
      await updatePublicFormView({
        data: {
          id: viewId,
          name: name.trim() || "Formulário público",
          auto_relation_field_id: autoRel || null,
          form_field_ids: ids.length === selectableFields.length ? null : ids,
        },
      });
      toast.success("Formulário atualizado");
      onSaved();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  function toggle(id: string, on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  return (
    <Dialog open={!!viewId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Editar formulário público</DialogTitle></DialogHeader>
        {q.isLoading || !view ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Nome</Label>
              <Input id="form-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Formulário público" />
            </div>
            <div className="space-y-2">
              <Label>Campo relação para o registro de origem</Label>
              <Select value={autoRel || "__none__"} onValueChange={(v) => setAutoRel(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {relationFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Preenchido automaticamente com o registro de origem; ocultado do formulário.</p>
            </div>
            <div className="space-y-2">
              <Label>Campos exibidos no formulário</Label>
              <ul className="space-y-2 rounded-md border border-border/60 p-3">
                {selectableFields.length === 0 ? (
                  <li className="text-xs text-muted-foreground">A tabela de destino não tem campos elegíveis.</li>
                ) : selectableFields.map((f) => {
                  const isAuto = f.id === autoRel;
                  return (
                    <li key={f.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`ff-${f.id}`}
                        checked={selectedIds.has(f.id)}
                        disabled={isAuto}
                        onCheckedChange={(v) => toggle(f.id, !!v)}
                      />
                      <Label htmlFor={`ff-${f.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                        {f.label} <span className="text-xs text-muted-foreground">({f.type}){isAuto ? " · auto" : ""}</span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !view}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

