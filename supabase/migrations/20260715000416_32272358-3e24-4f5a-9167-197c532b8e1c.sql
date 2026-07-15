
REVOKE ALL ON FUNCTION public.reconcile_org_category_fields(uuid) FROM PUBLIC, anon;
-- Keep grant to authenticated so server functions using the user session can call it;
-- callers verify super admin / owner permission before invoking.
