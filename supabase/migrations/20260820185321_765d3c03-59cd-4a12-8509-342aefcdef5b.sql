-- 1) Modelo padrão global de orçamento
ALTER TABLE public.category_pdf_layout ALTER COLUMN category_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS category_pdf_layout_default_uniq
  ON public.category_pdf_layout ((category_id IS NULL)) WHERE category_id IS NULL;

-- 2) Tipo e estilo por bloco
ALTER TABLE public.category_pdf_layout_fields
  ADD COLUMN IF NOT EXISTS block_type text NOT NULL DEFAULT 'field',
  ADD COLUMN IF NOT EXISTS style jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Contador diário global de orçamentos
CREATE TABLE IF NOT EXISTS public.quote_counters (
  day date PRIMARY KEY,
  seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quote_counters TO authenticated;
GRANT ALL ON public.quote_counters TO service_role;

ALTER TABLE public.quote_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read quote counters"
  ON public.quote_counters FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS quote_counters_set_updated_at ON public.quote_counters;
CREATE TRIGGER quote_counters_set_updated_at
  BEFORE UPDATE ON public.quote_counters
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _seq integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.quote_counters (day, seq) VALUES (_day, 1)
  ON CONFLICT (day) DO UPDATE SET seq = public.quote_counters.seq + 1
  RETURNING seq INTO _seq;

  RETURN to_char(_day, 'DDMMYYYY') || lpad(_seq::text, 2, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_quote_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated, service_role;

-- 4) Novo tipo de campo: quantidade
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'quantity';
