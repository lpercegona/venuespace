CREATE TABLE public.category_pdf_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL UNIQUE REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.category_pdf_layout TO authenticated;
GRANT ALL ON public.category_pdf_layout TO service_role;
ALTER TABLE public.category_pdf_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_layout_read_authenticated" ON public.category_pdf_layout
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pdf_layout_write_super_admin" ON public.category_pdf_layout
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER category_pdf_layout_set_updated_at
  BEFORE UPDATE ON public.category_pdf_layout
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.category_pdf_layout_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.category_pdf_layout(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label_override text,
  width_percent smallint NOT NULL DEFAULT 100 CHECK (width_percent IN (25,50,75,100)),
  font_size smallint NOT NULL DEFAULT 10 CHECK (font_size BETWEEN 8 AND 24),
  order_index integer NOT NULL DEFAULT 0,
  section_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.category_pdf_layout_fields TO authenticated;
GRANT ALL ON public.category_pdf_layout_fields TO service_role;
ALTER TABLE public.category_pdf_layout_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_layout_fields_read_authenticated" ON public.category_pdf_layout_fields
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pdf_layout_fields_write_super_admin" ON public.category_pdf_layout_fields
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_pdf_layout_fields_layout ON public.category_pdf_layout_fields(layout_id, order_index);

CREATE TRIGGER category_pdf_layout_fields_set_updated_at
  BEFORE UPDATE ON public.category_pdf_layout_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Migra a configuração de PDF do módulo Reservas para o novo modelo
INSERT INTO public.category_pdf_layout (category_id, config)
SELECT c.id, COALESCE((cm.config->'pdf'), '{}'::jsonb)
FROM public.organization_categories c
LEFT JOIN public.category_modules cm
  ON cm.category_id = c.id AND cm.module_key = 'bookings'
ON CONFLICT (category_id) DO NOTHING;

-- Campos-base da organização mapeados para as colunas físicas
INSERT INTO public.category_org_fields (category_id, field_key, label, field_type, required, config, order_index, is_base)
SELECT c.id, v.field_key, v.label, v.field_type, v.required, v.config, v.order_index, true
FROM public.organization_categories c
CROSS JOIN (VALUES
  ('org_name', 'Nome da organização', 'text', true, '{"column_key":"name"}'::jsonb, -40),
  ('org_logo', 'Logotipo', 'image', false, '{"column_key":"logo_url"}'::jsonb, -30),
  ('org_description', 'Descrição', 'long_text', false, '{"column_key":"description"}'::jsonb, -20),
  ('org_address', 'Endereço', 'address', false, '{"column_key":"address"}'::jsonb, -10)
) AS v(field_key, label, field_type, required, config, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.category_org_fields f
  WHERE f.category_id = c.id AND f.field_key = v.field_key
);