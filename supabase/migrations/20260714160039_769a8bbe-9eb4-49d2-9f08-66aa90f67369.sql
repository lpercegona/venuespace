
-- Enums
CREATE TYPE public.app_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.record_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.deal_status AS ENUM ('none', 'negotiating', 'accepted', 'declined', 'closed');
CREATE TYPE public.contribution_status AS ENUM ('none', 'pledged', 'confirmed', 'refunded');
CREATE TYPE public.field_type AS ENUM ('text','long_text','number','currency','boolean','date','datetime','select','multiselect','email','phone','url','image','file','relation','computed');
CREATE TYPE public.view_type AS ENUM ('grid','public_list','public_detail','public_form');

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Memberships (roles NEVER on profile — separate table)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX memberships_user_idx ON public.memberships(user_id);
CREATE INDEX memberships_org_idx ON public.memberships(organization_id);

-- Security-definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND organization_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner','editor'));
$$;

-- Organizations policies
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "orgs_insert_authenticated" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_update_owner" ON public.organizations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), id, 'owner')) WITH CHECK (public.has_role(auth.uid(), id, 'owner'));
CREATE POLICY "orgs_delete_owner" ON public.organizations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), id, 'owner'));

-- Memberships policies
CREATE POLICY "memberships_select_same_org" ON public.memberships FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "memberships_insert_owner" ON public.memberships FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'));
CREATE POLICY "memberships_update_owner" ON public.memberships FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), organization_id, 'owner')) WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'));
CREATE POLICY "memberships_delete_owner_or_self" ON public.memberships FOR DELETE TO authenticated USING (public.has_role(auth.uid(), organization_id, 'owner') OR user_id = auth.uid());

-- Trigger: creator becomes owner
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- Tables (dynamic user-defined tables)
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  bookable BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tables TO authenticated;
GRANT SELECT ON public.tables TO anon;
GRANT ALL ON public.tables TO service_role;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tables_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "tables_select_members" ON public.tables FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "tables_insert_editor" ON public.tables FOR INSERT TO authenticated WITH CHECK (public.can_edit_org(auth.uid(), organization_id));
CREATE POLICY "tables_update_editor" ON public.tables FOR UPDATE TO authenticated USING (public.can_edit_org(auth.uid(), organization_id)) WITH CHECK (public.can_edit_org(auth.uid(), organization_id));
CREATE POLICY "tables_delete_owner" ON public.tables FOR DELETE TO authenticated USING (public.has_role(auth.uid(), organization_id, 'owner'));

-- Fields
CREATE TABLE public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type public.field_type NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT SELECT ON public.fields TO anon;
GRANT ALL ON public.fields TO service_role;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER fields_updated_at BEFORE UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "fields_select_members" ON public.fields FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tables t WHERE t.id = table_id AND public.is_org_member(auth.uid(), t.organization_id))
);
CREATE POLICY "fields_insert_editor" ON public.fields FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.tables t WHERE t.id = table_id AND public.can_edit_org(auth.uid(), t.organization_id))
);
CREATE POLICY "fields_update_editor" ON public.fields FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tables t WHERE t.id = table_id AND public.can_edit_org(auth.uid(), t.organization_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.tables t WHERE t.id = table_id AND public.can_edit_org(auth.uid(), t.organization_id))
);
CREATE POLICY "fields_delete_editor" ON public.fields FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tables t WHERE t.id = table_id AND public.can_edit_org(auth.uid(), t.organization_id))
);
