import { useQuery } from "@tanstack/react-query";
import type { LayoutItem } from "@/components/venue/public-card-renderer";

/** Layout público configurado pelo super admin para a categoria (usado no skeleton). */
export function useCategoryLayout(categoryId: string | undefined, scope: "organization_card" | "record_card") {
  return useQuery({
    queryKey: ["public-category-layout", categoryId, scope],
    queryFn: async (): Promise<LayoutItem[]> => {
      const res = await fetch(`/api/public/category-layout/${categoryId}?scope=${scope}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json?.fields ?? []) as LayoutItem[];
    },
    enabled: !!categoryId,
    staleTime: 5 * 60_000,
  });
}

/** Indica se a categoria possui registros públicos (para ocultar listagens vazias). */
export function useHasPublicRecords(categoryId: string | undefined) {
  const q = useQuery({
    queryKey: ["public-records-count", categoryId],
    queryFn: async (): Promise<number> => {
      const p = new URLSearchParams({ limit: "1", offset: "0" });
      if (categoryId) p.set("category", categoryId);
      const res = await fetch(`/api/public/records?${p.toString()}`);
      if (!res.ok) return 0;
      const json = await res.json();
      return Number(json?.total ?? (json?.items?.length ?? 0));
    },
    enabled: !!categoryId,
    staleTime: 5 * 60_000,
  });
  return { hasRecords: (q.data ?? 0) > 0, isLoading: q.isLoading };
}
