// Server-only helpers for the configurable home (Iteração 30 — correção/extensão).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cached, TTL_SHORT } from "@/lib/server-cache";
import { listPublicOrganizations, listPublicRecords, signPathsCached } from "@/lib/public.server";
import type { PublicFilterRule } from "@/lib/public.server";

export type HomeBlockLinkItem = {
  title: string;
  image_path?: string | null;
  image_url?: string | null;
  field_key?: string | null;
  value?: string | null;
  category_id?: string | null;
  category_slug?: string | null;
};

/** Mapa category_id -> slug (derivado do nome, igual à navegação pública). */
async function loadCategorySlugs(): Promise<Map<string, string>> {
  return cached("home:category-slugs", TTL_SHORT, loadCategorySlugsUncached);
}

async function loadCategorySlugsUncached(): Promise<Map<string, string>> {
  const { slugify } = await import("@/lib/slug");
  const { data } = await supabaseAdmin.from("organization_categories").select("id, name");
  return new Map(((data ?? []) as any[]).map((c) => [c.id as string, slugify(c.name as string)]));
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  return signPathsCached(paths);
}

/**
 * Resolve todos os blocos de um agrupamento em paralelo (antes eram
 * sequenciais, ~4s de idas ao banco encadeadas) e só então aplica a regra de
 * não repetir a mesma organização/registro entre blocos, na ordem original.
 * Cada bloco é buscado com folga (`limit` + margem) para que a deduplicação
 * não reduza a quantidade de cards exibidos.
 */
export async function loadHomeGroupingData(groupingId: string) {
  const { data: blocks, error } = await supabaseAdmin
    .from("home_blocks")
    .select("id, title, source, rules, order_by, limit_count, order_index, block_type, columns, items")
    .eq("grouping_id", groupingId)
    .eq("is_active", true)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);

  const list = ((blocks ?? []) as any[]);
  const cardBlocks = list.filter((b) => (b.block_type ?? "cards") !== "links");
  const totalCardLimit = cardBlocks.reduce(
    (acc, b) => acc + Math.min(Math.max(Number(b.limit_count ?? 6), 1), 60),
    0,
  );

  const [categorySlugs, resolved] = await Promise.all([
    loadCategorySlugs(),
    Promise.all(
      list.map(async (b) => {
        const blockType = (b.block_type ?? "cards") as "cards" | "links";
        if (blockType === "links") {
          const raw = (Array.isArray(b.items) ? b.items : []) as HomeBlockLinkItem[];
          const signed = await signPaths(raw.map((i) => i.image_path ?? "").filter(Boolean) as string[]);
          return { id: b.id, source: "links" as const, raw, signed };
        }
        const limit = Math.min(Math.max(Number(b.limit_count ?? 6), 1), 60);
        const fetchLimit = Math.min(limit + totalCardLimit, 60);
        const rules = (b.rules ?? []) as PublicFilterRule[];
        if (b.source === "records") {
          const { items } = await listPublicRecords({ limit: fetchLimit, offset: 0, rules });
          return { id: b.id, source: "records" as const, items, limit };
        }
        const { items } = await listPublicOrganizations({ limit: fetchLimit, offset: 0, rules });
        return { id: b.id, source: "organizations" as const, items, limit };
      }),
    ),
  ]);

  const seenOrgs = new Set<string>();
  const seenRecords = new Set<string>();
  const result: Array<{ id: string; items: any[]; links: HomeBlockLinkItem[] }> = [];

  for (const r of resolved) {
    if (r.source === "links") {
      result.push({
        id: r.id,
        items: [],
        links: r.raw.map((i) => ({
          ...i,
          category_slug: i.category_id ? (categorySlugs.get(i.category_id) ?? null) : null,
          image_url: i.image_path && !/^https?:\/\//i.test(i.image_path)
            ? (r.signed.get(i.image_path) ?? null)
            : (i.image_path ?? null),
        })),
      });
      continue;
    }
    const seen = r.source === "records" ? seenRecords : seenOrgs;
    const idOf = (it: any) => (r.source === "records" ? it.record_id : it.id);
    const items = r.items.filter((it: any) => !seen.has(idOf(it))).slice(0, r.limit);
    for (const it of items) seen.add(idOf(it));
    result.push({ id: r.id, items, links: [] });
  }

  return { blocks: result };
}


export type FieldKeyOption = { value: string; label: string };
export type FieldKeyInfo = { key: string; label: string; type: string; scope: string; options?: FieldKeyOption[] };

function optionsOf(config: any): FieldKeyOption[] {
  const raw = Array.isArray(config?.options) ? config.options : [];
  const out: FieldKeyOption[] = [];
  for (const o of raw) {
    if (typeof o === "string") out.push({ value: o, label: o });
    else if (o && typeof o === "object") {
      const value = String(o.value ?? o.key ?? o.label ?? "");
      if (value) out.push({ value, label: String(o.label ?? o.name ?? value) });
    }
  }
  return out;
}

/** Lista todas as field-keys disponíveis para regras de blocos da home. */
export async function listAvailableFieldKeys(): Promise<{ organization: FieldKeyInfo[]; record: FieldKeyInfo[] }> {
  const base: FieldKeyInfo[] = [
    { key: "name", label: "Nome", type: "text", scope: "Base" },
    { key: "slug", label: "Slug", type: "text", scope: "Base" },
    { key: "description", label: "Descrição", type: "long_text", scope: "Base" },
    { key: "address.cep", label: "CEP", type: "text", scope: "Endereço" },
    { key: "address.street", label: "Logradouro", type: "text", scope: "Endereço" },
    { key: "address.number", label: "Número", type: "text", scope: "Endereço" },
    { key: "address.complement", label: "Complemento", type: "text", scope: "Endereço" },
    { key: "address.neighborhood", label: "Bairro", type: "text", scope: "Endereço" },
    { key: "address.city", label: "Cidade", type: "text", scope: "Endereço" },
    { key: "address.state", label: "UF", type: "text", scope: "Endereço" },
    { key: "address.city_state_full", label: "Cidade - Estado (extenso)", type: "text", scope: "Endereço" },
  ];

  const [{ data: cats }, { data: orgFields }, { data: recFields }] = await Promise.all([
    supabaseAdmin.from("organization_categories").select("id, name"),
    supabaseAdmin.from("category_org_fields").select("category_id, field_key, label, field_type, config").order("order_index", { ascending: true }),
    supabaseAdmin.from("category_standard_table_fields").select("field_key, label, field_type, config").order("order_index", { ascending: true }),
  ]);

  const catName = new Map(((cats ?? []) as any[]).map((c) => [c.id, c.name as string]));
  const organization: FieldKeyInfo[] = [...base];
  for (const f of ((orgFields ?? []) as any[])) {
    organization.push({
      key: f.field_key,
      label: f.label,
      type: f.field_type,
      scope: catName.get(f.category_id) ?? "Categoria",
      options: optionsOf(f.config),
    });
  }

  const seen = new Set<string>();
  const record: FieldKeyInfo[] = [];
  for (const f of ((recFields ?? []) as any[])) {
    if (seen.has(f.field_key)) continue;
    seen.add(f.field_key);
    record.push({ key: f.field_key, label: f.label, type: f.field_type, scope: "Registro", options: optionsOf(f.config) });
  }

  return { organization, record };
}
