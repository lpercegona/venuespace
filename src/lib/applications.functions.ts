import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =========== Iteration 5: /me/applications ===========

export const getMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: recs, error } = await context.supabase
      .from("records")
      .select(
        "id, data, deal_status, agreed_value, status, created_at, table:tables(id, name, slug, organization:organizations(id, slug, name))",
      )
      .eq("applicant_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const items = (recs ?? []) as any[];
    // Attach conversation id per submission if any
    const ids = items.map((r) => r.id);
    const convMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: convs } = await context.supabase
        .from("conversations")
        .select("id, record_id")
        .in("record_id", ids);
      for (const c of (convs ?? []) as any[]) convMap.set(c.record_id, c.id);
    }
    return items.map((r) => ({ ...r, conversation_id: convMap.get(r.id) ?? null }));
  });

// =========== Iteration 6: Campaigns / Contributions ===========

export const setContributionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pledged", "confirmed", "refunded", "none"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("records")
      .update({ contribution_status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listContributionsForCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ campaign_record_id: z.string().uuid(), table_id: z.string().uuid(), relation_key: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("records")
      .select("id, data, contribution_status, created_at, applicant_user_id")
      .eq("table_id", data.table_id)
      .contains("data", { [data.relation_key]: data.campaign_record_id } as any)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// =========== Iteration 8: Membership management ===========

/**
 * Organizações podem ficar sem proprietário (correção da Iteração 25): nesse
 * estado a página pública mantém apenas contato direto, sem formulários/chat.
 * Mantido apenas para checar a existência do membro alvo.
 */
async function assertMembershipExists(supabase: any, membershipId: string) {
  const { data: m, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("id", membershipId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!m) throw new Error("Membro não encontrado.");
}


export const updateMembershipRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      role: z.enum(["owner", "editor", "viewer"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMembershipExists(context.supabase, data.id);
    const { error } = await context.supabase
      .from("memberships")
      .update({ role: data.role })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMembershipExists(context.supabase, data.id);
    const { error } = await context.supabase.from("memberships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =========== Notifications: unread messages ===========

export const listUnreadForOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, conversation_id, body, type, sender_role, created_at, conversation:conversations(id, title)")
      .eq("organization_id", data.organization_id)
      .is("read_at", null)
      .neq("sender_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversation_id)
      .is("read_at", null)
      .neq("sender_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =========== Iteration 7: Booking conflict detection ===========

export type BookingCheckResult = {
  bookable: boolean;
  conflict: null | { record_id: string; start: string; end: string };
};

/**
 * Given a submission record on a bookable-source table, check if its
 * booking_start/booking_end overlap another accepted/closed submission
 * on the same resource. Returns conflict info if any.
 */
export const checkBookingConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ record_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    return await runBookingCheck(context.supabase, data.record_id);
  });

export async function runBookingCheck(supabase: any, recordId: string): Promise<BookingCheckResult> {
  const { data: rec } = await supabase
    .from("records")
    .select("id, table_id, data, deal_status")
    .eq("id", recordId)
    .maybeSingle();
  if (!rec) return { bookable: false, conflict: null };

  // Read source table (submissions table) for booking fields
  const { data: fields } = await supabase
    .from("fields")
    .select("id, key, type, config")
    .eq("table_id", rec.table_id);
  const fs = (fields ?? []) as Array<{ key: string; type: string; config: any }>;
  const startF = fs.find((f) => (f.config ?? {}).booking_role === "start");
  const endF = fs.find((f) => (f.config ?? {}).booking_role === "end");
  const resourceRelKey =
    fs.find((f) => (f.config ?? {}).is_resource_relation === true)?.key ??
    (fs.find((f) => f.type === "relation")?.key ?? null);

  if (!startF || !endF || !resourceRelKey) return { bookable: false, conflict: null };

  const start = rec.data?.[startF.key];
  const end = rec.data?.[endF.key];
  const resourceId = rec.data?.[resourceRelKey];
  if (!start || !end || !resourceId) return { bookable: true, conflict: null };

  // Find other submissions on the same table, same resource, accepted/closed, with overlap
  const { data: others } = await supabase
    .from("records")
    .select("id, data, deal_status")
    .eq("table_id", rec.table_id)
    .neq("id", recordId)
    .in("deal_status", ["accepted", "closed"])
    .contains("data", { [resourceRelKey]: resourceId } as any);

  for (const o of (others ?? []) as any[]) {
    const oStart = o.data?.[startF.key];
    const oEnd = o.data?.[endF.key];
    if (!oStart || !oEnd) continue;
    // Overlap: startA < endB && startB < endA
    if (String(start) < String(oEnd) && String(oStart) < String(end)) {
      return { bookable: true, conflict: { record_id: o.id, start: oStart, end: oEnd } };
    }
  }
  return { bookable: true, conflict: null };
}

// =========== Iteration 7: Occupancy calendar ===========

export const listOccupancy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: fields } = await context.supabase
      .from("fields")
      .select("id, key, type, config")
      .eq("table_id", data.table_id);
    const fs = (fields ?? []) as any[];
    const startF = fs.find((f) => (f.config ?? {}).booking_role === "start");
    const endF = fs.find((f) => (f.config ?? {}).booking_role === "end");
    const relF = fs.find((f) => (f.config ?? {}).is_resource_relation === true) ?? fs.find((f) => f.type === "relation");
    if (!startF || !endF || !relF) return { entries: [], meta: null };

    const { data: rows } = await context.supabase
      .from("records")
      .select("id, data, deal_status")
      .eq("table_id", data.table_id)
      .in("deal_status", ["accepted", "closed"]);

    const entries = (rows ?? []).map((r: any) => ({
      id: r.id,
      resource_id: r.data?.[relF.key] ?? null,
      start: r.data?.[startF.key] ?? null,
      end: r.data?.[endF.key] ?? null,
      status: r.deal_status,
    })).filter((e: any) => e.start && e.end && e.resource_id);
    return { entries, meta: { start_key: startF.key, end_key: endF.key, relation_key: relF.key } };
  });
