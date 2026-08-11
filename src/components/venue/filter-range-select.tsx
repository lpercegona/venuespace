import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { parseRangeValue, serializeRangeValue } from "@/lib/filter-params";

const ANY = "__any";

type Props = {
  label: string;
  /** Opções numéricas do lado "a partir de". */
  minOptions: number[];
  /** Opções numéricas do lado "até". */
  maxOptions: number[];
  /** Valor serializado atual (`min:100|max:300`). */
  value: string | undefined;
  onChange: (next: string) => void;
  defaultOpen?: boolean;
  className?: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/**
 * Filtro de faixa numérica com dois seletores ("A partir de" / "Até"),
 * no mesmo padrão de acordeon dos demais filtros públicos.
 */
export function FilterRangeSelect({
  label,
  minOptions,
  maxOptions,
  value,
  onChange,
  defaultOpen,
  className,
}: Props) {
  const range = useMemo(() => parseRangeValue(value), [value]);
  const selectedCount = (range.min != null ? 1 : 0) + (range.max != null ? 1 : 0);
  const [open, setOpen] = useState(() => defaultOpen ?? selectedCount > 0);

  const set = (side: "min" | "max", raw: string) => {
    const next = { ...range };
    if (raw === ANY) delete next[side];
    else next[side] = Number(raw);
    onChange(serializeRangeValue(next));
  };

  return (
    <div className={cn("border-b border-border/60 pb-2 last:border-b-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left"
        >
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
            {selectedCount > 0 ? ` (${selectedCount})` : ""}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {selectedCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => onChange("")}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      {!open ? null : (
        <div className="grid grid-cols-2 gap-2 pb-2">
          <div className="min-w-0 space-y-1">
            <span className="block text-[11px] text-muted-foreground">A partir de</span>
            <Select value={range.min != null ? String(range.min) : ANY} onValueChange={(v) => set("min", v)}>
              <SelectTrigger className="h-9 text-xs" aria-label={`${label}: a partir de`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Qualquer</SelectItem>
                {minOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {fmt(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1">
            <span className="block text-[11px] text-muted-foreground">Até</span>
            <Select value={range.max != null ? String(range.max) : ANY} onValueChange={(v) => set("max", v)}>
              <SelectTrigger className="h-9 text-xs" aria-label={`${label}: até`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Qualquer</SelectItem>
                {maxOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {fmt(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
