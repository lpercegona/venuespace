
-- Super admin registry (global, cross-org) for development access
CREATE TABLE public.super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Users can see their own super admin record (to check status client-side)
CREATE POLICY "Users can view own super admin status"
  ON public.super_admins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security-definer helper to check super admin status without RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id);
$$;

-- Whitelist of dev super admin emails; auto-promoted on signup or first login
CREATE OR REPLACE FUNCTION public.is_super_admin_email(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(_email) IN ('lpercegona@gmail.com');
$$;

-- Extend handle_new_user to also insert into super_admins when email matches
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  IF public.is_super_admin_email(NEW.email) THEN
    INSERT INTO public.super_admins (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- Backfill: if the whitelisted user already exists in auth.users, promote now
INSERT INTO public.super_admins (user_id, email)
SELECT id, email FROM auth.users WHERE public.is_super_admin_email(email)
ON CONFLICT (user_id) DO NOTHING;
