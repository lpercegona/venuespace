import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { randomBytes } from "crypto";

const ContributeSchema = z.object({
  amount: z.number().positive().finite(),
  contact_email: z.string().email(),
  contact_name: z.string().max(120).optional(),
  message: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/campaigns/$recordId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { createPublicClient } = await import("@/lib/public.server");
        const sb = createPublicClient();

        const { data: campaign } = await sb
          .from("records")
          .select("id, data, table_id, organization_id, status")
          .eq("id", params.recordId)
          .maybeSingle();
        if (!campaign || campaign.status !== "published") {
          return Response.json({ error: "Campanha não encontrada" }, { status: 404 });
        }
        const { data: org } = await sb
          .from("organizations")
          .select("id, slug, name")
          .eq("id", campaign.organization_id)
          .maybeSingle();
        const { data: table } = await sb
          .from("tables")
          .select("id, name")
          .eq("id", campaign.table_id)
          .maybeSingle();
        const { data: fields } = await sb
          .from("fields")
          .select("id, key, label, type, position, config")
          .eq("table_id", campaign.table_id)
          .order("position", { ascending: true });

        // Find a public_form view for this table (contributions form)
        const { data: views } = await sb
          .from("views")
          .select("id, submissions_table_id, config")
          .eq("table_id", campaign.table_id)
          .eq("type", "public_form")
          .limit(1);
        const view = views?.[0] as any;

        // Sum confirmed contributions
        let confirmedTotal = 0;
        let contributionCount = 0;
        if (view?.submissions_table_id) {
          const relKey =
            (view.config ?? {}).auto_relation_field_id
              ? (await sb.from("fields").select("key").eq("id", (view.config ?? {}).auto_relation_field_id).maybeSingle()).data?.key ?? null
              : null;
          if (relKey) {
            const { data: contribs } = await sb
              .from("records")
              .select("data, contribution_status")
              .eq("table_id", view.submissions_table_id)
              .contains("data", { [relKey]: campaign.id } as any);
            for (const c of (contribs ?? []) as any[]) {
              if (c.contribution_status === "confirmed") {
                const amountKey = Object.keys(c.data ?? {}).find((k) => /amount|valor/i.test(k));
                confirmedTotal += Number(c.data?.[amountKey ?? ""] ?? 0);
                contributionCount += 1;
              }
            }
          }
        }

        return Response.json({
          organization: org,
          table,
          campaign: { id: campaign.id, data: campaign.data },
          fields: fields ?? [],
          form: view ? { view_id: view.id, submissions_table_id: view.submissions_table_id } : null,
          progress: { confirmed_total: confirmedTotal, count: contributionCount },
        });
      },

      POST: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
        const parsed = ContributeSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Payload inválido" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: campaign } = await supabaseAdmin
          .from("records")
          .select("id, table_id, organization_id, status")
          .eq("id", params.recordId)
          .maybeSingle();
        if (!campaign || campaign.status !== "published") {
          return Response.json({ error: "Campanha não encontrada" }, { status: 404 });
        }

        const { data: views } = await supabaseAdmin
          .from("views")
          .select("id, submissions_table_id, config")
          .eq("table_id", campaign.table_id)
          .eq("type", "public_form")
          .limit(1);
        const view = views?.[0] as any;
        if (!view?.submissions_table_id) {
          return Response.json({ error: "Formulário de contribuição não configurado" }, { status: 400 });
        }

        // Determine relation key
        let relKey: string | null = null;
        if ((view.config ?? {}).auto_relation_field_id) {
          const { data: f } = await supabaseAdmin
            .from("fields").select("key").eq("id", (view.config ?? {}).auto_relation_field_id).maybeSingle();
          relKey = f?.key ?? null;
        }
        if (!relKey) return Response.json({ error: "Relação automática ausente" }, { status: 400 });

        const data: Record<string, any> = {
          [relKey]: campaign.id,
          amount: parsed.data.amount,
          contact_email: parsed.data.contact_email,
        };
        if (parsed.data.contact_name) data.contact_name = parsed.data.contact_name;
        if (parsed.data.message) data.message = parsed.data.message;

        // Optional bearer to attach applicant
        let applicantUserId: string | null = null;
        const auth = request.headers.get("authorization");
        if (auth?.startsWith("Bearer ")) {
          try {
            const { createPublicClient } = await import("@/lib/public.server");
            const sb = createPublicClient();
            const { data: u } = await sb.auth.getUser(auth.slice(7));
            applicantUserId = u?.user?.id ?? null;
          } catch { /* ignore */ }
        }

        const { data: sub, error: subErr } = await supabaseAdmin
          .from("records")
          .insert({
            table_id: view.submissions_table_id,
            organization_id: campaign.organization_id,
            data,
            status: "draft",
            contribution_status: "pledged",
            applicant_user_id: applicantUserId,
          })
          .select("id")
          .single();
        if (subErr) return Response.json({ error: subErr.message }, { status: 500 });

        // Conversation for the organizer
        const { data: conv } = await supabaseAdmin
          .from("conversations")
          .insert({
            organization_id: campaign.organization_id,
            record_id: sub.id,
            title: `Contribuição — ${parsed.data.contact_name ?? parsed.data.contact_email}`,
            lead_email: parsed.data.contact_email,
            applicant_user_id: applicantUserId,
          })
          .select("id")
          .single();

        let leadToken: string | null = null;
        if (!applicantUserId && conv) {
          leadToken = randomBytes(24).toString("hex");
          await supabaseAdmin.from("lead_access_tokens").insert({
            token: leadToken,
            conversation_id: conv.id,
            organization_id: campaign.organization_id,
            record_id: sub.id,
            email: parsed.data.contact_email,
          });
        }

        return Response.json({ contribution_id: sub.id, lead_token: leadToken, conversation_id: conv?.id ?? null });
      },
    },
  },
});
