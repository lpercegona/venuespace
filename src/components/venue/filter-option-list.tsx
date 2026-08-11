import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseFilterValues, toggleFilterValue } from "@/lib/filter-params";

/** Acima deste número de opções, o filtro ganha busca interna + scroll. */
const LONG_LIST_THRESHOLD = 8;

type Props = {
  label: string;
  options: string[];
  /** Valor serializado atual (`A|B`). */
  value: string | undefined;
  onChange: (next: string) => void;
  /** Abre o acordeon por padrão. */
  defaultOpen?: boolean;
  className?: string;
};

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Lista de opções em multisseleção (checkboxes).
 * Listas curtas aparecem completas; listas longas ganham busca e scroll.
 */
export function FilterOptionList({ label, options, value, onChange, defaultOpen, className }: Props) {
  const selected = useMemo(() => parseFilterValues(value), [value]);
  const isLong = options.length > LONG_LIST_THRESHOLD;
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(() => defaultOpen ?? parseFilterValues(value).length > 0);

  const visible = useMemo(() => {
    if (!isLong || !term.trim()) return options;
    const needle = norm(term.trim());
    return options.filter((o) => norm(o).includes(needle));
  }, [options, term, isLong]);

  const isChecked = (opt: string) => selected.some((v) => v.toLowerCase() === opt.toLowerCase());

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
            {selected.length > 0 ? ` (${selected.length})` : ""}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {selected.length > 0 ? (
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
      <div className="space-y-2 pb-1">
      {isLong ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            type="search"
            placeholder={`Buscar em ${label.toLowerCase()}`}
            aria-label={`Buscar em ${label}`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      ) : null}

      <div className={cn("space-y-1.5", isLong && "max-h-52 overflow-y-auto pr-1")}>
        {visible.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">Nenhuma opção.</p>
        ) : (
          visible.map((opt) => {
            const id = `f-${label}-${opt}`.replace(/\s+/g, "-");
            return (
              <label
                key={opt}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 text-sm leading-tight"
              >
                <Checkbox
                  id={id}
                  checked={isChecked(opt)}
                  onCheckedChange={() => onChange(toggleFilterValue(value, opt))}
                />
                <span className="min-w-0 flex-1 break-words">{opt}</span>
              </label>
            );
          })
        )}
      </div>
      </div>
      )}
    </div>
  );
}
