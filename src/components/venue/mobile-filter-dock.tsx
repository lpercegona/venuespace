import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FilterOptionList } from "@/components/venue/filter-option-list";
import { FilterRangeSelect } from "@/components/venue/filter-range-select";
import { countSelectedFilters } from "@/lib/filter-params";
import type { PublicFilterDef } from "@/components/venue/public-filter-bar";

type Props = {
  term: string;
  onTermChange: (v: string) => void;
  filters: PublicFilterDef[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClear: () => void;
  total: number;
};

/** Busca + filtros como ativo flutuante fixo no rodapé (mobile/tablet). */
export function MobileFilterDock({
  term,
  onTermChange,
  filters,
  values,
  onFilterChange,
  onClear,
  total,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = countSelectedFilters(values) + (term ? 1 : 0);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            className="pointer-events-auto min-h-11 gap-2 rounded-full px-6 shadow-elegant"
            aria-label="Buscar e filtrar"
          >
            <Search className="h-4 w-4" />
            Buscar e filtrar
            {activeCount > 0 ? (
              <Badge variant="secondary" className="rounded-full px-1.5">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[88vh] p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="font-display">Buscar e filtrar</SheetTitle>
          </SheetHeader>

          <div className="px-4 pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                type="search"
                placeholder="Buscar"
                aria-label="Buscar"
                value={term}
                onChange={(e) => onTermChange(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(88vh-13rem)] px-4">
            <div className="space-y-0 py-3">
              {filters.map((f, i) =>
                f.filter_type === "range" ? (
                  <FilterRangeSelect
                    key={f.key}
                    label={f.label}
                    minOptions={f.min_options ?? []}
                    maxOptions={f.max_options ?? []}
                    value={values[f.key]}
                    defaultOpen={i === 0}
                    onChange={(next) => onFilterChange(f.key, next)}
                  />
                ) : (
                  <FilterOptionList
                    key={f.key}
                    label={f.label}
                    options={f.options}
                    value={values[f.key]}
                    defaultOpen={i === 0}
                    onChange={(next) => onFilterChange(f.key, next)}
                  />
                ),
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2 border-t border-border p-4">
            <Button variant="ghost" className="min-h-11" onClick={onClear}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            <Button className="min-h-11 grow" onClick={() => setOpen(false)}>
              <SlidersHorizontal className="h-4 w-4" />
              Ver {total} resultado{total === 1 ? "" : "s"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
