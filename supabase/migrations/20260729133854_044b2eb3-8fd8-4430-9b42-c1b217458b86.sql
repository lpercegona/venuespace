-- === Bloco A: master de reservas em tabelas padrão ===
ALTER TABLE public.category_standard_tables
  ADD COLUMN IF NOT EXISTS bookable boolean NOT NULL DEFAULT false;

-- === Bloco B: formulários padrão por categoria ===
CREATE TABLE IF NOT EXISTS public.category_standard_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('organization','record')),
  standard_table_id uuid REFERENCES public.category_standard_tables(id) ON DELETE CASCADE,
  name text NOT NULL,
  submit_label text NOT NULL DEFAULT 'Enviar',
  target_table_name text NOT NULL DEFAULT 'Contatos',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_standard_forms_scope_table_chk
    CHECK ((scope = 'record' AND standard_table_id IS NOT NULL) OR (scope = 'organization' AND standard_table_id IS NULL))
);

GRANT SELECT ON public.category_standard_forms TO authenticated;
GRANT ALL ON public.category_standard_forms TO service_role;
ALTER TABLE public.category_standard_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "csf_read_authenticated" ON public.category_standard_forms;
CREATE POLICY "csf_read_authenticated" ON public.category_standard_forms
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.category_standard_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.category_standard_forms(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, field_key)
);

GRANT SELECT ON public.category_standard_form_fields TO authenticated;
GRANT ALL ON public.category_standard_form_fields TO service_role;
ALTER TABLE public.category_standard_form_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "csff_read_authenticated" ON public.category_standard_form_fields;
CREATE POLICY "csff_read_authenticated" ON public.category_standard_form_fields
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS tg_csf_updated_at ON public.category_standard_forms;
CREATE TRIGGER tg_csf_updated_at BEFORE UPDATE ON public.category_standard_forms
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS tg_csff_updated_at ON public.category_standard_form_fields;
CREATE TRIGGER tg_csff_updated_at BEFORE UPDATE ON public.category_standard_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- rastreio da origem nas instâncias
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS origin_standard_form_id uuid;
ALTER TABLE public.views  ADD COLUMN IF NOT EXISTS origin_standard_form_id uuid;

-- === Bloco C: campos de contato base para todas as organizações ===
INSERT INTO public.organization_fields (key, label, type, required, position, config)
VALUES
  ('phone',    'Telefone', 'phone', false, 100, '{}'::jsonb),
  ('whatsapp', 'WhatsApp', 'phone', false, 101, '{}'::jsonb),
  ('email',    'E-mail',   'email', false, 102, '{}'::jsonb),
  ('website',  'Site',     'url',   false, 103, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- === Instanciação dos formulários padrão numa organização (interna) ===
CREATE OR REPLACE FUNCTION public.apply_standard_forms_to_org(_org_id uuid, _category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _form record;
  _f record;
  _sub_table_id uuid;
  _src_table_id uuid;
  _rel_field_id uuid;
  _base_slug text;
  _try_slug text;
  _n int;
  _view_id uuid;
  _view_table_id uuid;
BEGIN
  FOR _form IN
    SELECT * FROM public.category_standard_forms
    WHERE category_id = _category_id AND is_active = true
  LOOP
    -- tabela de destino das submissões
    SELECT id INTO _sub_table_id FROM public.tables
    WHERE organization_id = _org_id AND origin_standard_form_id = _form.id LIMIT 1;

    IF _sub_table_id IS NULL THEN
      _base_slug := left(regexp_replace(lower(coalesce(_form.target_table_name, 'contatos')), '[^a-z0-9]+', '-', 'g'), 50);
      _base_slug := trim(both '-' from _base_slug);
      IF _base_slug = '' THEN _base_slug := 'formulario'; END IF;
      _try_slug := _base_slug; _n := 2;
      WHILE EXISTS (SELECT 1 FROM public.tables t WHERE t.organization_id = _org_id AND t.slug = _try_slug) LOOP
        _try_slug := _base_slug || '-' || _n; _n := _n + 1;
      END LOOP;
      INSERT INTO public.tables (organization_id, slug, name, description, is_system, is_locked, is_public, origin_standard_form_id)
      VALUES (_org_id, _try_slug, coalesce(_form.target_table_name, 'Contatos'), 'Submissões do formulário público', true, true, false, _form.id)
      RETURNING id INTO _sub_table_id;
    ELSE
      UPDATE public.tables
        SET name = coalesce(_form.target_table_name, 'Contatos'), is_locked = true, is_system = true
      WHERE id = _sub_table_id;
    END IF;

    -- espelha campos do formulário padrão
    FOR _f IN SELECT * FROM public.category_standard_form_fields WHERE form_id = _form.id ORDER BY order_index LOOP
      IF EXISTS (SELECT 1 FROM public.fields WHERE table_id = _sub_table_id AND key = _f.field_key) THEN
        UPDATE public.fields
          SET label = _f.label, type = _f.field_type::field_type, required = _f.required,
              position = _f.order_index, config = _f.config, source = 'category', category_field_key = _f.field_key
        WHERE table_id = _sub_table_id AND key = _f.field_key;
      ELSE
        INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
        VALUES (_sub_table_id, _f.field_key, _f.label, _f.field_type::field_type, _f.required, _f.order_index, _f.config, 'category', _f.field_key);
      END IF;
    END LOOP;

    DELETE FROM public.fields f
    WHERE f.table_id = _sub_table_id
      AND f.source = 'category'
      AND f.key <> '__origem'
      AND NOT EXISTS (
        SELECT 1 FROM public.category_standard_form_fields sf
        WHERE sf.form_id = _form.id AND sf.field_key = f.key
      );

    _rel_field_id := NULL;
    _src_table_id := NULL;

    IF _form.scope = 'record' THEN
      SELECT id INTO _src_table_id FROM public.tables
      WHERE organization_id = _org_id AND origin_standard_table_id = _form.standard_table_id LIMIT 1;
      IF _src_table_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT id INTO _rel_field_id FROM public.fields
      WHERE table_id = _sub_table_id AND key = '__origem' LIMIT 1;
      IF _rel_field_id IS NULL THEN
        INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
        VALUES (_sub_table_id, '__origem', 'Registro de origem', 'relation'::field_type, false, 999,
                jsonb_build_object('target_table_id', _src_table_id), 'category', '__origem')
        RETURNING id INTO _rel_field_id;
      ELSE
        UPDATE public.fields SET config = jsonb_build_object('target_table_id', _src_table_id) WHERE id = _rel_field_id;
      END IF;
      _view_table_id := _src_table_id;
    ELSE
      _view_table_id := _sub_table_id;
    END IF;

    -- view public_form
    SELECT id INTO _view_id FROM public.views
    WHERE organization_id = _org_id AND origin_standard_form_id = _form.id LIMIT 1;

    IF _view_id IS NULL THEN
      INSERT INTO public.views (table_id, organization_id, name, type, config, submissions_table_id, origin_standard_form_id)
      VALUES (_view_table_id, _org_id, _form.name, 'public_form'::view_type,
              jsonb_build_object('auto_relation_field_id', _rel_field_id, 'submit_label', _form.submit_label),
              _sub_table_id, _form.id);
    ELSE
      UPDATE public.views
        SET table_id = _view_table_id,
            name = _form.name,
            submissions_table_id = _sub_table_id,
            config = jsonb_build_object('auto_relation_field_id', _rel_field_id, 'submit_label', _form.submit_label)
      WHERE id = _view_id;
    END IF;
  END LOOP;

  -- remove instâncias de formulários que não existem mais / foram desativados
  DELETE FROM public.views v
  WHERE v.organization_id = _org_id
    AND v.origin_standard_form_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.category_standard_forms f
      WHERE f.id = v.origin_standard_form_id AND f.category_id = _category_id AND f.is_active = true
    );
END; $$;

REVOKE ALL ON FUNCTION public.apply_standard_forms_to_org(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_category_standard_forms(_category_id uuid)
RETURNS TABLE(orgs_touched integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org record;
  _n int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  FOR _org IN SELECT id FROM public.organizations WHERE category_id = _category_id LOOP
    PERFORM public.apply_standard_forms_to_org(_org.id, _category_id);
    _n := _n + 1;
  END LOOP;
  RETURN QUERY SELECT _n;
END; $$;

REVOKE ALL ON FUNCTION public.sync_category_standard_forms(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_category_standard_forms(uuid) TO authenticated;

-- === Propagação do master de reservas no sync de tabelas padrão ===
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
      AND NOT EXISTS (
        SELECT 1 FROM public.category_standard_tables cst
        WHERE cst.id = t.origin_standard_table_id AND cst.category_id = _category_id
      );

    FOR _st IN
      SELECT * FROM public.category_standard_tables
      WHERE category_id = _category_id ORDER BY order_index
    LOOP
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

-- === create_organization: instancia também os formulários padrão ===
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
    WHERE cst.category_id = _category_id
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