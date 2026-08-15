INSERT INTO public.category_table_fields (category_id, field_key, label, field_type, required, config, order_index, group_id, is_base)
SELECT c.id, f.key, f.label, f.type, f.required, COALESCE(f.config,'{}'::jsonb), f.position, NULL, true
FROM public.table_fields f CROSS JOIN public.organization_categories c
ON CONFLICT (category_id, field_key) DO NOTHING;

INSERT INTO public.organization_category_default_fields (category_id, field_key, label, field_type, required, config, order_index, group_id, is_base)
SELECT c.id, f.key, f.label, f.type, f.required, COALESCE(f.config,'{}'::jsonb), f.position, NULL, true
FROM public.record_fields f CROSS JOIN public.organization_categories c
ON CONFLICT (category_id, field_key) DO NOTHING;

INSERT INTO public.category_org_fields (category_id, field_key, label, field_type, required, config, order_index, group_id, is_base)
SELECT c.id, f.key, f.label, f.type, f.required, COALESCE(f.config,'{}'::jsonb), f.position, NULL, true
FROM public.organization_fields f CROSS JOIN public.organization_categories c
ON CONFLICT (category_id, field_key) DO NOTHING;