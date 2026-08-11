ALTER TABLE public.category_filter_fields DROP CONSTRAINT IF EXISTS category_filter_fields_filter_type_check;
ALTER TABLE public.category_filter_fields ADD CONSTRAINT category_filter_fields_filter_type_check CHECK (filter_type = ANY (ARRAY['search'::text, 'select'::text, 'city'::text, 'range'::text]));
ALTER TABLE public.category_filter_fields ADD COLUMN IF NOT EXISTS min_field_key text;
ALTER TABLE public.category_filter_fields ADD COLUMN IF NOT EXISTS max_field_key text;