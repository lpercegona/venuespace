import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, SlidersHorizontal } from "lucide-react";
import { exploreFiltersQuery } from "@/lib/public-queries";
import { FilterOptionList } from "@/components/venue/filter-option-list";
import { FilterRangeSelect } from "@/components/venue/filter-range-select";
import { countSelectedFilters } from "@/lib/filter-params";

type Props = {
  categoryId: string | undefined;
  categorySlug: string | undefined;
};

/**
 * Busca da home: encaminha termo + filtros selecionados para /explore.
 * As opções de filtro são dinâmicas (facetadas pelo termo e pelos demais filtros).
 */
export function HomeSearchBar({ categoryId, categorySlug }: Props) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const filtersQ = useQuery(
    exploreFiltersQuery({ scope: "organization", categoryId, q: term, filters: values, enabled: !!categoryId }),
  );
  const filters = useMemo(
    () => (filtersQ.data?.filters ?? []).filter((f: any) => f.filter_type === "select" || f.filter_type === "range"),
    [filtersQ.data],
  );
  const activeCount = countSelectedFilters(values);

  function submit() {
    const search: Record<string, string> = {};
    if (term.trim()) search.q = term.trim();
    if (categorySlug) search.categoria = categorySlug;
    for (const [k, v] of Object.entries(values)) if (v) search[`f_${k}`] = v;
    navigate({ to: "/explore", search: search as any });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mx-auto mt-8 flex w-full max-w-2xl items-center gap-2 rounded-full border border-border bg-background/80 p-2 shadow-elegant backdrop-blur"
    >
      <div className="min-w-0 grow">
        <Input
          className="h-11 rounded-full border-0 bg-transparent px-4 text-foreground shadow-none focus-visible:ring-0"
          type="search"
          placeholder="Busque seu espaço..."
          aria-label="Buscar"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {filters.length > 0 ? (
        
  <Popover>
  <PopoverTrigger asChild>
    <Button
      type="button"
      variant="outline"
      className="relative h-11 shrink-0 gap-2 rounded-full text-foreground aspect-square sm:aspect-auto sm:w-auto"
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span className="hidden sm:inline">Filtros</span>
      {activeCount > 0 ? (
        <Badge
          variant="secondary"
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px] sm:static sm:h-auto sm:w-auto sm:px-2 sm:py-0 sm:text-xs"
        >
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  </PopoverTrigger>
 
</Popover>
          <PopoverContent align="end" className="w-80 p-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-0 p-3 text-left">
                {filters.map((f: any, i: number) => {
                  const change = (next: string) =>
                    setValues((prev) => {
                      const copy = { ...prev };
                      if (next) copy[f.key] = next;
                      else delete copy[f.key];
                      return copy;
                    });
                  return f.filter_type === "range" ? (
                    <FilterRangeSelect
                      key={f.key}
                      label={f.label}
                      minOptions={f.min_options ?? []}
                      maxOptions={f.max_options ?? []}
                      value={values[f.key]}
                      defaultOpen={i === 0}
                      onChange={change}
                    />
                  ) : (
                    <FilterOptionList
                      key={f.key}
                      label={f.label}
                      options={f.options}
                      value={values[f.key]}
                      defaultOpen={i === 0}
                      onChange={change}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      ) : null}

      <Button type="submit" size="icon" aria-label="Buscar" className="h-11 w-11 shrink-0 rounded-full">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}
