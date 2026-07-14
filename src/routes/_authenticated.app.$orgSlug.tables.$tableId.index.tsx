import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Rows3, Settings2 } from "lucide-react";
import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { DynamicGrid, type RecordRow } from "@/components/venue/dynamic-grid";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getOrganizationBySlug, getTable } from "@/lib/orgs.functions";
import {
  listRecords, createRecord, updateRecord, deleteRecord, setRecordStatus,
} from "@/lib/records.functions";

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

  return (
    <AppShell
      title={table.data?.name ?? "Tabela"}
      subtitle={table.data?.description ?? undefined}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/app/$orgSlug" params={{ orgSlug }}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Voltar</Button>
          </Link>
          <Link to="/app/$orgSlug/tables/$tableId/schema" params={{ orgSlug, tableId }}>
            <Button variant="outline" size="sm"><Settings2 className="h-4 w-4" />Campos</Button>
          </Link>
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
    </AppShell>
  );
}
