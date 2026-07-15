
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP FUNCTION IF EXISTS public.create_organization(text, text, text);

CREATE OR REPLACE FUNCTION public.create_organization(
  _name text,
  _slug text,
  _category_id uuid,
  _description text DEFAULT NULL,
  _address jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(id uuid, slug text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = '22023';
  END IF;
  IF _slug IS NULL OR _slug !~ '^[a-z0-9-]{2,60}$' THEN
    RAISE EXCEPTION 'Invalid slug' USING ERRCODE = '22023';
  END IF;
  IF _category_id IS NULL THEN
    RAISE EXCEPTION 'Category required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.organizations (name, slug, description, category_id, address, created_by)
  VALUES (btrim(_name), _slug, _description, _category_id, COALESCE(_address, '{}'::jsonb), _uid)
  RETURNING organizations.id INTO _new_id;

  RETURN QUERY SELECT o.id, o.slug, o.name FROM public.organizations o WHERE o.id = _new_id;
END;
$$;
