
-- Iteration 3 + 4: public publication, submissions, conversations, messages, lead access

-- ============ Anon-visible metadata policies ============
-- Organizations, tables, fields, views: metadata safe to expose to anon (no PII)
CREATE POLICY "organizations: anon read" ON public.organizations FOR SELECT TO anon USING (true);
CREATE POLICY "tables: anon read" ON public.tables FOR SELECT TO anon USING (true);
CREATE POLICY "fields: anon read" ON public.fields FOR SELECT TO anon USING (true);
CREATE POLICY "views: anon read" ON public.views FOR SELECT TO anon USING (true);

GRANT SELECT ON public.organizations TO anon;
GRANT SELECT ON public.tables TO anon;
GRANT SELECT ON public.fields TO anon;
GRANT SELECT ON public.views TO anon;

-- Records: only published rows readable by anon
CREATE POLICY "records: anon read published" ON public.records
  FOR SELECT TO anon USING (status = 'published');
GRANT SELECT ON public.records TO anon;

-- ============ conversations ============
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.records(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Conversa',
  lead_email TEXT,
  applicant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations: members read" ON public.conversations
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id) OR applicant_user_id = auth.uid());
CREATE POLICY "conversations: editors insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (can_edit_org(auth.uid(), organization_id) OR applicant_user_id = auth.uid());
CREATE POLICY "conversations: editors update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (can_edit_org(auth.uid(), organization_id) OR applicant_user_id = auth.uid())
  WITH CHECK (can_edit_org(auth.uid(), organization_id) OR applicant_user_id = auth.uid());
CREATE POLICY "conversations: editors delete" ON public.conversations
  FOR DELETE TO authenticated USING (can_edit_org(auth.uid(), organization_id));

CREATE INDEX idx_conversations_org ON public.conversations(organization_id);
CREATE INDEX idx_conversations_record ON public.conversations(record_id);
CREATE INDEX idx_conversations_applicant ON public.conversations(applicant_user_id);

CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ messages ============
-- type: 'text' | 'proposal' | 'system'
-- sender_role: 'member' | 'lead' | 'system'
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email TEXT,
  sender_role TEXT NOT NULL DEFAULT 'member',
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL DEFAULT '',
  proposed_value NUMERIC,
  proposal_status TEXT,  -- 'pending' | 'accepted' | 'declined' (only when type='proposal')
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages: participants read" ON public.messages
  FOR SELECT TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.applicant_user_id = auth.uid())
  );
CREATE POLICY "messages: participants insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (sender_user_id = auth.uid())
    AND (
      is_org_member(auth.uid(), organization_id)
      OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.applicant_user_id = auth.uid())
    )
  );
CREATE POLICY "messages: sender update read" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.applicant_user_id = auth.uid())
  )
  WITH CHECK (
    is_org_member(auth.uid(), organization_id)
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.applicant_user_id = auth.uid())
  );
CREATE POLICY "messages: editors delete" ON public.messages
  FOR DELETE TO authenticated USING (can_edit_org(auth.uid(), organization_id));

CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);

-- ============ lead_access_tokens ============
CREATE TABLE public.lead_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.records(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.lead_access_tokens TO service_role;
-- Not readable by anon or authenticated directly; only via server route with service role.

ALTER TABLE public.lead_access_tokens ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated → locked; server routes use service_role.

CREATE INDEX idx_lead_tokens_conv ON public.lead_access_tokens(conversation_id);
