-- 1) Rotina reescrita: uma única tabela "Contatos" por organização
CREATE OR REPLACE FUNCTION public.ensure_contacts_table(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
  _try_slug text;
  _n int := 2;
BEGIN
  SELECT id INTO _id FROM public.tables
  WHERE organization_id = _org_id AND system_data->>'kind' = 'contacts' LIMIT 1;

  IF _id IS NULL THEN
    -- reaproveita a tabela de submissões mais antiga, se existir
    SELECT id INTO _id FROM public.tables
    WHERE organization_id = _org_id AND origin_standard_form_id IS NOT NULL
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF _id IS NULL THEN
    _try_slug := 'contatos';
    WHILE EXISTS (SELECT 1 FROM public.tables t WHERE t.organization_id = _org_id AND t.slug = _try_slug) LOOP
      _try_slug := 'contatos-' || _n; _n := _n + 1;
    END LOOP;
    INSERT INTO public.tables (organization_id, slug, name, description, is_system, is_locked, is_public, system_data)
    VALUES (_org_id, _try_slug, 'Contatos', 'Respostas dos formulários públicos', true, true, false,
            jsonb_build_object('kind','contacts'))
    RETURNING id INTO _id;
  ELSE
    UPDATE public.tables
      SET name = 'Contatos',
          description = COALESCE(description, 'Respostas dos formulários públicos'),
          is_system = true, is_locked = true, is_public = false,
          origin_standard_form_id = NULL,
          system_data = COALESCE(system_data,'{}'::jsonb) || jsonb_build_object('kind','contacts')
    WHERE id = _id;
  END IF;

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.ensure_contacts_table(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Consolida tabelas de submissões antigas na tabela Contatos
DO $$
DECLARE
  _org record;
  _target uuid;
  _old record;
  _pos int;
BEGIN
  FOR _org IN SELECT DISTINCT organization_id AS id FROM public.tables WHERE origin_standard_form_id IS NOT NULL LOOP
    _target := public.ensure_contacts_table(_org.id);

    FOR _old IN
      SELECT id FROM public.tables
      WHERE organization_id = _org.id AND origin_standard_form_id IS NOT NULL AND id <> _target
    LOOP
      SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.fields WHERE table_id = _target;
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
      SELECT _target, f.key, f.label, f.type, f.required, _pos + row_number() OVER (ORDER BY f.position), f.config, f.source, f.category_field_key
      FROM public.fields f
      WHERE f.table_id = _old.id
        AND NOT EXISTS (SELECT 1 FROM public.fields g WHERE g.table_id = _target AND g.key = f.key);

      UPDATE public.records SET table_id = _target WHERE table_id = _old.id;
      UPDATE public.views SET submissions_table_id = _target WHERE submissions_table_id = _old.id;
      UPDATE public.views SET table_id = _target WHERE table_id = _old.id;
      DELETE FROM public.tables WHERE id = _old.id;
    END LOOP;
  END LOOP;
END $$;

-- 3) apply_standard_forms_to_org: ambos os formulários gravam na tabela Contatos
CREATE OR REPLACE FUNCTION public.apply_standard_forms_to_org(_org_id uuid, _category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contacts uuid;
  _form record;
  _f record;
  _src_table_id uuid;
  _rel_field_id uuid;
  _view_id uuid;
  _view_table_id uuid;
  _needs_relation boolean := false;
  _all_keys text[] := ARRAY[]::text[];
  _form_field_ids uuid[];
  _fid uuid;
BEGIN
  _contacts := public.ensure_contacts_table(_org_id);

  SELECT EXISTS (
    SELECT 1 FROM public.category_standard_forms
    WHERE category_id = _category_id AND is_active = true AND scope = 'record'
  ) INTO _needs_relation;

  IF _needs_relation THEN
    SELECT id INTO _rel_field_id FROM public.fields WHERE table_id = _contacts AND key = '__origem' LIMIT 1;
    IF _rel_field_id IS NULL THEN
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
      VALUES (_contacts, '__origem', 'Registro de origem', 'relation'::field_type, false, 999, '{}'::jsonb, 'category', '__origem')
      RETURNING id INTO _rel_field_id;
    END IF;
    _all_keys := _all_keys || '__origem'::text;
  END IF;

  FOR _form IN
    SELECT * FROM public.category_standard_forms
    WHERE category_id = _category_id AND is_active = true
  LOOP
    _form_field_ids := ARRAY[]::uuid[];

    FOR _f IN SELECT * FROM public.category_standard_form_fields WHERE form_id = _form.id ORDER BY order_index LOOP
      SELECT id INTO _fid FROM public.fields WHERE table_id = _contacts AND key = _f.field_key LIMIT 1;
      IF _fid IS NULL THEN
        INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
        VALUES (_contacts, _f.field_key, _f.label, _f.field_type::field_type, _f.required, _f.order_index, _f.config, 'category', _f.field_key)
        RETURNING id INTO _fid;
      ELSE
        UPDATE public.fields
          SET label = _f.label, type = _f.field_type::field_type, config = _f.config,
              source = 'category', category_field_key = _f.field_key
        WHERE id = _fid;
      END IF;
      _form_field_ids := _form_field_ids || _fid;
      _all_keys := _all_keys || _f.field_key::text;
    END LOOP;

    _src_table_id := NULL;
    IF _form.scope = 'record' THEN
      SELECT id INTO _src_table_id FROM public.tables
      WHERE organization_id = _org_id AND origin_standard_table_id = _form.standard_table_id LIMIT 1;
      IF _src_table_id IS NULL THEN CONTINUE; END IF;
      UPDATE public.fields SET config = jsonb_build_object('target_table_id', _src_table_id)
      WHERE id = _rel_field_id;
      _view_table_id := _src_table_id;
    ELSE
      _view_table_id := _contacts;
    END IF;

    SELECT id INTO _view_id FROM public.views
    WHERE organization_id = _org_id AND origin_standard_form_id = _form.id LIMIT 1;

    IF _view_id IS NULL THEN
      INSERT INTO public.views (table_id, organization_id, name, type, config, submissions_table_id, origin_standard_form_id)
      VALUES (_view_table_id, _org_id, _form.name, 'public_form'::view_type,
              jsonb_build_object(
                'auto_relation_field_id', CASE WHEN _form.scope = 'record' THEN _rel_field_id ELSE NULL END,
                'submit_label', _form.submit_label,
                'form_field_ids', to_jsonb(_form_field_ids)),
              _contacts, _form.id);
    ELSE
      UPDATE public.views
        SET table_id = _view_table_id,
            name = _form.name,
            submissions_table_id = _contacts,
            config = jsonb_build_object(
              'auto_relation_field_id', CASE WHEN _form.scope = 'record' THEN _rel_field_id ELSE NULL END,
              'submit_label', _form.submit_label,
              'form_field_ids', to_jsonb(_form_field_ids))
      WHERE id = _view_id;
    END IF;
  END LOOP;

  -- remove campos de categoria órfãos na tabela Contatos
  DELETE FROM public.fields f
  WHERE f.table_id = _contacts
    AND f.source = 'category'
    AND NOT (f.key = ANY(_all_keys));

  -- remove views de formulários inativos/removidos
  DELETE FROM public.views v
  WHERE v.organization_id = _org_id
    AND v.origin_standard_form_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.category_standard_forms f
      WHERE f.id = v.origin_standard_form_id AND f.category_id = _category_id AND f.is_active = true
    );
END; $$;

-- 4) Tabela de contatos nunca pública
CREATE OR REPLACE FUNCTION public.tg_contacts_table_private()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.system_data->>'kind','') = 'contacts' THEN
    NEW.is_public := false;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_contacts_table_private ON public.tables;
CREATE TRIGGER trg_contacts_table_private
BEFORE INSERT OR UPDATE ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.tg_contacts_table_private();

-- 5) Reaplica para todas as organizações existentes
DO $$
DECLARE _o record;
BEGIN
  FOR _o IN SELECT id, category_id FROM public.organizations LOOP
    PERFORM public.apply_standard_forms_to_org(_o.id, _o.category_id);
  END LOOP;
END $$;