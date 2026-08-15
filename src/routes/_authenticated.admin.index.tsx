import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Pencil,
  ArrowLeft,
  Shield,
  FileText,
  Check,
  Settings2,
  Layers,
  LayoutGrid,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SegmentedToggle } from "@/components/venue/segmented-toggle";
import { cn } from "@/lib/utils";
import { listBlogPostsAdmin, deleteBlogPost, type BlogPostListItem } from "@/lib/blog.functions";

import { AppShell } from "@/components/venue/app-shell";
import { FieldCatalogSection } from "@/components/admin/field-catalog-section";
import {
  FieldTypeConfig,
  applyDraftToConfig,
  draftFromConfig,
  emptyTypeDraft,
  formatOptionLines,
  parseOptionLines,
  type TypeDraft,
} from "@/components/admin/field-type-config";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLabels } from "@/hooks/use-instance-context";

import { amISuperAdmin, getInstanceSettingsPublic, updateInstanceSettings } from "@/lib/instance-settings.functions";
import {
  listPlatformLabelsPublic,
  upsertPlatformLabel,
  listCategoryLabelsPublic,
  upsertCategoryLabel,
  deleteCategoryLabel,
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
  getCategoryBaseFieldConfig,
  updateCategoryBaseFieldConfig,
  type CategoryCascadeField,
  type BaseFieldPresentation,
} from "@/lib/category-cascade.functions";
import {
  listCategoryFieldGroups,
  upsertCategoryFieldGroup,
  deleteCategoryFieldGroup,
  type CategoryFieldGroup,
} from "@/lib/category-field-groups.functions";
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
import {
  listCategoryStandardForms,
  upsertCategoryStandardForm,
  deleteCategoryStandardForm,
  listCategoryStandardFormFields,
  upsertCategoryStandardFormField,
  deleteCategoryStandardFormField,
  type CategoryStandardForm,
  type CategoryStandardFormField,
} from "@/lib/category-standard-forms.functions";
import { listCategoryLayout, saveCategoryLayout, type LayoutField } from "@/lib/category-layouts.functions";
import {
  listCategoryFilterFieldsPublic,
  upsertCategoryFilterField,
  deleteCategoryFilterField,
  type CategoryFilterField,
} from "@/lib/category-filters.functions";
import { listPendingReviewsAdmin, moderateReviewAdmin, type ReviewModerationItem } from "@/lib/reviews.functions";
import { HomeGroupingsSection } from "@/components/admin/home-groupings-section";
import { HomeBlocksSection } from "@/components/admin/home-blocks-section";

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
    <AppShell title="Configurações" subtitle="Ajustes globais que valem para todas as organizações.">
      <AdminWorkspace />
    </AppShell>
  );
}

// ---------- Workspace (sidebar + toggle segmentado) ----------

type AdminSection = { value: string; label: string; render: () => ReactElement };
type AdminGroup = { value: string; label: string; icon: LucideIcon; sections: AdminSection[] };

const ADMIN_GROUPS: AdminGroup[] = [
  {
    value: "settings",
    label: "Configurações",
    icon: Settings2,
    sections: [
      { value: "general", label: "Geral", render: () => <GeneralSection /> },
      { value: "labels", label: "Rótulos", render: () => <LabelsSection /> },
    ],
  },
  {
    value: "structure",
    label: "Estrutura",
    icon: Layers,
    sections: [
      { value: "categories", label: "Categorias", render: () => <CategoriesSection /> },
      { value: "defaults", label: "Campos", render: () => <DefaultFieldsSection /> },
      { value: "standard-tables", label: "Tabelas", render: () => <StandardTablesSection /> },
      { value: "standard-forms", label: "Formulários", render: () => <StandardFormsSection /> },
      { value: "filters", label: "Filtros", render: () => <FilterFieldsSection /> },
    ],
  },
  {
    value: "layout",
    label: "Layout",
    icon: LayoutGrid,
    sections: [
      { value: "layouts", label: "Layout público", render: () => <LayoutsSection /> },
      { value: "home-groupings", label: "Agrupamentos", render: () => <HomeGroupingsSection /> },
      { value: "home-blocks", label: "Seções home", render: () => <HomeBlocksSection /> },
    ],
  },
  {
    value: "content",
    label: "Conteúdo",
    icon: FileText,
    sections: [
      { value: "blog", label: "Blog", render: () => <BlogSection /> },
      { value: "reviews", label: "Avaliações", render: () => <ReviewsSection /> },
    ],
  },
];

function AdminWorkspace() {
  const [groupValue, setGroupValue] = useState(ADMIN_GROUPS[0].value);
  const [sectionValue, setSectionValue] = useState(ADMIN_GROUPS[0].sections[0].value);
  const [menuOpen, setMenuOpen] = useState(false);

  const group = ADMIN_GROUPS.find((g) => g.value === groupValue) ?? ADMIN_GROUPS[0];
  const section = group.sections.find((s) => s.value === sectionValue) ?? group.sections[0];

  function selectGroup(value: string) {
    const g = ADMIN_GROUPS.find((x) => x.value === value) ?? ADMIN_GROUPS[0];
    setGroupValue(g.value);
    setSectionValue(g.sections[0].value);
    setMenuOpen(false);
  }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Áreas da administração">
      {ADMIN_GROUPS.map((g) => {
        const active = g.value === group.value;
        const Icon = g.icon;
        return (
          <button
            key={g.value}
            type="button"
            onClick={() => selectGroup(g.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-left text-sm font-medium transition-colors outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "bg-primary text-primary-foreground shadow-elegant"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{g.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex gap-6">
      <aside className="hidden w-56 shrink-0 rounded-2xl border border-transparent bg-transparent p-2 min-[860px]:block">
        {nav}
      </aside>

      <div className="min-w-0 grow">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Abrir menu"
                className="h-10 w-10 rounded-full min-[860px]:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle>Administração</SheetTitle>
              </SheetHeader>
              {nav}
            </SheetContent>
          </Sheet>

          {group.sections.length > 1 ? (
            <SegmentedToggle
              ariaLabel={group.label}
              value={section.value}
              onValueChange={setSectionValue}
              options={group.sections.map((s) => ({ value: s.value, label: s.label }))}
            />
          ) : null}
        </div>

        {section.render()}
      </div>
    </div>
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

  if (s.isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Geral</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tz">Fuso horário padrão</Label>
            <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="America/Sao_Paulo" />
            <p className="text-xs text-muted-foreground">IANA (ex.: America/Sao_Paulo, Europe/Lisbon).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccy">Código de moeda (ISO 4217)</Label>
            <Input
              id="ccy"
              value={ccy}
              onChange={(e) => setCcy(e.target.value.toUpperCase())}
              placeholder="BRL"
              maxLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sym">Símbolo</Label>
            <Input id="sym" value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Posição do símbolo</Label>
            <Select value={pos} onValueChange={(v) => setPos(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <p className="text-sm text-muted-foreground">
                Quando desligado, apenas o super admin pode criar/editar/apagar {t("fields", "campos").toLowerCase()} em{" "}
                {t("tables", "tabelas").toLowerCase()}.
              </p>
            </div>
            <Switch checked={allow} onCheckedChange={setAllow} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** "Opção | Icone" por linha → { options, option_icons }. */

// ---------- Labels ----------

function LabelsSection() {
  const qc = useQueryClient();
  const labels = useQuery({ queryKey: ["admin-platform-labels"], queryFn: () => listPlatformLabelsPublic() });
  const catLabels = useQuery({ queryKey: ["admin-category-labels"], queryFn: () => listCategoryLabelsPublic() });
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [scope, setScope] = useState<string>("global");
  const isGlobal = scope === "global";

  const [drafts, setDrafts] = useState<Record<string, { label: string; icon: string }>>({});
  useEffect(() => {
    if (!labels.data) return;
    const overrides = new Map((catLabels.data ?? []).filter((c) => c.category_id === scope).map((c) => [c.key, c]));
    const d: Record<string, { label: string; icon: string }> = {};
    for (const l of labels.data) {
      const o = isGlobal ? undefined : overrides.get(l.key);
      d[l.key] = { label: o?.label ?? l.label, icon: o?.icon ?? l.icon ?? "" };
    }
    setDrafts(d);
  }, [labels.data, catLabels.data, scope, isGlobal]);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-platform-labels"] }),
      qc.invalidateQueries({ queryKey: ["admin-category-labels"] }),
      qc.invalidateQueries({ queryKey: ["platform-labels"] }),
      qc.invalidateQueries({ queryKey: ["category-labels"] }),
    ]);
  }

  async function saveLabel(key: string) {
    const d = drafts[key];
    if (!d) return;
    try {
      if (isGlobal) await upsertPlatformLabel({ data: { key, label: d.label, icon: d.icon || null } });
      else await upsertCategoryLabel({ data: { category_id: scope, key, label: d.label, icon: d.icon || null } });
      toast.success("Rótulo salvo");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function resetLabel(key: string) {
    if (isGlobal) return;
    try {
      await deleteCategoryLabel({ data: { category_id: scope, key } });
      toast.success("Rótulo da categoria removido");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const overriddenKeys = new Set((catLabels.data ?? []).filter((c) => c.category_id === scope).map((c) => c.key));

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Termos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ao escolher uma categoria, os rótulos definidos sobrepõem os globais apenas nela.
          </p>
        </div>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global (todas as categorias)</SelectItem>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {labels.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave</TableHead>
                  <TableHead>Rótulo</TableHead>
                  <TableHead>Ícone (lucide)</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(labels.data ?? []).map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-2">
                        {l.key}
                        {!isGlobal && overriddenKeys.has(l.key) ? <Badge variant="secondary">categoria</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={drafts[l.key]?.label ?? ""}
                        onChange={(e) =>
                          setDrafts((s) => ({
                            ...s,
                            [l.key]: { ...(s[l.key] ?? { label: "", icon: "" }), label: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={drafts[l.key]?.icon ?? ""}
                        onChange={(e) =>
                          setDrafts((s) => ({
                            ...s,
                            [l.key]: { ...(s[l.key] ?? { label: "", icon: "" }), icon: e.target.value },
                          }))
                        }
                        placeholder="Building2"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => saveLabel(l.key)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        {!isGlobal && overriddenKeys.has(l.key) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resetLabel(l.key)}
                            aria-label="Remover rótulo da categoria"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
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

  function openNew() {
    setEditing(null);
    setName("");
    setIcon("");
    setDescription("");
    setOpen(true);
  }
  function openEdit(c: OrganizationCategory) {
    setEditing(c);
    setName(c.name);
    setIcon(c.icon ?? "");
    setDescription(c.description ?? "");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateOrganizationCategory({
          data: { id: editing.id, name, icon: icon || null, description: description || null },
        });
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
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display">Categorias de {organizationLabel}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="c-name">Nome</Label>
                <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-icon">Ícone (lucide)</Label>
                <Input id="c-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Tag" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-desc">Descrição</Label>
                <Textarea id="c-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {cats.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (cats.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Shield className="h-5 w-5" />}
            title="Nenhuma categoria criada"
            description={`Crie a primeira categoria para começar a classificar ${organizationsLabel}.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ícone</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>{t("organizations", "Organizações")}</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cats.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.icon ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {c.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{counts.data?.[c.id] ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
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
  "text",
  "long_text",
  "number",
  "currency",
  "boolean",
  "date",
  "datetime",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
  "image",
  "gallery",
  "file",
  "relation",
  "computed",
] as const;

type DefaultsScope = "org" | "table" | "record";

type UnifiedField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  order_index: number;
  config: Record<string, any>;
  group_id?: string | null;
  is_base?: boolean;
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
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
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
  const [lastReconcile, setLastReconcile] = useState<{
    organizations: number;
    tables_touched: number;
    fields_added: number;
  } | null>(null);

  async function reconcile() {
    if (!selected) return;
    setReconciling(true);
    try {
      const r = await reconcileCategoryAllOrganizations({ data: { category_id: selected } });
      setLastReconcile(r);
      toast.success(
        `${r.fields_added} ${fieldsLabel} em ${r.tables_touched} ${tablesLabel} de ${r.organizations} ${t("organizations", "organizações").toLowerCase()}.`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReconciling(false);
    }
  }

  const [tab, setTab] = useState("org");

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Campos padrão por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Definição obrigatória por categoria. Determina os {fieldsLabel} exibidos ao criar {organizationLabel},{" "}
            {t("table", "tabela").toLowerCase()} e {t("record", "registro").toLowerCase()}.
          </p>
        </div>
        {tab === "all" ? null : (
          <Select value={selected ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione categoria" />
            </SelectTrigger>
            <SelectContent>
              {(cats.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="org">Organização</TabsTrigger>
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="record">Registro</TabsTrigger>
              <TabsTrigger
                value="all"
                className="text-destructive data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
              >
                Todos os campos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="org">
              <ScopeEditor categoryId={selected} scope="org" />
            </TabsContent>
            <TabsContent value="table">
              <ScopeEditor categoryId={selected} scope="table" />
            </TabsContent>
            <TabsContent value="record">
              <ScopeEditor categoryId={selected} scope="record" />
            </TabsContent>
            <TabsContent value="all">
              <FieldCatalogSection />
            </TabsContent>
          </Tabs>
        )}

        {selected && tab !== "all" ? (

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
                  Última execução: {lastReconcile.fields_added} {fieldsLabel} em {lastReconcile.tables_touched}{" "}
                  {tablesLabel} de {lastReconcile.organizations} {t("organizations", "organizações").toLowerCase()}.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}


const SCOPE_BASE_KEY: Record<DefaultsScope, "organization" | "table" | null> = {
  org: "organization",
  table: "table",
  record: null,
};


function FieldGroupsManager({ categoryId, scope }: { categoryId: string; scope: DefaultsScope }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-field-groups", scope, categoryId],
    queryFn: () => listCategoryFieldGroups({ data: { category_id: categoryId, scope } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryFieldGroup | null>(null);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditing(null);
    setTitle("");
    setKey("");
    setDescription("");
    setOrder((list.data ?? []).length);
  }

  function openEdit(g: CategoryFieldGroup) {
    setEditing(g);
    setTitle(g.title);
    setKey(g.key);
    setDescription(g.description ?? "");
    setOrder(g.order_index);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertCategoryFieldGroup({
        data: {
          id: editing?.id,
          category_id: categoryId,
          scope,
          key: editing ? editing.key : toSnake(key || title),
          title,
          description: description.trim() ? description.trim() : null,
          order_index: order,
        },
      });
      toast.success(editing ? "Bloco atualizado" : "Bloco criado");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin-field-groups", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryFieldGroup({ data: { id } });
      toast.success("Bloco removido");
      qc.invalidateQueries({ queryKey: ["admin-field-groups", scope, categoryId] });
      qc.invalidateQueries({ queryKey: ["admin-defaults", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Blocos de campos</p>
          <p className="text-xs text-muted-foreground">
            Agrupam os campos no formulário com título e descrição próprios.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0" onClick={reset}>
              <Plus className="h-4 w-4" />
              Novo bloco
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar bloco" : "Novo bloco"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fg-title">Título</Label>
                <Input id="fg-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              {!editing ? (
                <div className="space-y-2">
                  <Label htmlFor="fg-key">Chave</Label>
                  <Input
                    id="fg-key"
                    className="font-mono"
                    placeholder="auto"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="fg-desc">Descrição</Label>
                <Textarea id="fg-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fg-order">Ordem</Label>
                <Input id="fg-order" type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-3 space-y-2">
        {list.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum bloco definido. Campos aparecem em bloco único.</p>
        ) : (
          (list.data ?? []).map((g) => (
            <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {g.title} <span className="font-mono text-xs text-muted-foreground">{g.key}</span>
                </p>
                {g.description ? <p className="truncate text-xs text-muted-foreground">{g.description}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(g)} aria-label="Editar bloco">
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" aria-label="Remover bloco">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover bloco?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Os campos deste bloco continuam existindo, apenas ficam sem agrupamento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(g.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BaseFieldRow({
  base,
  presentation,
  onEdit,
  groupTitle,
}: {
  base: { key: string; label: string; type: string; required: boolean };
  presentation: BaseFieldPresentation | undefined;
  onEdit: () => void;
  groupTitle: string | null;
}) {
  const visible = presentation?.visible ?? true;
  return (
    <TableRow className="bg-muted/40">
      <TableCell className="text-muted-foreground">{presentation?.order_index ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">{base.key}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          {presentation?.label || base.label} <Badge variant="outline">base</Badge>
          {!visible ? <Badge variant="secondary">oculto</Badge> : null}
          {groupTitle ? <Badge variant="secondary">{groupTitle}</Badge> : null}
        </span>
        {presentation?.tooltip ? (
          <span className="block truncate text-xs text-muted-foreground">{presentation.tooltip}</span>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{base.type}</Badge>
      </TableCell>
      <TableCell>{(presentation?.required ?? base.required) ? "sim" : "—"}</TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Editar ${base.label}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
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
          id: r.id,
          field_key: r.field_key,
          label: r.label,
          field_type: r.field_type,
          required: r.required,
          order_index: r.order_index,
          config: (r.config ?? {}) as Record<string, any>,
          group_id: r.group_id ?? null,
          is_base: r.is_base ?? false,
        }));
      }
      const rows = await listCategoryCascadeFields({ data: { category_id: categoryId, scope } });
      return (rows as CategoryCascadeField[]).map((r) => ({
        id: r.id,
        field_key: r.field_key,
        label: r.label,
        field_type: r.field_type,
        required: r.required,
        order_index: r.order_index,
        config: (r.config ?? {}) as Record<string, any>,
        group_id: r.group_id ?? null,
        is_base: r.is_base ?? false,
      }));
    },
  });

  const groups = useQuery({
    queryKey: ["admin-field-groups", scope, categoryId],
    queryFn: () => listCategoryFieldGroups({ data: { category_id: categoryId, scope } }),
  });
  const groupTitle = (id?: string | null) =>
    (groups.data ?? []).find((g) => g.id === id)?.title ?? null;

  const baseKey = SCOPE_BASE_KEY[scope];
  const baseCfg = useQuery({
    queryKey: ["admin-base-field-config", categoryId],
    queryFn: () => getCategoryBaseFieldConfig({ data: { category_id: categoryId } }),
  });
  const basePresentation = (key: string): BaseFieldPresentation | undefined =>
    baseKey ? ((baseCfg.data as any)?.[baseKey]?.[key] as BaseFieldPresentation | undefined) : undefined;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnifiedField | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [required, setRequired] = useState(false);
  const [order, setOrder] = useState(0);
  const [tooltip, setTooltip] = useState("");
  const [groupId, setGroupId] = useState("__none__");
  const [isBase, setIsBase] = useState(false);
  const [saving, setSaving] = useState(false);

  // configuração por tipo
  const [typeDraft, setTypeDraft] = useState<TypeDraft>(emptyTypeDraft());

  function reset() {
    setEditing(null);
    setLabel("");
    setKey("");
    setType("text");
    setRequired(false);
    setOrder(0);
    setTooltip("");
    setGroupId("__none__");
    setIsBase(false);
    setTypeDraft(emptyTypeDraft());
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
    let i = 2;
    while (existing.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  }

  function openNew() {
    reset();
    setOrder((list.data ?? []).length);
    setOpen(true);
  }

  function openEdit(f: UnifiedField) {
    reset();
    setEditing(f);
    setLabel(f.label);
    setKey(f.field_key);
    setType(f.field_type as any);
    setRequired(f.required);
    setOrder(f.order_index);
    const cfg = f.config ?? {};
    setTooltip(typeof cfg.tooltip === "string" ? cfg.tooltip : "");
    setGroupId(f.group_id ?? "__none__");
    setIsBase(!!f.is_base);
    setTypeDraft(draftFromConfig(cfg));
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const finalKey = editing ? key : uniqueKey(toSnake(key || label));
      // Merge com o config existente: preserva chaves desconhecidas e limpa as
      // que não se aplicam mais ao tipo escolhido.
      const config = applyDraftToConfig(editing?.config ?? null, type, typeDraft, tooltip);


      const payload = {
        id: editing?.id,
        category_id: categoryId,
        field_key: finalKey,
        label,
        field_type: type,
        required,
        order_index: order,
        config,
        group_id: groupId === "__none__" ? null : groupId,
        is_base: isBase,
      };
      if (scope === "record") {
        await upsertCategoryDefaultField({ data: payload });
      } else {
        await upsertCategoryCascadeField({ data: { ...payload, scope } });
      }
      toast.success(editing ? "Campo atualizado" : "Campo criado");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin-defaults", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ----- edição de campo base (apresentação) -----
  const [baseOpen, setBaseOpen] = useState(false);
  const [baseEditing, setBaseEditing] = useState<{ key: string; label: string; type: string; required: boolean } | null>(null);
  const [bLabel, setBLabel] = useState("");
  const [bTooltip, setBTooltip] = useState("");
  const [bRequired, setBRequired] = useState(false);
  const [bVisible, setBVisible] = useState(true);
  const [bOrder, setBOrder] = useState(0);
  const [bGroup, setBGroup] = useState("__none__");
  const [bSaving, setBSaving] = useState(false);

  function openBaseEdit(b: { key: string; label: string; type: string; required: boolean }) {
    const p = basePresentation(b.key);
    setBaseEditing(b);
    setBLabel(p?.label ?? b.label);
    setBTooltip(p?.tooltip ?? "");
    setBRequired(p?.required ?? b.required);
    setBVisible(p?.visible ?? true);
    setBOrder(p?.order_index ?? 0);
    setBGroup(p?.group_id ?? "__none__");
    setBaseOpen(true);
  }

  async function submitBase(e: React.FormEvent) {
    e.preventDefault();
    if (!baseEditing || !baseKey) return;
    setBSaving(true);
    try {
      const current = (baseCfg.data ?? { organization: {}, table: {} }) as any;
      const next = {
        organization: { ...(current.organization ?? {}) },
        table: { ...(current.table ?? {}) },
      };
      next[baseKey] = {
        ...(next[baseKey] ?? {}),
        [baseEditing.key]: {
          visible: bVisible,
          required: bRequired,
          label: bLabel,
          tooltip: bTooltip.trim(),
          group_id: bGroup === "__none__" ? null : bGroup,
          order_index: bOrder,
        },
      };
      await updateCategoryBaseFieldConfig({ data: { category_id: categoryId, base_field_config: next } });
      toast.success("Campo base atualizado");
      setBaseOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-base-field-config", categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBSaving(false);
    }
  }

  const baseFields = BASE_FIELDS[scope];

  return (
    <div className="space-y-4">
      <FieldGroupsManager categoryId={categoryId} scope={scope} />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 text-xs text-muted-foreground">
          Campos-base têm chave e tipo fixos, mas rótulo, ajuda, obrigatoriedade, bloco e visibilidade são editáveis.
          Campos adicionais definidos aqui são semeados retroativamente.
        </p>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo campo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar campo" : "Novo campo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="df-label">Rótulo</Label>
                <Input id="df-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="df-key">Chave</Label>
                <Input
                  id="df-key"
                  className="font-mono"
                  placeholder="auto"
                  pattern="^[a-z][a-z0-9_]*$"
                  value={key}
                  readOnly={!!editing}
                  disabled={!!editing}
                  onChange={(e) => setKey(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((tp) => (
                        <SelectItem key={tp} value={tp}>
                          {tp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="df-order">Ordem</Label>
                  <Input
                    id="df-order"
                    type="number"
                    min={0}
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Bloco</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem bloco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem bloco</SelectItem>
                      {(groups.data ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="df-tooltip">Texto de ajuda (tooltip)</Label>
                  <Textarea
                    id="df-tooltip"
                    rows={2}
                    value={tooltip}
                    onChange={(e) => setTooltip(e.target.value)}
                    placeholder="Exibido em ícone (i) ao lado do rótulo no formulário."
                  />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="df-req" className="text-sm">
                    Obrigatório
                  </Label>
                  <Switch id="df-req" checked={required} onCheckedChange={setRequired} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <Label htmlFor="df-base" className="text-sm">
                      Campo base da plataforma
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Semeia este campo automaticamente em todas as categorias.
                    </p>
                  </div>
                  <Switch id="df-base" checked={isBase} onCheckedChange={setIsBase} />
                </div>
                <FieldTypeConfig
                  type={type}
                  draft={typeDraft}
                  onChange={(patch) => setTypeDraft((d) => ({ ...d, ...patch }))}
                  idPrefix="df"
                />

              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={baseOpen} onOpenChange={setBaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar campo base</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitBase} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Chave</Label>
                <Input className="font-mono" value={baseEditing?.key ?? ""} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value={baseEditing?.type ?? ""} readOnly disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-label">Rótulo</Label>
              <Input id="bf-label" required value={bLabel} onChange={(e) => setBLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-tooltip">Texto de ajuda (tooltip)</Label>
              <Textarea id="bf-tooltip" rows={2} value={bTooltip} onChange={(e) => setBTooltip(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bloco</Label>
                <Select value={bGroup} onValueChange={setBGroup}>
                  <SelectTrigger><SelectValue placeholder="Sem bloco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem bloco</SelectItem>
                    {(groups.data ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bf-order">Ordem</Label>
                <Input id="bf-order" type="number" min={0} value={bOrder} onChange={(e) => setBOrder(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="bf-req" className="text-sm">Obrigatório</Label>
              <Switch id="bf-req" checked={bRequired} onCheckedChange={setBRequired} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="bf-vis" className="text-sm">Visível no formulário</Label>
              <Switch id="bf-vis" checked={bVisible} onCheckedChange={setBVisible} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBaseOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={bSaving}>
                {bSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              <BaseFieldRow
                key={`base-${b.key}`}
                base={b}
                presentation={basePresentation(b.key)}
                groupTitle={groupTitle(basePresentation(b.key)?.group_id)}
                onEdit={() => openBaseEdit(b)}
              />
            ))}
            {list.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center">
                  <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : (list.data ?? []).length === 0 && baseFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum campo definido.
                </TableCell>
              </TableRow>
            ) : (
              (list.data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.order_index}</TableCell>
                  <TableCell className="font-mono text-xs">{f.field_key}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      {f.label}
                      {f.is_base ? <Badge variant="outline">base</Badge> : null}
                      {groupTitle(f.group_id) ? <Badge variant="secondary">{groupTitle(f.group_id)}</Badge> : null}
                    </span>
                    {f.config?.tooltip ? (
                      <span className="block truncate text-xs text-muted-foreground">{String(f.config.tooltip)}</span>
                    ) : null}
                    {Array.isArray(f.config?.options) && f.config.options.length > 0 ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {f.config.options.length} opções: {(f.config.options as any[]).slice(0, 4).join(", ")}
                        {f.config.options.length > 4 ? "…" : ""}
                      </span>
                    ) : f.field_type === "select" || f.field_type === "multiselect" ? (
                      <span className="block text-xs text-destructive">sem opções configuradas</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{f.field_type}</Badge>
                  </TableCell>
                  <TableCell>{f.required ? "sim" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
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
  prefix?: string;
  icon?: string;
  bleed?: boolean;
  style?: "title" | "subtitle" | "normal";
  slot?: "background" | "badge" | "top_right" | "rating" | "title" | "features" | "location";
  display?: "text" | "icons";
};

const IMMERSIVE_SLOTS: Array<{ value: NonNullable<EditorRow["slot"]>; label: string }> = [
  { value: "background", label: "Imagem de fundo" },
  { value: "badge", label: "Selo (topo esquerda)" },
  { value: "top_right", label: "Texto (topo direita)" },
  { value: "rating", label: "Avaliação (topo direita)" },
  { value: "title", label: "Título (rodapé esquerda)" },
  { value: "features", label: "Comodidades (rodapé esquerda)" },
  { value: "location", label: "Localização (rodapé direita)" },
];

function isMediaFieldKey(key: string) {
  return key === "logo_url" || /(avatar|capa|cover|foto|galeria|gallery|imagem|image|logo|photo|picture)/i.test(key);
}

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
          <p className="text-sm text-muted-foreground">
            Escolha quais campos aparecem no card da organização e do registro, e em que largura.
          </p>
        </div>
        <Select value={selected ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione categoria" />
          </SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
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
              <TabsTrigger value="organization_page">Página de organização</TabsTrigger>
            </TabsList>
            <TabsContent value="organization_card">
              <LayoutEditor categoryId={selected} scope="organization_card" />
            </TabsContent>
            <TabsContent value="record_card">
              <LayoutEditor categoryId={selected} scope="record_card" />
            </TabsContent>
            <TabsContent value="organization_page">
              <PageStyleSelector categoryId={selected} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

/** Miniatura em skeleton do Layout 1 (cabeçalho + duas colunas). */
function LayoutOneThumb() {
  return (
    <div className="space-y-1.5 rounded-md bg-muted/60 p-2">
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-5 rounded bg-muted-foreground/30" />
        <div className="h-2 w-16 rounded bg-muted-foreground/30" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="col-span-2 space-y-1.5">
          <div className="h-2 w-full rounded bg-muted-foreground/20" />
          <div className="h-2 w-5/6 rounded bg-muted-foreground/20" />
          <div className="h-10 w-full rounded bg-muted-foreground/20" />
        </div>
        <div className="h-16 rounded bg-muted-foreground/30" />
      </div>
    </div>
  );
}

/** Miniatura em skeleton do Layout 2 (faixa hero + colunas assimétricas). */
function LayoutTwoThumb() {
  return (
    <div className="space-y-1.5 rounded-md bg-muted/60 p-2">
      <div className="relative -mx-2 -mt-2 h-10 bg-muted-foreground/30">
        <div className="absolute bottom-1 left-2 h-2 w-14 rounded bg-background/70" />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <div className="col-span-3 space-y-1.5">
          <div className="h-2 w-full rounded bg-muted-foreground/20" />
          <div className="h-2 w-4/5 rounded bg-muted-foreground/20" />
          <div className="h-8 w-full rounded bg-muted-foreground/20" />
        </div>
        <div className="col-span-2 -mt-4 h-16 rounded bg-muted-foreground/30 shadow-elegant" />
      </div>
    </div>
  );
}

/**
 * Seleção estática do estilo da página pública de organização.
 * Correção da Iteração 28: sem editor de campos, apenas Layout 1 ou Layout 2.
 */
function PageStyleSelector({ categoryId }: { categoryId: string }) {
  const qc = useQueryClient();
  const src = useQuery({
    queryKey: ["admin-layout", "organization_page", categoryId],
    queryFn: () => listCategoryLayout({ data: { category_id: categoryId, scope: "organization_page" } }),
  });
  const [style, setStyle] = useState<"standard" | "immersive">("standard");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (src.data) setStyle((src.data.card_style as "standard" | "immersive") ?? "standard");
  }, [src.data]);

  async function save() {
    setSaving(true);
    try {
      await saveCategoryLayout({
        data: { category_id: categoryId, scope: "organization_page", card_style: style, fields: [] },
      });
      toast.success("Estilo da página salvo");
      qc.invalidateQueries({ queryKey: ["admin-layout", "organization_page", categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (src.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  const options: Array<{ value: "standard" | "immersive"; title: string; desc: string; thumb: ReactNode }> = [
    { value: "standard", title: "Layout 1", desc: "Cabeçalho com logo e duas colunas.", thumb: <LayoutOneThumb /> },
    {
      value: "immersive",
      title: "Layout 2",
      desc: "Faixa hero com galeria e card de interesse sobreposto.",
      thumb: <LayoutTwoThumb />,
    },
  ];

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha a estrutura da página individual de organização. Os dois layouts têm estrutura fixa e usam os campos já
        cadastrados.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((o) => {
          const active = style === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setStyle(o.value)}
              aria-pressed={active}
              className={`rounded-xl border p-3 text-left outline-hidden transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
            >
              {o.thumb}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="font-medium">{o.title}</span>
                {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{o.desc}</p>
            </button>
          );
        })}
      </div>
      <Button onClick={save} disabled={saving} className="min-h-11">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Salvar estilo
      </Button>
    </div>
  );
}

function LayoutEditor({
  categoryId,
  scope,
}: {
  categoryId: string;
  scope: "organization_card" | "record_card" | "organization_page";
}) {
  const qc = useQueryClient();
  const src = useQuery({
    queryKey: ["admin-layout", scope, categoryId],
    queryFn: async () => {
      const layout = await listCategoryLayout({ data: { category_id: categoryId, scope } });
      const isOrgScope = scope === "organization_card" || scope === "organization_page";
      const scopeArg = isOrgScope ? "org" : "record";
      const cascadeFields =
        scopeArg === "record"
          ? await listCategoryDefaultFields({ data: { category_id: categoryId } })
          : await listCategoryCascadeFields({ data: { category_id: categoryId, scope: "org" } });
      const baseFields: Array<{ field_key: string; label: string }> = isOrgScope
        ? [
            { field_key: "name", label: "Nome (base)" },
            { field_key: "description", label: "Descrição (base)" },
            { field_key: "logo_url", label: "Logo (base)" },
            { field_key: "address.city", label: "Cidade (base)" },
            { field_key: "address.state", label: "UF (base)" },
            { field_key: "address.city_state_full", label: "Cidade - Estado (extenso) (base)" },
            { field_key: "address.neighborhood", label: "Bairro (base)" },
            { field_key: "address.street", label: "Logradouro (base)" },
            { field_key: "address.number", label: "Número (base)" },
            { field_key: "address.complement", label: "Complemento (base)" },
            { field_key: "address.cep", label: "CEP (base)" },
          ]
        : [
            { field_key: "org_name", label: "Organização (base)" },
            { field_key: "table_name", label: "Tabela (base)" },
            { field_key: "deal_status", label: "Status (base)" },
          ];
      const fields = [...baseFields, ...(cascadeFields as Array<{ field_key: string; label: string }>)];
      return { layout: layout.fields as LayoutField[], card_style: layout.card_style ?? "standard", fields };
    },
  });

  const [rows, setRows] = useState<EditorRow[]>([]);
  const [cardStyle, setCardStyle] = useState<"standard" | "immersive">("standard");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (src.data) {
      setCardStyle((src.data.card_style as "standard" | "immersive") ?? "standard");
      setRows(
        src.data.layout.map((r) => ({
          field_key: r.field_key,
          width_percent: r.width_percent,
          order_index: r.order_index,
          label_override: (r.config?.label_override as string) ?? "",
          prefix: (r.config?.prefix as string) ?? "",
          icon: (r.config?.icon as string) ?? "",
          bleed: (r.config?.bleed as boolean) ?? false,
          style: (r.config?.style as EditorRow["style"]) ?? (r.field_key === "name" ? "title" : "normal"),
          slot: (r.config?.slot as EditorRow["slot"]) ?? undefined,
          display: (r.config?.display as EditorRow["display"]) ?? "icons",
        })),
      );
    }
  }, [src.data]);

  const available = (src.data?.fields ?? []).filter((f) => !rows.some((r) => r.field_key === f.field_key));

  function updateRow(i: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
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
      await saveCategoryLayout({
        data: {
          category_id: categoryId,
          scope,
          card_style: cardStyle,
          fields: rows.map((r, i) => ({
            field_key: r.field_key,
            width_percent: r.width_percent,
            order_index: i,
            config: {
              ...(r.label_override ? { label_override: r.label_override } : {}),
              ...(r.prefix?.trim() ? { prefix: r.prefix.trim() } : {}),
              ...(r.icon ? { icon: r.icon } : {}),
              ...(r.bleed && r.width_percent === 100 ? { bleed: true } : {}),
              ...(r.style ? { style: r.style } : {}),
              ...(cardStyle === "immersive" && r.slot ? { slot: r.slot } : {}),
              ...(cardStyle === "immersive" && r.slot === "features" && r.display ? { display: r.display } : {}),
            },
          })),
        },
      });
      toast.success("Layout salvo");
      qc.invalidateQueries({ queryKey: ["admin-layout", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (src.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  const immersive = cardStyle === "immersive";

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{scope === "organization_page" ? "Estilo da página" : "Estilo do card"}</p>
          <p className="text-xs text-muted-foreground">
            {immersive
              ? "Layout 2: faixa hero com imagem de fundo e informações sobrepostas."
              : "Layout 1: duas colunas com campos empilhados e largura configurável."}
          </p>
        </div>
        <Select value={cardStyle} onValueChange={(v) => setCardStyle(v as "standard" | "immersive")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Layout 1</SelectItem>
            <SelectItem value="immersive">Layout 2</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Ordem</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Rótulo (override)</TableHead>
              <TableHead className="w-32">Prefixo</TableHead>
              <TableHead>Ícone (lucide)</TableHead>
              {immersive ? (
                <>
                  <TableHead className="w-52">Posição</TableHead>
                  <TableHead className="w-36">Exibição</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-36">Estilo</TableHead>
                  <TableHead className="w-32">Largura</TableHead>
                  <TableHead className="w-32">Sem margens</TableHead>
                </>
              )}
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={immersive ? 8 : 9} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum campo no layout. Adicione abaixo.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => {
                const bleedable = isMediaFieldKey(r.field_key) && r.width_percent === 100;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => moveRow(i, -1)} disabled={i === 0}>
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moveRow(i, 1)}
                          disabled={i === rows.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.field_key}</TableCell>
                    <TableCell>
                      <Input
                        value={r.label_override ?? ""}
                        onChange={(e) => updateRow(i, { label_override: e.target.value })}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.prefix ?? ""}
                        onChange={(e) => updateRow(i, { prefix: e.target.value })}
                        placeholder="ATÉ"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.icon ?? ""}
                        onChange={(e) => updateRow(i, { icon: e.target.value })}
                        placeholder="Home, MapPin..."
                      />
                    </TableCell>
                    {immersive ? (
                      <>
                        <TableCell>
                          <Select
                            value={r.slot ?? "title"}
                            onValueChange={(v) => updateRow(i, { slot: v as EditorRow["slot"] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {IMMERSIVE_SLOTS.map((sl) => (
                                <SelectItem key={sl.value} value={sl.value}>
                                  {sl.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {r.slot === "features" ? (
                            <Select
                              value={r.display ?? "icons"}
                              onValueChange={(v) => updateRow(i, { display: v as EditorRow["display"] })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="icons">Somente ícones</SelectItem>
                                <SelectItem value="text">Texto</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell>
                        <Select
                          value={r.style ?? "normal"}
                          onValueChange={(v) => updateRow(i, { style: v as EditorRow["style"] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="title">Título (H3)</SelectItem>
                            <SelectItem value="subtitle">Subtítulo</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {immersive ? null : (
                      <>
                        <TableCell>
                          <Select
                            value={String(r.width_percent)}
                            onValueChange={(v) => updateRow(i, { width_percent: Number(v) as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="25">25%</SelectItem>
                              <SelectItem value="50">50%</SelectItem>
                              <SelectItem value="75">75%</SelectItem>
                              <SelectItem value="100">100%</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {bleedable ? (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border accent-primary"
                                checked={!!r.bleed}
                                onChange={(e) => updateRow(i, { bleed: e.target.checked })}
                              />
                              Ignorar padding
                            </label>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => removeRow(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Adicionar campo:</span>
        {available.length === 0 ? (
          <span className="text-xs text-muted-foreground">Todos os campos da categoria já foram incluídos.</span>
        ) : (
          available.map((f) => (
            <Button key={f.field_key} size="sm" variant="outline" onClick={() => addField(f.field_key)}>
              <Plus className="h-3 w-3" />
              {f.label}
            </Button>
          ))
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar layout
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {immersive
          ? 'No Layout 2 a largura é ignorada: cada campo é posicionado pela posição escolhida. Comodidades usam os ícones definidos nas opções do campo ("Opção | Icone").'
          : "As larguras devem somar 100% por linha (25+75, 50+50, 25+25+50, ou 100). O motor agrupa os campos em linhas automaticamente."}
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
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-display">Posts do blog</CardTitle>
        <Button size="sm" asChild>
          <Link to="/admin/blog/$postId" params={{ postId: "new" }}>
            <Plus className="h-4 w-4" />
            Novo post
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Nenhum post ainda"
            description="Crie o primeiro post do blog."
          />
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
                        <Link to="/admin/blog/$postId" params={{ postId: p.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione categoria" />
          </SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
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
            <TabsContent value="organization">
              <FilterScopeEditor categoryId={selected} scope="organization" />
            </TabsContent>
            <TabsContent value="record">
              <FilterScopeEditor categoryId={selected} scope="record" />
            </TabsContent>
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
        return (rows as CategoryDefaultField[]).map((r) => ({ key: r.field_key, label: r.label, type: r.field_type }));
      }
      const rows = await listCategoryCascadeFields({ data: { category_id: categoryId, scope: "org" } });
      return (rows as CategoryCascadeField[]).map((r) => ({ key: r.field_key, label: r.label, type: r.field_type }));
    },
  });

  const availableKeys = [
    ...(scope === "organization" ? ORG_BASE_FILTER_KEYS : []),
    ...((catFields.data ?? []) as Array<{ key: string; label: string; type?: string }>),
  ];
  const numericKeys = ((catFields.data ?? []) as Array<{ key: string; label: string; type?: string }>).filter(
    (f) => f.type === "number" || f.type === "currency",
  );
  const usedKeys = new Set((list.data ?? []).map((f) => f.field_key));
  const pickable = availableKeys.filter((f) => !usedKeys.has(f.key));

  const [newKey, setNewKey] = useState<string>("");
  const [newType, setNewType] = useState<"search" | "select" | "range">("select");
  const [minKey, setMinKey] = useState<string>("");
  const [maxKey, setMaxKey] = useState<string>("");
  const [rangeLabel, setRangeLabel] = useState<string>("");

  async function add() {
    const isRange = newType === "range";
    if (isRange ? !(minKey && maxKey && rangeLabel.trim()) : !newKey) return;
    try {
      await upsertCategoryFilterField({
        data: {
          category_id: categoryId,
          scope,
          field_key: isRange ? `${minKey}__${maxKey}__range` : newKey,
          filter_type: newType,
          label_override: isRange ? rangeLabel.trim() : null,
          min_field_key: isRange ? minKey : null,
          max_field_key: isRange ? maxKey : null,
          order_index: (list.data ?? []).length,
        },
      });
      toast.success("Filtro adicionado");
      setNewKey("");
      setMinKey("");
      setMaxKey("");
      setRangeLabel("");
      qc.invalidateQueries({ queryKey: ["admin-filters", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function updateType(f: CategoryFilterField, filter_type: "search" | "select" | "range") {
    try {
      await upsertCategoryFilterField({
        data: {
          id: f.id,
          category_id: f.category_id,
          scope: f.scope,
          field_key: f.field_key,
          filter_type,
          label_override: f.label_override ?? null,
          min_field_key: f.min_field_key ?? null,
          max_field_key: f.max_field_key ?? null,
          order_index: f.order_index,
        },
      });
      qc.invalidateQueries({ queryKey: ["admin-filters", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryFilterField({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-filters", scope, categoryId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const labelFor = (key: string) => availableKeys.find((f) => f.key === key)?.label ?? key;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className={cn("min-w-[240px] flex-1 space-y-1", newType === "range" && "hidden")}>
          <Label>Campo</Label>
          <Select value={newKey} onValueChange={setNewKey}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um campo" />
            </SelectTrigger>
            <SelectContent>
              {pickable.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Todos os campos já foram adicionados.
                </SelectItem>
              ) : (
                pickable.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label} <span className="text-muted-foreground">({f.key})</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1">
          <Label>Comportamento</Label>
          <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="select">Filtro (lista)</SelectItem>
              <SelectItem value="search">Busca (texto livre)</SelectItem>
              <SelectItem value="range">Faixa numérica (a partir de / até)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {newType === "range" ? (
          <>
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label>Campo mínimo</Label>
              <Select value={minKey} onValueChange={setMinKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Campo numérico" />
                </SelectTrigger>
                <SelectContent>
                  {numericKeys.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Nenhum campo numérico nesta categoria.
                    </SelectItem>
                  ) : (
                    numericKeys.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label} <span className="text-muted-foreground">({f.key})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label>Campo máximo</Label>
              <Select value={maxKey} onValueChange={setMaxKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Campo numérico" />
                </SelectTrigger>
                <SelectContent>
                  {numericKeys.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Nenhum campo numérico nesta categoria.
                    </SelectItem>
                  ) : (
                    numericKeys.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label} <span className="text-muted-foreground">({f.key})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label>Rótulo</Label>
              <Input
                value={rangeLabel}
                onChange={(e) => setRangeLabel(e.target.value)}
                placeholder="Ex.: Capacidade"
              />
            </div>
          </>
        ) : null}

        <Button
          size="sm"
          onClick={add}
          disabled={
            newType === "range"
              ? !minKey || !maxKey || minKey === "__none" || maxKey === "__none" || !rangeLabel.trim()
              : !newKey || newKey === "__none"
          }
        >
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
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center">
                  <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : (list.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum filtro configurado.
                </TableCell>
              </TableRow>
            ) : (
              (list.data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.label_override ?? labelFor(f.field_key)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {f.filter_type === "range"
                      ? `${f.min_field_key ?? "?"} → ${f.max_field_key ?? "?"}`
                      : f.field_key}
                  </TableCell>
                  <TableCell>
                    <Select value={f.filter_type} onValueChange={(v) => updateType(f, v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select">Filtro (lista)</SelectItem>
                        <SelectItem value="search">Busca (texto livre)</SelectItem>
                        <SelectItem value="range" disabled={f.filter_type !== "range"}>
                          Faixa numérica (a partir de / até)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => remove(f.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

// ---------- Standard tables per category ----------

const ST_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "boolean",
  "date",
  "datetime",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
  "image",
  "gallery",
  "file",
  "relation",
  "computed",
] as const;

function stSnake(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
function stSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function StandardTablesSection() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedCat && cats.data && cats.data.length > 0) setSelectedCat(cats.data[0].id);
  }, [cats.data, selectedCat]);

  const tables = useQuery({
    queryKey: ["admin-std-tables", selectedCat],
    queryFn: () =>
      selectedCat
        ? listCategoryStandardTables({ data: { category_id: selectedCat } })
        : Promise.resolve([] as CategoryStandardTable[]),
    enabled: !!selectedCat,
  });

  const [openTable, setOpenTable] = useState(false);
  const [editingTable, setEditingTable] = useState<CategoryStandardTable | null>(null);
  const [tName, setTName] = useState("");
  const [tSlugV, setTSlugV] = useState("");
  const [tIcon, setTIcon] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tOrder, setTOrder] = useState(0);
  const [tPub, setTPub] = useState(false);
  const [tBook, setTBook] = useState(false);
  const [tBusy, setTBusy] = useState(false);

  function openNewTable() {
    setEditingTable(null);
    setTName("");
    setTSlugV("");
    setTIcon("");
    setTDesc("");
    setTOrder((tables.data ?? []).length);
    setTPub(false);
    setTBook(false);
    setOpenTable(true);
  }
  function openEditTable(t: CategoryStandardTable) {
    setEditingTable(t);
    setTName(t.name);
    setTSlugV(t.slug);
    setTIcon(t.icon ?? "");
    setTDesc(t.description ?? "");
    setTOrder(t.order_index);
    setTPub(!!t.is_public);
    setTBook(!!(t as any).bookable);
    setOpenTable(true);
  }
  async function saveTable(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCat) return;
    setTBusy(true);
    try {
      await upsertCategoryStandardTable({
        data: {
          id: editingTable?.id,
          category_id: selectedCat,
          name: tName,
          slug: tSlugV || stSlug(tName),
          icon: tIcon || null,
          description: tDesc || null,
          order_index: tOrder,
          is_public: tPub,
          bookable: tBook,
        },
      });
      toast.success(editingTable ? "Tabela atualizada" : "Tabela criada");
      setOpenTable(false);
      qc.invalidateQueries({ queryKey: ["admin-std-tables", selectedCat] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTBusy(false);
    }
  }
  async function removeTable(id: string) {
    try {
      await deleteCategoryStandardTable({ data: { id } });
      toast.success("Tabela removida");
      qc.invalidateQueries({ queryKey: ["admin-std-tables", selectedCat] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  useEffect(() => {
    const list = tables.data ?? [];
    if (list.length === 0) {
      setSelectedTable(null);
      return;
    }
    if (!selectedTable || !list.find((t) => t.id === selectedTable)) setSelectedTable(list[0].id);
  }, [tables.data, selectedTable]);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Tabelas padrão por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Estruturas de tabela criadas automaticamente em cada nova organização da categoria. As tabelas nascem
            travadas — só o super admin edita a estrutura. Não retroage a organizações já existentes.
          </p>
        </div>
        <Select value={selectedCat ?? ""} onValueChange={setSelectedCat}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione categoria" />
          </SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedCat ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Tabelas-modelo</p>
              <Dialog
                open={openTable}
                onOpenChange={(v) => {
                  setOpenTable(v);
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openNewTable}>
                    <Plus className="h-4 w-4" />
                    Nova tabela
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">{editingTable ? "Editar tabela" : "Nova tabela"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={saveTable} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        required
                        value={tName}
                        onChange={(e) => {
                          setTName(e.target.value);
                          if (!editingTable && !tSlugV) setTSlugV(stSlug(e.target.value));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input
                        required
                        pattern="^[a-z0-9-]+$"
                        value={tSlugV}
                        onChange={(e) => setTSlugV(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Ícone (lucide)</Label>
                        <Input value={tIcon} onChange={(e) => setTIcon(e.target.value)} placeholder="Home" />
                      </div>
                      <div className="space-y-2">
                        <Label>Ordem</Label>
                        <Input
                          type="number"
                          min={0}
                          value={tOrder}
                          onChange={(e) => setTOrder(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea rows={3} value={tDesc} onChange={(e) => setTDesc(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="text-sm">Pública por padrão</Label>
                        <p className="text-xs text-muted-foreground">
                          Novas organizações desta categoria criam esta tabela já pública.
                        </p>
                      </div>
                      <Switch checked={tPub} onCheckedChange={setTPub} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="text-sm">Recebe reservas</Label>
                        <p className="text-xs text-muted-foreground">
                          Controle mestre: quando desligado, nenhuma organização da categoria pode habilitar reservas
                          nesta tabela.
                        </p>
                      </div>
                      <Switch checked={tBook} onCheckedChange={setTBook} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setOpenTable(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={tBusy}>
                        {tBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTable ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {(tables.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tabela-modelo definida.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Ícone</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tables.data ?? []).map((t) => (
                      <TableRow key={t.id} className={selectedTable === t.id ? "bg-muted/40" : ""}>
                        <TableCell>{t.order_index}</TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.icon ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedTable(t.id)}>
                              Campos
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEditTable(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover tabela-modelo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Novas organizações da categoria deixarão de receber esta tabela. Organizações já
                                    criadas não são afetadas.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeTable(t.id)}>Remover</AlertDialogAction>
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

            {selectedTable ? <StandardTableFieldsEditor standardTableId={selectedTable} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StandardTableFieldsEditor({ standardTableId }: { standardTableId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-std-fields", standardTableId],
    queryFn: () => listCategoryStandardTableFields({ data: { standard_table_id: standardTableId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryStandardTableField | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<(typeof ST_FIELD_TYPES)[number]>("text");
  const [required, setRequired] = useState(false);
  const [order, setOrder] = useState(0);
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditing(null);
    setLabel("");
    setKey("");
    setType("text");
    setRequired(false);
    setOrder(0);
    setOptionsText("");
  }
  function openNew() {
    reset();
    setOrder((list.data ?? []).length);
    setOpen(true);
  }
  function openEdit(f: CategoryStandardTableField) {
    setEditing(f);
    setLabel(f.label);
    setKey(f.field_key);
    setType(f.field_type as any);
    setRequired(f.required);
    setOrder(f.order_index);
    const opts = (f.config?.options as string[] | undefined) ?? [];
    setOptionsText(formatOptionLines(opts, f.config?.option_icons as Record<string, string> | undefined));
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const config: Record<string, any> = { ...(editing?.config ?? {}) };
      if (type === "select" || type === "multiselect") {
        const parsed = parseOptionLines(optionsText);
        if (parsed.options.length > 0) config.options = parsed.options;
        else delete config.options;
        if (Object.keys(parsed.option_icons).length > 0) config.option_icons = parsed.option_icons;
        else delete config.option_icons;
      } else {
        delete config.options;
        delete config.option_icons;
      }
      await upsertCategoryStandardTableField({
        data: {
          id: editing?.id,
          standard_table_id: standardTableId,
          field_key: editing ? key : key || stSnake(label),
          label,
          field_type: type,
          required,
          order_index: order,
          config,
        },
      });
      toast.success(editing ? "Campo atualizado" : "Campo criado");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin-std-fields", standardTableId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await deleteCategoryStandardTableField({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-std-fields", standardTableId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Campos da tabela-modelo</p>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo campo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar campo" : "Novo campo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Rótulo</Label>
                <Input
                  required
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (!editing && !key) setKey(stSnake(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Chave</Label>
                <Input
                  required
                  pattern="^[a-z][a-z0-9_]*$"
                  value={key}
                  readOnly={!!editing}
                  disabled={!!editing}
                  onChange={(e) => setKey(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ST_FIELD_TYPES.map((tp) => (
                        <SelectItem key={tp} value={tp}>
                          {tp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                  <Label className="text-sm">Obrigatório</Label>
                  <Switch checked={required} onCheckedChange={setRequired} />
                </div>
                {type === "select" || type === "multiselect" ? (
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Opções (uma por linha)</Label>
                    <Textarea rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {(list.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum campo definido.</p>
      ) : (
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
              {(list.data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.order_index}</TableCell>
                  <TableCell className="font-mono text-xs">{f.field_key}</TableCell>
                  <TableCell>{f.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{f.field_type}</Badge>
                  </TableCell>
                  <TableCell>{f.required ? <Badge>sim</Badge> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(f.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---------- Iteração 24: formulários padrão por categoria ----------

const FORM_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "boolean",
  "date",
  "datetime",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
  "image",
  "gallery",
  "file",
] as const;

function StandardFormsSection() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin-org-cats"], queryFn: () => listOrganizationCategoriesPublic() });
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedCat && cats.data && cats.data.length > 0) setSelectedCat(cats.data[0].id);
  }, [cats.data, selectedCat]);

  const stdTables = useQuery({
    queryKey: ["admin-std-tables", selectedCat],
    queryFn: () =>
      selectedCat
        ? listCategoryStandardTables({ data: { category_id: selectedCat } })
        : Promise.resolve([] as CategoryStandardTable[]),
    enabled: !!selectedCat,
  });

  const forms = useQuery({
    queryKey: ["admin-std-forms", selectedCat],
    queryFn: () =>
      selectedCat
        ? listCategoryStandardForms({ data: { category_id: selectedCat } })
        : Promise.resolve([] as CategoryStandardForm[]),
    enabled: !!selectedCat,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryStandardForm | null>(null);
  const [scope, setScope] = useState<"organization" | "record">("organization");
  const [stdTableId, setStdTableId] = useState<string>("");
  const [name, setName] = useState("");
  const [submitLabel, setSubmitLabel] = useState("Enviar");
  const [targetName, setTargetName] = useState("Contatos");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setScope("organization");
    setStdTableId("");
    setName("Fale com a organização");
    setSubmitLabel("Enviar");
    setTargetName("Contatos");
    setActive(true);
    setOpen(true);
  }
  function openEdit(f: CategoryStandardForm) {
    setEditing(f);
    setScope(f.scope);
    setStdTableId(f.standard_table_id ?? "");
    setName(f.name);
    setSubmitLabel(f.submit_label);
    setTargetName(f.target_table_name);
    setActive(f.is_active);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCat) return;
    setBusy(true);
    try {
      await upsertCategoryStandardForm({
        data: {
          id: editing?.id,
          category_id: selectedCat,
          scope,
          standard_table_id: scope === "record" ? stdTableId || null : null,
          name,
          submit_label: submitLabel,
          target_table_name: targetName,
          is_active: active,
        },
      });
      toast.success(editing ? "Formulário atualizado" : "Formulário criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-std-forms", selectedCat] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryStandardForm({ data: { id } });
      toast.success("Formulário removido");
      qc.invalidateQueries({ queryKey: ["admin-std-forms", selectedCat] });
      if (selectedForm === id) setSelectedForm(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  useEffect(() => {
    const list = forms.data ?? [];
    if (list.length === 0) {
      setSelectedForm(null);
      return;
    }
    if (!selectedForm || !list.find((f) => f.id === selectedForm)) setSelectedForm(list[0].id);
  }, [forms.data, selectedForm]);

  const tableName = (id: string | null) => (stdTables.data ?? []).find((t) => t.id === id)?.name ?? "—";

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display">Formulários padrão por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Formulários públicos de contato/interesse criados automaticamente nas páginas públicas de organização e de
            registro. Alterações são aplicadas retroativamente a todas as organizações da categoria.
          </p>
        </div>
        <Select value={selectedCat ?? ""} onValueChange={setSelectedCat}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione categoria" />
          </SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedCat ? (
          <p className="text-sm text-muted-foreground">Crie uma categoria primeiro.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Formulários</p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openNew}>
                    <Plus className="h-4 w-4" />
                    Novo formulário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">
                      {editing ? "Editar formulário" : "Novo formulário"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={save} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Escopo</Label>
                      <Select value={scope} onValueChange={(v) => setScope(v as "organization" | "record")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organization">Página pública da organização</SelectItem>
                          <SelectItem value="record">Página pública de registro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {scope === "record" ? (
                      <div className="space-y-2">
                        <Label>Tabela padrão de origem</Label>
                        <Select value={stdTableId} onValueChange={setStdTableId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a tabela padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            {(stdTables.data ?? []).map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Nome do formulário</Label>
                      <Input required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Texto do botão</Label>
                        <Input required value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tabela de destino</Label>
                        <Input required value={targetName} onChange={(e) => setTargetName(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="text-sm">Ativo</Label>
                        <p className="text-xs text-muted-foreground">
                          Desativar remove o formulário das páginas públicas das organizações.
                        </p>
                      </div>
                      <Switch checked={active} onCheckedChange={setActive} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {(forms.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum formulário padrão definido.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Escopo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="w-40"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(forms.data ?? []).map((f) => (
                      <TableRow key={f.id} className={selectedForm === f.id ? "bg-muted/40" : ""}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {f.name}
                            {f.is_active ? null : <Badge variant="secondary">inativo</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f.scope === "organization" ? "Organização" : "Registro"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f.scope === "record" ? tableName(f.standard_table_id) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.target_table_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedForm(f.id)}>
                              Campos
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover formulário padrão?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O formulário deixa de aparecer nas páginas públicas das organizações desta
                                    categoria. As submissões já recebidas são preservadas.
                                  </AlertDialogDescription>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedForm ? <StandardFormFieldsEditor formId={selectedForm} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StandardFormFieldsEditor({ formId }: { formId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-std-form-fields", formId],
    queryFn: () => listCategoryStandardFormFields({ data: { form_id: formId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryStandardFormField | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<string>("text");
  const [required, setRequired] = useState(false);
  const [visible, setVisible] = useState(true);
  const [optionsText, setOptionsText] = useState("");
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setLabel("");
    setKey("");
    setType("text");
    setRequired(false);
    setVisible(true);
    setOptionsText("");
    setOrder((list.data ?? []).length);
    setOpen(true);
  }
  function openEdit(f: CategoryStandardFormField) {
    setEditing(f);
    setLabel(f.label);
    setKey(f.field_key);
    setType(f.field_type);
    setRequired(f.required);
    setVisible(f.visible !== false);
    setOptionsText(Array.isArray((f.config ?? {}).options) ? ((f.config as any).options as string[]).join("\n") : "");
    setOrder(f.order_index);
    setOpen(true);
  }


  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const options = optionsText
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      const config: Record<string, any> = { ...(editing?.config ?? {}) };
      if (type === "select" || type === "multiselect") config.options = options;
      else delete config.options;
      await upsertCategoryStandardFormField({
        data: {
          id: editing?.id,
          form_id: formId,
          field_key: key || toSnake(label),
          label,
          field_type: type as any,
          required,
          config,
          order_index: order,
        },
      });
      toast.success(editing ? "Campo atualizado" : "Campo criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-std-form-fields", formId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCategoryStandardFormField({ data: { id } });
      toast.success("Campo removido");
      qc.invalidateQueries({ queryKey: ["admin-std-form-fields", formId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Campos do formulário</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo campo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar campo" : "Novo campo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label>Rótulo</Label>
                <Input
                  required
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (!editing && !key) setKey(toSnake(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Chave</Label>
                <Input required pattern="^[a-z][a-z0-9_]*$" value={key} onChange={(e) => setKey(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
                </div>
              </div>
              {type === "select" || type === "multiselect" ? (
                <div className="space-y-2">
                  <Label>Opções (uma por linha)</Label>
                  <Textarea rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label className="text-sm">Obrigatório</Label>
                <Switch checked={required} onCheckedChange={setRequired} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum campo definido.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordem</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-24">Obrig.</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.order_index}</TableCell>
                  <TableCell className="font-medium">{f.label}</TableCell>
                  <TableCell className="font-mono text-xs">{f.field_key}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.field_type}</TableCell>
                  <TableCell>{f.required ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(f.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---------- Reviews moderation ----------

function ReviewsSection() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-pending-reviews"], queryFn: () => listPendingReviewsAdmin({}) });
  const [busy, setBusy] = useState<string | null>(null);

  async function handleModerate(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      await moderateReviewAdmin({ data: { id, status } });
      toast.success(status === "approved" ? "Avaliação aprovada" : "Avaliação rejeitada");
      await qc.invalidateQueries({ queryKey: ["admin-pending-reviews"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const items = (list.data?.items ?? []) as ReviewModerationItem[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Moderação de avaliações</CardTitle>
      </CardHeader>
      <CardContent>
        {list.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação pendente.</p>
        ) : (
          <div className="space-y-4">
            {items.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {r.user?.display_name || r.user?.email || "Usuário"}
                      </span>
                      <span className="text-muted-foreground">em</span>
                      <span className="font-medium text-foreground">{r.organization?.name || "Organização"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      ))}
                    </div>
                    {r.comment ? <p className="mt-2 text-sm text-foreground/90">{r.comment}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => handleModerate(r.id, "rejected")}
                    >
                      Rejeitar
                    </Button>
                    <Button size="sm" disabled={busy === r.id} onClick={() => handleModerate(r.id, "approved")}>
                      Aprovar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
