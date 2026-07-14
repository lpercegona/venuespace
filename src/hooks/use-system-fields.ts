import { useQuery } from "@tanstack/react-query";
import type { SystemFieldRow, SystemFieldScope } from "@/lib/system-fields.functions";

type AllFields = Record<SystemFieldScope, SystemFieldRow[]>;

async function fetchAll(): Promise<AllFields> {
  const res = await fetch("/api/public/system-fields");
  if (!res.ok) return { organization: [], table: [], record: [] };
  return res.json();
}

/** Cached lookup for instance-wide system fields definition, per scope. */
export function useSystemFields(scope: SystemFieldScope) {
  const q = useQuery({
    queryKey: ["system-fields"],
    queryFn: fetchAll,
    staleTime: 5 * 60 * 1000,
  });
  return {
    fields: (q.data?.[scope] ?? []) as SystemFieldRow[],
    isLoading: q.isLoading,
  };
}
