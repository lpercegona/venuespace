UPDATE public.organization_category_default_fields d
SET config = jsonb_set(COALESCE(d.config, '{}'::jsonb), '{options}', sf.config->'options', true)
FROM public.category_standard_table_fields sf
JOIN public.category_standard_tables st ON st.id = sf.standard_table_id
WHERE sf.field_key = 'tipos_de_layout'
  AND sf.config ? 'options'
  AND st.category_id = d.category_id
  AND d.field_key = 'tipos_de_layout'
  AND NOT (COALESCE(d.config, '{}'::jsonb) ? 'options');

UPDATE public.fields f
SET config = jsonb_set(COALESCE(f.config, '{}'::jsonb), '{options}', d.config->'options', true)
FROM public.organization_category_default_fields d
JOIN public.organizations o ON o.category_id = d.category_id
JOIN public.tables t ON t.organization_id = o.id
WHERE d.field_key = 'tipos_de_layout'
  AND d.config ? 'options'
  AND f.table_id = t.id
  AND f.key = 'tipos_de_layout'
  AND NOT (COALESCE(f.config, '{}'::jsonb) ? 'options');