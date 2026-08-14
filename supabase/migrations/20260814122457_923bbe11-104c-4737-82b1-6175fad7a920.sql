CREATE OR REPLACE FUNCTION public.set_deal_status_guarded(
  _record_id uuid,
  _status deal_status,
  _agreed_value numeric DEFAULT NULL,
  _start_key text DEFAULT NULL,
  _end_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rec public.records%ROWTYPE;
  _items text[];
  _start text;
  _end text;
  _conflict record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _rec FROM public.records WHERE id = _record_id;
  IF _rec.id IS NULL THEN
    RAISE EXCEPTION 'Reserva nao encontrada';
  END IF;

  IF NOT (public.can_edit_org(auth.uid(), _rec.organization_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissao' USING ERRCODE = '42501';
  END IF;

  -- Serializa confirmacoes concorrentes na mesma agenda ate o fim da transacao.
  PERFORM pg_advisory_xact_lock(hashtextextended(_rec.table_id::text, 0));

  IF _status IN ('accepted','closed') AND _start_key IS NOT NULL AND _end_key IS NOT NULL THEN
    _start := _rec.data->>_start_key;
    _end := _rec.data->>_end_key;

    SELECT ARRAY(
      SELECT DISTINCT (i->>'record_id')
      FROM jsonb_array_elements(COALESCE(_rec.system_data->'items','[]'::jsonb)) AS i
      WHERE i->>'record_id' IS NOT NULL
    ) INTO _items;

    IF _start IS NOT NULL AND _end IS NOT NULL AND array_length(_items, 1) > 0 THEN
      SELECT o.id,
             o.data->>_start_key AS os,
             o.data->>_end_key AS oe
        INTO _conflict
      FROM public.records o
      WHERE o.table_id = _rec.table_id
        AND o.id <> _rec.id
        AND o.status <> 'archived'
        AND o.deal_status IN ('accepted','closed')
        AND o.data->>_start_key IS NOT NULL
        AND o.data->>_end_key IS NOT NULL
        AND (o.data->>_start_key) < _end
        AND _start < (o.data->>_end_key)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(o.system_data->'items','[]'::jsonb)) AS oi
          WHERE (oi->>'record_id') = ANY(_items)
        )
      LIMIT 1;

      IF _conflict.id IS NOT NULL THEN
        RAISE EXCEPTION 'Conflito de reserva: ja existe uma negociacao aceita entre % e %.', _conflict.os, _conflict.oe;
      END IF;
    END IF;
  END IF;

  UPDATE public.records
     SET deal_status = _status,
         agreed_value = COALESCE(_agreed_value, agreed_value)
   WHERE id = _record_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_deal_status_guarded(uuid, deal_status, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_deal_status_guarded(uuid, deal_status, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_deal_status_guarded(uuid, deal_status, numeric, text, text) TO service_role;