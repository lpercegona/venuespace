import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrganizationReviews = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("organization_reviews")
      .select("id, user_id, rating, comment, status, created_at, user:user_id(display_name)")
      .eq("organization_id", data.organization_id)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as any[] };
  });

export const getMyOrganizationReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("organization_reviews")
      .select("id, rating, comment, status")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as { id: string; rating: number; comment: string | null; status: string } | null;
  });

export const upsertMyOrganizationReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("organization_reviews")
      .select("id")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const payload = {
      organization_id: data.organization_id,
      user_id: context.userId,
      rating: data.rating,
      comment: data.comment ?? null,
      status: "pending" as const,
    };

    if (existing) {
      const { error } = await context.supabase
        .from("organization_reviews")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    }

    const { data: created, error } = await context.supabase
      .from("organization_reviews")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as any).id };
  });

export const listPendingReviewsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSA } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSA) throw new Error("Apenas super admin.");

    const { data: rows, error } = await context.supabase
      .from("organization_reviews")
      .select("id, organization_id, user_id, rating, comment, created_at, organization:organization_id(name, slug), user:user_id(display_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as any[] };
  });

export const moderateReviewAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSA } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSA) throw new Error("Apenas super admin.");

    const { error } = await context.supabase
      .from("organization_reviews")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
