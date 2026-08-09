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
import { usePublicCategories } from "@/components/venue/category-tabs";
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

type FieldKeyOption = { value: string; label: string };
type FieldKeyInfo = { key: string; label: string; type: string; scope: string; options?: FieldKeyOption[] };

function FieldKeysHelper({
  source,
  onPick,
}: {
  source: "organizations" | "records";
  onPick?: (key: string, value?: string) => void;
}) {
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
      <PopoverContent className="w-[min(92vw,44rem)] p-0" align="end">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Field-keys disponíveis</p>
          <p className="text-xs text-muted-foreground">
            Clique na chave para preencher o filtro; clique em uma opção para preencher chave e valor.
          </p>
        </div>
        <ScrollArea className="h-[22rem]">
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {q.isLoading ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">Carregando...</p>
            ) : list.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">Nenhuma field-key encontrada.</p>
            ) : (
              list.map((f, i) => (
                <div key={`${f.key}-${i}`} className="rounded-md border border-border p-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onPick?.(f.key)}
                  >
                    <code className="text-xs font-medium">{f.key}</code>
                    <p className="text-xs text-muted-foreground">
                      {f.label} · {f.type} · {f.scope}
                    </p>
                  </button>
                  {(f.options ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(f.options ?? []).map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => onPick?.(f.key, o.value)}
                          className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}


export function HomeBlocksSection() {
  const qc = useQueryClient();
  const blocksQ = useQuery({ queryKey: ["admin-home-blocks"], queryFn: () => listHomeBlocksAdmin() });
  const groupingsQ = useQuery({ queryKey: ["admin-home-groupings"], queryFn: () => listHomeGroupingsAdmin() });
  const categoriesQ = usePublicCategories();

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
                  <Label htmlFor="b-type">Tipo de bloco</Label>
                  <Select value={blockType} onValueChange={(v) => setBlockType(v as any)}>
                    <SelectTrigger id="b-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cards">Cards dinâmicos</SelectItem>
                      <SelectItem value="links">Cards de atalho (título + imagem)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="b-source">Fonte</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as any)} disabled={blockType === "links"}>
                    <SelectTrigger id="b-source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organizations">Organizações</SelectItem>
                      <SelectItem value="records">Registros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-columns">Colunas (desktop)</Label>
                  <Select value={String(columns)} onValueChange={(v) => setColumns(Number(v) as 3 | 4)}>
                    <SelectTrigger id="b-columns"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 colunas</SelectItem>
                      <SelectItem value="4">4 colunas</SelectItem>
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

              {blockType === "cards" ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Filtros (rules)</Label>
                    <div className="flex items-center gap-1">
                      <FieldKeysHelper
                        source={source}
                        onPick={(key, value) =>
                          setRules((prev) => {
                            if (prev.length === 0) return [{ field_key: key, operator: "=", value: value ?? "" }];
                            return prev.map((r, i) =>
                              i === prev.length - 1
                                ? { ...r, field_key: key, ...(value !== undefined ? { value } : {}) }
                                : r,
                            );
                          })
                        }
                      />
                      <Button type="button" variant="outline" size="sm" onClick={addRule}>Adicionar</Button>
                    </div>
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
              ) : (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Label>Cards de atalho</Label>
                      <p className="text-xs text-muted-foreground">
                        Título + imagem de fundo. Cada card abre a busca já filtrada pelo campo e valor definidos.
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <FieldKeysHelper
                        source="organizations"
                        onPick={(key, value) =>
                          setItems((prev) => {
                            if (prev.length === 0)
                              return [{ title: "", image_path: "", field_key: key, value: value ?? "" }];
                            return prev.map((it, i) =>
                              i === prev.length - 1
                                ? { ...it, field_key: key, ...(value !== undefined ? { value } : {}) }
                                : it,
                            );
                          })
                        }
                      />
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>Adicionar</Button>
                    </div>
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className="space-y-2 rounded-md border border-border p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} placeholder="Título (ex.: Curitiba)" />
                        <Input value={it.field_key ?? ""} onChange={(e) => updateItem(i, { field_key: e.target.value })} placeholder="field_key (ex.: address.city)" />
                        <Input value={it.value ?? ""} onChange={(e) => updateItem(i, { value: e.target.value })} placeholder="valor (ex.: Curitiba)" />
                      </div>
                      <Select
                        value={it.category_id ?? ""}
                        onValueChange={(v) => updateItem(i, { category_id: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Categoria de destino" /></SelectTrigger>
                        <SelectContent>
                          {(categoriesQ.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <UploadField value={it.image_path ?? ""} kind="image" onChange={(v) => updateItem(i, { image_path: v })} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} aria-label="Remover card"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum card de atalho adicionado.</p> : null}
                </div>
              )}


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

