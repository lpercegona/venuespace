import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
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
    staleTime: 5 * 60_000,
  });
}

export function categorySlug(c: PublicCategory) {
  return slugify(c.name);
}

/** Resolve the active category id from the URL slug (defaults to the first). */
export function resolveCategory(cats: PublicCategory[] | undefined, slug: string | undefined) {
  const list = cats ?? [];
  if (list.length === 0) return null;
  const found = slug ? list.find((c) => categorySlug(c) === slug) : undefined;
  return found ?? list[0];
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
    <div
      role="tablist"
      aria-label="Categorias"
      className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}
    >
      {list.map((c) => {
        const s = categorySlug(c);
        const isActive = active?.id === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(s)}
            className={cn(
              "min-h-11 shrink-0 rounded-lg border border-border px-4 text-sm font-medium transition-colors",
              "outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
