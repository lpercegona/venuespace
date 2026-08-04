import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicLayoutScope = "organization_card" | "record_card" | "organization_page";

export type LayoutField = {
  id: string;
  field_key: string;
  width_percent: 25 | 50 | 75 | 100;
  order_index: number;
  config: Record<string, any>;
};

async function requireSA(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

export const listCategoryLayout = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      category_id: z.string().uuid(),
      scope: z.enum(["organization_card", "record_card", "organization_page"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: parent } = await (supabaseAdmin as any)
      .from("category_public_layouts")
      .select("id, card_style")
      .eq("category_id", data.category_id)
      .eq("scope", data.scope)
      .maybeSingle();
    if (!parent) return { layout_id: null, card_style: "standard" as const, fields: [] as LayoutField[] };
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("category_public_layout_fields")
      .select("id, field_key, width_percent, order_index, config")
      .eq("layout_id", (parent as any).id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      layout_id: (parent as any).id as string,
      card_style: ((parent as any).card_style ?? "standard") as "standard" | "immersive",
      fields: ((rows ?? []) as any[]).map((r) => ({
        id: r.id,
        field_key: r.field_key,
        width_percent: r.width_percent,
        order_index: r.order_index,
        config: r.config ?? {},
      })) as LayoutField[],
    };
  });


const rowSchema = z.object({
  field_key: z.string().min(1).max(120),
  width_percent: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  order_index: z.number().int().min(0).max(999),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const saveCategoryLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      category_id: z.string().uuid(),
      scope: z.enum(["organization_card", "record_card", "organization_page"]),
      card_style: z.enum(["standard", "immersive"]).optional(),
      fields: z.array(rowSchema),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSA(context.supabase, context.userId);

    const cardStyle = data.card_style ?? "standard";
    if (cardStyle === "standard") {
      // Validate width_percent sums per row (fields are consecutive; group by cumulative until 100).
      let acc = 0;
      for (const f of data.fields) {
        acc += f.width_percent;
        if (acc > 100) throw new Error("Uma linha excede 100% de largura.");
        if (acc === 100) acc = 0;
      }
    }


    // Upsert parent
    const { data: existing } = await (context.supabase as any)
      .from("category_public_layouts")
      .select("id")
      .eq("category_id", data.category_id)
      .eq("scope", data.scope)
      .maybeSingle();
    let layoutId: string;
    if (existing) {
      layoutId = (existing as any).id;
      await (context.supabase as any).from("category_public_layouts").update({ updated_at: new Date().toISOString(), card_style: cardStyle }).eq("id", layoutId);
    } else {
      const { data: created, error: cErr } = await (context.supabase as any)
        .from("category_public_layouts")
        .insert({ category_id: data.category_id, scope: data.scope, card_style: cardStyle })

        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      layoutId = (created as any).id;
    }
    // Replace rows atomically
    await (context.supabase as any).from("category_public_layout_fields").delete().eq("layout_id", layoutId);
    if (data.fields.length > 0) {
      const rows = data.fields.map((f, i) => ({
        layout_id: layoutId,
        field_key: f.field_key,
        width_percent: f.width_percent,
        order_index: f.order_index ?? i,
        config: f.config ?? {},
      }));
      const { error } = await (context.supabase as any).from("category_public_layout_fields").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, layout_id: layoutId };
  });
