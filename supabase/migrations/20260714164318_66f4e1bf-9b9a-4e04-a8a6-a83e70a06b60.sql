
-- Iteration 5: applicants can read their own submissions
CREATE POLICY "records: applicants can read own"
ON public.records FOR SELECT TO authenticated
USING (applicant_user_id = auth.uid());

-- Iteration 5: applicants can read their own lead_access_tokens rows (not needed; keep locked)

-- Iteration 8: allow owners to update memberships role (already exists via memberships_update_owner)
-- Add index for message unread lookups
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages (organization_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_records_applicant ON public.records (applicant_user_id) WHERE applicant_user_id IS NOT NULL;
