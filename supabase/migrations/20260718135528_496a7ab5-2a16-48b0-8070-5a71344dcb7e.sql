GRANT SELECT ON public.category_filter_fields TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.category_filter_fields TO authenticated;
GRANT ALL ON public.category_filter_fields TO service_role;