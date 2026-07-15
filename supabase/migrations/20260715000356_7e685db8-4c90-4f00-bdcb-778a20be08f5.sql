
-- 1. Ensure a "Sem categoria" default and backfill orgs
INSERT INTO public.organization_categories (name, description)
SELECT 'Sem categoria', 'Categoria padrão para organizações sem definição específica.'
WHERE NOT EXISTS (SELECT 1 FROM public.organization_categories WHERE name = 'Sem categoria');

UPDATE public.organizations SET category_id = (SELECT id FROM public.organization_categories WHERE name = 'Sem categoria')
WHERE category_id IS NULL;

ALTER TABLE public.organizations ALTER COLUMN category_id SET NOT NULL;

-- 2. base_field_config on organization_categories
ALTER TABLE public.organization_categories
  ADD COLUMN IF NOT EXISTS base_field_config jsonb NOT NULL DEFAULT
    '{"organization":{"description":{"visible":true,"required":false},"logo":{"visible":true,"required":false},"timezone":{"visible":true,"required":false},"currency":{"visible":true,"required":false}},"table":{"icon":{"visible":true,"required":false},"description":{"visible":true,"required":false}}}'::jsonb;

-- 3. category_data payloads
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS category_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tables        ADD COLUMN IF NOT EXISTS category_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Source tagging on fields
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user';
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS category_field_key text NULL;
ALTER TABLE public.fields DROP CONSTRAINT IF EXISTS fields_source_check;
ALTER TABLE public.fields ADD CONSTRAINT fields_source_check CHECK (source IN ('category','user','legacy'));

-- Mark existing fields as legacy (one-time backfill)
UPDATE public.fields SET source = 'legacy' WHERE source = 'user';

-- 5. category_org_fields
CREATE TABLE IF NOT EXISTS public.category_org_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, field_key)
);
CREATE INDEX IF NOT EXISTS category_org_fields_category_idx ON public.category_org_fields (category_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_org_fields TO authenticated;
GRANT SELECT ON public.category_org_fields TO anon;
GRANT ALL ON public.category_org_fields TO service_role;
ALTER TABLE public.category_org_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cof_read_all ON public.category_org_fields;
CREATE POLICY cof_read_all ON public.category_org_fields FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS cof_write_sa ON public.category_org_fields;
CREATE POLICY cof_write_sa ON public.category_org_fields FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS category_org_fields_touch ON public.category_org_fields;
CREATE TRIGGER category_org_fields_touch BEFORE UPDATE ON public.category_org_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. category_table_fields
CREATE TABLE IF NOT EXISTS public.category_table_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, field_key)
);
CREATE INDEX IF NOT EXISTS category_table_fields_category_idx ON public.category_table_fields (category_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_table_fields TO authenticated;
GRANT SELECT ON public.category_table_fields TO anon;
GRANT ALL ON public.category_table_fields TO service_role;
ALTER TABLE public.category_table_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ctf_read_all ON public.category_table_fields;
CREATE POLICY ctf_read_all ON public.category_table_fields FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ctf_write_sa ON public.category_table_fields;
CREATE POLICY ctf_write_sa ON public.category_table_fields FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS category_table_fields_touch ON public.category_table_fields;
CREATE TRIGGER category_table_fields_touch BEFORE UPDATE ON public.category_table_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7. Reconcile helper: merge category defaults into an org's tables (idempotent).
CREATE OR REPLACE FUNCTION public.reconcile_org_category_fields(_org_id uuid)
RETURNS TABLE(tables_touched int, fields_added int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat uuid;
  _t record;
  _def record;
  _tables_touched int := 0;
  _fields_added int := 0;
  _next_pos int;
  _has_new boolean;
BEGIN
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
        -- Ensure existing field with same key is retagged as category-sourced
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
$$;
