import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ Conversations ============

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("conversations")
      .select("id, title, lead_email, applicant_user_id, record_id, updated_at, created_at")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: conv, error } = await context.supabase
      .from("conversations")
      .select("id, title, lead_email, applicant_user_id, record_id, organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Conversa não encontrada");

    const { data: record } = conv.record_id
      ? await context.supabase
          .from("records")
          .select("id, deal_status, agreed_value, data, table_id")
          .eq("id", conv.record_id)
          .maybeSingle()
      : { data: null };

    return { conversation: conv, record };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, sender_user_id, sender_email, sender_role, type, body, proposed_value, proposal_status, read_at, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ Messages ============

const sendSchema = z.object({
  conversation_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  type: z.enum(["text", "proposal"]).default("text"),
  proposed_value: z.number().finite().nullable().optional(),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Determine sender role: member if org membership exists, else lead (applicant)
    const { data: mem } = await context.supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const senderRole = mem?.role ? "member" : "lead";

    const insert = {
      conversation_id: data.conversation_id,
      organization_id: data.organization_id,
      sender_user_id: context.userId,
      sender_role: senderRole,
      type: data.type,
      body: data.body,
      proposed_value: data.type === "proposal" ? (data.proposed_value ?? null) : null,
      proposal_status: data.type === "proposal" ? "pending" : null,
    };
    const { data: row, error } = await context.supabase
      .from("messages").insert(insert).select("id").single();
    if (error) throw new Error(error.message);

    await context.supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversation_id);

    return row;
  });

// ============ Proposal + deal_status ============

export const setProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      message_id: z.string().uuid(),
      status: z.enum(["accepted", "declined"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("messages")
      .update({ proposal_status: data.status })
      .eq("id", data.message_id)
      .eq("type", "proposal");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDealStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      record_id: z.string().uuid(),
      status: z.enum(["negotiating", "accepted", "declined", "closed"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const update: Record<string, any> = { deal_status: data.status };

    if (data.status === "closed") {
      // Find last accepted proposal on any conversation tied to this record
      const { data: convs } = await context.supabase
        .from("conversations").select("id").eq("record_id", data.record_id);
      const convIds = (convs ?? []).map((c: any) => c.id);
      if (convIds.length > 0) {
        const { data: msg } = await context.supabase
          .from("messages")
          .select("proposed_value, created_at")
          .in("conversation_id", convIds)
          .eq("type", "proposal")
          .eq("proposal_status", "accepted")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msg?.proposed_value != null) update.agreed_value = msg.proposed_value;
      }
    }

    const { error } = await context.supabase
      .from("records").update(update as any).eq("id", data.record_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Public form view creation (helper for editors) ============

export const createPublicFormView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table_id: z.string().uuid(),
      submissions_table_id: z.string().uuid(),
      name: z.string().min(1).max(80).default("Formulário público"),
      auto_relation_field_id: z.string().uuid().nullable().optional(),
      form_field_ids: z.array(z.string().uuid()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: table } = await context.supabase
      .from("tables")
      .select("organization_id")
      .eq("id", data.table_id)
      .maybeSingle();
    if (!table) throw new Error("Tabela não encontrada");

    const config: Record<string, any> = {};
    if (data.auto_relation_field_id) config.auto_relation_field_id = data.auto_relation_field_id;
    if (data.form_field_ids) config.form_field_ids = data.form_field_ids;

    const { data: row, error } = await context.supabase
      .from("views")
      .insert({
        table_id: data.table_id,
        organization_id: table.organization_id,
        name: data.name,
        type: "public_form",
        submissions_table_id: data.submissions_table_id,
        config: config as any,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
