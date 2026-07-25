GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_email(text) TO authenticated, anon;