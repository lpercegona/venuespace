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
    SELECT cst.id, cst.name, cst.slug, cst.icon, cst.description, cst.order_index
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

    INSERT INTO public.tables (organization_id, slug, name, description, icon, origin_standard_table_id, is_locked)
    VALUES (_new_id, _try_slug, _st.name, _st.description, _st.icon, _st.id, true)
    RETURNING tables.id INTO _new_table_id;

    INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
    SELECT _new_table_id, f.field_key, f.label, f.field_type::field_type, f.required, f.order_index, f.config, 'category', f.field_key
    FROM public.category_standard_table_fields f
    WHERE f.standard_table_id = _st.id
    ORDER BY f.order_index;
  END LOOP;

  RETURN QUERY SELECT o.id, o.slug, o.name FROM public.organizations o WHERE o.id = _new_id;
END;
$function$;