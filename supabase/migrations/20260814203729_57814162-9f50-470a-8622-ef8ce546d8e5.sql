-- 1) ensure_contacts_table: garante campos de empresa/CNPJ/endereço e destrava a tabela
CREATE OR REPLACE FUNCTION public.ensure_contacts_table(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
  _try_slug text;
  _n int := 2;
  _pos int;
BEGIN
  SELECT id INTO _id FROM public.tables
  WHERE organization_id = _org_id AND system_data->>'kind' = 'contacts' LIMIT 1;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.tables
    WHERE organization_id = _org_id AND origin_standard_form_id IS NOT NULL
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF _id IS NULL THEN
    _try_slug := 'contatos';
    WHILE EXISTS (SELECT 1 FROM public.tables t WHERE t.organization_id = _org_id AND t.slug = _try_slug) LOOP
      _try_slug := 'contatos-' || _n; _n := _n + 1;
    END LOOP;
    INSERT INTO public.tables (organization_id, slug, name, description, is_system, is_locked, is_public, system_data)
    VALUES (_org_id, _try_slug, 'Contatos', 'Respostas dos formulários públicos', true, false, false,
            jsonb_build_object('kind','contacts'))
    RETURNING id INTO _id;
  ELSE
    UPDATE public.tables
      SET name = 'Contatos',
          description = COALESCE(description, 'Respostas dos formulários públicos'),
          is_system = true, is_locked = false, is_public = false,
          origin_standard_form_id = NULL,
          system_data = COALESCE(system_data,'{}'::jsonb) || jsonb_build_object('kind','contacts')
    WHERE id = _id;
  END IF;

  SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.fields WHERE table_id = _id;

  IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _id AND key = 'contact_company') THEN
    INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
    VALUES (_id, 'contact_company', 'Empresa / Razão social', 'text'::field_type, false, _pos, '{}'::jsonb, 'user');
    _pos := _pos + 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _id AND key = 'contact_cnpj') THEN
    INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
    VALUES (_id, 'contact_cnpj', 'CNPJ', 'text'::field_type, false, _pos, '{}'::jsonb, 'user');
    _pos := _pos + 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _id AND key = 'contact_address') THEN
    INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
    VALUES (_id, 'contact_address', 'Endereço do cliente', 'long_text'::field_type, false, _pos, '{}'::jsonb, 'user');
  END IF;

  RETURN _id;
END; $function$;

-- 2) ensure_bookings_table: garante o campo de deslocamento
CREATE OR REPLACE FUNCTION public.ensure_bookings_table(_source_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _src public.tables%ROWTYPE;
  _bid uuid;
  _slug text;
  _pos int;
BEGIN
  SELECT * INTO _src FROM public.tables WHERE id = _source_table_id;
  IF _src.id IS NULL THEN
    RAISE EXCEPTION 'Tabela nao encontrada';
  END IF;

  IF NOT (public.can_edit_org(auth.uid(), _src.organization_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  SELECT id INTO _bid
  FROM public.tables
  WHERE organization_id = _src.organization_id
    AND (system_data->>'kind') = 'bookings'
    AND (system_data->>'source_table_id') = _source_table_id::text
  LIMIT 1;

  IF _bid IS NULL THEN
    _slug := left('reservas-' || coalesce(_src.slug, 'tabela'), 60);
    IF EXISTS (SELECT 1 FROM public.tables WHERE organization_id = _src.organization_id AND slug = _slug) THEN
      _slug := left(_slug, 50) || '-' || substr(replace(_source_table_id::text, '-', ''), 1, 6);
    END IF;

    INSERT INTO public.tables (organization_id, slug, name, description, icon, bookable, is_system, is_locked, is_public, system_data)
    VALUES (
      _src.organization_id,
      _slug,
      left('Reservas de ' || _src.name, 120),
      'Reservas geradas a partir de ' || _src.name,
      'calendar-days',
      false,
      true,
      true,
      false,
      jsonb_build_object('kind', 'bookings', 'source_table_id', _source_table_id::text)
    )
    RETURNING id INTO _bid;

    INSERT INTO public.fields (table_id, key, label, type, required, position, config) VALUES
      (_bid, 'booking_start', 'Início', 'datetime', false, 0, jsonb_build_object('booking_role', 'start')),
      (_bid, 'booking_end', 'Término', 'datetime', false, 1, jsonb_build_object('booking_role', 'end')),
      (_bid, 'event_location', 'Local de instalação/evento', 'long_text', false, 2, '{}'::jsonb),
      (_bid, 'booking_notes', 'Observações da reserva', 'long_text', false, 3, '{}'::jsonb);

    UPDATE public.records
    SET table_id = _bid
    WHERE table_id = _source_table_id
      AND (
        jsonb_typeof(system_data->'items') = 'array'
        OR deal_status <> 'none'::deal_status
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _bid AND key = 'travel_fee') THEN
    SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.fields WHERE table_id = _bid;
    INSERT INTO public.fields (table_id, key, label, type, required, position, config)
    VALUES (_bid, 'travel_fee', 'Deslocamento', 'currency'::field_type, false, _pos, '{}'::jsonb);
  END IF;

  RETURN _bid;
END;
$function$;

-- 3) Backfill: tabelas de contatos existentes
DO $$
DECLARE
  _t record;
  _pos int;
BEGIN
  FOR _t IN SELECT id FROM public.tables WHERE system_data->>'kind' = 'contacts' LOOP
    UPDATE public.tables SET is_locked = false WHERE id = _t.id;
    SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.fields WHERE table_id = _t.id;
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _t.id AND key = 'contact_company') THEN
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
      VALUES (_t.id, 'contact_company', 'Empresa / Razão social', 'text'::field_type, false, _pos, '{}'::jsonb, 'user');
      _pos := _pos + 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _t.id AND key = 'contact_cnpj') THEN
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
      VALUES (_t.id, 'contact_cnpj', 'CNPJ', 'text'::field_type, false, _pos, '{}'::jsonb, 'user');
      _pos := _pos + 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _t.id AND key = 'contact_address') THEN
      INSERT INTO public.fields (table_id, key, label, type, required, position, config, source)
      VALUES (_t.id, 'contact_address', 'Endereço do cliente', 'long_text'::field_type, false, _pos, '{}'::jsonb, 'user');
    END IF;
  END LOOP;
END $$;

-- 4) Backfill: tabelas de reservas existentes
DO $$
DECLARE
  _t record;
  _pos int;
BEGIN
  FOR _t IN SELECT id FROM public.tables WHERE system_data->>'kind' = 'bookings' LOOP
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE table_id = _t.id AND key = 'travel_fee') THEN
      SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.fields WHERE table_id = _t.id;
      INSERT INTO public.fields (table_id, key, label, type, required, position, config)
      VALUES (_t.id, 'travel_fee', 'Deslocamento', 'currency'::field_type, false, _pos, '{}'::jsonb);
    END IF;
  END LOOP;
END $$;