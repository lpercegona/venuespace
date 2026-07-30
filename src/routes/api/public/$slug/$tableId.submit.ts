import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { randomBytes } from "crypto";

const SubmitSchema = z.object({
  view_id: z.string().uuid(),
  source_record_id: z.string().uuid().nullable().optional(),
  contact_email: z.string().email(),
  contact_name: z.string().max(120).optional(),
  data: z.record(z.string(), z.any()),
});

export const Route = createFileRoute("/api/public/$slug/$tableId/submit")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }
        const parsed = SubmitSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Payload inválido", issues: parsed.error.issues }, { status: 400 });
        }
        const { view_id, source_record_id, contact_email, contact_name, data } = parsed.data;

        const { loadPublicFormSchema, orgHasAssignedUser } = await import("@/lib/public.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Load view + submissions schema
        const { view, fields } = await loadPublicFormSchema(view_id);

        // Verify organization slug matches path
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id, slug")
          .eq("id", view.organization_id)
          .maybeSingle();
        if (!org || org.slug !== params.slug) {
          return Response.json({ error: "Organização não corresponde" }, { status: 400 });
        }
        // Contato pela plataforma exige usuário atribuído à organização (Correção Iteração 24).
        if (!(await orgHasAssignedUser(view.organization_id))) {
          return Response.json({ error: "Esta organização não recebe contatos pela plataforma." }, { status: 403 });
        }
        // Verify source table matches path (or view.table_id)
        if (view.source_table_id !== params.tableId) {
          return Response.json({ error: "Tabela não corresponde" }, { status: 400 });
        }

        // If auto_relation is required, verify source record exists and is published
        if (view.auto_relation_field_id) {
          if (!source_record_id) {
            return Response.json({ error: "source_record_id obrigatório" }, { status: 400 });
          }
          const { data: srcRec } = await supabaseAdmin
            .from("records")
            .select("id, status, table_id")
            .eq("id", source_record_id)
            .maybeSingle();
          if (!srcRec || srcRec.status !== "published" || srcRec.table_id !== view.source_table_id) {
            return Response.json({ error: "Registro de origem inválido" }, { status: 400 });
          }
        }

        // Build clean data limited to view fields
        const allowedKeys = new Set(fields.map((f: any) => f.key));
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) if (allowedKeys.has(k)) clean[k] = v;

        // Required check
        for (const f of fields) {
          if (f.required) {
            const v = clean[f.key];
            if (v === undefined || v === null || v === "") {
              return Response.json({ error: `Campo obrigatório: ${f.label}` }, { status: 400 });
            }
          }
        }

        // Fill auto-relation field with source record id
        if (view.auto_relation_field_id) {
          const relField = (await supabaseAdmin
            .from("fields")
            .select("key")
            .eq("id", view.auto_relation_field_id)
            .maybeSingle()).data;
          if (relField?.key) clean[relField.key] = source_record_id!;
        }

        // Attach contact metadata
        clean.__contact_email = contact_email;
        if (contact_name) clean.__contact_name = contact_name;

        // Check optional authenticated bearer to fill applicant_user_id
        let applicantUserId: string | null = null;
        const auth = request.headers.get("authorization");
        if (auth?.startsWith("Bearer ")) {
          const token = auth.slice(7);
          try {
            const { data: userRes } = await supabaseAdmin.auth.getUser(token);
            applicantUserId = userRes?.user?.id ?? null;
          } catch {
            /* ignore */
          }
        }

        // Insert submission
        const { data: sub, error: subErr } = await supabaseAdmin
          .from("records")
          .insert({
            table_id: view.submissions_table_id,
            organization_id: view.organization_id,
            data: clean as any,
            status: "draft",
            applicant_user_id: applicantUserId,
          })
          .select("id")
          .single();
        if (subErr) return Response.json({ error: subErr.message }, { status: 500 });

        // Create conversation linked to the submission
        const title = `Contato — ${contact_name ?? contact_email}`;
        const { data: conv, error: convErr } = await supabaseAdmin
          .from("conversations")
          .insert({
            organization_id: view.organization_id,
            record_id: sub.id,
            title,
            lead_email: contact_email,
            applicant_user_id: applicantUserId,
          })
          .select("id")
          .single();
        if (convErr) return Response.json({ error: convErr.message }, { status: 500 });

        // Anonymous access token
        let leadToken: string | null = null;
        if (!applicantUserId) {
          leadToken = randomBytes(24).toString("hex");
          await supabaseAdmin.from("lead_access_tokens").insert({
            token: leadToken,
            conversation_id: conv.id,
            organization_id: view.organization_id,
            record_id: sub.id,
            email: contact_email,
          });
        }

        return Response.json({
          submission_id: sub.id,
          conversation_id: conv.id,
          lead_token: leadToken,
        });
      },
    },
  },
});
