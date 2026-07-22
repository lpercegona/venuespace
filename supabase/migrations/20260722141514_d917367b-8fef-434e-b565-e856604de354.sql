
-- 1. category_standard_tables
CREATE TABLE public.category_standard_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  icon text,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT ON public.category_standard_tables TO anon, authenticated;
GRANT ALL ON public.category_standard_tables TO service_role;
ALTER TABLE public.category_standard_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cst_read_all" ON public.category_standard_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cst_write_super_admin" ON public.category_standard_tables FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER cst_touch BEFORE UPDATE ON public.category_standard_tables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. category_standard_table_fields
CREATE TABLE public.category_standard_table_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_table_id uuid NOT NULL REFERENCES public.category_standard_tables(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standard_table_id, field_key)
);
GRANT SELECT ON public.category_standard_table_fields TO anon, authenticated;
GRANT ALL ON public.category_standard_table_fields TO service_role;
ALTER TABLE public.category_standard_table_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cstf_read_all" ON public.category_standard_table_fields FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cstf_write_super_admin" ON public.category_standard_table_fields FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER cstf_touch BEFORE UPDATE ON public.category_standard_table_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. tables: lock columns
ALTER TABLE public.tables ADD COLUMN origin_standard_table_id uuid REFERENCES public.category_standard_tables(id) ON DELETE SET NULL;
ALTER TABLE public.tables ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- 4. tables: replace update/delete policies to respect lock
DROP POLICY IF EXISTS tables_update_editor ON public.tables;
DROP POLICY IF EXISTS tables_delete_owner ON public.tables;
CREATE POLICY "tables_update_editor" ON public.tables FOR UPDATE TO authenticated
  USING (public.can_edit_org(auth.uid(), organization_id) AND (NOT is_locked OR public.is_super_admin(auth.uid())))
  WITH CHECK (public.can_edit_org(auth.uid(), organization_id) AND (NOT is_locked OR public.is_super_admin(auth.uid())));
CREATE POLICY "tables_delete_owner" ON public.tables FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'owner'::app_role) AND (NOT is_locked OR public.is_super_admin(auth.uid())));

-- 5. fields: block structural mutation on locked tables (non-super admins)
DROP POLICY IF EXISTS fields_insert_editor ON public.fields;
DROP POLICY IF EXISTS fields_update_editor ON public.fields;
DROP POLICY IF EXISTS fields_delete_owner ON public.fields;

CREATE POLICY "fields_insert_editor" ON public.fields FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tables t
      WHERE t.id = fields.table_id
        AND public.can_edit_org(auth.uid(), t.organization_id)
        AND (NOT t.is_locked OR public.is_super_admin(auth.uid()))
    )
  );
CREATE POLICY "fields_update_editor" ON public.fields FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tables t
      WHERE t.id = fields.table_id
        AND public.can_edit_org(auth.uid(), t.organization_id)
        AND (NOT t.is_locked OR public.is_super_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tables t
      WHERE t.id = fields.table_id
        AND public.can_edit_org(auth.uid(), t.organization_id)
        AND (NOT t.is_locked OR public.is_super_admin(auth.uid()))
    )
  );
CREATE POLICY "fields_delete_owner" ON public.fields FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tables t
      WHERE t.id = fields.table_id
        AND public.has_role(auth.uid(), t.organization_id, 'owner'::app_role)
        AND (NOT t.is_locked OR public.is_super_admin(auth.uid()))
    )
  );

-- 6. create_organization: also instantiate standard tables + fields
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

  -- Instantiate standard tables for this category
  FOR _st IN
    SELECT id, name, slug, icon, description, order_index
    FROM public.category_standard_tables
    WHERE category_id = _category_id
    ORDER BY order_index
  LOOP
    _base_slug := _st.slug;
    _try_slug := _base_slug;
    _n := 2;
    WHILE EXISTS (SELECT 1 FROM public.tables WHERE organization_id = _new_id AND slug = _try_slug) LOOP
      _try_slug := _base_slug || '-' || _n;
      _n := _n + 1;
    END LOOP;

    INSERT INTO public.tables (organization_id, slug, name, description, icon, origin_standard_table_id, is_locked)
    VALUES (_new_id, _try_slug, _st.name, _st.description, _st.icon, _st.id, true)
    RETURNING id INTO _new_table_id;

    INSERT INTO public.fields (table_id, key, label, type, required, position, config, source, category_field_key)
    SELECT _new_table_id, f.field_key, f.label, f.field_type::field_type, f.required, f.order_index, f.config, 'category', f.field_key
    FROM public.category_standard_table_fields f
    WHERE f.standard_table_id = _st.id
    ORDER BY f.order_index;
  END LOOP;

  RETURN QUERY SELECT o.id, o.slug, o.name FROM public.organizations o WHERE o.id = _new_id;
END;
$function$;
