-- Drop old single-scope layout table
DROP TABLE IF EXISTS public.organization_category_public_layouts CASCADE;

-- Extend field_type enum with 'gallery'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'field_type' AND e.enumlabel = 'gallery') THEN
    ALTER TYPE public.field_type ADD VALUE 'gallery';
  END IF;
END $$;

-- Public layout scope enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_layout_scope') THEN
    CREATE TYPE public.public_layout_scope AS ENUM ('organization_card', 'record_card');
  END IF;
END $$;

-- Parent layout per (category, scope)
CREATE TABLE IF NOT EXISTS public.category_public_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  scope public.public_layout_scope NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, scope)
);

GRANT SELECT ON public.category_public_layouts TO anon, authenticated;
GRANT ALL ON public.category_public_layouts TO service_role;
ALTER TABLE public.category_public_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read layouts" ON public.category_public_layouts FOR SELECT USING (true);
CREATE POLICY "super admin write layouts" ON public.category_public_layouts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Layout field rows
CREATE TABLE IF NOT EXISTS public.category_public_layout_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.category_public_layouts(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  width_percent smallint NOT NULL CHECK (width_percent IN (25, 50, 75, 100)),
  order_index int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpl_fields_layout ON public.category_public_layout_fields (layout_id, order_index);

GRANT SELECT ON public.category_public_layout_fields TO anon, authenticated;
GRANT ALL ON public.category_public_layout_fields TO service_role;
ALTER TABLE public.category_public_layout_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read layout fields" ON public.category_public_layout_fields FOR SELECT USING (true);
CREATE POLICY "super admin write layout fields" ON public.category_public_layout_fields FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_cpl_updated_at BEFORE UPDATE ON public.category_public_layouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();