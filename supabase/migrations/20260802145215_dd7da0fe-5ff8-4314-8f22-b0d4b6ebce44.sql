CREATE TABLE public.category_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, key)
);

GRANT SELECT ON public.category_labels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_labels TO authenticated;
GRANT ALL ON public.category_labels TO service_role;

ALTER TABLE public.category_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_labels_public_read" ON public.category_labels
  FOR SELECT USING (true);

CREATE POLICY "category_labels_sa_write" ON public.category_labels
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER category_labels_set_updated_at
  BEFORE UPDATE ON public.category_labels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.category_public_layouts
  ADD COLUMN IF NOT EXISTS card_style text NOT NULL DEFAULT 'standard';