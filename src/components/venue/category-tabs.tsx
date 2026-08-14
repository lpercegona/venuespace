import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";

export type PublicCategory = { id: string; name: string; icon?: string | null };

async function fetchCategories(): Promise<PublicCategory[]> {
  const res = await fetch("/api/public/organization-categories");
  if (!res.ok) throw new Error("Falha ao carregar categorias");
  return res.json();
}

export function usePublicCategories() {
  return useQuery({
    queryKey: ["public-org-categories"],
    queryFn: fetchCategories,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev: PublicCategory[] | undefined) => prev,
  });
}


export function categorySlug(c: PublicCategory) {
  return slugify(c.name);
}

/** Resolve the active category id from the URL slug (defaults to "Espaços", then the first). */
export function resolveCategory(cats: PublicCategory[] | undefined, slug: string | undefined) {
  const list = cats ?? [];
  if (list.length === 0) return null;
  const found = slug ? list.find((c) => categorySlug(c) === slug) : undefined;
  const preferred = list.find((c) => categorySlug(c) === "espacos");
  return found ?? preferred ?? list[0];
}


export function CategoryTabs({
  categories,
  isLoading,
  activeSlug,
  onSelect,
  className,
}: {
  categories: PublicCategory[] | undefined;
  isLoading?: boolean;
  activeSlug: string | undefined;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={cn("flex gap-2", className)}>
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    );
  }
  const list = categories ?? [];
  if (list.length < 2) return null;
  const active = resolveCategory(list, activeSlug);
  return (
    <Tabs
      value={active ? categorySlug(active) : undefined}
      onValueChange={onSelect}
      className={cn("-mx-4 w-auto px-4 sm:mx-0 sm:px-0", className)}
    >
      <TabsList aria-label="Categorias" className="h-auto flex-wrap justify-start gap-1 p-1">
        {list.map((c) => (
          <TabsTrigger key={c.id} value={categorySlug(c)} className="min-h-9 px-4 text-sm font-medium">
            {c.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

