import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/venue/empty-state";
import { UploadField } from "@/components/venue/dynamic-form";
import {
  listHomeBlocksAdmin,
  listHomeGroupingsAdmin,
  saveHomeBlock,
  deleteHomeBlock,
  type HomeBlockDTO,
  type HomeBlockLink,
} from "@/lib/home-config.functions";

const operators = [
  { value: "=", label: "Igual a" },
  { value: "!=", label: "Diferente de" },
  { value: ">", label: "Maior que" },
  { value: ">=", label: "Maior ou igual" },
  { value: "<", label: "Menor que" },
  { value: "<=", label: "Menor ou igual" },
  { value: "contains", label: "Contém" },
  { value: "filled", label: "Preenchido" },
];

type FieldKeyInfo = { key: string; label: string; type: string; scope: string };

function FieldKeysHelper({ source }: { source: "organizations" | "records" }) {
  const q = useQuery({
    queryKey: ["admin-field-keys"],
    queryFn: async (): Promise<{ organization: FieldKeyInfo[]; record: FieldKeyInfo[] }> => {
      const res = await fetch("/api/public/field-keys");
      if (!res.ok) throw new Error("Falha ao carregar field-keys");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const list = (source === "records" ? q.data?.record : q.data?.organization) ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label="Field-keys disponíveis">
          <Info className="h-4 w-4" />
          Field-keys
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Field-keys disponíveis</p>
          <p className="text-xs text-muted-foreground">
            Campos de lista (ex.: comodidades) aceitam “Igual a” e “Contém” pelo valor de cada opção.
          </p>
        </div>
        <ScrollArea className="max-h-72">
          <ul className="divide-y divide-border">
            {q.isLoading ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">Carregando...</li>
            ) : list.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">Nenhuma field-key encontrada.</li>
            ) : (
              list.map((f, i) => (
                <li key={`${f.key}-${i}`} className="px-3 py-2">
                  <code className="text-xs font-medium">{f.key}</code>
                  <p className="text-xs text-muted-foreground">
                    {f.label} · {f.type} · {f.scope}
                  </p>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}


export function HomeBlocksSection() {
  const qc = useQueryClient();
  const blocksQ = useQuery({ queryKey: ["admin-home-blocks"], queryFn: () => listHomeBlocksAdmin() });
  const groupingsQ = useQuery({ queryKey: ["admin-home-groupings"], queryFn: () => listHomeGroupingsAdmin() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HomeBlockDTO | null>(null);
  const [groupingId, setGroupingId] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<"organizations" | "records">("organizations");
  const [orderBy, setOrderBy] = useState("");
  const [limitCount, setLimitCount] = useState(6);
  const [orderIndex, setOrderIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<HomeBlockDTO["rules"]>([]);
  const [blockType, setBlockType] = useState<"cards" | "links">("cards");
  const [columns, setColumns] = useState<3 | 4>(3);
  const [items, setItems] = useState<HomeBlockLink[]>([]);
  const [saving, setSaving] = useState(false);

  function reset(dto?: HomeBlockDTO) {
    setEditing(dto ?? null);
    setGroupingId(dto?.grouping_id ?? (groupingsQ.data?.groupings[0]?.id ?? ""));
    setTitle(dto?.title ?? "");
    setSource(dto?.source ?? "organizations");
    setOrderBy(dto?.order_by ?? "");
    setLimitCount(dto?.limit_count ?? 6);
    setOrderIndex(dto?.order_index ?? 0);
    setIsActive(dto?.is_active ?? true);
    setRules(dto?.rules ?? []);
    setBlockType(dto?.block_type ?? "cards");
    setColumns(dto?.columns ?? 3);
    setItems(dto?.items ?? []);
  }

  function openNew() {
    reset();
    setOpen(true);
  }

  function openEdit(b: HomeBlockDTO) {
    reset(b);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveHomeBlock({
        data: {
          id: editing?.id,
          grouping_id: groupingId,
          title,
          source,
          rules: blockType === "links" ? [] : rules,
          order_by: orderBy || undefined,
          limit_count: limitCount,
          order_index: orderIndex,
          is_active: isActive,
          block_type: blockType,
          columns,
          items: blockType === "links" ? items.filter((i) => i.title.trim() !== "") : [],
        },
      });
      toast.success(editing ? "Bloco atualizado" : "Bloco criado");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["admin-home-blocks"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHomeBlock({ data: { id } });
      toast.success("Bloco removido");
      await qc.invalidateQueries({ queryKey: ["admin-home-blocks"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function updateRule(index: number, patch: Partial<HomeBlockDTO["rules"][number]>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRule() {
    setRules((prev) => [...prev, { field_key: "", operator: "=", value: "" }]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<HomeBlockLink>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { title: "", image_path: "", field_key: "address.city", value: "" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }


  const list = blocksQ.data?.blocks ?? [];
  const groupings = groupingsQ.data?.groupings ?? [];

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Blocos da home</CardTitle>
          <p className="text-sm text-muted-foreground">Seções de cards exibidas dentro de cada agrupamento.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" />Novo bloco</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar bloco" : "Novo bloco"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="b-grouping">Agrupamento</Label>
                <Select value={groupingId} onValueChange={setGroupingId}>
                  <SelectTrigger id="b-grouping"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groupings.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="b-title">Título</Label>
                  <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-source">Fonte</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as any)}>
                    <SelectTrigger id="b-source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organizations">Organizações</SelectItem>
                      <SelectItem value="records">Registros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="b-order-by">Ordenar por</Label>
                  <Input id="b-order-by" value={orderBy} onChange={(e) => setOrderBy(e.target.value)} placeholder="updated_at" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-limit">Limite</Label>
                  <Input id="b-limit" type="number" min={1} max={50} value={limitCount} onChange={(e) => setLimitCount(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-order">Ordem</Label>
                  <Input id="b-order" type="number" value={orderIndex} onChange={(e) => setOrderIndex(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="b-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="b-active">Ativo</Label>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <Label>Filtros (rules)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRule}>Adicionar</Button>
                </div>
                {rules.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <Input value={r.field_key} onChange={(e) => updateRule(i, { field_key: e.target.value })} placeholder="field_key" />
                    </div>
                    <div className="col-span-3">
                      <Select value={r.operator} onValueChange={(v) => updateRule(i, { operator: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      <Input value={r.value ?? ""} onChange={(e) => updateRule(i, { value: e.target.value })} placeholder="valor" disabled={r.operator === "filled"} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(i)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                {rules.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum filtro — exibe os itens mais recentes.</p> : null}
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
        {blocksQ.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <EmptyState title="Nenhum bloco criado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Agrupamento</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell>{b.grouping?.label ?? "—"}</TableCell>
                  <TableCell>{b.source === "organizations" ? "Organizações" : "Registros"}</TableCell>
                  <TableCell>{b.order_index}</TableCell>
                  <TableCell>{b.is_active ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(b)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover bloco?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(b.id)}>Remover</AlertDialogAction>
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

