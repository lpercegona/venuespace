-- Adiciona escopo para layout de página de organização
ALTER TYPE public_layout_scope ADD VALUE IF NOT EXISTS 'organization_page';

-- Tabela de avaliações
CREATE TABLE public.organization_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_reviews TO authenticated;
GRANT ALL ON public.organization_reviews TO service_role;

ALTER TABLE public.organization_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reviews"
  ON public.organization_reviews
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read approved reviews"
  ON public.organization_reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Super admins can moderate reviews"
  ON public.organization_reviews
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER organization_reviews_set_updated_at
  BEFORE UPDATE ON public.organization_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
