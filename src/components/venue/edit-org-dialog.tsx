import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateOrganization, deleteOrganization } from "@/lib/orgs.functions";
import { listOrganizationCategoriesPublic } from "@/lib/organization-categories.functions";
import { useSystemFields } from "@/hooks/use-system-fields";
import { useLabels } from "@/hooks/use-instance-context";
import { CategoryFieldsForm } from "@/components/venue/category-fields-form";
import { AddressFields, type AddressValue } from "@/components/venue/address-fields";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  org: {
    id: string; slug: string; name: string;
    description: string | null; logo_url: string | null;
    category_id?: string | null;
    timezone?: string | null;
    currency?: string | null;
    system_data?: Record<string, any> | null;
    category_data?: Record<string, any> | null;
    address?: AddressValue | null;
    is_public?: boolean | null;
  };
};

export function EditOrgDialog({ open, onOpenChange, org }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useLabels();
  const { fields: sysFields } = useSystemFields("organization");
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "");
  const [categoryId, setCategoryId] = useState<string>(org.category_id ?? "__none__");
  const [timezone, setTimezone] = useState(org.timezone ?? "");
  const [currency, setCurrency] = useState(org.currency ?? "");
  const initialSys = useMemo(() => (org.system_data ?? {}) as Record<string, any>, [org.system_data]);
  const [sysData, setSysData] = useState<Record<string, any>>(initialSys);
  const initialCat = useMemo(() => (org.category_data ?? {}) as Record<string, any>, [org.category_data]);
  const [catData, setCatData] = useState<Record<string, any>>(initialCat);
  const initialAddr = useMemo(() => (org.address ?? {}) as AddressValue, [org.address]);
  const [address, setAddress] = useState<AddressValue>(initialAddr);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deleting, setDeleting] = useState(false);

  const cats = useQuery({
    queryKey: ["public-org-categories"],
    queryFn: () => listOrganizationCategoriesPublic(),
    staleTime: 60_000,
  });

  function setSys(k: string, v: any) { setSysData((s) => ({ ...s, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateOrganization({ data: {
        id: org.id,
        name,
        description: description || null,
        logo_url: logoUrl || null,
        category_id: categoryId === "__none__" ? null : categoryId,
        timezone: timezone.trim() ? timezone.trim() : null,
        currency: currency.trim() ? currency.trim().toUpperCase() : null,
        system_data: sysData,
        category_data: catData,
        address,
      } });
      toast.success("Organização atualizada");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["org", org.slug] }),
        qc.invalidateQueries({ queryKey: ["my-orgs"] }),
      ]);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteOrganization({ data: { id: org.id, confirm_slug: confirmSlug } });
      toast.success(`${t("organization", "Organização")} excluída`);
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });
      setConfirmDelete(false);
      onOpenChange(false);
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Editar {t("organization", "organização").toLowerCase()}</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="o-name">Nome</Label>
            <Input id="o-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-desc">Descrição</Label>
            <Textarea id="o-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-logo">Logo (URL)</Label>
            <Input id="o-logo" type="url" placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("category", "Categoria")}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem {t("category", "categoria").toLowerCase()}</SelectItem>
                {(cats.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="o-tz">Fuso horário (override)</Label>
              <Input id="o-tz" placeholder="America/Sao_Paulo" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-cur">Moeda (override)</Label>
              <Input id="o-cur" placeholder="BRL" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Deixe fuso e moeda em branco para herdar o padrão da instância.</p>

          <AddressFields value={address} onChange={setAddress} />



          <CategoryFieldsForm
            categoryId={categoryId === "__none__" ? null : categoryId}
            scope="org"
            value={catData}
            onChange={setCatData}
            title="Campos da categoria"
          />


          {sysFields.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campos de sistema</p>
              {sysFields.filter((f) => f.type !== "computed").map((f) => {
                const id = `sys-${f.key}`;
                const v = sysData[f.key] ?? "";
                if (f.type === "boolean") {
                  return (
                    <div key={f.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <Label htmlFor={id} className="text-sm">{f.label}</Label>
                      <Switch id={id} checked={!!v} onCheckedChange={(x) => setSys(f.key, x)} />
                    </div>
                  );
                }
                if (f.type === "long_text" || f.type === "textarea") {
                  return (
                    <div key={f.id} className="space-y-2">
                      <Label htmlFor={id}>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
                      <Textarea id={id} rows={3} required={f.required} value={v} onChange={(e) => setSys(f.key, e.target.value)} />
                    </div>
                  );
                }
                if (f.type === "select") {
                  const opts: string[] = ((f.config ?? {}).options as string[]) ?? [];
                  return (
                    <div key={f.id} className="space-y-2">
                      <Label>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
                      <Select value={typeof v === "string" ? v : ""} onValueChange={(x) => setSys(f.key, x)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                const inputType =
                  f.type === "number" || f.type === "currency" ? "number" :
                  f.type === "date" ? "date" :
                  f.type === "datetime" ? "datetime-local" :
                  f.type === "email" ? "email" :
                  f.type === "url" ? "url" :
                  f.type === "phone" ? "tel" : "text";
                return (
                  <div key={f.id} className="space-y-2">
                    <Label htmlFor={id}>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
                    <Input id={id} type={inputType} required={f.required} value={v ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (f.type === "number" || f.type === "currency") setSys(f.key, val === "" ? null : Number(val));
                        else setSys(f.key, val);
                      }} />
                  </div>
                );
              })}
            </div>
          ) : null}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />Excluir {t("organization", "organização").toLowerCase()}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {t("organization", "organização").toLowerCase()}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é permanente e remove todas as {t("tables", "tabelas").toLowerCase()}, {t("records", "registros").toLowerCase()}, {t("conversations", "conversas").toLowerCase()} e {t("messages", "mensagens").toLowerCase()}.
                    Para confirmar, digite o slug <span className="font-mono">{org.slug}</span>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={org.slug} />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmSlug !== org.slug || deleting}
                    onClick={(e) => { e.preventDefault(); handleDelete(); }}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
