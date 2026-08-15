import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FileDown, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/venue/empty-state";
import {
  listCategoryModules,
  listBookingsModuleFields,
  setCategoryModuleEnabled,
  saveCategoryModuleConfig,
  previewBookingsQuotePdf,
} from "@/lib/modules.functions";
import {
  DEFAULT_BOOKINGS_CONFIG,
  PDF_BLOCK_LABELS,
  PDF_VARIABLES,
  type BookingsModuleConfig,
  type ModuleFormFieldConfig,
} from "@/lib/modules";

type CategoryRow = {
  category_id: string;
  category_name: string;
  is_enabled: boolean;
  config: BookingsModuleConfig;
};

/** Configuração do módulo Reservas por categoria: ativação, formulário e layout do PDF. */
export function ModuleBookingsConfig() {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingsModuleConfig>(DEFAULT_BOOKINGS_CONFIG);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const cats = useQuery({
    queryKey: ["module-categories", "bookings"],
    queryFn: () => listCategoryModules({ data: { module_key: "bookings" } }) as Promise<CategoryRow[]>,
  });

  const current = useMemo(
    () => (cats.data ?? []).find((c) => c.category_id === selected) ?? null,
    [cats.data, selected],
  );

  useEffect(() => {
    if (!selected && cats.data && cats.data.length > 0) setSelected(cats.data[0].category_id);
  }, [cats.data, selected]);

  useEffect(() => {
    if (current) setDraft(current.config);
  }, [current?.category_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldsQuery = useQuery({
    queryKey: ["module-bookings-fields", selected],
    queryFn: () => listBookingsModuleFields({ data: { category_id: selected! } }),
    enabled: !!selected,
  });

  const tableFields = (fieldsQuery.data?.fields ?? []) as Array<{
    field_key: string; label: string; field_type: string; required: boolean; order_index: number;
  }>;

  function fieldConfig(key: string): ModuleFormFieldConfig {
    return (
      draft.form.find((f) => f.field_key === key) ?? {
        field_key: key, visible: true, label_override: null, required: null,
        order_index: tableFields.findIndex((t) => t.field_key === key),
      }
    );
  }

  function patchField(key: string, part: Partial<ModuleFormFieldConfig>) {
    setDraft((d) => {
      const existing = d.form.find((f) => f.field_key === key);
      const next = { ...fieldConfig(key), ...part };
      return {
        ...d,
        form: existing ? d.form.map((f) => (f.field_key === key ? next : f)) : [...d.form, next],
      };
    });
  }

  function moveField(key: string, dir: -1 | 1) {
    const ordered = [...tableFields]
      .map((t) => fieldConfig(t.field_key))
      .sort((a, b) => a.order_index - b.order_index);
    const i = ordered.findIndex((f) => f.field_key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    setDraft((d) => ({ ...d, form: ordered.map((f, idx) => ({ ...f, order_index: idx })) }));
  }

  function moveBlock(key: string, dir: -1 | 1) {
    setDraft((d) => {
      const blocks = [...d.pdf.blocks];
      const i = blocks.findIndex((b) => b.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return d;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, pdf: { ...d.pdf, blocks } };
    });
  }

  async function toggleCategory(row: CategoryRow, enabled: boolean) {
    try {
      await setCategoryModuleEnabled({
        data: { category_id: row.category_id, module_key: "bookings", is_enabled: enabled },
      });
      toast.success(enabled ? "Módulo ativado." : "Módulo desativado.");
      cats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await saveCategoryModuleConfig({
        data: { category_id: selected, module_key: "bookings", config: draft as any },
      });
      toast.success("Configuração salva.");
      cats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    if (!selected) return;
    setPreviewing(true);
    try {
      const { base64 } = await previewBookingsQuotePdf({
        data: { category_id: selected, config: draft as any },
      });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  if (cats.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if ((cats.data ?? []).length === 0) {
    return <EmptyState title="Nenhuma categoria" description="Crie categorias para configurar o módulo." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativação por categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(cats.data ?? []).map((c) => (
            <div
              key={c.category_id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border p-3"
            >
              <button
                type="button"
                onClick={() => setSelected(c.category_id)}
                className="min-w-0 truncate text-left text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {c.category_name}
                {c.category_id === selected ? (
                  <Badge variant="secondary" className="ml-2 shrink-0">editando</Badge>
                ) : null}
              </button>
              <Switch
                className="shrink-0"
                checked={c.is_enabled}
                onCheckedChange={(v) => toggleCategory(c, v)}
                aria-label={`Ativar módulo Reservas para ${c.category_name}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {current ? (
        <Card>
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <CardTitle className="min-w-0 truncate text-base">
              Configuração — {current.category_name}
            </CardTitle>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={preview} disabled={previewing}>
                {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Pré-visualizar PDF
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="form">
              <TabsList>
                <TabsTrigger value="form">Formulário</TabsTrigger>
                <TabsTrigger value="pdf">Orçamento (PDF)</TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="space-y-3 pt-4">
                <p className="text-xs text-muted-foreground">
                  Os campos vêm da tabela padrão de Reservas da categoria. Período, itens e contato têm
                  seletor próprio no formulário e não aparecem nesta lista.
                </p>
                {fieldsQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : tableFields.length === 0 ? (
                  <EmptyState
                    title="Sem tabela de reservas"
                    description="Esta categoria ainda não possui a tabela padrão de Reservas."
                  />
                ) : (
                  <ul className="space-y-2">
                    {[...tableFields]
                      .sort((a, b) => fieldConfig(a.field_key).order_index - fieldConfig(b.field_key).order_index)
                      .map((t) => {
                        const c = fieldConfig(t.field_key);
                        return (
                          <li key={t.field_key} className="space-y-3 rounded-lg border border-border p-3">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{t.label}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {t.field_key} · {t.field_type}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button variant="ghost" size="icon" aria-label="Mover para cima" onClick={() => moveField(t.field_key, -1)}>
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Mover para baixo" onClick={() => moveField(t.field_key, 1)}>
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="space-y-1.5 sm:col-span-1">
                                <Label className="text-xs text-muted-foreground">Rótulo no formulário</Label>
                                <Input
                                  className="h-10"
                                  placeholder={t.label}
                                  value={c.label_override ?? ""}
                                  onChange={(e) => patchField(t.field_key, { label_override: e.target.value || null })}
                                />
                              </div>
                              <label className="flex min-h-11 items-center gap-3 text-sm">
                                <Switch
                                  checked={c.visible}
                                  onCheckedChange={(v) => patchField(t.field_key, { visible: v })}
                                />
                                Visível
                              </label>
                              <label className="flex min-h-11 items-center gap-3 text-sm">
                                <Switch
                                  checked={typeof c.required === "boolean" ? c.required : t.required}
                                  onCheckedChange={(v) => patchField(t.field_key, { required: v })}
                                />
                                Obrigatório
                              </label>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="pdf" className="space-y-5 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cor de destaque (hex)</Label>
                    <Input
                      className="h-10"
                      placeholder="#6b4fa3"
                      value={draft.pdf.accent}
                      onChange={(e) => setDraft((d) => ({ ...d, pdf: { ...d.pdf, accent: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tamanho da logo (24–90)</Label>
                    <Input
                      className="h-10" type="number" min={24} max={90}
                      value={draft.pdf.logo_size}
                      onChange={(e) => setDraft((d) => ({ ...d, pdf: { ...d.pdf, logo_size: Number(e.target.value) || 58 } }))}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Blocos do documento</h4>
                  <ul className="space-y-2">
                    {draft.pdf.blocks.map((b) => (
                      <li
                        key={b.key}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <span className="min-w-0 truncate text-sm">{PDF_BLOCK_LABELS[b.key]}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon" aria-label="Mover para cima" onClick={() => moveBlock(b.key, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Mover para baixo" onClick={() => moveBlock(b.key, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={b.enabled}
                            aria-label={`Exibir ${PDF_BLOCK_LABELS[b.key]}`}
                            onCheckedChange={(v) =>
                              setDraft((d) => ({
                                ...d,
                                pdf: {
                                  ...d.pdf,
                                  blocks: d.pdf.blocks.map((x) => (x.key === b.key ? { ...x, enabled: v } : x)),
                                },
                              }))
                            }
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Colunas da tabela de itens</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ["period", "Período de locação"],
                      ["daily", "Valor da diária"],
                      ["note", "Observações do item"],
                      ["courtesy", "Selo de cortesia"],
                      ["discount", "Desconto aplicado"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
                        <Switch
                          checked={draft.pdf.item_columns[key]}
                          onCheckedChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              pdf: { ...d.pdf, item_columns: { ...d.pdf.item_columns, [key]: v } },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Textos</h4>
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {PDF_VARIABLES.join(" ")}
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Título do documento</Label>
                    <Input
                      className="h-10"
                      value={draft.pdf.texts.title}
                      onChange={(e) => setDraft((d) => ({ ...d, pdf: { ...d.pdf, texts: { ...d.pdf.texts, title: e.target.value } } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Texto de abertura</Label>
                    <Textarea
                      rows={2}
                      value={draft.pdf.texts.intro}
                      onChange={(e) => setDraft((d) => ({ ...d, pdf: { ...d.pdf, texts: { ...d.pdf.texts, intro: e.target.value } } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Condições adicionais (uma por linha)</Label>
                    <Textarea
                      rows={3}
                      value={draft.pdf.texts.terms}
                      onChange={(e) => setDraft((d) => ({ ...d, pdf: { ...d.pdf, texts: { ...d.pdf.texts, terms: e.target.value } } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mensagem final</Label>
                    <Textarea
                      rows={2}
                      value={draft.pdf.texts.closing}
                      onChange={(e) => setDraft((d) => ({ ...d, pdf: { ...d.pdf, texts: { ...d.pdf.texts, closing: e.target.value } } }))}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
