import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { InstanceSettings, CurrencyDisplay } from "@/lib/instance-settings.functions";
import type { PlatformLabel } from "@/lib/platform-labels.functions";
import { resolveContext, type FormatContext } from "@/lib/formatting";

async function fetchInstanceSettings(): Promise<InstanceSettings | null> {
  const res = await fetch("/api/public/instance-settings");
  if (!res.ok) return null;
  return res.json();
}

async function fetchPlatformLabels(): Promise<PlatformLabel[]> {
  const res = await fetch("/api/public/platform-labels", { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

/** Instance settings, cached 5min. Falls back to defaults if unreachable. */
export function useInstanceSettings() {
  return useQuery({
    queryKey: ["instance-settings"],
    queryFn: fetchInstanceSettings,
    staleTime: 5 * 60 * 1000,
  });
}

/** Platform labels dictionary. Runtime-administered labels refetch when observers mount, focus, or reconnect. */
export function usePlatformLabels() {
  return useQuery({
    queryKey: ["platform-labels"],
    queryFn: fetchPlatformLabels,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
}

const FALLBACK_LABELS: Record<string, string> = {
  organization: "Organização",
  organizations: "Organizações",
  table: "Tabela",
  tables: "Tabelas",
  record: "Registro",
  records: "Registros",
  view: "View",
  views: "Views",
  field: "Campo",
  fields: "Campos",
  membership: "Membro",
  memberships: "Membros",
  conversation: "Conversa",
  conversations: "Conversas",
  message: "Mensagem",
  messages: "Mensagens",
  campaign: "Campanha",
  campaigns: "Campanhas",
  contribution: "Contribuição",
  contributions: "Contribuições",
  booking: "Reserva",
  bookings: "Reservas",
  category: "Categoria",
  categories: "Categorias",
};

/** Resolve a label key to its current label. Returns fallback when data is loading. */
export function useLabels() {
  const q = usePlatformLabels();
  const dict = useMemo(() => {
    const base: Record<string, string> = { ...FALLBACK_LABELS };
    for (const l of q.data ?? []) base[l.key] = l.label;
    return base;
  }, [q.data]);
  const icons = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const l of q.data ?? []) map[l.key] = l.icon;
    return map;
  }, [q.data]);
  return {
    t: (key: string, fallback?: string) => dict[key] ?? fallback ?? key,
    icon: (key: string) => icons[key] ?? null,
    labels: dict,
  };
}

/** Formatting context, merging org overrides onto instance defaults. */
export function useFormatContext(org?: {
  timezone?: string | null;
  currency?: string | null;
  currency_display?: CurrencyDisplay | null;
} | null): FormatContext {
  const s = useInstanceSettings();
  return useMemo(() => resolveContext(s.data ?? null, org ?? null), [s.data, org]);
}
