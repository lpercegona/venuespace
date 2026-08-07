import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/venue/empty-state";
import { listOrganizationCategoriesPublic } from "@/lib/organization-categories.functions";
import {
  listHomeGroupingsAdmin,
  saveHomeGrouping,
  deleteHomeGrouping,
  type HomeGroupingDTO,
} from "@/lib/home-config.functions";

export function HomeGroupingsSection() {
  const qc = useQueryClient();
  const groupingsQ = useQuery({ queryKey: ["admin-home-groupings"], queryFn: () => listHomeGroupingsAdmin() });
  const catsQ = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HomeGroupingDTO | null>(null);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function reset(dto?: HomeGroupingDTO) {
    setEditing(dto ?? null);
    setLabel(dto?.label ?? "");
    setSlug(dto?.slug ?? "");
    setDescription(dto?.description ?? "");
    setOrderIndex(dto?.order_index ?? 0);
    setIsActive(dto?.is_active ?? true);
    setCategoryIds(dto?.category_ids ?? []);
  }

  function openNew() {
    reset();
    setOpen(true);
  }

  function openEdit(g: HomeGroupingDTO) {
    reset(g);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveHomeGrouping({
        data: {
          id: editing?.id,
          label,
          slug: slug || slugify(label),
          description: description || null,
          order_index: orderIndex,
          is_active: isActive,
          category_ids: categoryIds,
        },
      });
      toast.success(editing ? "Agrupamento atualizado" : "Agrupamento criado");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["admin-home-groupings"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHomeGrouping({ data: { id } });
      toast.success("Agrupamento removido");
      await qc.invalidateQueries({ queryKey: ["admin-home-groupings"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const list = groupingsQ.data?.groupings ?? [];

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Agrupamentos da home</CardTitle>
          <p className="text-sm text-muted-foreground">Abas do pill toggle da página inicial.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" />Novo agrupamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Editar agrupamento" : "Novo agrupamento"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="g-label">Label</Label>
                <Input id="g-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-slug">Slug (URL)</Label>
                <Input id="g-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(label)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-desc">Descrição</Label>
                <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="g-order">Ordem</Label>
                  <Input id="g-order" type="number" value={orderIndex} onChange={(e) => setOrderIndex(Number(e.target.value))} />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Switch id="g-active" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="g-active">Ativo</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categorias vinculadas</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(catsQ.data ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={categoryIds.includes(c.id)} onCheckedChange={() => toggleCategory(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Salvar</>}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {groupingsQ.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <EmptyState title="Nenhum agrupamento criado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.label}</TableCell>
                  <TableCell className="font-mono text-xs">{g.slug}</TableCell>
                  <TableCell>{g.order_index}</TableCell>
                  <TableCell>{g.is_active ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(g)}><PencilIcon /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover agrupamento?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não remove os blocos vinculados.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(g.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
  );
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
