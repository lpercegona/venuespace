-- 1. Novas colunas
ALTER TABLE public.category_standard_tables
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.category_standard_forms
  ADD COLUMN IF NOT EXISTS target_standard_table_id uuid REFERENCES public.category_standard_tables(id) ON DELETE SET NULL;

ALTER TABLE public.category_standard_form_fields
  ADD COLUMN IF NOT EXISTS source_standard_field_key text,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

-- 2. Semear modelos de sistema (Contatos e Reservas) para cada categoria
DO $seed$
DECLARE
  _cat record;
  _id uuid;
BEGIN
  FOR _cat IN SELECT id FROM public.organization_categories LOOP
    -- Contatos
    SELECT id INTO _id FROM public.category_standard_tables
      WHERE category_id = _cat.id AND kind = 'contacts' LIMIT 1;
    IF _id IS NULL THEN
      INSERT INTO public.category_standard_tables
        (category_id, name, slug, icon, description, order_index, is_public, bookable, kind, is_system)
      VALUES (_cat.id, 'Contatos', 'contatos', 'users', 'Respostas dos formulários públicos', 900, false, false, 'contacts', true)
      RETURNING id INTO _id;
      INSERT INTO public.category_standard_table_fields
        (standard_table_id, field_key, label, field_type, required, config, order_index)
      VALUES
        (_id, 'contact_company', 'Empresa / Razão social', 'text', false, '{}'::jsonb, 0),
        (_id, 'contact_cnpj', 'CNPJ', 'text', false, '{}'::jsonb, 1),
        (_id, 'contact_address', 'Endereço do cliente', 'long_text', false, '{}'::jsonb, 2);
    END IF;

    -- Reservas
    SELECT id INTO _id FROM public.category_standard_tables
      WHERE category_id = _cat.id AND kind = 'bookings' LIMIT 1;
    IF _id IS NULL THEN
      INSERT INTO public.category_standard_tables
        (category_id, name, slug, icon, description, order_index, is_public, bookable, kind, is_system)
      VALUES (_cat.id, 'Reservas', 'reservas', 'calendar-days', 'Reservas geradas a partir de uma tabela reservável', 901, false, false, 'bookings', true)
      RETURNING id INTO _id;
      INSERT INTO public.category_standard_table_fields
        (standard_table_id, field_key, label, field_type, required, config, order_index)
      VALUES
        (_id, 'booking_start', 'Início', 'datetime', false, jsonb_build_object('booking_role','start'), 0),
        (_id, 'booking_end', 'Término', 'datetime', false, jsonb_build_object('booking_role','end'), 1),
        (_id, 'event_location', 'Local de instalação/evento', 'long_text', false, '{}'::jsonb, 2),
        (_id, 'booking_notes', 'Observações da reserva', 'long_text', false, '{}'::jsonb, 3),
        (_id, 'travel_fee', 'Deslocamento', 'currency', false, '{}'::jsonb, 4);
    END IF;
  END LOOP;
END $seed$;

-- 3. Helper: aplica campos de um modelo de sistema em uma tabela real da organização
CREATE OR REPLACE FUNCTION public.apply_standard_fields_to_table(_standard_table_id uuid, _table_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _f record;
BEGIN
  IF _standard_table_id IS NULL OR _table_id IS NULL THEN RETURN; END IF;
  FOR _f IN
    SELECT * FROM public.category_standard_table_fields
    WHERE standard_table_id = _standard_table_id ORDER BY order_index
  LOOP
    IF EXISTS (SELECT 1 FROM public.fields WHERE table_id = _table_id AND key = _f.field_key) THEN
      UPDATE public.fields
        SET label = _f.label, type = _f.field_type::field_type, required = _f.required,
            position = _f.order_index, config = _f.config,
            source = 'category', category_field_key = _f.field_key
      WHERE table_id = _table_id AND key = _f.field_key;
    ELSE
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
      VALUES (_table_id, _f.field_key, _f.label, _f.field_type::field_type, _f.required, _f.order_index, _f.config, 'category', _f.field_key);
    END IF;
  END LOOP;

  DELETE FROM public.fields f
  WHERE f.table_id = _table_id
    AND f.source = 'category'
    AND f.key <> '__origem'
    AND NOT EXISTS (
      SELECT 1 FROM public.category_standard_table_fields sf
      WHERE sf.standard_table_id = _standard_table_id AND sf.field_key = f.key
    );
END; $function$;

REVOKE EXECUTE ON FUNCTION public.apply_standard_fields_to_table(uuid, uuid) FROM anon, authenticated;

-- 4. ensure_contacts_table passa a materializar a partir do modelo
CREATE OR REPLACE FUNCTION public.ensure_contacts_table(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
  _try_slug text;
  _n int := 2;
  _cat uuid;
  _model uuid;
  _pos int;
BEGIN
  SELECT category_id INTO _cat FROM public.organizations WHERE id = _org_id;
  SELECT id INTO _model FROM public.category_standard_tables
    WHERE category_id = _cat AND kind = 'contacts' LIMIT 1;

  SELECT id INTO _id FROM public.tables
  WHERE organization_id = _org_id AND system_data->>'kind' = 'contacts' LIMIT 1;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.tables
    WHERE organization_id = _org_id AND origin_standard_form_id IS NOT NULL
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF _id IS NULL THEN
    _try_slug := 'contatos';
    WHILE EXISTS (SELECT 1 FROM public.tables t WHERE t.organization_id = _org_id AND t.slug = _try_slug) LOOP
      _try_slug := 'contatos-' || _n; _n := _n + 1;
    END LOOP;
    INSERT INTO public.tables (organization_id, slug, name, description, is_system, is_locked, is_public, system_data, origin_standard_table_id)
    VALUES (_org_id, _try_slug, COALESCE((SELECT name FROM public.category_standard_tables WHERE id = _model), 'Contatos'),
            'Respostas dos formulários públicos', true, false, false,
            jsonb_build_object('kind','contacts'), _model)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.tables
      SET name = COALESCE((SELECT name FROM public.category_standard_tables WHERE id = _model), 'Contatos'),
          description = COALESCE(description, 'Respostas dos formulários públicos'),
          is_system = true, is_locked = false, is_public = false,
          origin_standard_form_id = NULL,
          origin_standard_table_id = COALESCE(_model, origin_standard_table_id),
          system_data = COALESCE(system_data,'{}'::jsonb) || jsonb_build_object('kind','contacts')
    WHERE id = _id;
  END IF;

  IF _model IS NOT NULL THEN
    PERFORM public.apply_standard_fields_to_table(_model, _id);
  ELSE
    SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.fields WHERE table_id = _id;
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _id AND key = 'contact_company') THEN
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
      VALUES (_id, 'contact_company', 'Empresa / Razão social', 'text'::field_type, false, _pos, '{}'::jsonb, 'user');
    END IF;
  END IF;

  RETURN _id;
END; $function$;

-- 5. ensure_bookings_table passa a materializar a partir do modelo
CREATE OR REPLACE FUNCTION public.ensure_bookings_table(_source_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _src public.tables%ROWTYPE;
  _bid uuid;
  _slug text;
  _cat uuid;
  _model uuid;
BEGIN
  SELECT * INTO _src FROM public.tables WHERE id = _source_table_id;
  IF _src.id IS NULL THEN
    RAISE EXCEPTION 'Tabela nao encontrada';
  END IF;

  IF NOT (public.can_edit_org(auth.uid(), _src.organization_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  SELECT category_id INTO _cat FROM public.organizations WHERE id = _src.organization_id;
  SELECT id INTO _model FROM public.category_standard_tables
    WHERE category_id = _cat AND kind = 'bookings' LIMIT 1;

  SELECT id INTO _bid
  FROM public.tables
  WHERE organization_id = _src.organization_id
    AND (system_data->>'kind') = 'bookings'
    AND (system_data->>'source_table_id') = _source_table_id::text
  LIMIT 1;

  IF _bid IS NULL THEN
    _slug := left('reservas-' || coalesce(_src.slug, 'tabela'), 60);
    IF EXISTS (SELECT 1 FROM public.tables WHERE organization_id = _src.organization_id AND slug = _slug) THEN
      _slug := left(_slug, 50) || '-' || substr(replace(_source_table_id::text, '-', ''), 1, 6);
    END IF;

    INSERT INTO public.tables (organization_id, slug, name, description, icon, bookable, is_system, is_locked, is_public, system_data, origin_standard_table_id)
    VALUES (
      _src.organization_id,
      _slug,
      left('Reservas de ' || _src.name, 120),
      'Reservas geradas a partir de ' || _src.name,
      'calendar-days',
      false, true, true, false,
      jsonb_build_object('kind', 'bookings', 'source_table_id', _source_table_id::text),
      _model
    )
    RETURNING id INTO _bid;

    UPDATE public.records
    SET table_id = _bid
    WHERE table_id = _source_table_id
      AND (
        jsonb_typeof(system_data->'items') = 'array'
        OR deal_status <> 'none'::deal_status
      );
  ELSE
    UPDATE public.tables SET origin_standard_table_id = COALESCE(_model, origin_standard_table_id) WHERE id = _bid;
  END IF;

  IF _model IS NOT NULL THEN
    PERFORM public.apply_standard_fields_to_table(_model, _bid);
  END IF;

  RETURN _bid;
END; $function$;

-- 6. create_organization: não instanciar modelos de sistema como tabelas normais
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text, _category_id uuid, _description text DEFAULT NULL::text, _address jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id uuid, slug text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _st record;
  _new_table_id uuid;
  _base_slug text;
  _try_slug text;
  _n int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = '22023';
  END IF;
  IF _slug IS NULL OR _slug !~ '^[a-z0-9-]{2,60}$' THEN
    RAISE EXCEPTION 'Invalid slug' USING ERRCODE = '22023';
  END IF;
  IF _category_id IS NULL THEN
    RAISE EXCEPTION 'Category is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.organizations (name, slug, description, category_id, address, created_by)
  VALUES (btrim(_name), _slug, _description, _category_id, COALESCE(_address, '{}'::jsonb), _uid)
  RETURNING organizations.id INTO _new_id;

  FOR _st IN
    SELECT cst.id, cst.name, cst.slug, cst.icon, cst.description, cst.order_index, cst.is_public
    FROM public.category_standard_tables cst
    WHERE cst.category_id = _category_id AND COALESCE(cst.kind, 'normal') = 'normal'
    ORDER BY cst.order_index
  LOOP
    _base_slug := _st.slug;
    _try_slug := _base_slug;
    _n := 2;
    WHILE EXISTS (SELECT 1 FROM public.tables t WHERE t.organization_id = _new_id AND t.slug = _try_slug) LOOP
      _try_slug := _base_slug || '-' || _n;
      _n := _n + 1;
    END LOOP;

    INSERT INTO public.tables (organization_id, slug, name, description, icon, origin_standard_table_id, is_locked, is_public)
    VALUES (_new_id, _try_slug, _st.name, _st.description, _st.icon, _st.id, true, COALESCE(_st.is_public, false))
    RETURNING tables.id INTO _new_table_id;

    INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
    SELECT _new_table_id, f.field_key, f.label, f.field_type::field_type, f.required, f.order_index, f.config, 'category', f.field_key
    FROM public.category_standard_table_fields f
    WHERE f.standard_table_id = _st.id
    ORDER BY f.order_index;
  END LOOP;

  PERFORM public.apply_standard_forms_to_org(_new_id, _category_id);

  RETURN QUERY SELECT o.id, o.slug, o.name FROM public.organizations o WHERE o.id = _new_id;
END;
$function$;

-- 7. sync_category_standard_tables: também sincroniza modelos de sistema
CREATE OR REPLACE FUNCTION public.sync_category_standard_tables(_category_id uuid)
RETURNS TABLE(orgs_touched integer, tables_created integer, fields_added integer, fields_removed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org record;
  _st record;
  _f record;
  _sys record;
  _table_id uuid;
  _base_slug text;
  _try_slug text;
  _n int;
  _orgs int := 0;
  _created int := 0;
  _added int := 0;
  _removed int := 0;
  _cnt int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  FOR _org IN SELECT id FROM public.organizations WHERE category_id = _category_id LOOP
    _orgs := _orgs + 1;

    DELETE FROM public.tables t
    WHERE t.organization_id = _org.id
      AND t.origin_standard_table_id IS NOT NULL
      AND COALESCE(t.system_data->>'kind','') = ''
      AND NOT EXISTS (
        SELECT 1 FROM public.category_standard_tables cst
        WHERE cst.id = t.origin_standard_table_id AND cst.category_id = _category_id
      );

    FOR _st IN
      SELECT * FROM public.category_standard_tables
      WHERE category_id = _category_id ORDER BY order_index
    LOOP
      IF COALESCE(_st.kind, 'normal') <> 'normal' THEN
        FOR _sys IN
          SELECT id FROM public.tables
          WHERE organization_id = _org.id AND system_data->>'kind' = _st.kind
        LOOP
          UPDATE public.tables SET origin_standard_table_id = _st.id WHERE id = _sys.id;
          PERFORM public.apply_standard_fields_to_table(_st.id, _sys.id);
        END LOOP;
        CONTINUE;
      END IF;

      SELECT id INTO _table_id FROM public.tables
      WHERE organization_id = _org.id AND origin_standard_table_id = _st.id LIMIT 1;

      IF _table_id IS NULL THEN
        _base_slug := _st.slug; _try_slug := _base_slug; _n := 2;
        WHILE EXISTS (SELECT 1 FROM public.tables t WHERE t.organization_id = _org.id AND t.slug = _try_slug) LOOP
          _try_slug := _base_slug || '-' || _n; _n := _n + 1;
        END LOOP;
        INSERT INTO public.tables (organization_id, slug, name, description, icon, origin_standard_table_id, is_locked, is_public, bookable)
        VALUES (_org.id, _try_slug, _st.name, _st.description, _st.icon, _st.id, true, COALESCE(_st.is_public,false), false)
        RETURNING id INTO _table_id;
        _created := _created + 1;
      ELSE
        UPDATE public.tables
          SET name = _st.name, description = _st.description, icon = _st.icon,
              is_public = COALESCE(_st.is_public,false), is_locked = true,
              bookable = CASE WHEN COALESCE(_st.bookable,false) THEN bookable ELSE false END
        WHERE id = _table_id;
      END IF;

      FOR _f IN
        SELECT * FROM public.category_standard_table_fields
        WHERE standard_table_id = _st.id ORDER BY order_index
      LOOP
        IF EXISTS (SELECT 1 FROM public.fields WHERE table_id = _table_id AND key = _f.field_key) THEN
          UPDATE public.fields
            SET label = _f.label, type = _f.field_type::field_type, required = _f.required,
                position = _f.order_index, config = _f.config,
                source = 'category', category_field_key = _f.field_key
          WHERE table_id = _table_id AND key = _f.field_key;
        ELSE
          INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
          VALUES (_table_id, _f.field_key, _f.label, _f.field_type::field_type, _f.required, _f.order_index, _f.config, 'category', _f.field_key);
          _added := _added + 1;
        END IF;
      END LOOP;

      WITH del AS (
        DELETE FROM public.fields f
        WHERE f.table_id = _table_id
          AND f.source = 'category'
          AND NOT EXISTS (
            SELECT 1 FROM public.category_standard_table_fields sf
            WHERE sf.standard_table_id = _st.id AND sf.field_key = f.key
          )
        RETURNING 1
      ) SELECT count(*) INTO _cnt FROM del;
      _removed := _removed + COALESCE(_cnt,0);
    END LOOP;

    PERFORM public.apply_standard_forms_to_org(_org.id, _category_id);
  END LOOP;

  RETURN QUERY SELECT _orgs, _created, _added, _removed;
END; $function$;

-- 8. apply_standard_forms_to_org: destino configurável + visibilidade de campo
CREATE OR REPLACE FUNCTION public.apply_standard_forms_to_org(_org_id uuid, _category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _contacts uuid;
  _form record;
  _f record;
  _src_table_id uuid;
  _target_table_id uuid;
  _rel_field_id uuid;
  _view_id uuid;
  _view_table_id uuid;
  _contact_keys text[] := ARRAY[]::text[];
  _form_field_ids uuid[];
  _fid uuid;
BEGIN
  _contacts := public.ensure_contacts_table(_org_id);

  SELECT ARRAY(
    SELECT sf.field_key FROM public.category_standard_table_fields sf
    JOIN public.category_standard_tables st ON st.id = sf.standard_table_id
    WHERE st.category_id = _category_id AND st.kind = 'contacts'
  ) INTO _contact_keys;

  FOR _form IN
    SELECT * FROM public.category_standard_forms
    WHERE category_id = _category_id AND is_active = true
  LOOP
    _form_field_ids := ARRAY[]::uuid[];

    -- tabela de destino do formulário
    _target_table_id := NULL;
    IF _form.target_standard_table_id IS NOT NULL THEN
      SELECT id INTO _target_table_id FROM public.tables
      WHERE organization_id = _org_id AND origin_standard_table_id = _form.target_standard_table_id LIMIT 1;
    END IF;
    IF _target_table_id IS NULL THEN
      _target_table_id := _contacts;
    END IF;

    -- relação automática com o registro de origem
    _rel_field_id := NULL;
    IF _form.scope = 'record' THEN
      SELECT id INTO _rel_field_id FROM public.fields WHERE table_id = _target_table_id AND key = '__origem' LIMIT 1;
      IF _rel_field_id IS NULL THEN
        INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
        VALUES (_target_table_id, '__origem', 'Registro de origem', 'relation'::field_type, false, 999, '{}'::jsonb, 'category', '__origem')
        RETURNING id INTO _rel_field_id;
      END IF;
      IF _target_table_id = _contacts THEN
        _contact_keys := _contact_keys || '__origem'::text;
      END IF;
    END IF;

    FOR _f IN SELECT * FROM public.category_standard_form_fields WHERE form_id = _form.id ORDER BY order_index LOOP
      SELECT id INTO _fid FROM public.fields WHERE table_id = _target_table_id AND key = _f.field_key LIMIT 1;
      IF _fid IS NULL THEN
        INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
        VALUES (_target_table_id, _f.field_key, _f.label, _f.field_type::field_type, _f.required, _f.order_index, _f.config, 'category', _f.field_key)
        RETURNING id INTO _fid;
      ELSE
        UPDATE public.fields
          SET label = _f.label, type = _f.field_type::field_type, config = _f.config,
              source = 'category', category_field_key = _f.field_key
        WHERE id = _fid;
      END IF;
      IF COALESCE(_f.visible, true) THEN
        _form_field_ids := _form_field_ids || _fid;
      END IF;
      IF _target_table_id = _contacts THEN
        _contact_keys := _contact_keys || _f.field_key::text;
      END IF;
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
                'auto_relation_field_id', _rel_field_id,
                'submit_label', _form.submit_label,
                'form_field_ids', to_jsonb(_form_field_ids)),
              _target_table_id, _form.id);
    ELSE
      UPDATE public.views
        SET table_id = _view_table_id,
            name = _form.name,
            submissions_table_id = _target_table_id,
            config = jsonb_build_object(
              'auto_relation_field_id', _rel_field_id,
              'submit_label', _form.submit_label,
              'form_field_ids', to_jsonb(_form_field_ids))
      WHERE id = _view_id;
    END IF;
  END LOOP;

  -- remove campos de categoria órfãos na tabela Contatos
  DELETE FROM public.fields f
  WHERE f.table_id = _contacts
    AND f.source = 'category'
    AND NOT (f.key = ANY(_contact_keys));

  -- remove views de formulários inativos/removidos
  DELETE FROM public.views v
  WHERE v.organization_id = _org_id
    AND v.origin_standard_form_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.category_standard_forms f
      WHERE f.id = v.origin_standard_form_id AND f.category_id = _category_id AND f.is_active = true
    );
END; $function$;

-- 9. Vincular tabelas de sistema já existentes aos novos modelos
UPDATE public.tables t
SET origin_standard_table_id = cst.id
FROM public.organizations o, public.category_standard_tables cst
WHERE t.organization_id = o.id
  AND cst.category_id = o.category_id
  AND cst.kind = t.system_data->>'kind'
  AND t.system_data->>'kind' IN ('contacts','bookings')
  AND t.origin_standard_table_id IS DISTINCT FROM cst.id;