import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicFilterDef } from "@/components/venue/public-filter-bar";
import { FilterOptionList } from "@/components/venue/filter-option-list";
import { countSelectedFilters } from "@/lib/filter-params";

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
 * Coluna lateral de filtros expandidos (desktop), em multisseleção.
 * As opções chegam já facetadas pelo servidor.
 */
export function PublicFilterSidebar({
  term,
  onTermChange,
  filters,
  values,
  onFilterChange,
  onClear,
  className,
}: Props) {
  const hasActive = !!term || countSelectedFilters(values) > 0;

  return (
    <aside className={cn("space-y-5", className)} aria-label="Filtros">
      <div className="relative">
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

      <div className="max-h-[calc(100vh-12rem)] space-y-0 overflow-y-auto pr-1">
        {filters.map((f, i) => (
          <FilterOptionList
            key={f.key}
            label={f.label}
            options={f.options}
            value={values[f.key]}
            defaultOpen={i === 0}
            onChange={(next) => onFilterChange(f.key, next)}
          />
        ))}
      </div>

      {hasActive ? (
        <Button variant="ghost" size="sm" className="h-10 w-full justify-start" onClick={onClear}>
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      ) : null}
    </aside>
  );
}
