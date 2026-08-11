import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicFilterDef } from "@/components/venue/public-filter-bar";

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
 * Coluna lateral de filtros expandidos (desktop).
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
  const hasActive = !!term || Object.values(values).some(Boolean);

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

      {filters.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          <Select
            value={values[f.key] ?? "__any"}
            onValueChange={(v) => onFilterChange(f.key, v === "__any" ? "" : v)}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">Todos</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {hasActive ? (
        <Button variant="ghost" size="sm" className="h-10 w-full justify-start" onClick={onClear}>
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      ) : null}
    </aside>
  );
}
