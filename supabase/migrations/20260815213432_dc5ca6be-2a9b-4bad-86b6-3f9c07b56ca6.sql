ALTER TABLE public.organization_categories
  ADD COLUMN IF NOT EXISTS allow_custom_tables boolean NOT NULL DEFAULT true;