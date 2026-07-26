CREATE OR REPLACE FUNCTION public.sync_category_standard_tables(_category_id uuid)
RETURNS TABLE(orgs_touched integer, tables_created integer, fields_added integer, fields_removed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- remove tables originating from standard tables that no longer exist
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
        INSERT INTO public.tables (organization_id, slug, name, description, icon, origin_standard_table_id, is_locked, is_public)
        VALUES (_org.id, _try_slug, _st.name, _st.description, _st.icon, _st.id, true, COALESCE(_st.is_public,false))
        RETURNING id INTO _table_id;
        _created := _created + 1;
      ELSE
        UPDATE public.tables
          SET name = _st.name, description = _st.description, icon = _st.icon,
              is_public = COALESCE(_st.is_public,false), is_locked = true
        WHERE id = _table_id;
      END IF;

      -- mirror fields
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
  END LOOP;

  RETURN QUERY SELECT _orgs, _created, _added, _removed;
END; $$;

REVOKE ALL ON FUNCTION public.sync_category_standard_tables(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_category_standard_tables(uuid) TO authenticated, service_role;