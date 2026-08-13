CREATE OR REPLACE FUNCTION public.ensure_bookings_table(_source_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _src public.tables%ROWTYPE;
  _bid uuid;
  _slug text;
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

  RETURN _bid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_bookings_table(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_bookings_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_bookings_table(uuid) TO service_role;