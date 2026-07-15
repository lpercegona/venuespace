import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Pencil, ArrowLeft, Shield } from "lucide-react";

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
  listCategoryPublicLayoutPublic,
  upsertCategoryPublicLayoutItem,
  deleteCategoryPublicLayoutItem,
  seedCategoryDefaultsRetroactive,
  type PublicLayoutItem,
  type FieldSourceKind,
} from "@/lib/category-layouts.functions";
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
  listSystemFieldsPublic,
  upsertSystemField,
  deleteSystemField,
  type SystemFieldRow,
  type SystemFieldScope,
} from "@/lib/system-fields.functions";
import { CategoryCascadeSection } from "@/components/venue/category-cascade-section";


export const Route = createFileRoute("/_authenticated/admin")({
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
          <TabsTrigger value="cascade">Cascata</TabsTrigger>
          <TabsTrigger value="layout">Layout público</TabsTrigger>
          <TabsTrigger value="system">Campos de sistema</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralSection /></TabsContent>
        <TabsContent value="labels"><LabelsSection /></TabsContent>
        <TabsContent value="categories"><CategoriesSection /></TabsContent>
        <TabsContent value="defaults"><DefaultFieldsSection /></TabsContent>
        <TabsContent value="cascade"><CategoryCascadeSection /></TabsContent>
        <TabsContent value="layout"><PublicLayoutSection /></TabsContent>
        <TabsContent value="system"><SystemFieldsSection /></TabsContent>
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

// ---------- Default fields per category ----------

const FIELD_TYPES = [
  "text","long_text","number","currency","boolean","date","datetime","select","multiselect","email","phone","url","image","file","relation","computed",
];

function DefaultFieldsSection() {
  const { t } = useLabels();
  const organizationLabel = t("organization", "organização").toLowerCase();
  const tableLabel = t("table", "tabela").toLowerCase();
  const fieldsLabel = t("fields", "campos").toLowerCase();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && cats.data && cats.data.length > 0) setSelected(cats.data[0].id);
  }, [cats.data, selected]);

  const fields = useQuery({
    queryKey: ["admin-cat-defaults", selected],
    queryFn: () => listCategoryDefaultFields({ data: { category_id: selected! } }),
    enabled: !!selected,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDefaultField | null>(null);
  const [fk, setFk] = useState("");
  const [flabel, setFlabel] = useState("");
  const [ftype, setFtype] = useState("text");
  const [freq, setFreq] = useState(false);
  const [forder, setForder] = useState(0);
  const [saving, setSaving] = useState(false);

  function openNew() { setEditing(null); setFk(""); setFlabel(""); setFtype("text"); setFreq(false); setForder((fields.data ?? []).length); setOpen(true); }
  function openEdit(f: CategoryDefaultField) { setEditing(f); setFk(f.field_key); setFlabel(f.label); setFtype(f.field_type); setFreq(f.required); setForder(f.order_index); setOpen(true); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await upsertCategoryDefaultField({ data: { id: editing?.id, category_id: selected, field_key: fk, label: flabel, field_type: ftype as any, required: freq, order_index: forder } });
      toast.success("Campo salvo");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["admin-cat-defaults", selected] });
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryDefaultField({ data: { id } });
      toast.success("Campo removido");
      await qc.invalidateQueries({ queryKey: ["admin-cat-defaults", selected] });
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-display">Campos padrão por categoria</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={selected ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
            <SelectContent>
              {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={openNew} disabled={!selected}><Plus className="h-4 w-4" />Novo campo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar campo padrão" : "Novo campo padrão"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="f-key">Chave (snake_case)</Label><Input id="f-key" required value={fk} onChange={(e) => setFk(e.target.value)} placeholder="titulo" /></div>
                  <div className="space-y-2"><Label htmlFor="f-label">Rótulo</Label><Input id="f-label" required value={flabel} onChange={(e) => setFlabel(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={ftype} onValueChange={setFtype}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="f-order">Ordem</Label><Input id="f-order" type="number" value={forder} onChange={(e) => setForder(Number(e.target.value))} /></div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-sm">Obrigatório</span>
                    <Switch checked={freq} onCheckedChange={setFreq} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!selected ? <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p> :
          fields.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
          (fields.data ?? []).length === 0 ? (
            <EmptyState icon={<Plus className="h-5 w-5" />} title={`Sem ${fieldsLabel} padrão`} description={`Adicione ${fieldsLabel} que serão semeados em toda ${tableLabel} nova de ${organizationLabel} desta categoria.`} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Chave</TableHead><TableHead>Rótulo</TableHead><TableHead>Tipo</TableHead><TableHead>Obrigatório</TableHead><TableHead className="w-32"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(fields.data ?? []).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="w-16">{f.order_index}</TableCell>
                      <TableCell className="font-mono text-xs">{f.field_key}</TableCell>
                      <TableCell>{f.label}</TableCell>
                      <TableCell><Badge variant="secondary">{f.field_type}</Badge></TableCell>
                      <TableCell>{f.required ? "sim" : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </CardContent>
    </Card>
  );
}

// ---------- Public layout per category ----------

const FIELD_SOURCES: Array<{ value: FieldSourceKind; label: string; hint: string }> = [
  { value: "record_data_field", label: "Campo da tabela (data)", hint: "Chave do field da tabela publicada (ex.: titulo, preco)" },
  { value: "record_field", label: "Campo de sistema do registro", hint: "Chave definida em Campos de sistema (registro)" },
  { value: "table_field", label: "Campo de sistema da tabela", hint: "Chave definida em Campos de sistema (tabela)" },
  { value: "org_field", label: "Campo de sistema da organização", hint: "Chave definida em Campos de sistema (organização)" },
];

function PublicLayoutSection() {
  const { t } = useLabels();
  const tablesLabel = t("tables", "tabelas").toLowerCase();
  const fieldsLabel = t("fields", "campos").toLowerCase();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && cats.data && cats.data.length > 0) setSelected(cats.data[0].id);
  }, [cats.data, selected]);

  const items = useQuery({
    queryKey: ["admin-cat-layout", selected],
    queryFn: () => listCategoryPublicLayoutPublic({ data: { category_id: selected! } }),
    enabled: !!selected,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicLayoutItem | null>(null);
  const [src, setSrc] = useState<FieldSourceKind>("record_data_field");
  const [ref, setRef] = useState("");
  const [icon, setIcon] = useState("");
  const [labelOv, setLabelOv] = useState("");
  const [ord, setOrd] = useState(0);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null); setSrc("record_data_field"); setRef(""); setIcon(""); setLabelOv("");
    setOrd((items.data ?? []).length); setOpen(true);
  }
  function openEdit(it: PublicLayoutItem) {
    setEditing(it); setSrc(it.field_source); setRef(it.field_ref); setIcon(it.icon ?? "");
    setLabelOv(it.label_override ?? ""); setOrd(it.order_index); setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await upsertCategoryPublicLayoutItem({ data: {
        id: editing?.id, category_id: selected, field_source: src, field_ref: ref,
        icon: icon || null, label_override: labelOv || null, order_index: ord,
      } });
      toast.success("Item salvo");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["admin-cat-layout", selected] });
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryPublicLayoutItem({ data: { id } });
      toast.success("Item removido");
      await qc.invalidateQueries({ queryKey: ["admin-cat-layout", selected] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function retroactive() {
    if (!selected) return;
    try {
      const r = await seedCategoryDefaultsRetroactive({ data: { category_id: selected } });
      toast.success(`${r.fields_created} ${fieldsLabel} criado(s) em ${r.tables_touched} ${tablesLabel}`);
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Layout público por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">Define quais {fieldsLabel} e ícones aparecem nos cards públicos das {tablesLabel} desta categoria.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selected ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
            <SelectContent>
              {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={retroactive} disabled={!selected}>Aplicar campos padrão retroativamente</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={openNew} disabled={!selected}><Plus className="h-4 w-4" />Novo item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar item" : "Novo item de layout"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2">
                  <Label>Origem do campo</Label>
                  <Select value={src} onValueChange={(v) => setSrc(v as FieldSourceKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_SOURCES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{FIELD_SOURCES.find((f) => f.value === src)?.hint}</p>
                </div>
                <div className="space-y-2"><Label htmlFor="l-ref">Chave do campo</Label><Input id="l-ref" required value={ref} onChange={(e) => setRef(e.target.value)} placeholder="titulo" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="l-icon">Ícone lucide</Label><Input id="l-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="MapPin" /></div>
                  <div className="space-y-2"><Label htmlFor="l-ord">Ordem</Label><Input id="l-ord" type="number" value={ord} onChange={(e) => setOrd(Number(e.target.value))} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="l-lab">Rótulo (override)</Label><Input id="l-lab" value={labelOv} onChange={(e) => setLabelOv(e.target.value)} placeholder="Opcional" /></div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!selected ? <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p> :
          items.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
          (items.data ?? []).length === 0 ? (
            <EmptyState icon={<Plus className="h-5 w-5" />} title="Sem itens de layout" description={`Adicione os ${fieldsLabel} que devem aparecer nos cards públicos das ${tablesLabel} desta categoria.`} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Origem</TableHead><TableHead>Chave</TableHead><TableHead>Rótulo</TableHead><TableHead>Ícone</TableHead><TableHead className="w-32"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(items.data ?? []).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="w-16">{it.order_index}</TableCell>
                      <TableCell><Badge variant="secondary">{it.field_source}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{it.field_ref}</TableCell>
                      <TableCell>{it.label_override ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{it.icon ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </CardContent>
    </Card>
  );
}

// ---------- System fields (instance-level, per scope) ----------

const SCOPES: Array<{ value: SystemFieldScope; label: string }> = [
  { value: "organization", label: "Organização" },
  { value: "table", label: "Tabela" },
  { value: "record", label: "Registro" },
];

function SystemFieldsSection() {
  const { t } = useLabels();
  const organizationLabel = t("organization", "organização").toLowerCase();
  const tableLabel = t("table", "tabela").toLowerCase();
  const recordLabel = t("record", "registro").toLowerCase();
  const qc = useQueryClient();
  const [scope, setScope] = useState<SystemFieldScope>("organization");
  const fields = useQuery({
    queryKey: ["admin-system-fields", scope],
    queryFn: () => listSystemFieldsPublic({ data: { scope } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SystemFieldRow | null>(null);
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [flabel, setFlabel] = useState("");
  const [ftype, setFtype] = useState("text");
  const [freq, setFreq] = useState(false);
  const [forder, setForder] = useState(0);
  const [saving, setSaving] = useState(false);

  function toSnake(input: string): string {
    return input
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
      .slice(0, 60);
  }

  function uniqueKey(base: string): string {
    const existing = new Set((fields.data ?? []).map((f) => f.key));
    if (!base) return base;
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  }

  function openNew() {
    setEditing(null); setKey(""); setKeyTouched(false); setFlabel(""); setFtype("text"); setFreq(false);
    setForder((fields.data ?? []).length); setOpen(true);
  }
  function openEdit(f: SystemFieldRow) {
    setEditing(f); setKey(f.key); setKeyTouched(true); setFlabel(f.label); setFtype(f.type);
    setFreq(f.required); setForder(f.position); setOpen(true);
  }

  function onLabelChange(v: string) {
    setFlabel(v);
    if (!editing && !keyTouched) setKey(toSnake(v));
  }
  function onKeyChange(v: string) {
    setKey(v);
    setKeyTouched(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let finalKey = key;
      if (!editing) {
        const base = toSnake(key || flabel);
        finalKey = uniqueKey(base);
        if (finalKey !== key) setKey(finalKey);
      }
      await upsertSystemField({ data: {
        id: editing?.id, scope, key: finalKey, label: flabel, type: ftype as any,
        required: freq, position: forder,
      } });
      toast.success("Campo salvo");
      setOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-system-fields", scope] }),
        qc.invalidateQueries({ queryKey: ["system-fields"] }),
      ]);
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      await deleteSystemField({ data: { scope, id } });
      toast.success("Campo removido");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-system-fields", scope] }),
        qc.invalidateQueries({ queryKey: ["system-fields"] }),
      ]);
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Campos de sistema</CardTitle>
          <p className="text-sm text-muted-foreground">Definidos globalmente pelo super admin. Aparecem em toda {organizationLabel}/{tableLabel}/{recordLabel} conforme o escopo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as SystemFieldScope)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="h-4 w-4" />Novo campo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar campo" : "Novo campo de sistema"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="sf-key">Chave</Label><Input id="sf-key" required value={key} onChange={(e) => onKeyChange(e.target.value)} placeholder="segmento" readOnly={!!editing} disabled={!!editing} /></div>
                  <div className="space-y-2"><Label htmlFor="sf-label">Rótulo</Label><Input id="sf-label" required value={flabel} onChange={(e) => onLabelChange(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={ftype} onValueChange={setFtype}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="sf-ord">Ordem</Label><Input id="sf-ord" type="number" value={forder} onChange={(e) => setForder(Number(e.target.value))} /></div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-sm">Obrigatório</span>
                    <Switch checked={freq} onCheckedChange={setFreq} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {fields.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
          (fields.data ?? []).length === 0 ? (
            <EmptyState icon={<Plus className="h-5 w-5" />} title="Sem campos de sistema" description="Adicione campos que aparecerão em toda nova/edição neste escopo." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Chave</TableHead><TableHead>Rótulo</TableHead><TableHead>Tipo</TableHead><TableHead>Obrigatório</TableHead><TableHead className="w-32"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(fields.data ?? []).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="w-16">{f.position}</TableCell>
                      <TableCell className="font-mono text-xs">{f.key}</TableCell>
                      <TableCell>{f.label}</TableCell>
                      <TableCell><Badge variant="secondary">{f.type}</Badge></TableCell>
                      <TableCell>{f.required ? "sim" : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </CardContent>
    </Card>
  );
}
