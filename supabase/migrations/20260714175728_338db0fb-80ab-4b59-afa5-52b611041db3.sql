
-- 1. Drop anon SELECT policies on org/tables/fields/views (public routes use service-role admin client)
DROP POLICY IF EXISTS "organizations: anon read" ON public.organizations;
DROP POLICY IF EXISTS "tables: anon read" ON public.tables;
DROP POLICY IF EXISTS "fields: anon read" ON public.fields;
DROP POLICY IF EXISTS "views: anon read" ON public.views;

-- Records anon policy also over-exposed; keep only published rows via admin client instead.
-- We keep the existing "records: anon read published" as it filters by status; scanner did not flag it.

-- 2. Tighten profiles SELECT: self or co-member only
DROP POLICY IF EXISTS profiles_select_all_authenticated ON public.profiles;
CREATE POLICY profiles_select_self_or_comember ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships m1
      JOIN public.memberships m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
    )
  );

-- 3. lead_access_tokens: explicit deny-all for anon/authenticated (service role bypasses)
CREATE POLICY lead_access_tokens_no_direct_access ON public.lead_access_tokens
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 4. Lock down SECURITY DEFINER function EXECUTE. Keep authenticated on helpers used by RLS/RPC.
REVOKE ALL ON FUNCTION public.create_organization(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_edit_org(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_org(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin_email(text) FROM PUBLIC, anon;

-- 5. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
