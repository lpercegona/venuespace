// Server-only helpers for the configurable home (Iteração 30 — correção/extensão).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listPublicOrganizations, listPublicRecords } from "@/lib/public.server";
import type { PublicFilterRule } from "@/lib/public.server";

export type HomeBlockLinkItem = {
  title: string;
  image_path?: string | null;
  image_url?: string | null;
  field_key?: string | null;
  value?: string | null;
  category_id?: string | null;
};

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return out;
  const { data } = await supabaseAdmin.storage.from("venue-uploads").createSignedUrls(unique, 60 * 60);
  for (const row of (data ?? []) as Array<{ path?: string | null; signedUrl?: string | null }>) {
    if (row?.path && row?.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

/**
 * Resolve todos os blocos de um agrupamento em sequência, garantindo que uma
 * mesma organização/registro não se repita entre blocos da mesma página.
 */
export async function loadHomeGroupingData(groupingId: string) {
  const { data: blocks, error } = await supabaseAdmin
    .from("home_blocks")
    .select("id, title, source, rules, order_by, limit_count, order_index, block_type, columns, items")
    .eq("grouping_id", groupingId)
    .eq("is_active", true)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);

  const seenOrgs = new Set<string>();
  const seenRecords = new Set<string>();
  const result: Array<{ id: string; items: any[]; links: HomeBlockLinkItem[] }> = [];

  for (const b of ((blocks ?? []) as any[])) {
    const blockType = (b.block_type ?? "cards") as "cards" | "links";
    if (blockType === "links") {
      const raw = (Array.isArray(b.items) ? b.items : []) as HomeBlockLinkItem[];
      const signed = await signPaths(raw.map((i) => i.image_path ?? "").filter(Boolean) as string[]);
      result.push({
        id: b.id,
        items: [],
        links: raw.map((i) => ({
          ...i,
          image_url: i.image_path && !/^https?:\/\//i.test(i.image_path)
            ? (signed.get(i.image_path) ?? null)
            : (i.image_path ?? null),
        })),
      });
      continue;
    }

    const limit = Math.min(Math.max(Number(b.limit_count ?? 6), 1), 60);
    const rules = (b.rules ?? []) as PublicFilterRule[];
    if (b.source === "records") {
      const { items } = await listPublicRecords({
        limit,
        offset: 0,
        rules,
        exclude_ids: Array.from(seenRecords),
      });
      for (const it of items) seenRecords.add(it.record_id);
      result.push({ id: b.id, items, links: [] });
    } else {
      const { items } = await listPublicOrganizations({
        limit,
        offset: 0,
        rules,
        exclude_ids: Array.from(seenOrgs),
      });
      for (const it of items) seenOrgs.add(it.id);
      result.push({ id: b.id, items, links: [] });
    }
  }

  return { blocks: result };
}

export type FieldKeyInfo = { key: string; label: string; type: string; scope: string };

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
    supabaseAdmin.from("category_org_fields").select("category_id, field_key, label, field_type").order("order_index", { ascending: true }),
    supabaseAdmin.from("category_standard_table_fields").select("field_key, label, field_type").order("order_index", { ascending: true }),
  ]);

  const catName = new Map(((cats ?? []) as any[]).map((c) => [c.id, c.name as string]));
  const organization: FieldKeyInfo[] = [...base];
  for (const f of ((orgFields ?? []) as any[])) {
    organization.push({
      key: f.field_key,
      label: f.label,
      type: f.field_type,
      scope: catName.get(f.category_id) ?? "Categoria",
    });
  }

  const seen = new Set<string>();
  const record: FieldKeyInfo[] = [];
  for (const f of ((recFields ?? []) as any[])) {
    if (seen.has(f.field_key)) continue;
    seen.add(f.field_key);
    record.push({ key: f.field_key, label: f.label, type: f.field_type, scope: "Registro" });
  }

  return { organization, record };
}
