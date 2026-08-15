import { normalizeBookingsConfig, type BookingsModuleConfig, type ModuleKey } from "@/lib/modules";

/** Configuração do módulo para uma categoria (com defaults aplicados). */
export async function loadCategoryModule(
  supabase: any,
  categoryId: string | null,
  moduleKey: ModuleKey,
): Promise<{ enabled: boolean; config: BookingsModuleConfig }> {
  if (!categoryId) return { enabled: true, config: normalizeBookingsConfig(null) };
  const { data } = await supabase
    .from("category_modules")
    .select("is_enabled, config")
    .eq("category_id", categoryId)
    .eq("module_key", moduleKey)
    .maybeSingle();
  return {
    enabled: data ? data.is_enabled !== false : true,
    config: normalizeBookingsConfig(data?.config ?? null),
  };
}

/** Configuração do módulo a partir da organização (resolve a categoria). */
export async function loadOrgModule(
  supabase: any,
  organizationId: string,
  moduleKey: ModuleKey,
) {
  const { data: org } = await supabase
    .from("organizations")
    .select("category_id")
    .eq("id", organizationId)
    .maybeSingle();
  return loadCategoryModule(supabase, (org?.category_id as string | null) ?? null, moduleKey);
}

/** Bloqueia escrita quando o módulo está desativado para a categoria da organização. */
export async function assertModuleEnabled(
  supabase: any,
  organizationId: string,
  moduleKey: ModuleKey,
) {
  const { enabled } = await loadOrgModule(supabase, organizationId, moduleKey);
  if (!enabled) {
    throw new Error("O módulo Reservas está desativado para a categoria desta organização.");
  }
}
