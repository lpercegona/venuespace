import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Pencil, ArrowLeft, Shield, FileText } from "lucide-react";
import { listBlogPostsAdmin, deleteBlogPost, type BlogPostListItem } from "@/lib/blog.functions";

import { AppShell } from "@/components/venue/app-shell";
import { EmptyState } from "@/components/venue/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLabels } from "@/hooks/use-instance-context";

import {
  amISuperAdmin,
  getInstanceSettingsPublic,
  updateInstanceSettings,
} from "@/lib/instance-settings.functions";
import {
  listPlatformLabelsPublic,
  upsertPlatformLabel,
} from "@/lib/platform-labels.functions";
import {
  countOrganizationsByCategory,
  createOrganizationCategory,
  deleteOrganizationCategory,
  listCategoryDefaultFields,
  listOrganizationCategoriesPublic,
  updateOrganizationCategory,
  upsertCategoryDefaultField,
  deleteCategoryDefaultField,
  type CategoryDefaultField,
  type OrganizationCategory,
} from "@/lib/organization-categories.functions";
import {
  listCategoryCascadeFields,
  upsertCategoryCascadeField,
  deleteCategoryCascadeField,
  reconcileCategoryAllOrganizations,
  type CategoryCascadeField,
} from "@/lib/category-cascade.functions";
import {
  listCategoryStandardTables,
  upsertCategoryStandardTable,
  deleteCategoryStandardTable,
  listCategoryStandardTableFields,
  upsertCategoryStandardTableField,
  deleteCategoryStandardTableField,
  type CategoryStandardTable,
  type CategoryStandardTableField,
} from "@/lib/category-standard-tables.functions";
import { listCategoryLayout, saveCategoryLayout, type LayoutField } from "@/lib/category-layouts.functions";
import {
  listCategoryFilterFieldsPublic,
  upsertCategoryFilterField,
  deleteCategoryFilterField,
  type CategoryFilterField,
} from "@/lib/category-filters.functions";


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useLabels();
  const organizationsLabel = t("organizations", "organizações").toLowerCase();
  const navigate = useNavigate();
  const gate = useQuery({ queryKey: ["is-super-admin"], queryFn: () => amISuperAdmin() });

  useEffect(() => {
    if (gate.isSuccess && !gate.data?.is_super_admin) {
      toast.error("Acesso restrito ao super admin");
      navigate({ to: "/app" });
    }
  }, [gate.isSuccess, gate.data, navigate]);

  if (gate.isLoading || !gate.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gate.data.is_super_admin) return null;

  return (
    <AppShell
      title="Configurações da instância"
      subtitle={`Ajustes globais que valem para todas as ${organizationsLabel}.`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/app"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        </Button>
      }
    >
      <Tabs defaultValue="general">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="labels">Rótulos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="defaults">Campos padrão</TabsTrigger>
          <TabsTrigger value="filters">Filtros públicos</TabsTrigger>
          <TabsTrigger value="layouts">Layout público</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralSection /></TabsContent>
        <TabsContent value="labels"><LabelsSection /></TabsContent>
        <TabsContent value="categories"><CategoriesSection /></TabsContent>
        <TabsContent value="defaults"><DefaultFieldsSection /></TabsContent>
        <TabsContent value="filters"><FilterFieldsSection /></TabsContent>
        <TabsContent value="layouts"><LayoutsSection /></TabsContent>
        <TabsContent value="blog"><BlogSection /></TabsContent>
      </Tabs>

    </AppShell>
  );
}

// ---------- General ----------

function GeneralSection() {
  const { t } = useLabels();
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["instance-settings-admin"], queryFn: () => getInstanceSettingsPublic() });
  const [tz, setTz] = useState("America/Sao_Paulo");
  const [ccy, setCcy] = useState("BRL");
  const [symbol, setSymbol] = useState("R$");
  const [pos, setPos] = useState<"before" | "after">("before");
  const [dec, setDec] = useState(",");
  const [thou, setThou] = useState(".");
  const [allow, setAllow] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!s.data) return;
    setTz(s.data.default_timezone);
    setCcy(s.data.default_currency);
    setSymbol(s.data.currency_display.symbol);
    setPos(s.data.currency_display.position);
    setDec(s.data.currency_display.decimal);
    setThou(s.data.currency_display.thousand);
    setAllow(s.data.allow_user_field_management);
  }, [s.data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateInstanceSettings({
        data: {
          default_timezone: tz,
          default_currency: ccy,
          currency_display: { symbol, position: pos, decimal: dec, thousand: thou },
          allow_user_field_management: allow,
        },
      });
      toast.success("Configurações atualizadas");
      await qc.invalidateQueries({ queryKey: ["instance-settings"] });
      await qc.invalidateQueries({ queryKey: ["instance-settings-admin"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (s.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Geral</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tz">Fuso horário padrão</Label>
            <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="America/Sao_Paulo" />
            <p className="text-xs text-muted-foreground">IANA (ex.: America/Sao_Paulo, Europe/Lisbon).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccy">Código de moeda (ISO 4217)</Label>
            <Input id="ccy" value={ccy} onChange={(e) => setCcy(e.target.value.toUpperCase())} placeholder="BRL" maxLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sym">Símbolo</Label>
            <Input id="sym" value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Posição do símbolo</Label>
            <Select value={pos} onValueChange={(v) => setPos(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Antes (R$ 1.234,56)</SelectItem>
                <SelectItem value="after">Depois (1.234,56 R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dec">Separador decimal</Label>
            <Input id="dec" value={dec} onChange={(e) => setDec(e.target.value)} maxLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thou">Separador de milhar</Label>
            <Input id="thou" value={thou} onChange={(e) => setThou(e.target.value)} maxLength={2} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Permitir gestão de campos por usuários</p>
              <p className="text-sm text-muted-foreground">Quando desligado, apenas o super admin pode criar/editar/apagar {t("fields", "campos").toLowerCase()} em {t("tables", "tabelas").toLowerCase()}.</p>
            </div>
            <Switch checked={allow} onCheckedChange={setAllow} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Salvar</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------- Labels ----------

function LabelsSection() {
  const qc = useQueryClient();
  const labels = useQuery({ queryKey: ["admin-platform-labels"], queryFn: () => listPlatformLabelsPublic() });
  

  const [drafts, setDrafts] = useState<Record<string, { label: string; icon: string }>>({});
  useEffect(() => {
    if (!labels.data) return;
    const d: typeof drafts = {};
    for (const l of labels.data) d[l.key] = { label: l.label, icon: l.icon ?? "" };
    setDrafts(d);
  }, [labels.data]);

  async function saveLabel(key: string) {
    const d = drafts[key];
    if (!d) return;
    try {
      await upsertPlatformLabel({ data: { key, label: d.label, icon: d.icon || null } });
      toast.success("Rótulo salvo");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-platform-labels"] }),
        qc.invalidateQueries({ queryKey: ["platform-labels"] }),
      ]);
    } catch (err) { toast.error((err as Error).message); }
  }




  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Termos-núcleo</CardTitle>
        <p className="text-sm text-muted-foreground">Aplicados em toda a plataforma. Alterações salvas são revalidadas imediatamente nesta sessão.</p>
      </CardHeader>
      <CardContent>
        {labels.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Chave</TableHead><TableHead>Rótulo</TableHead><TableHead>Ícone (lucide)</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
              <TableBody>
                {(labels.data ?? []).map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="font-mono text-xs">{l.key}</TableCell>
                    <TableCell><Input value={drafts[l.key]?.label ?? ""} onChange={(e) => setDrafts((s) => ({ ...s, [l.key]: { ...(s[l.key] ?? { label: "", icon: "" }), label: e.target.value } }))} /></TableCell>
                    <TableCell><Input value={drafts[l.key]?.icon ?? ""} onChange={(e) => setDrafts((s) => ({ ...s, [l.key]: { ...(s[l.key] ?? { label: "", icon: "" }), icon: e.target.value } }))} placeholder="Building2" /></TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => saveLabel(l.key)}><Save className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Categories ----------

function CategoriesSection() {
  const { t } = useLabels();
  const organizationLabel = t("organization", "organização").toLowerCase();
  const organizationsLabel = t("organizations", "organizações").toLowerCase();
  const fieldsLabel = t("fields", "campos").toLowerCase();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const counts = useQuery({ queryKey: ["admin-org-cat-counts"], queryFn: () => countOrganizationsByCategory() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationCategory | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function openNew() { setEditing(null); setName(""); setIcon(""); setDescription(""); setOpen(true); }
  function openEdit(c: OrganizationCategory) { setEditing(c); setName(c.name); setIcon(c.icon ?? ""); setDescription(c.description ?? ""); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateOrganizationCategory({ data: { id: editing.id, name, icon: icon || null, description: description || null } });
        toast.success("Categoria atualizada");
      } else {
        await createOrganizationCategory({ data: { name, icon: icon || null, description: description || null } });
        toast.success("Categoria criada");
      }
      setOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-org-cats"] }),
        qc.invalidateQueries({ queryKey: ["organization-categories"] }),
      ]);
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }

  async function remove(c: OrganizationCategory) {
    try {
      await deleteOrganizationCategory({ data: { id: c.id } });
      toast.success("Categoria removida");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-org-cats"] }),
        qc.invalidateQueries({ queryKey: ["admin-org-cat-counts"] }),
        qc.invalidateQueries({ queryKey: ["organization-categories"] }),
      ]);
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display">Categorias de {organizationLabel}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="h-4 w-4" />Nova</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="c-name">Nome</Label><Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="c-icon">Ícone (lucide)</Label><Input id="c-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Tag" /></div>
              <div className="space-y-2"><Label htmlFor="c-desc">Descrição</Label><Textarea id="c-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {cats.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (cats.data ?? []).length === 0 ? (
          <EmptyState icon={<Shield className="h-5 w-5" />} title="Nenhuma categoria criada" description={`Crie a primeira categoria para começar a classificar ${organizationsLabel}.`} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Ícone</TableHead><TableHead>Descrição</TableHead><TableHead>{t("organizations", "Organizações")}</TableHead><TableHead className="w-32"></TableHead></TableRow></TableHeader>
              <TableBody>
                {(cats.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.icon ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{c.description ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{counts.data?.[c.id] ?? 0}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="sm" variant="outline"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {(counts.data?.[c.id] ?? 0) > 0
                                  ? `${counts.data?.[c.id]} ${organizationLabel}(ões) ficarão sem categoria. ${t("fields", "Campos")} padrão desta categoria serão perdidos.`
                                  : "Esta ação é permanente."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(c)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Default fields per category (unified: org / table / record) ----------

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","gallery","file","relation","computed",
] as const;

type DefaultsScope = "org" | "table" | "record";

type UnifiedField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  order_index: number;
};

const BASE_FIELDS: Record<DefaultsScope, Array<{ key: string; label: string; type: string; required: boolean }>> = {
  org: [
    { key: "name", label: "Nome", type: "text", required: true },
    { key: "slug", label: "Slug", type: "text", required: true },
    { key: "category_id", label: "Categoria", type: "relation", required: true },
    { key: "address.cep", label: "CEP", type: "text", required: false },
    { key: "address.street", label: "Logradouro", type: "text", required: false },
    { key: "address.number", label: "Número", type: "text", required: false },
    { key: "address.complement", label: "Complemento", type: "text", required: false },
    { key: "address.neighborhood", label: "Bairro", type: "text", required: false },
    { key: "address.city", label: "Cidade", type: "text", required: false },
    { key: "address.state", label: "UF", type: "text", required: false },
  ],
  table: [
    { key: "name", label: "Nome", type: "text", required: true },
    { key: "icon", label: "Ícone", type: "text", required: false },
    { key: "description", label: "Descrição", type: "long_text", required: false },
  ],
  record: [],
};

function toSnake(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function DefaultFieldsSection() {
  const { t } = useLabels();
  const organizationLabel = t("organization", "organização").toLowerCase();
  const tablesLabel = t("tables", "tabelas").toLowerCase();
  const fieldsLabel = t("fields", "campos").toLowerCase();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && cats.data && cats.data.length > 0) setSelected(cats.data[0].id);
  }, [cats.data, selected]);

  const [reconciling, setReconciling] = useState(false);
  const [lastReconcile, setLastReconcile] = useState<{ organizations: number; tables_touched: number; fields_added: number } | null>(null);

  async function reconcile() {
    if (!selected) return;
    setReconciling(true);
    try {
      const r = await reconcileCategoryAllOrganizations({ data: { category_id: selected } });
      setLastReconcile(r);
      toast.success(`${r.fields_added} ${fieldsLabel} em ${r.tables_touched} ${tablesLabel} de ${r.organizations} ${t("organizations", "organizações").toLowerCase()}.`);
    } catch (err) { toast.error((err as Error).message); }
    finally { setReconciling(false); }
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Campos padrão por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Definição obrigatória por categoria. Determina os {fieldsLabel} exibidos ao criar {organizationLabel}, {t("table", "tabela").toLowerCase()} e {t("record", "registro").toLowerCase()}.
          </p>
        </div>
        <Select value={selected ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <Tabs defaultValue="org">
            <TabsList className="mb-4">
              <TabsTrigger value="org">Organização</TabsTrigger>
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="record">Registro</TabsTrigger>
            </TabsList>
            <TabsContent value="org"><ScopeEditor categoryId={selected} scope="org" /></TabsContent>
            <TabsContent value="table"><ScopeEditor categoryId={selected} scope="table" /></TabsContent>
            <TabsContent value="record"><ScopeEditor categoryId={selected} scope="record" /></TabsContent>
          </Tabs>
        )}

        {selected ? (
          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Reconciliação retroativa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aplica os {fieldsLabel} padrão desta categoria em todas as ambientes de espaços.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={reconcile} disabled={reconciling}>
                {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar retroativamente"}
              </Button>
              {lastReconcile ? (
                <span className="text-xs text-muted-foreground">
                  Última execução: {lastReconcile.fields_added} {fieldsLabel} em {lastReconcile.tables_touched} {tablesLabel} de {lastReconcile.organizations} {t("organizations", "organizações").toLowerCase()}.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ScopeEditor({ categoryId, scope }: { categoryId: string; scope: DefaultsScope }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-defaults", scope, categoryId],
    queryFn: async (): Promise<UnifiedField[]> => {
      if (scope === "record") {
        const rows = await listCategoryDefaultFields({ data: { category_id: categoryId } });
        return (rows as CategoryDefaultField[]).map((r) => ({
          id: r.id, field_key: r.field_key, label: r.label, field_type: r.field_type,
          required: r.required, order_index: r.order_index,
        }));
      }
      const rows = await listCategoryCascadeFields({ data: { category_id: categoryId, scope } });
      return (rows as CategoryCascadeField[]).map((r) => ({
        id: r.id, field_key: r.field_key, label: r.label, field_type: r.field_type,
        required: r.required, order_index: r.order_index,
      }));
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnifiedField | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [required, setRequired] = useState(false);
  const [order, setOrder] = useState(0);
  const [optionsText, setOptionsText] = useState("");
  const [cepRole, setCepRole] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditing(null); setLabel(""); setKey(""); setKeyTouched(false);
    setType("text"); setRequired(false); setOrder(0); setOptionsText(""); setCepRole(false);
  }

  function uniqueKey(base: string) {
    const baseKeys = new Set(BASE_FIELDS[scope].map((b) => b.key));
    const existing = new Set(
      (list.data ?? [])
        .map((f) => f.field_key)
        .filter((k) => k !== editing?.field_key)
        .concat([...baseKeys]),
    );
    if (!base) return base;
    if (!existing.has(base)) return base;
    let i = 2; while (existing.has(`${base}_${i}`)) i++; return `${base}_${i}`;
  }

  function openNew() {
    reset();
    setOrder((list.data ?? []).length);
    setOpen(true);
  }
  function openEdit(f: UnifiedField) {
    setEditing(f); setLabel(f.label); setKey(f.field_key); setKeyTouched(true);
    setType(f.field_type as any); setRequired(f.required); setOrder(f.order_index);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const finalKey = editing ? key : uniqueKey(toSnake(key || label));
      const config: Record<string, any> = {};
      if (type === "select" || type === "multiselect") {
        const opts = optionsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        if (opts.length > 0) config.options = opts;
      }
      if (type === "text" && cepRole) config.role = "cep";
      if (scope === "record") {
        await upsertCategoryDefaultField({ data: {
          id: editing?.id, category_id: categoryId,
          field_key: finalKey, label, field_type: type, required, order_index: order, config,
        } });
      } else {
        await upsertCategoryCascadeField({ data: {
          id: editing?.id, scope, category_id: categoryId,
          field_key: finalKey, label, field_type: type, required, order_index: order, config,
        } });
      }
      toast.success(editing ? "Campo atualizado" : "Campo criado");
      setOpen(false); reset();
      qc.invalidateQueries({ queryKey: ["admin-defaults", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      if (scope === "record") {
        await deleteCategoryDefaultField({ data: { id } });
      } else {
        await deleteCategoryCascadeField({ data: { scope, id } });
      }
      toast.success("Campo removido");
      qc.invalidateQueries({ queryKey: ["admin-defaults", scope, categoryId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  const baseFields = BASE_FIELDS[scope];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Campos-base (fixos) aparecem no topo somente como referência. Campos adicionais definidos aqui são semeados retroativamente.
        </p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="h-4 w-4" />Novo campo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editing ? "Editar campo" : "Novo campo"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="df-label">Rótulo</Label>
                <Input id="df-label" required value={label} onChange={(e) => {
                  setLabel(e.target.value);
                  if (!keyTouched && !editing) setKey(uniqueKey(toSnake(e.target.value)));
                }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="df-key">Chave</Label>
                <Input id="df-key" required pattern="^[a-z][a-z0-9_]*$" value={key}
                  readOnly={!!editing} disabled={!!editing}
                  onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="df-order">Ordem</Label>
                  <Input id="df-order" type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="df-req" className="text-sm">Obrigatório</Label>
                  <Switch id="df-req" checked={required} onCheckedChange={setRequired} />
                </div>
                {(type === "select" || type === "multiselect") ? (
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="df-options">Opções (uma por linha)</Label>
                    <Textarea id="df-options" rows={4} value={optionsText}
                      onChange={(e) => setOptionsText(e.target.value)}
                      placeholder="Ex: Aluguel&#10;Venda&#10;Temporada" />
                  </div>
                ) : null}
                {type === "text" ? (
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <Label htmlFor="df-cep" className="text-sm">Autocompletar via ViaCEP</Label>
                      <p className="text-xs text-muted-foreground">Ao preencher, busca endereço e preenche logradouro/bairro/cidade/estado.</p>
                    </div>
                    <Switch id="df-cep" checked={cepRole} onCheckedChange={setCepRole} />
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Salvar" : "Criar")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ordem</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>Rótulo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baseFields.map((b) => (
              <TableRow key={`base-${b.key}`} className="bg-muted/40">
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="font-mono text-xs">{b.key}</TableCell>
                <TableCell className="flex items-center gap-2">{b.label} <Badge variant="outline">base</Badge></TableCell>
                <TableCell><Badge variant="secondary">{b.type}</Badge></TableCell>
                <TableCell>{b.required ? "sim" : "—"}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
            {list.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : (list.data ?? []).length === 0 && baseFields.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhum campo definido.</TableCell></TableRow>
            ) : (
              (list.data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.order_index}</TableCell>
                  <TableCell className="font-mono text-xs">{f.field_key}</TableCell>
                  <TableCell>{f.label}</TableCell>
                  <TableCell><Badge variant="secondary">{f.field_type}</Badge></TableCell>
                  <TableCell>{f.required ? "sim" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="outline"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover campo?</AlertDialogTitle>
                            <AlertDialogDescription>Ação irreversível.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(f.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------- Public card layout editor ----------

type EditorRow = {
  field_key: string;
  width_percent: 25 | 50 | 75 | 100;
  order_index: number;
  label_override?: string;
  icon?: string;
};

function LayoutsSection() {
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && cats.data && cats.data.length > 0) setSelected(cats.data[0].id);
  }, [cats.data, selected]);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Layout dos cards públicos</CardTitle>
          <p className="text-sm text-muted-foreground">Escolha quais campos aparecem no card da organização e do registro, e em que largura.</p>
        </div>
        <Select value={selected ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <Tabs defaultValue="organization_card">
            <TabsList>
              <TabsTrigger value="organization_card">Card de organização</TabsTrigger>
              <TabsTrigger value="record_card">Card de registro</TabsTrigger>
            </TabsList>
            <TabsContent value="organization_card"><LayoutEditor categoryId={selected} scope="organization_card" /></TabsContent>
            <TabsContent value="record_card"><LayoutEditor categoryId={selected} scope="record_card" /></TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function LayoutEditor({ categoryId, scope }: { categoryId: string; scope: "organization_card" | "record_card" }) {
  const qc = useQueryClient();
  const src = useQuery({
    queryKey: ["admin-layout", scope, categoryId],
    queryFn: async () => {
      const layout = await listCategoryLayout({ data: { category_id: categoryId, scope } });
      const scopeArg = scope === "organization_card" ? "org" : "record";
      const cascadeFields = scopeArg === "record"
        ? await listCategoryDefaultFields({ data: { category_id: categoryId } })
        : await listCategoryCascadeFields({ data: { category_id: categoryId, scope: "org" } });
      const baseFields: Array<{ field_key: string; label: string }> = scope === "organization_card"
        ? [
            { field_key: "name", label: "Nome (base)" },
            { field_key: "description", label: "Descrição (base)" },
            { field_key: "logo_url", label: "Logo (base)" },
            { field_key: "address.city", label: "Cidade (base)" },
            { field_key: "address.state", label: "UF (base)" },
            { field_key: "address.neighborhood", label: "Bairro (base)" },
            { field_key: "address.street", label: "Logradouro (base)" },
            { field_key: "address.number", label: "Número (base)" },
            { field_key: "address.complement", label: "Complemento (base)" },
            { field_key: "address.cep", label: "CEP (base)" },
          ]
        : [];
      const fields = [
        ...baseFields,
        ...(cascadeFields as Array<{ field_key: string; label: string }>),
      ];
      return { layout: layout.fields as LayoutField[], fields };
    },
  });

  const [rows, setRows] = useState<EditorRow[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (src.data) {
      setRows(src.data.layout.map((r) => ({
        field_key: r.field_key,
        width_percent: r.width_percent,
        order_index: r.order_index,
        label_override: (r.config?.label_override as string) ?? "",
        icon: (r.config?.icon as string) ?? "",
      })));
    }
  }, [src.data]);

  const available = (src.data?.fields ?? []).filter((f) => !rows.some((r) => r.field_key === f.field_key));

  function updateRow(i: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function moveRow(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((r, idx) => ({ ...r, order_index: idx }));
    });
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, order_index: idx })));
  }
  function addField(field_key: string) {
    setRows((prev) => [...prev, { field_key, width_percent: 100 as const, order_index: prev.length }]);
  }
  async function save() {
    setSaving(true);
    try {
      await saveCategoryLayout({ data: {
        category_id: categoryId, scope,
        fields: rows.map((r, i) => ({
          field_key: r.field_key, width_percent: r.width_percent, order_index: i,
          config: {
            ...(r.label_override ? { label_override: r.label_override } : {}),
            ...(r.icon ? { icon: r.icon } : {}),
          },
        })),
      } });
      toast.success("Layout salvo");
      qc.invalidateQueries({ queryKey: ["admin-layout", scope, categoryId] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  if (src.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Ordem</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Rótulo (override)</TableHead>
              <TableHead>Ícone (lucide)</TableHead>
              <TableHead className="w-32">Largura</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhum campo no layout. Adicione abaixo.</TableCell></TableRow>
            ) : rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => moveRow(i, -1)} disabled={i === 0}>↑</Button>
                    <Button size="sm" variant="outline" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1}>↓</Button>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.field_key}</TableCell>
                <TableCell><Input value={r.label_override ?? ""} onChange={(e) => updateRow(i, { label_override: e.target.value })} placeholder="—" /></TableCell>
                <TableCell><Input value={r.icon ?? ""} onChange={(e) => updateRow(i, { icon: e.target.value })} placeholder="Home, MapPin..." /></TableCell>
                <TableCell>
                  <Select value={String(r.width_percent)} onValueChange={(v) => updateRow(i, { width_percent: Number(v) as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25%</SelectItem>
                      <SelectItem value="50">50%</SelectItem>
                      <SelectItem value="75">75%</SelectItem>
                      <SelectItem value="100">100%</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Adicionar campo:</span>
        {available.length === 0 ? <span className="text-xs text-muted-foreground">Todos os campos da categoria já foram incluídos.</span> : (
          available.map((f) => (
            <Button key={f.field_key} size="sm" variant="outline" onClick={() => addField(f.field_key)}>
              <Plus className="h-3 w-3" />{f.label}
            </Button>
          ))
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Salvar layout</>}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        As larguras devem somar 100% por linha (25+75, 50+50, 25+25+50, ou 100). O motor agrupa os campos em linhas automaticamente.
      </p>
    </div>
  );
}


function BlogSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-blog-posts"], queryFn: () => listBlogPostsAdmin() });
  async function onDelete(id: string) {
    try {
      await deleteBlogPost({ data: { id } });
      toast.success("Post removido");
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      qc.invalidateQueries({ queryKey: ["public-blog"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-display">Posts do blog</CardTitle>
        <Button size="sm" asChild>
          <Link to="/admin/blog/$postId" params={{ postId: "new" }}><Plus className="h-4 w-4" />Novo post</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum post ainda" description="Crie o primeiro post do blog." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Atualizado</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((p: BlogPostListItem) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={p.status === "published" ? "default" : "secondary"}>
                      {p.status === "published" ? "Publicado" : "Rascunho"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/admin/blog/$postId" params={{ postId: p.id }}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover post?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(p.id)}>Remover</AlertDialogAction>
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


// ---------- Filter fields (explore) ----------

function FilterFieldsSection() {
  const { t } = useLabels();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && cats.data && cats.data.length > 0) setSelected(cats.data[0].id);
  }, [cats.data, selected]);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Filtros públicos por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha quais campos aparecem como filtros ou entram na busca livre em Explorar.
          </p>
        </div>
        <Select value={selected ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <Tabs defaultValue="organization">
            <TabsList className="mb-4">
              <TabsTrigger value="organization">{t("organization", "Organização")}</TabsTrigger>
              <TabsTrigger value="record">{t("record", "Registro")}</TabsTrigger>
            </TabsList>
            <TabsContent value="organization"><FilterScopeEditor categoryId={selected} scope="organization" /></TabsContent>
            <TabsContent value="record"><FilterScopeEditor categoryId={selected} scope="record" /></TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

const ORG_BASE_FILTER_KEYS: Array<{ key: string; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "description", label: "Descrição" },
  { key: "address.city", label: "Cidade" },
  { key: "address.state", label: "UF" },
  { key: "address.neighborhood", label: "Bairro" },
];

function FilterScopeEditor({ categoryId, scope }: { categoryId: string; scope: "organization" | "record" }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-filters", scope, categoryId],
    queryFn: () => listCategoryFilterFieldsPublic({ data: { category_id: categoryId, scope } }),
  });
  const catFields = useQuery({
    queryKey: ["admin-defaults", scope === "organization" ? "org" : "record", categoryId],
    queryFn: async () => {
      if (scope === "record") {
        const rows = await listCategoryDefaultFields({ data: { category_id: categoryId } });
        return (rows as CategoryDefaultField[]).map((r) => ({ key: r.field_key, label: r.label }));
      }
      const rows = await listCategoryCascadeFields({ data: { category_id: categoryId, scope: "org" } });
      return (rows as CategoryCascadeField[]).map((r) => ({ key: r.field_key, label: r.label }));
    },
  });

  const availableKeys = [
    ...(scope === "organization" ? ORG_BASE_FILTER_KEYS : []),
    ...((catFields.data ?? []) as Array<{ key: string; label: string }>),
  ];
  const usedKeys = new Set((list.data ?? []).map((f) => f.field_key));
  const pickable = availableKeys.filter((f) => !usedKeys.has(f.key));

  const [newKey, setNewKey] = useState<string>("");
  const [newType, setNewType] = useState<"search" | "select">("select");

  async function add() {
    if (!newKey) return;
    try {
      await upsertCategoryFilterField({
        data: {
          category_id: categoryId,
          scope,
          field_key: newKey,
          filter_type: newType,
          order_index: (list.data ?? []).length,
        },
      });
      toast.success("Filtro adicionado");
      setNewKey("");
      qc.invalidateQueries({ queryKey: ["admin-filters", scope, categoryId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function updateType(f: CategoryFilterField, filter_type: "search" | "select") {
    try {
      await upsertCategoryFilterField({ data: { id: f.id, category_id: f.category_id, scope: f.scope, field_key: f.field_key, filter_type, order_index: f.order_index } });
      qc.invalidateQueries({ queryKey: ["admin-filters", scope, categoryId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryFilterField({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-filters", scope, categoryId] });
    } catch (err) { toast.error((err as Error).message); }
  }

  const labelFor = (key: string) => availableKeys.find((f) => f.key === key)?.label ?? key;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1 space-y-1">
          <Label>Campo</Label>
          <Select value={newKey} onValueChange={setNewKey}>
            <SelectTrigger><SelectValue placeholder="Selecione um campo" /></SelectTrigger>
            <SelectContent>
              {pickable.length === 0 ? (
                <SelectItem value="__none" disabled>Todos os campos já foram adicionados.</SelectItem>
              ) : pickable.map((f) => (
                <SelectItem key={f.key} value={f.key}>{f.label} <span className="text-muted-foreground">({f.key})</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48 space-y-1">
          <Label>Comportamento</Label>
          <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="select">Filtro (lista)</SelectItem>
              <SelectItem value="search">Busca (texto livre)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={add} disabled={!newKey || newKey === "__none"}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead className="w-52">Comportamento</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : (list.data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nenhum filtro configurado.</TableCell></TableRow>
            ) : (
              (list.data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{labelFor(f.field_key)}</TableCell>
                  <TableCell className="font-mono text-xs">{f.field_key}</TableCell>
                  <TableCell>
                    <Select value={f.filter_type} onValueChange={(v) => updateType(f, v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select">Filtro (lista)</SelectItem>
                        <SelectItem value="search">Busca (texto livre)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

