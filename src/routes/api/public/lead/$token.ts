import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const PostSchema = z.object({
  body: z.string().min(1).max(4000),
  type: z.enum(["text", "proposal"]).default("text"),
  proposed_value: z.number().finite().nullable().optional(),
});

async function loadContext(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: t } = await supabaseAdmin
    .from("lead_access_tokens")
    .select("token, conversation_id, organization_id, email, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!t) return { supabaseAdmin, token: null };
  if (new Date(t.expires_at).getTime() < Date.now()) return { supabaseAdmin, token: null };
  return { supabaseAdmin, token: t };
}

export const Route = createFileRoute("/api/public/lead/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin, token } = await loadContext(params.token);
        if (!token) return Response.json({ error: "Token inválido" }, { status: 404 });

        const { data: conv } = await supabaseAdmin
          .from("conversations")
          .select("id, title, lead_email, record_id, organization_id")
          .eq("id", token.conversation_id)
          .maybeSingle();
        if (!conv) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("slug, name")
          .eq("id", conv.organization_id)
          .maybeSingle();

        const { data: record } = conv.record_id
          ? await supabaseAdmin
              .from("records")
              .select("id, deal_status, agreed_value, data")
              .eq("id", conv.record_id)
              .maybeSingle()
          : { data: null };

        const { data: messages } = await supabaseAdmin
          .from("messages")
          .select("id, sender_email, sender_role, type, body, proposed_value, proposal_status, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        return Response.json({
          conversation: { id: conv.id, title: conv.title, lead_email: conv.lead_email },
          organization: org ?? null,
          record: record ?? null,
          messages: messages ?? [],
        });
      },
      POST: async ({ params, request }) => {
        const { supabaseAdmin, token } = await loadContext(params.token);
        if (!token) return Response.json({ error: "Token inválido" }, { status: 404 });

        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
        const parsed = PostSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Payload inválido" }, { status: 400 });

        const insert = {
          conversation_id: token.conversation_id,
          organization_id: token.organization_id,
          sender_user_id: null,
          sender_email: token.email,
          sender_role: "lead",
          type: parsed.data.type,
          body: parsed.data.body,
          proposed_value: parsed.data.type === "proposal" ? (parsed.data.proposed_value ?? null) : null,
          proposal_status: parsed.data.type === "proposal" ? "pending" : null,
        };
        const { data, error } = await supabaseAdmin.from("messages").insert(insert).select("id").single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", token.conversation_id);
        return Response.json({ id: data.id });
      },
    },
  },
});
