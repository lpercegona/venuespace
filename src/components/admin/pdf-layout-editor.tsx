import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Minus, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/venue/empty-state";
import { PdfPreview } from "@/components/admin/pdf-preview";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DEFAULT_PDF_CONFIG, PDF_BLOCK_LABELS, PDF_VARIABLES, type BookingsPdfConfig } from "@/lib/modules";
import { PDF_WIDTHS, type PdfLayoutField, type PdfWidth } from "@/lib/pdf-layout";
import {
  getCategoryPdfLayout,
  saveCategoryPdfLayout,
  previewBookingQuote,
} from "@/lib/category-pdf-layout.functions";

type AvailableField = { field_key: string; label: string; field_type: string };

type Props = {
  categoryId: string;
  availableFields: AvailableField[];
};

/** Modelo de Orçamento (PDF) por categoria: campos, estilo e preview ao vivo. */
export function PdfLayoutEditor({ categoryId, availableFields }: Props) {
  const [config, setConfig] = useState<BookingsPdfConfig>(DEFAULT_PDF_CONFIG);
  const [fields, setFields] = useState<PdfLayoutField[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [toAdd, setToAdd] = useState<string>("");

  const layoutQuery = useQuery({
    queryKey: ["category-pdf-layout", categoryId],
    queryFn: () => getCategoryPdfLayout({ data: { category_id: categoryId } }),
  });

  useEffect(() => {
    if (layoutQuery.data) {
      setConfig(layoutQuery.data.config as BookingsPdfConfig);
      setFields(layoutQuery.data.fields as PdfLayoutField[]);
    }
  }, [layoutQuery.data]);

  const draft = useMemo(() => ({ config, fields }), [config, fields]);
  const debounced = useDebouncedValue(draft, 600);

  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    previewBookingQuote({
      data: {
        category_id: categoryId,
        config: debounced.config as any,
        fields: debounced.fields.map((f, i) => ({
          field_key: f.field_key,
          label_override: f.label_override,
          width_percent: f.width_percent,
          font_size: f.font_size,
          order_index: i,
          section_title: f.section_title,
        })),
      },
    })
      .then((r) => {
        if (!cancelled) setPreview(r.base64);
      })
      .catch((e) => {
        if (!cancelled) toast.error((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, debounced]);

  const remaining = availableFields.filter((a) => !fields.some((f) => f.field_key === a.field_key));

  function addField(key: string) {
    const src = availableFields.find((a) => a.field_key === key);
    if (!src) return;
    setFields((list) => [
      ...list,
      {
        field_key: src.field_key,
        label_override: null,
        width_percent: 100,
        font_size: 10,
        order_index: list.length,
        section_title: null,
      },
    ]);
    setToAdd("");
  }

  function patch(key: string, part: Partial<PdfLayoutField>) {
    setFields((list) => list.map((f) => (f.field_key === key ? { ...f, ...part } : f)));
  }

  function remove(key: string) {
    setFields((list) => list.filter((f) => f.field_key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setFields((list) => {
      const i = list.findIndex((f) => f.field_key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((f, idx) => ({ ...f, order_index: idx }));
    });
  }

  function dropOn(key: string) {
    if (!dragKey || dragKey === key) return;
    setFields((list) => {
      const from = list.findIndex((f) => f.field_key === dragKey);
      const to = list.findIndex((f) => f.field_key === key);
      if (from < 0 || to < 0) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next.map((f, idx) => ({ ...f, order_index: idx }));
    });
    setDragKey(null);
  }

  function moveBlock(key: string, dir: -1 | 1) {
    setConfig((c) => {
      const blocks = [...c.blocks];
      const i = blocks.findIndex((b) => b.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return c;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...c, blocks };
    });
  }

  async function save() {
    setSaving(true);
    try {
      await saveCategoryPdfLayout({
        data: {
          category_id: categoryId,
          config: config as any,
          fields: fields.map((f, i) => ({
            field_key: f.field_key,
            label_override: f.label_override,
            width_percent: f.width_percent,
            font_size: f.font_size,
            order_index: i,
            section_title: f.section_title,
          })),
        },
      });
      toast.success("Modelo de orçamento salvo.");
      layoutQuery.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (layoutQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h4 className="min-w-0 truncate text-sm font-medium">Modelo de Orçamento (PDF)</h4>
          <Button size="sm" onClick={save} disabled={saving} className="shrink-0">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Campos disponíveis na tabela de reservas</Label>
            <Select value={toAdd} onValueChange={setToAdd}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={remaining.length ? "Selecionar campo" : "Todos os campos já usados"} />
              </SelectTrigger>
              <SelectContent>
                {remaining.map((a) => (
                  <SelectItem key={a.field_key} value={a.field_key}>
                    {a.label} · {a.field_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="h-11 shrink-0"
            variant="outline"
            onClick={() => addField(toAdd)}
            disabled={!toAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar ao modelo
          </Button>
        </div>

        {fields.length === 0 ? (
          <EmptyState
            title="Modelo vazio"
            description="Adicione campos da tabela de reservas para compor o orçamento."
          />
        ) : (
          <ul className="space-y-2">
            {fields.map((f) => {
              const src = availableFields.find((a) => a.field_key === f.field_key);
              return (
                <li
                  key={f.field_key}
                  draggable
                  onDragStart={() => setDragKey(f.field_key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(f.field_key)}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{src?.label ?? f.field_key}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.field_key}
                        {src ? ` · ${src.field_type}` : " · campo removido da tabela"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Mover para cima" onClick={() => move(f.field_key, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Mover para baixo" onClick={() => move(f.field_key, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Remover do modelo" onClick={() => remove(f.field_key)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Rótulo no PDF</Label>
                      <Input
                        className="h-10"
                        placeholder={src?.label ?? f.field_key}
                        value={f.label_override ?? ""}
                        onChange={(e) => patch(f.field_key, { label_override: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Seção (título opcional)</Label>
                      <Input
                        className="h-10"
                        placeholder="Ex.: Detalhes do evento"
                        value={f.section_title ?? ""}
                        onChange={(e) => patch(f.field_key, { section_title: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Largura</Label>
                      <Select
                        value={String(f.width_percent)}
                        onValueChange={(v) => patch(f.field_key, { width_percent: Number(v) as PdfWidth })}
                      >
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PDF_WIDTHS.map((w) => (
                            <SelectItem key={w} value={String(w)}>{w}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Tamanho do texto</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline" size="icon" aria-label="Diminuir tamanho do texto"
                          onClick={() => patch(f.field_key, { font_size: Math.max(8, f.font_size - 1) })}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center text-sm tabular-nums">{f.font_size}</span>
                        <Button
                          variant="outline" size="icon" aria-label="Aumentar tamanho do texto"
                          onClick={() => patch(f.field_key, { font_size: Math.min(24, f.font_size + 1) })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor de destaque (hex)</Label>
            <Input
              className="h-10"
              placeholder="#6b4fa3"
              value={config.accent}
              onChange={(e) => setConfig((c) => ({ ...c, accent: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tamanho da logo (24–90)</Label>
            <Input
              className="h-10" type="number" min={24} max={90}
              value={config.logo_size}
              onChange={(e) => setConfig((c) => ({ ...c, logo_size: Number(e.target.value) || 58 }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Blocos do documento</h4>
          <ul className="space-y-2">
            {config.blocks.map((b) => (
              <li
                key={b.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3"
              >
                <span className="min-w-0 truncate text-sm">{PDF_BLOCK_LABELS[b.key]}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Mover bloco para cima" onClick={() => moveBlock(b.key, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Mover bloco para baixo" onClick={() => moveBlock(b.key, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={b.enabled}
                    onCheckedChange={(v) =>
                      setConfig((c) => ({
                        ...c,
                        blocks: c.blocks.map((x) => (x.key === b.key ? { ...x, enabled: v } : x)),
                      }))
                    }
                    aria-label={`Exibir bloco ${PDF_BLOCK_LABELS[b.key]}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Textos</h4>
          <p className="text-xs text-muted-foreground">Variáveis: {PDF_VARIABLES.join(" ")}</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título do documento</Label>
            <Input
              className="h-10"
              value={config.texts.title}
              onChange={(e) => setConfig((c) => ({ ...c, texts: { ...c.texts, title: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Texto de abertura</Label>
            <Textarea
              rows={2}
              value={config.texts.intro}
              onChange={(e) => setConfig((c) => ({ ...c, texts: { ...c.texts, intro: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Condições adicionais (uma por linha)</Label>
            <Textarea
              rows={3}
              value={config.texts.terms}
              onChange={(e) => setConfig((c) => ({ ...c, texts: { ...c.texts, terms: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mensagem final</Label>
            <Textarea
              rows={2}
              value={config.texts.closing}
              onChange={(e) => setConfig((c) => ({ ...c, texts: { ...c.texts, closing: e.target.value } }))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <h4 className="text-sm font-medium">Pré-visualização</h4>
        <p className="text-xs text-muted-foreground">
          Inclui o logotipo da organização e o rodapé de assinatura da plataforma.
        </p>
        <PdfPreview base64={preview} loading={previewing} />
      </div>
    </div>
  );
}
