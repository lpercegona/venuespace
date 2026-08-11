import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterOptionList } from "@/components/venue/filter-option-list";
import { countSelectedFilters } from "@/lib/filter-params";

export type PublicFilterDef = {
  key: string;
  label: string;
  filter_type: "search" | "select";
  options: string[];
};

type Props = {
  term: string;
  onTermChange: (v: string) => void;
  filters: PublicFilterDef[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClear: () => void;
  className?: string;
};

/**
 * Busca instantânea + filtros em multisseleção dentro de um painel
 * (usado em mobile e como fallback compacto).
 */
export function PublicFilterBar({
  term,
  onTermChange,
  filters,
  values,
  onFilterChange,
  onClear,
  className,
}: Props) {
  const activeCount = countSelectedFilters(values);
  const hasActive = activeCount > 0 || !!term;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative min-w-0 grow">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 pl-9"
          type="search"
          placeholder="Buscar"
          aria-label="Buscar"
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
        />
      </div>

      {filters.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 shrink-0 gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeCount > 0 ? (
                <Badge variant="secondary" className="rounded-full px-1.5">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-3">
                {filters.map((f) => (
                  <FilterOptionList
                    key={f.key}
                    label={f.label}
                    options={f.options}
                    value={values[f.key]}
                    onChange={(next) => onFilterChange(f.key, next)}
                  />
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      ) : null}

      {hasActive ? (
        <Button variant="ghost" size="sm" className="h-10 shrink-0" onClick={onClear}>
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Limpar</span>
        </Button>
      ) : null}
    </div>
  );
}
