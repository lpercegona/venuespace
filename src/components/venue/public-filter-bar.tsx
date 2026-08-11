import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * Busca instantânea + filtros agrupados em um único dropdown
 * (mesmo comportamento em mobile e desktop).
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
  const activeCount = Object.values(values).filter(Boolean).length;
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
          <PopoverContent align="end" className="w-72 p-0">
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 p-3">
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
