-- Revoga execução pública/anônima de todas as funções internas
REVOKE EXECUTE ON FUNCTION public.apply_standard_forms_to_org(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit_org(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_bookings_table(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_contacts_table(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_org_category_fields(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_deal_status_guarded(uuid, public.deal_status, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_category_standard_forms(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_category_standard_tables(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_contacts_table_private() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_home_groupings_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Reconcede apenas as funções chamadas pelo aplicativo com sessão autenticada
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_bookings_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_contacts_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_org_category_fields(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_deal_status_guarded(uuid, public.deal_status, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_category_standard_forms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_category_standard_tables(uuid) TO authenticated;

-- service_role mantém acesso completo (uso interno pelo servidor)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;