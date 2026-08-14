CREATE TABLE public.category_field_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('org','table','record')),
  key text NOT NULL,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, scope, key)
);

GRANT SELECT ON public.category_field_groups TO anon;
GRANT SELECT ON public.category_field_groups TO authenticated;
GRANT ALL ON public.category_field_groups TO service_role;

ALTER TABLE public.category_field_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read field groups"
ON public.category_field_groups FOR SELECT
USING (true);

CREATE POLICY "Super admin manages field groups"
ON public.category_field_groups FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER category_field_groups_set_updated_at
BEFORE UPDATE ON public.category_field_groups
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.category_org_fields
  ADD COLUMN group_id uuid REFERENCES public.category_field_groups(id) ON DELETE SET NULL,
  ADD COLUMN is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.category_table_fields
  ADD COLUMN group_id uuid REFERENCES public.category_field_groups(id) ON DELETE SET NULL,
  ADD COLUMN is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.organization_category_default_fields
  ADD COLUMN group_id uuid REFERENCES public.category_field_groups(id) ON DELETE SET NULL,
  ADD COLUMN is_base boolean NOT NULL DEFAULT false;

INSERT INTO public.category_field_groups (category_id, scope, key, title, description, order_index)
SELECT c.id, 'org', 'endereco', 'Endereço', 'Localização usada nas páginas públicas e nos filtros de busca.', 10
FROM public.organization_categories c
ON CONFLICT (category_id, scope, key) DO NOTHING;

INSERT INTO public.category_field_groups (category_id, scope, key, title, description, order_index)
SELECT c.id, 'org', 'orcamento', 'Orçamento', 'Dados do emissor usados no PDF de orçamento das reservas.', 20
FROM public.organization_categories c
ON CONFLICT (category_id, scope, key) DO NOTHING;

INSERT INTO public.category_org_fields (category_id, field_key, label, field_type, required, config, order_index, group_id, is_base)
SELECT c.id, v.field_key, v.label, v.field_type, false, v.config, v.order_index, g.id, true
FROM public.organization_categories c
JOIN public.category_field_groups g
  ON g.category_id = c.id AND g.scope = 'org' AND g.key = 'orcamento'
CROSS JOIN (VALUES
  ('quote_cnpj', 'CNPJ', 'text', '{"system_key":"quote.cnpj","placeholder":"00.000.000/0001-00"}'::jsonb, 900),
  ('quote_site', 'Site', 'text', '{"system_key":"quote.site","placeholder":"www.exemplo.com.br"}'::jsonb, 901),
  ('quote_validity_days', 'Validade do orçamento (dias)', 'number', '{"system_key":"quote.validity_days","default":15}'::jsonb, 902),
  ('quote_payment_terms', 'Condições de pagamento (uma por linha)', 'long_text', '{"system_key":"quote.payment_terms"}'::jsonb, 903)
) AS v(field_key, label, field_type, config, order_index)
ON CONFLICT (category_id, field_key) DO NOTHING;