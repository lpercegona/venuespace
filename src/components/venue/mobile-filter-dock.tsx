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

/**
 * Busca + filtros como ativo flutuante fixo e centralizado no rodapé (mobile/tablet).
 * Mesma aparência da barra de busca da home.
 */
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
  const activeCount = countSelectedFilters(values);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 lg:hidden">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-border bg-background/95 p-2 shadow-elegant backdrop-blur"
      >
        <div className="relative min-w-0 grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-full pl-9 text-foreground shadow-none focus-visible:ring-0"
            type="search"
            placeholder="Buscar"
            aria-label="Buscar"
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
          />
        </div>

        {filters.length > 0 ? (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 gap-2 rounded-full text-foreground"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeCount > 0 ? (
                  <Badge variant="secondary" className="rounded-full px-1.5">
                    {activeCount}
                  </Badge>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[88vh] p-0">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="font-display">Filtrar</SheetTitle>
              </SheetHeader>

              <ScrollArea className="h-[calc(88vh-9rem)] px-4">
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
                  Ver {total} resultado{total === 1 ? "" : "s"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : null}

        <Button
          type="submit"
          size="icon"
          aria-label="Buscar"
          className="h-11 w-11 shrink-0 rounded-full"
        >
          <Search className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
