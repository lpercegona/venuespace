import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, ChevronDown, GripVertical, Loader2, Minus, Palette, Plus, Save, Trash2, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfPreview } from "@/components/admin/pdf-preview";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DEFAULT_PDF_CONFIG, PDF_BLOCK_LABELS, type BookingsPdfConfig } from "@/lib/modules";
import {
  DEFAULT_BLOCK_STYLE, PDF_BLOCK_TYPE_LABELS, PDF_WIDTHS, isTextBlock, newTextBlockKey,
  parseTableContent, type PdfBlockStyle, type PdfBlockType, type PdfLayoutField, type PdfWidth,
} from "@/lib/pdf-layout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildVariableGroups, variableToken } from "@/lib/pdf-variables";
import {
  getCategoryPdfLayout,
  saveCategoryPdfLayout,
  previewBookingQuote,
} from "@/lib/category-pdf-layout.functions";

type AvailableField = { field_key: string; label: string; field_type: string };

type Props = {
  /** `null` edita o modelo "Padrão" global. */
  categoryId: string | null;
  availableFields: AvailableField[];
  /** Recebe a função de salvar para o botão único do topo. */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Esconde o botão interno de salvar. */
  hideSave?: boolean;
};

const SAMPLE = {
  cliente: "Cliente de exemplo — cliente@exemplo.com",
  cliente_empresa: "Empresa Exemplo LTDA",
  cliente_cnpj: "00.000.000/0000-00",
  cliente_endereco: "Rua Exemplo, 000 — Cidade/UF",
  organizacao_cnpj: "00.000.000/0001-00",
  organizacao_site: "venuespace.com.br",
  local: "Local de Instalação/Prestação de Serviço",
  periodo: "10 a 12 de março de 2026",
  inicio: "10/03/2026",
  fim: "12/03/2026",
  itens_total: "R$ 2.700,00",
  deslocamento: "R$ 250,00",
  total: "R$ 2.950,00",
  validade: "15",
  numero: "A1B2C3D4",
  data: "18/08/2026",
} as Record<string, string>;

/** Editor visual do Modelo de Orçamento: folha A4 editável + variáveis + PDF real. */
export function PdfVisualEditor({ categoryId, availableFields, saveRef, hideSave }: Props) {
  const [config, setConfig] = useState<BookingsPdfConfig>(DEFAULT_PDF_CONFIG);
  const [fields, setFields] = useState<PdfLayoutField[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const lastFocused = useRef<{ key: string; el: HTMLTextAreaElement } | null>(null);

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

  const payloadFields = useMemo(
    () =>
      fields.map((f, i) => ({
        field_key: f.field_key,
        block_type: f.block_type,
        label_override: f.label_override,
        width_percent: f.width_percent,
        font_size: f.font_size,
        order_index: i,
        section_title: f.section_title,
        content: f.content,
        style: f.style,
      })),
    [fields],
  );

  const draft = useMemo(() => ({ config, fields: payloadFields }), [config, payloadFields]);
  const debounced = useDebouncedValue(draft, 700);

  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    previewBookingQuote({
      data: { category_id: categoryId, config: debounced.config as any, fields: debounced.fields },
    })
      .then((r) => { if (!cancelled) setPreview(r.base64); })
      .catch((e) => { if (!cancelled) toast.error((e as Error).message); })
      .finally(() => { if (!cancelled) setPreviewing(false); });
    return () => { cancelled = true; };
  }, [categoryId, debounced]);

  const variableGroups = useMemo(
    () => buildVariableGroups(availableFields.map((a) => ({ field_key: a.field_key, label: a.label }))),
    [availableFields],
  );

  const remaining = availableFields.filter((a) => !fields.some((f) => f.field_key === a.field_key));
  const enabled = new Map(config.blocks.map((b) => [b.key, b.enabled !== false]));

  function patch(key: string, part: Partial<PdfLayoutField>) {
    setFields((list) => list.map((f) => (f.field_key === key ? { ...f, ...part } : f)));
  }
  function remove(key: string) {
    setFields((list) => list.filter((f) => f.field_key !== key));
    if (activeKey === key) setActiveKey(null);
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
  function addFieldBlock(key: string) {
    const src = availableFields.find((a) => a.field_key === key);
    if (!src) return;
    setFields((list) => [
      ...list,
      {
        field_key: src.field_key, block_type: "field", label_override: null, width_percent: 100,
        font_size: 10, order_index: list.length, section_title: null, content: null,
        style: { ...DEFAULT_BLOCK_STYLE },
      },
    ]);
    setActiveKey(src.field_key);
  }
  /** Blocos sem campo vinculado: texto livre, título, linha e tabela. */
  function addBlock(type: Exclude<PdfBlockType, "field">) {
    const key = newTextBlockKey();
    const content =
      type === "text"
        ? "Escreva aqui o texto do bloco. Use variáveis como {{cliente}}."
        : type === "heading"
          ? "Novo título"
          : type === "table"
            ? "Descrição | Quantidade | Valor\nItem de exemplo | 1 | {{total}}"
            : null;
    setFields((list) => [
      ...list,
      {
        field_key: key, block_type: type,
        label_override: type === "heading" ? "Novo título" : type === "text" ? "Novo bloco" : null,
        width_percent: 100, font_size: type === "heading" ? 14 : 10,
        order_index: list.length, section_title: null, content,
        style: { ...DEFAULT_BLOCK_STYLE },
      },
    ]);
    setActiveKey(key);
  }

  /** Insere a variável no ponto do cursor do último conteúdo focado. */
  function insertVariable(key: string) {
    const token = variableToken(key);
    const target = lastFocused.current;
    if (!target) {
      toast.info("Clique no conteúdo de um bloco para inserir a variável.");
      return;
    }
    const el = target.el;
    const value = el.value ?? "";
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    patch(target.key, { content: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    setSaving(true);
    try {
      await saveCategoryPdfLayout({
        data: { category_id: categoryId, config: config as any, fields: payloadFields },
      });
      layoutQuery.refetch();
    } finally {
      setSaving(false);
    }
  }

  // Expõe o salvamento para o botão único do topo da tela de módulos.
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = save;
    return () => { saveRef.current = null; };
  });

  function openRealPdf() {
    if (!preview) return;
    const bin = atob(preview);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const sample = (raw: string | null, fallback: string) => {
    const text = (raw ?? "").trim();
    if (!text) return fallback;
    return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, k: string) => {
      if (SAMPLE[k]) return SAMPLE[k];
      if (k === "organizacao") return "Sua organização";
      const f = availableFields.find((a) => a.field_key === k);
      return f ? `[${f.label}]` : `[${k}]`;
    });
  };

  if (layoutQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium">Modelo de Orçamento (PDF)</h4>
          <p className="truncate text-xs text-muted-foreground">
            Edite direto na folha: clique em um título ou conteúdo para alterar.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="h-11 shrink-0 sm:h-9">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------- Folha A4 editável ---------------- */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={addFieldBlock}>
              <SelectTrigger className="h-10 w-full sm:w-64">
                <SelectValue placeholder={remaining.length ? "Adicionar campo da reserva" : "Todos os campos usados"} />
              </SelectTrigger>
              <SelectContent>
                {remaining.map((a) => (
                  <SelectItem key={a.field_key} value={a.field_key}>
                    {a.label} · {a.field_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value="" onValueChange={(v) => addBlock(v as Exclude<PdfBlockType, "field">)}>
              <SelectTrigger className="h-10 w-full sm:w-56">
                <span className="flex items-center gap-2 text-sm">
                  <Type className="h-4 w-4" />Adicionar bloco
                </span>
              </SelectTrigger>
              <SelectContent>
                {(["text", "heading", "divider", "table"] as const).map((t) => (
                  <SelectItem key={t} value={t}>{PDF_BLOCK_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="w-full">
            <div className="mx-auto w-[720px] max-w-full rounded-lg bg-paper p-8 text-paper-foreground shadow-elegant sm:p-10">
              {enabled.get("header") ? (
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-paper-line pb-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Sua organização</p>
                    <p className="truncate text-xs text-paper-muted">CNPJ {SAMPLE.organizacao_cnpj}</p>
                    <p className="truncate text-xs text-paper-muted">{SAMPLE.organizacao_site}</p>
                  </div>
                  <div
                    className="grid shrink-0 place-items-center rounded-md border border-dashed border-paper-line text-[10px] text-paper-muted"
                    style={{ width: config.logo_size, height: config.logo_size }}
                  >
                    logo
                  </div>
                </header>
              ) : null}

              {enabled.get("title") ? (
                <div className="pt-6">
                  <SheetInput
                    value={config.texts.title}
                    onChange={(v) => setConfig((c) => ({ ...c, texts: { ...c.texts, title: v } }))}
                    className="w-full text-xl font-semibold tracking-tight"
                    ariaLabel="Título do documento"
                  />
                  <div className="mt-2 h-px w-full" style={{ backgroundColor: config.accent }} />
                  <SheetTextarea
                    value={config.texts.intro}
                    onChange={(v) => setConfig((c) => ({ ...c, texts: { ...c.texts, intro: v } }))}
                    placeholder="Texto de abertura (opcional)"
                    className="mt-3 text-xs text-paper-muted"
                    ariaLabel="Texto de abertura"
                  />
                </div>
              ) : null}

              {enabled.get("client") ? (
                <section className="mt-6 grid gap-1 rounded-md border border-paper-line p-3 text-xs">
                  <p className="font-semibold">Dados do cliente</p>
                  <p className="text-paper-muted">{SAMPLE.cliente_empresa} · {SAMPLE.cliente_cnpj}</p>
                  <p className="text-paper-muted">{SAMPLE.cliente} · {SAMPLE.cliente_endereco}</p>
                  <p className="text-paper-muted">{SAMPLE.periodo} · {SAMPLE.local}</p>
                </section>
              ) : null}

              {/* Blocos configuráveis */}
              <section className="mt-5 flex flex-wrap items-stretch">
                {fields.length === 0 ? (
                  <p className="w-full rounded-md border border-dashed border-paper-line p-6 text-center text-xs text-paper-muted">
                    Nenhum bloco no modelo. Adicione um campo da reserva ou um bloco de texto.
                  </p>
                ) : null}
                {fields.map((f) => {
                  const src = availableFields.find((a) => a.field_key === f.field_key);
                  const isText = isTextBlock(f.field_key);
                  const active = activeKey === f.field_key;
                  return (
                    <div
                      key={f.field_key}
                      style={{ width: `${f.width_percent}%` }}
                      className="p-1"
                      draggable
                      onDragStart={() => setDragKey(f.field_key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropOn(f.field_key)}
                    >
                      <div
                        role="group"
                        aria-label={`Bloco ${src?.label ?? f.label_override ?? f.field_key}`}
                        onClick={() => setActiveKey(f.field_key)}
                        style={{
                          backgroundColor: f.style.background ?? undefined,
                          color: f.style.color ?? undefined,
                          textAlign: f.style.align,
                        }}
                        className={`h-full rounded-md border p-2 transition ${
                          f.style.border ? "border-paper-line" : ""
                        } ${active ? "border-primary bg-primary/5" : "border-transparent hover:border-paper-line"}`}
                      >
                        {f.section_title ? (
                          <SheetInput
                            value={f.section_title}
                            onChange={(v) => patch(f.field_key, { section_title: v || null })}
                            className="mb-2 w-full text-[11px] font-semibold uppercase tracking-wide"
                            ariaLabel="Título da seção"
                            style={{ color: config.accent }}
                          />
                        ) : null}

                        {f.block_type === "divider" ? (
                          <div
                            className="my-2 h-px w-full"
                            style={{ backgroundColor: f.style.color ?? config.accent }}
                            aria-hidden
                          />
                        ) : f.block_type === "table" ? (
                          <>
                            <table className="w-full border-collapse" style={{ fontSize: f.font_size }}>
                              <tbody>
                                {parseTableContent(f.content).map((row, ri) => (
                                  <tr key={ri} className="border-b border-paper-line">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className={`px-1.5 py-1 ${ri === 0 ? "font-semibold" : ""}`}>
                                        {sample(cell, "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <SheetTextarea
                              value={f.content ?? ""}
                              onChange={(v) => patch(f.field_key, { content: v || null })}
                              onFocusEl={(el) => { lastFocused.current = { key: f.field_key, el }; }}
                              placeholder="Uma linha por registro, colunas separadas por |"
                              className="mt-1 text-[10px] text-paper-muted"
                              ariaLabel="Conteúdo da tabela"
                            />
                          </>
                        ) : (
                          <>
                            {f.block_type === "heading" ? null : (
                              <SheetInput
                                value={f.label_override ?? src?.label ?? ""}
                                onChange={(v) => patch(f.field_key, { label_override: v || null })}
                                placeholder="Título do bloco"
                                className="w-full text-[10px] font-semibold uppercase tracking-wide text-paper-muted"
                                ariaLabel="Título do bloco"
                              />
                            )}

                            {isText || f.block_type === "heading" || f.content ? (
                              <SheetTextarea
                                value={f.content ?? ""}
                                onChange={(v) => patch(f.field_key, { content: v || null })}
                                onFocusEl={(el) => { lastFocused.current = { key: f.field_key, el }; }}
                                placeholder="Conteúdo do bloco (texto e variáveis)"
                                className={`w-full ${f.block_type === "heading" ? "font-semibold" : ""} ${
                                  f.style.bold ? "font-semibold" : ""
                                } ${f.style.italic ? "italic" : ""} ${f.style.uppercase ? "uppercase" : ""}`}
                                style={{ fontSize: f.font_size }}
                                ariaLabel="Conteúdo do bloco"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => patch(f.field_key, { content: variableToken(f.field_key) })}
                                className="mt-0.5 block w-full text-left"
                                style={{ fontSize: f.font_size }}
                              >
                                {`[${src?.label ?? f.field_key}]`}
                              </button>
                            )}
                          </>
                        )}

                        {active ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-paper-line pt-2">
                            <GripVertical className="h-4 w-4 cursor-grab text-paper-muted" aria-hidden />
                            <Select
                              value={String(f.width_percent)}
                              onValueChange={(v) => patch(f.field_key, { width_percent: Number(v) as PdfWidth })}
                            >
                              <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PDF_WIDTHS.map((w) => (
                                  <SelectItem key={w} value={String(w)}>{w}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8" aria-label="Diminuir tamanho do texto"
                              onClick={() => patch(f.field_key, { font_size: Math.max(8, f.font_size - 1) })}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-xs tabular-nums">{f.font_size}</span>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8" aria-label="Aumentar tamanho do texto"
                              onClick={() => patch(f.field_key, { font_size: Math.min(24, f.font_size + 1) })}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8" aria-label="Mover bloco para cima"
                              onClick={() => move(f.field_key, -1)}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8" aria-label="Mover bloco para baixo"
                              onClick={() => move(f.field_key, 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs"
                              onClick={() => patch(f.field_key, { section_title: f.section_title ? null : "Nova seção" })}
                            >
                              {f.section_title ? "Sem seção" : "Seção"}
                            </Button>
                            <BlockStylePopover
                              style={f.style}
                              onChange={(style) => patch(f.field_key, { style })}
                            />
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8" aria-label="Remover bloco"
                              onClick={() => remove(f.field_key)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </section>

              {enabled.get("items") ? (
                <section className="mt-5 rounded-md border border-paper-line text-xs">
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-2 rounded-t-md px-3 py-2 font-semibold text-paper"
                    style={{ backgroundColor: config.accent }}
                  >
                    <span>Item</span><span>Diárias</span><span>Valor</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-2 border-t border-paper-line px-3 py-2">
                    <span className="truncate">Item de exemplo A</span><span>2</span><span>R$ 1.800,00</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-2 border-t border-paper-line px-3 py-2">
                    <span className="truncate">Item de exemplo B</span><span>2</span><span>R$ 900,00</span>
                  </div>
                </section>
              ) : null}

              {enabled.get("totals") ? (
                <section className="mt-3 grid gap-1 text-right text-xs">
                  <p className="text-paper-muted">Itens: {SAMPLE.itens_total}</p>
                  <p className="text-paper-muted">Deslocamento: {SAMPLE.deslocamento}</p>
                  <p className="text-sm font-semibold">Total: {SAMPLE.total}</p>
                </section>
              ) : null}

              {enabled.get("terms") ? (
                <section className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: config.accent }}>
                    Condições de pagamento
                  </p>
                  <SheetTextarea
                    value={config.texts.terms}
                    onChange={(v) => setConfig((c) => ({ ...c, texts: { ...c.texts, terms: v } }))}
                    placeholder="Uma condição por linha"
                    className="mt-1 text-xs"
                    ariaLabel="Condições de pagamento"
                  />
                </section>
              ) : null}

              {enabled.get("closing") ? (
                <section className="mt-5">
                  <SheetTextarea
                    value={config.texts.closing}
                    onChange={(v) => setConfig((c) => ({ ...c, texts: { ...c.texts, closing: v } }))}
                    placeholder="Mensagem final"
                    className="text-xs text-paper-muted"
                    ariaLabel="Mensagem final"
                  />
                  <p className="mt-2 text-xs font-semibold">Sua organização</p>
                </section>
              ) : null}

              <footer className="mt-8 grid grid-cols-3 items-center gap-2 border-t border-paper-line pt-3 text-[10px] text-paper-muted">
                <span className="truncate">Orçamento gerado através da plataforma venuespace.</span>
                <span className="text-center">venuespace</span>
                <span className="text-right">venuespace.com.br</span>
              </footer>

              <p className="mt-3 text-center text-[10px] text-paper-muted">
                Pré-visualização com dados de exemplo — {sample(null, "o PDF final usa os dados reais da reserva")}.
              </p>
            </div>
          </ScrollArea>
        </div>

        {/* ---------------- Painel lateral ---------------- */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Tabs defaultValue="vars">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vars">Variáveis</TabsTrigger>
              <TabsTrigger value="pdf">PDF real</TabsTrigger>
            </TabsList>

            <TabsContent value="vars" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Clique no conteúdo de um bloco e depois em uma variável para inseri-la.
              </p>
              <ScrollArea className="h-[28rem] rounded-lg border border-border p-3">
                <TooltipProvider delayDuration={200}>
                  <div className="space-y-4">
                    {variableGroups.map((g) => (
                      <div key={g.title} className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {g.items.map((v) => (
                            <Tooltip key={v.key}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => insertVariable(v.key)}
                                  className="min-h-8 rounded-full border border-input bg-background px-2.5 py-1 text-xs transition hover:bg-accent"
                                >
                                  {v.label}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className="font-mono text-xs">{variableToken(v.key)}</span>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pdf" className="space-y-2 pt-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  Documento gerado com o layout atual.
                </p>
                <Button variant="outline" size="sm" onClick={openRealPdf} disabled={!preview}>
                  Abrir
                </Button>
              </div>
              <PdfPreview base64={preview} loading={previewing} />
            </TabsContent>
          </Tabs>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Estilo e blocos do documento
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cor de destaque (hex)</Label>
                  <Input
                    className="h-10" placeholder="#6b4fa3" value={config.accent}
                    onChange={(e) => setConfig((c) => ({ ...c, accent: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tamanho da logo (24–90)</Label>
                  <Input
                    className="h-10" type="number" min={24} max={90} value={config.logo_size}
                    onChange={(e) => setConfig((c) => ({ ...c, logo_size: Number(e.target.value) || 58 }))}
                  />
                </div>
              </div>
              <Separator />
              <ul className="space-y-2">
                {config.blocks.map((b) => (
                  <li key={b.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border p-2">
                    <span className="min-w-0 truncate text-xs">{PDF_BLOCK_LABELS[b.key]}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8" aria-label="Mover bloco para cima"
                        onClick={() =>
                          setConfig((c) => {
                            const blocks = [...c.blocks];
                            const i = blocks.findIndex((x) => x.key === b.key);
                            if (i <= 0) return c;
                            [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
                            return { ...c, blocks };
                          })
                        }
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8" aria-label="Mover bloco para baixo"
                        onClick={() =>
                          setConfig((c) => {
                            const blocks = [...c.blocks];
                            const i = blocks.findIndex((x) => x.key === b.key);
                            if (i < 0 || i >= blocks.length - 1) return c;
                            [blocks[i], blocks[i + 1]] = [blocks[i + 1], blocks[i]];
                            return { ...c, blocks };
                          })
                        }
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        checked={b.enabled}
                        aria-label={`Exibir bloco ${PDF_BLOCK_LABELS[b.key]}`}
                        onCheckedChange={(v) =>
                          setConfig((c) => ({
                            ...c,
                            blocks: c.blocks.map((x) => (x.key === b.key ? { ...x, enabled: v } : x)),
                          }))
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <Badge variant="secondary" className="text-xs">
                O rodapé de assinatura da plataforma é fixo em todas as páginas.
              </Badge>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

/** Campo de uma linha que parece texto do documento até receber foco. */
function SheetInput({
  value, onChange, className = "", placeholder, ariaLabel, style,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      style={style}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-sm border border-transparent bg-transparent outline-hidden transition placeholder:text-paper-muted hover:border-paper-line focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring ${className}`}
    />
  );
}

/** Área de texto multi-linha com a mesma aparência da folha. */
function SheetTextarea({
  value, onChange, className = "", placeholder, ariaLabel, style, onFocusEl,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  style?: React.CSSProperties;
  onFocusEl?: (el: HTMLTextAreaElement) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      style={style}
      onFocus={(e) => onFocusEl?.(e.currentTarget)}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none rounded-sm border border-transparent bg-transparent outline-hidden transition placeholder:text-paper-muted hover:border-paper-line focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring ${className}`}
    />
  );
}

/** Estilo do bloco em popover: cor, fundo, alinhamento, peso e borda. */
function BlockStylePopover({
  style, onChange,
}: {
  style: PdfBlockStyle;
  onChange: (s: PdfBlockStyle) => void;
}) {
  const set = (part: Partial<PdfBlockStyle>) => onChange({ ...style, ...part });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Estilo do bloco">
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor do texto</Label>
            <Input
              className="h-9" placeholder="#111827" value={style.color ?? ""}
              onChange={(e) => set({ color: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fundo</Label>
            <Input
              className="h-9" placeholder="#f3f4f6" value={style.background ?? ""}
              onChange={(e) => set({ background: e.target.value || null })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Alinhamento</Label>
          <Select value={style.align} onValueChange={(v) => set({ align: v as PdfBlockStyle["align"] })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Esquerda</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {([
          ["bold", "Negrito"],
          ["italic", "Itálico"],
          ["uppercase", "Maiúsculas"],
          ["border", "Borda"],
        ] as const).map(([key, label]) => (
          <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Label className="min-w-0 truncate text-xs">{label}</Label>
            <Switch
              checked={style[key] === true}
              aria-label={label}
              onCheckedChange={(v) => set({ [key]: v } as Partial<PdfBlockStyle>)}
            />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
