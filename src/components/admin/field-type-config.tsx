import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TYPE_HELP: Record<string, string> = {
  computed:
    "Campo calculado: escolha o modo (soma, contagem ou soma de quantidade x valor), a tabela de origem e as chaves usadas no cálculo. O valor é resolvido na leitura e não é editável no formulário.",
  relation:
    "Campo de relação: aponta para registros de outra tabela padrão da categoria. Informe a tabela de destino e a chave do campo usado como texto de exibição.",
  boolean:
    "Campo sim/não: define os rótulos exibidos para verdadeiro e falso e o valor inicial do formulário.",
};

export function parseOptionLines(text: string) {
  const options: string[] = [];
  const option_icons: Record<string, string> = {};
  for (const line of text.split(/\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const [labelPart, iconPart] = raw.split("|").map((x) => x.trim());
    if (!labelPart) continue;
    options.push(labelPart);
    if (iconPart) option_icons[labelPart] = iconPart;
  }
  return { options, option_icons };
}

/** Inverso de parseOptionLines, para preencher o textarea de edição. */
export function formatOptionLines(options: string[], icons: Record<string, string> | undefined) {
  return options.map((o) => (icons?.[o] ? `${o} | ${icons[o]}` : o)).join("\n");
}

export type TypeDraft = {
  optionsText: string;
  cepRole: boolean;
  computedMode: string;
  computedSource: string;
  computedValueKey: string;
  computedQtyKey: string;
  computedFilter: string;
  relationTarget: string;
  relationDisplay: string;
  relationMultiple: boolean;
  boolTrue: string;
  boolFalse: string;
  boolDefault: boolean;
};

export function emptyTypeDraft(): TypeDraft {
  return {
    optionsText: "",
    cepRole: false,
    computedMode: "sum",
    computedSource: "",
    computedValueKey: "",
    computedQtyKey: "",
    computedFilter: "",
    relationTarget: "",
    relationDisplay: "",
    relationMultiple: false,
    boolTrue: "",
    boolFalse: "",
    boolDefault: false,
  };
}

export function draftFromConfig(config: Record<string, any> | null | undefined): TypeDraft {
  const cfg = config ?? {};
  const comp = (cfg.compute ?? {}) as Record<string, any>;
  const opts = Array.isArray(cfg.options) ? (cfg.options as any[]).map(String) : [];
  return {
    optionsText: formatOptionLines(opts, cfg.option_icons as Record<string, string> | undefined),
    cepRole: cfg.role === "cep",
    computedMode: typeof comp.mode === "string" ? comp.mode : "sum",
    computedSource: typeof comp.source_table === "string" ? comp.source_table : "",
    computedValueKey: typeof comp.value_key === "string" ? comp.value_key : "",
    computedQtyKey: typeof comp.qty_key === "string" ? comp.qty_key : "",
    computedFilter: typeof comp.filter === "string" ? comp.filter : "",
    relationTarget: typeof cfg.target_table === "string" ? cfg.target_table : "",
    relationDisplay: typeof cfg.display_key === "string" ? cfg.display_key : "",
    relationMultiple: !!cfg.multiple,
    boolTrue: typeof cfg.true_label === "string" ? cfg.true_label : "",
    boolFalse: typeof cfg.false_label === "string" ? cfg.false_label : "",
    boolDefault: !!cfg.default,
  };
}

/**
 * Mescla o rascunho de configuração por tipo com o config existente,
 * preservando chaves desconhecidas e limpando as que não se aplicam ao tipo.
 */
export function applyDraftToConfig(
  base: Record<string, any> | null | undefined,
  type: string,
  draft: TypeDraft,
  tooltip: string,
): Record<string, any> {
  const config: Record<string, any> = { ...(base ?? {}) };

  if (type === "select" || type === "multiselect") {
    const parsed = parseOptionLines(draft.optionsText);
    if (parsed.options.length > 0) config.options = parsed.options;
    else delete config.options;
    if (Object.keys(parsed.option_icons).length > 0) config.option_icons = parsed.option_icons;
    else delete config.option_icons;
  } else {
    delete config.options;
    delete config.option_icons;
  }

  if (type === "text" && draft.cepRole) config.role = "cep";
  else if (config.role === "cep") delete config.role;

  if (tooltip.trim()) config.tooltip = tooltip.trim();
  else delete config.tooltip;

  if (type === "computed") {
    config.compute = {
      mode: draft.computedMode,
      source_table: draft.computedSource.trim() || null,
      value_key: draft.computedValueKey.trim() || null,
      qty_key: draft.computedQtyKey.trim() || null,
      filter: draft.computedFilter.trim() || null,
    };
  } else {
    delete config.compute;
  }

  if (type === "relation") {
    config.target_table = draft.relationTarget.trim() || null;
    config.display_key = draft.relationDisplay.trim() || null;
    config.multiple = draft.relationMultiple;
  } else {
    delete config.target_table;
    delete config.display_key;
    delete config.multiple;
  }

  if (type === "boolean") {
    config.true_label = draft.boolTrue.trim() || null;
    config.false_label = draft.boolFalse.trim() || null;
    config.default = draft.boolDefault;
  } else {
    delete config.true_label;
    delete config.false_label;
    delete config.default;
  }

  return config;
}

type Props = {
  type: string;
  draft: TypeDraft;
  onChange: (patch: Partial<TypeDraft>) => void;
  idPrefix?: string;
};

/** Blocos de configuração específicos por tipo de campo (select, cep, computed, relation, boolean). */
export function FieldTypeConfig({ type, draft, onChange, idPrefix = "ftc" }: Props) {
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <>
      {type === "select" || type === "multiselect" ? (
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor={id("options")}>Opções (uma por linha — use "Opção | Icone" para ícone)</Label>
          <Textarea
            id={id("options")}
            rows={4}
            value={draft.optionsText}
            onChange={(e) => onChange({ optionsText: e.target.value })}
            placeholder="Ex: Aluguel&#10;Venda&#10;Temporada"
          />
        </div>
      ) : null}

      {type === "text" ? (
        <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <Label htmlFor={id("cep")} className="text-sm">Autocompletar via ViaCEP</Label>
            <p className="text-xs text-muted-foreground">
              Ao preencher, busca endereço e preenche logradouro/bairro/cidade/estado.
            </p>
          </div>
          <Switch id={id("cep")} checked={draft.cepRole} onCheckedChange={(v) => onChange({ cepRole: v })} />
        </div>
      ) : null}

      {type === "computed" ? (
        <div className="sm:col-span-2 space-y-3 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">{TYPE_HELP.computed}</p>
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={draft.computedMode} onValueChange={(v) => onChange({ computedMode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Soma de um campo</SelectItem>
                <SelectItem value="count">Contagem de registros</SelectItem>
                <SelectItem value="sum_qty_value">Soma de quantidade × valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("comp-src")}>Tabela de origem (slug)</Label>
              <Input id={id("comp-src")} className="font-mono" value={draft.computedSource}
                onChange={(e) => onChange({ computedSource: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("comp-val")}>Campo de valor</Label>
              <Input id={id("comp-val")} className="font-mono" value={draft.computedValueKey}
                onChange={(e) => onChange({ computedValueKey: e.target.value })} />
            </div>
            {draft.computedMode === "sum_qty_value" ? (
              <div className="space-y-2">
                <Label htmlFor={id("comp-qty")}>Campo de quantidade</Label>
                <Input id={id("comp-qty")} className="font-mono" value={draft.computedQtyKey}
                  onChange={(e) => onChange({ computedQtyKey: e.target.value })} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={id("comp-filter")}>Filtro (opcional)</Label>
              <Input id={id("comp-filter")} className="font-mono" placeholder="contribution_status=confirmed"
                value={draft.computedFilter} onChange={(e) => onChange({ computedFilter: e.target.value })} />
            </div>
          </div>
        </div>
      ) : null}

      {type === "relation" ? (
        <div className="sm:col-span-2 space-y-3 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">{TYPE_HELP.relation}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("rel-target")}>Tabela de destino (slug)</Label>
              <Input id={id("rel-target")} className="font-mono" value={draft.relationTarget}
                onChange={(e) => onChange({ relationTarget: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("rel-display")}>Campo de exibição</Label>
              <Input id={id("rel-display")} className="font-mono" value={draft.relationDisplay}
                onChange={(e) => onChange({ relationDisplay: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor={id("rel-multi")} className="text-sm">Permitir múltiplos registros</Label>
            <Switch id={id("rel-multi")} checked={draft.relationMultiple}
              onCheckedChange={(v) => onChange({ relationMultiple: v })} />
          </div>
        </div>
      ) : null}

      {type === "boolean" ? (
        <div className="sm:col-span-2 space-y-3 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">{TYPE_HELP.boolean}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("bool-true")}>Rótulo para verdadeiro</Label>
              <Input id={id("bool-true")} value={draft.boolTrue} placeholder="Sim"
                onChange={(e) => onChange({ boolTrue: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("bool-false")}>Rótulo para falso</Label>
              <Input id={id("bool-false")} value={draft.boolFalse} placeholder="Não"
                onChange={(e) => onChange({ boolFalse: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor={id("bool-def")} className="text-sm">Valor padrão ligado</Label>
            <Switch id={id("bool-def")} checked={draft.boolDefault}
              onCheckedChange={(v) => onChange({ boolDefault: v })} />
          </div>
        </div>
      ) : null}
    </>
  );
}
