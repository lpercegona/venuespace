import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Loader2, Pencil, Search, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/venue/empty-state";
import {
  FieldTypeConfig, applyDraftToConfig, draftFromConfig, emptyTypeDraft, type TypeDraft,
} from "@/components/admin/field-type-config";
import {
  listFieldCatalog, listOrphanOrgFieldKeys, applyFieldCatalogEntry, deleteFieldCatalogEntry,
  type FieldCatalogEntry, type CatalogScope,
} from "@/lib/field-catalog.functions";
import { listOrganizationCategoriesPublic } from "@/lib/organization-categories.functions";

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;

const SCOPES: { value: CatalogScope; label: string }[] = [
  { value: "org", label: "Organização" },
  { value: "table", label: "Tabela" },
  { value: "record", label: "Registro" },
];

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function FieldCatalogSection() {
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ["admin-field-catalog"], queryFn: () => listFieldCatalog() });
  const orphans = useQuery({ queryKey: ["admin-field-orphans"], queryFn: () => listOrphanOrgFieldKeys() });
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [depFilter, setDepFilter] = useState<string>("all");

  const entries = useMemo(() => {
    const q = norm(search.trim());
    return (catalog.data ?? []).filter((e) => {
      if (q && !norm(e.field_key).includes(q) && !norm(e.label).includes(q)) return false;
      if (scopeFilter !== "all" && !e.usages.some((u) => u.scope === scopeFilter)) return false;
      if (depFilter === "with" && e.dependencies.length === 0) return false;
      if (depFilter === "base" && !e.is_base) return false;
      return true;
    });
  }, [catalog.data, search, scopeFilter, depFilter]);

  const catName = (id: string) => (cats.data ?? []).find((c) => c.id === id)?.name ?? id.slice(0, 8);

  // ---- diálogo de edição ----
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FieldCatalogEntry | null>(null);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<string>("text");
  const [required, setRequired] = useState(false);
  const [order, setOrder] = useState(0);
  const [tooltip, setTooltip] = useState("");
  const [isBase, setIsBase] = useState(false);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<TypeDraft>(emptyTypeDraft());
  const [saving, setSaving] = useState(false);

  const tKey = (categoryId: string, scope: CatalogScope) => `${categoryId}::${scope}`;

  function openEdit(e: FieldCatalogEntry) {
    setEditing(e);
    setLabel(e.label);
    setType(e.field_type);
    setRequired(e.required);
    setOrder(e.order_index);
    setTooltip(typeof e.config?.tooltip === "string" ? e.config.tooltip : "");
    setIsBase(e.is_base);
    setTargets(new Set(e.usages.map((u) => tKey(u.category_id, u.scope))));
    setDraft(draftFromConfig(e.config));
    setOpen(true);
  }

  function toggleTarget(categoryId: string, scope: CatalogScope) {
    setTargets((prev) => {
      const next = new Set(prev);
      const k = tKey(categoryId, scope);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const config = applyDraftToConfig(editing.config, type, draft, tooltip);
      const list = [...targets].map((k) => {
        const [category_id, scope] = k.split("::");
        return { category_id, scope: scope as CatalogScope };
      });
      await applyFieldCatalogEntry({
        data: {
          field_key: editing.field_key,
          label,
          field_type: type as any,
          required,
          order_index: order,
          config,
          is_base: isBase,
          targets: list,
        },
      });
      toast.success("Campo atualizado na plataforma");
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-field-catalog"] });
    qc.invalidateQueries({ queryKey: ["admin-field-orphans"] });
    qc.invalidateQueries({ queryKey: ["admin-defaults"] });
    qc.invalidateQueries({ queryKey: ["admin-field-groups"] });
    qc.invalidateQueries({ queryKey: ["admin-base-field-config"] });
  }

  async function removeEntry(entry: FieldCatalogEntry) {
    try {
      await deleteFieldCatalogEntry({
        data: { field_key: entry.field_key, force: entry.dependencies.length > 0 },
      });
      toast.success("Campo removido de todas as categorias");
      invalidate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const scopeCount = (e: FieldCatalogEntry, scope: CatalogScope) =>
    e.usages.filter((u) => u.scope === scope).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Todos os campos da plataforma</CardTitle>
        <p className="text-sm text-muted-foreground">
          Visão consolidada por chave de campo, com as categorias e escopos em que cada campo é usado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-xs text-destructive">
            <strong>Zona de risco.</strong> Alterações aqui atingem todas as categorias e organizações da
            plataforma. Mudar o tipo, remover o campo ou desmarcar categorias pode invalidar dados já
            preenchidos, filtros públicos, cards e o PDF de orçamento.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-9"
              placeholder="Buscar por chave ou rótulo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar campo"
            />
          </div>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="sm:w-44" aria-label="Filtrar por escopo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os escopos</SelectItem>
              {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={depFilter} onValueChange={setDepFilter}>
            <SelectTrigger className="sm:w-48" aria-label="Filtrar por dependência"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os campos</SelectItem>
              <SelectItem value="with">Com dependência</SelectItem>
              <SelectItem value="base">Somente base</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {catalog.isLoading ? (
          <div className="py-10 text-center"><Loader2 className="inline h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : catalog.isError ? (
          <p className="text-sm text-destructive">{(catalog.error as Error).message}</p>
        ) : entries.length === 0 ? (
          <EmptyState title="Nenhum campo encontrado" description="Ajuste a busca ou os filtros." />
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.field_key} className="rounded-lg border border-border p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{e.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{e.field_key}</span>
                      <Badge variant="secondary">{e.field_type}</Badge>
                      {e.is_base ? <Badge variant="outline">base</Badge> : null}
                      {e.required ? <Badge variant="secondary">obrigatório</Badge> : null}
                      {e.divergent ? <Badge variant="destructive">divergente</Badge> : null}
                    </p>
                    {e.config?.tooltip ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{String(e.config.tooltip)}</p>
                    ) : null}
                    <p className="mt-2 flex flex-wrap gap-1">
                      {SCOPES.map((s) =>
                        scopeCount(e, s.value) > 0 ? (
                          <Badge key={s.value} variant="secondary">
                            {s.label}: {scopeCount(e, s.value)}
                          </Badge>
                        ) : null,
                      )}
                      {e.dependencies.map((d) => (
                        <Badge key={d} variant="outline" className="border-destructive/50 text-destructive">{d}</Badge>
                      ))}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {e.is_base
                        ? "Aplicado a todas as categorias da plataforma."
                        : [...new Set(e.usages.map((u) => catName(u.category_id)))].join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(e)} aria-label={`Editar ${e.field_key}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" aria-label={`Remover ${e.field_key}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover “{e.field_key}” da plataforma?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O campo sai de {e.usages.length} definição(ões) em{" "}
                            {new Set(e.usages.map((u) => u.category_id)).size} categoria(s).
                            {e.dependencies.length > 0
                              ? ` Atenção: há dependências (${e.dependencies.join(", ")}).`
                              : ""}{" "}
                            Ação irreversível.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeEntry(e)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              Campos criados dentro de organizações ({orphans.data?.length ?? 0})
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Somente diagnóstico. Estes campos foram criados por organizações e não existem no catálogo por categoria.
            </p>
            {(orphans.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum campo fora do catálogo.</p>
            ) : (
              (orphans.data ?? []).map((o) => (
                <div key={o.key} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <span className="font-mono text-xs">{o.key}</span>
                  <span className="truncate text-sm">{o.label}</span>
                  <Badge variant="secondary">{o.type}</Badge>
                  <Badge variant="outline">{o.organizations} organização(ões)</Badge>
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Editar campo da plataforma</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Chave</Label>
              <Input className="font-mono" value={editing?.field_key ?? ""} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fc-label">Rótulo</Label>
              <Input id="fc-label" required value={label} onChange={(ev) => setLabel(ev.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                  </SelectContent>
                </Select>
                {editing && editing.dependencies.length > 0 && type !== editing.field_type ? (
                  <p className="text-xs text-destructive">
                    Este campo é usado em: {editing.dependencies.join(", ")}. Mudar o tipo pode quebrar essas funções.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-order">Ordem</Label>
                <Input id="fc-order" type="number" min={0} value={order} onChange={(ev) => setOrder(Number(ev.target.value))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fc-tooltip">Texto de ajuda (tooltip)</Label>
                <Textarea id="fc-tooltip" rows={2} value={tooltip} onChange={(ev) => setTooltip(ev.target.value)}
                  placeholder="Exibido em ícone (i) ao lado do rótulo no formulário." />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="fc-req" className="text-sm">Obrigatório</Label>
                <Switch id="fc-req" checked={required} onCheckedChange={setRequired} />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <Label htmlFor="fc-base" className="text-sm">Campo base da plataforma</Label>
                  <p className="text-xs text-muted-foreground">
                    Aplica o campo a todas as categorias, existentes e futuras. Desabilita a seleção manual.
                  </p>
                </div>
                <Switch id="fc-base" checked={isBase} onCheckedChange={setIsBase} />
              </div>
              <FieldTypeConfig
                type={type}
                draft={draft}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                idPrefix="fc"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Categorias que usam o campo</p>
              <p className="text-xs text-muted-foreground">
                {isBase
                  ? "Campo base: aplicado automaticamente em todas as categorias."
                  : "Marque em quais categorias e escopos o campo deve existir."}
              </p>
              <div className="mt-2 space-y-2">
                {(cats.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {SCOPES.map((s) => {
                        const id = `fc-${c.id}-${s.value}`;
                        return (
                          <div key={s.value} className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3">
                            <Label htmlFor={id} className="text-xs">{s.label}</Label>
                            <Switch
                              id={id}
                              disabled={isBase}
                              checked={isBase || targets.has(tKey(c.id, s.value))}
                              onCheckedChange={() => toggleTarget(c.id, s.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
