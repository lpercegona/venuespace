import type { ModuleKey } from "@/lib/modules";

export type ModuleDefinition = {
  key: ModuleKey;
  name: string;
  description: string;
  /** Recursos configuráveis expostos pelo módulo na administração. */
  features: Array<"form" | "pdf">;
};

/** Registro de módulos: novos módulos entram apenas como uma nova entrada aqui. */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: "bookings",
    name: "Reservas",
    description:
      "Agenda, disponibilidade por data, formulário de nova reserva e orçamento em PDF.",
    features: ["form", "pdf"],
  },
];

export function getModuleDefinition(key: string): ModuleDefinition | null {
  return MODULE_REGISTRY.find((m) => m.key === key) ?? null;
}
