
CREATE TABLE public.category_filter_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('organization','record')),
  field_key text NOT NULL,
  filter_type text NOT NULL CHECK (filter_type IN ('search','select','city')),
  label_override text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, scope, field_key)
);

GRANT SELECT ON public.category_filter_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_filter_fields TO authenticated;
GRANT ALL ON public.category_filter_fields TO service_role;

ALTER TABLE public.category_filter_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read category filter fields"
  ON public.category_filter_fields FOR SELECT
  USING (true);

CREATE POLICY "Super admins can insert category filter fields"
  ON public.category_filter_fields FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update category filter fields"
  ON public.category_filter_fields FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete category filter fields"
  ON public.category_filter_fields FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_category_filter_fields_updated_at
  BEFORE UPDATE ON public.category_filter_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_category_filter_fields_lookup
  ON public.category_filter_fields (category_id, scope, order_index);
