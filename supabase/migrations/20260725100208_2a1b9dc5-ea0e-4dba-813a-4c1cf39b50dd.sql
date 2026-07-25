
-- 1. Storage: restrict venue-uploads SELECT to owner (public reads happen through server-signed URLs).
DROP POLICY IF EXISTS "venue-uploads: authenticated read" ON storage.objects;
CREATE POLICY "venue-uploads: owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'venue-uploads' AND owner = auth.uid());

-- 2. Add ownership check inside reconcile_org_category_fields.
CREATE OR REPLACE FUNCTION public.reconcile_org_category_fields(_org_id uuid)
 RETURNS TABLE(tables_touched integer, fields_added integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cat uuid;
  _t record;
  _def record;
  _tables_touched int := 0;
  _fields_added int := 0;
  _next_pos int;
  _has_new boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_super_admin(auth.uid())
          OR public.has_role(auth.uid(), _org_id, 'owner')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT category_id INTO _cat FROM public.organizations WHERE id = _org_id;
  IF _cat IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  FOR _t IN SELECT id FROM public.tables WHERE organization_id = _org_id LOOP
    _has_new := false;
    SELECT COALESCE(MAX(position), -1) + 1 INTO _next_pos FROM public.fields WHERE table_id = _t.id;
    FOR _def IN
      SELECT * FROM public.organization_category_default_fields
      WHERE category_id = _cat ORDER BY order_index
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _t.id AND key = _def.field_key) THEN
        INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
        VALUES (_t.id, _def.field_key, _def.label, _def.field_type::field_type, _def.required, _next_pos, _def.config, 'category', _def.field_key);
        _next_pos := _next_pos + 1;
        _fields_added := _fields_added + 1;
        _has_new := true;
      ELSE
        UPDATE public.fields
          SET source = 'category', category_field_key = _def.field_key
          WHERE table_id = _t.id AND key = _def.field_key AND source = 'legacy';
      END IF;
    END LOOP;
    IF _has_new THEN
      _tables_touched := _tables_touched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _tables_touched, _fields_added;
END;
$function$;

-- 3. Restrict RLS on messages.proposal_status updates to non-senders.
DROP POLICY IF EXISTS "messages: sender update read" ON public.messages;
CREATE POLICY "messages: sender update read"
ON public.messages FOR UPDATE TO authenticated
USING (
  (public.is_org_member(auth.uid(), organization_id)
   OR EXISTS (SELECT 1 FROM public.conversations c
              WHERE c.id = messages.conversation_id AND c.applicant_user_id = auth.uid()))
  AND (sender_user_id IS DISTINCT FROM auth.uid())
)
WITH CHECK (
  (public.is_org_member(auth.uid(), organization_id)
   OR EXISTS (SELECT 1 FROM public.conversations c
              WHERE c.id = messages.conversation_id AND c.applicant_user_id = auth.uid()))
  AND (sender_user_id IS DISTINCT FROM auth.uid())
);

-- 4. Revoke public EXECUTE on SECURITY DEFINER helpers not intended as RPC.
-- Keep create_organization callable by authenticated; keep reconcile callable (now guarded).
REVOKE EXECUTE ON FUNCTION public.can_edit_org(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_org_category_fields(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, uuid, text, jsonb) FROM anon, PUBLIC;
