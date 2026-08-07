CREATE TABLE public.home_groupings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_groupings TO anon;
GRANT SELECT ON public.home_groupings TO authenticated;
GRANT ALL ON public.home_groupings TO service_role;

ALTER TABLE public.home_groupings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_groupings_public_read" ON public.home_groupings FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "home_groupings_auth_read" ON public.home_groupings FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "home_groupings_super_admin_write" ON public.home_groupings FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.home_grouping_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grouping_id uuid NOT NULL REFERENCES public.home_groupings(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (grouping_id, category_id)
);

GRANT SELECT ON public.home_grouping_categories TO anon;
GRANT SELECT ON public.home_grouping_categories TO authenticated;
GRANT ALL ON public.home_grouping_categories TO service_role;

ALTER TABLE public.home_grouping_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_grouping_categories_public_read" ON public.home_grouping_categories FOR SELECT TO anon USING (true);
CREATE POLICY "home_grouping_categories_auth_read" ON public.home_grouping_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "home_grouping_categories_super_admin_write" ON public.home_grouping_categories FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.home_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grouping_id uuid NOT NULL REFERENCES public.home_groupings(id) ON DELETE CASCADE,
  title text NOT NULL,
  source text NOT NULL CHECK (source IN ('organizations', 'records')),
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  order_by text,
  limit_count integer NOT NULL DEFAULT 6,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_blocks TO anon;
GRANT SELECT ON public.home_blocks TO authenticated;
GRANT ALL ON public.home_blocks TO service_role;

ALTER TABLE public.home_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_blocks_public_read" ON public.home_blocks FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "home_blocks_auth_read" ON public.home_blocks FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "home_blocks_super_admin_write" ON public.home_blocks FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_home_groupings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER home_groupings_updated_at
BEFORE UPDATE ON public.home_groupings
FOR EACH ROW EXECUTE FUNCTION public.tg_home_groupings_set_updated_at();

CREATE TRIGGER home_blocks_updated_at
BEFORE UPDATE ON public.home_blocks
FOR EACH ROW EXECUTE FUNCTION public.tg_home_groupings_set_updated_at();

-- Seed inicial: Espaços e Fornecedores
INSERT INTO public.home_groupings (label, slug, description, order_index, is_active)
VALUES
  ('Espaços', 'espacos', 'Espaços para eventos', 0, true),
  ('Fornecedores', 'fornecedores', 'Fornecedores e serviços para eventos', 1, true)
ON CONFLICT (slug) DO NOTHING;

WITH espacos AS (
  SELECT id FROM public.home_groupings WHERE slug = 'espacos' LIMIT 1
),
fornecedores AS (
  SELECT id FROM public.home_groupings WHERE slug = 'fornecedores' LIMIT 1
),
cat_espacos AS (
  SELECT id FROM public.organization_categories WHERE name ILIKE '%espaço%' LIMIT 1
),
cat_fornecedores AS (
  SELECT id FROM public.organization_categories WHERE name ILIKE '%audiovisual%' LIMIT 1
)
INSERT INTO public.home_grouping_categories (grouping_id, category_id)
SELECT e.id, c.id FROM espacos e, cat_espacos c
UNION ALL
SELECT f.id, cf.id FROM fornecedores f, cat_fornecedores cf
ON CONFLICT DO NOTHING;

-- Blocos iniciais de exemplo para Espaços
WITH espacos AS (
  SELECT id FROM public.home_groupings WHERE slug = 'espacos' LIMIT 1
)
INSERT INTO public.home_blocks (grouping_id, title, source, rules, limit_count, order_index, is_active)
SELECT
  e.id,
  'Espaços mais procurados',
  'organizations',
  '[{"field_key":"status","operator":"=","value":"published"}]'::jsonb,
  6,
  0,
  true
FROM espacos e
ON CONFLICT DO NOTHING;