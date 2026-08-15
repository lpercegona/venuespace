CREATE TABLE public.platform_modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_modules TO authenticated;
GRANT ALL ON public.platform_modules TO service_role;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_modules_read" ON public.platform_modules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_modules_write" ON public.platform_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER platform_modules_touch BEFORE UPDATE ON public.platform_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.category_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.platform_modules(key) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, module_key)
);

GRANT SELECT ON public.category_modules TO authenticated;
GRANT ALL ON public.category_modules TO service_role;
ALTER TABLE public.category_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_modules_read" ON public.category_modules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "category_modules_write" ON public.category_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER category_modules_touch BEFORE UPDATE ON public.category_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.platform_modules (key, name, description, order_index)
VALUES ('bookings', 'Reservas', 'Gestão de reservas, disponibilidade e orçamento em PDF.', 0)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.category_modules (category_id, module_key, is_enabled)
SELECT c.id, 'bookings', true FROM public.organization_categories c
ON CONFLICT (category_id, module_key) DO NOTHING;