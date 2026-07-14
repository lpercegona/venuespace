
-- 1) Bookable flag on tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS bookable boolean NOT NULL DEFAULT false;

-- 2) RECORDS
CREATE TABLE public.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.record_status NOT NULL DEFAULT 'draft',
  deal_status public.deal_status NOT NULL DEFAULT 'negotiating',
  agreed_value numeric,
  applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contribution_status public.contribution_status,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX records_table_id_idx ON public.records(table_id);
CREATE INDEX records_org_id_idx ON public.records(organization_id);
CREATE INDEX records_status_idx ON public.records(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "records: members can read"
  ON public.records FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "records: editors can insert"
  ON public.records FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_org(auth.uid(), organization_id));

CREATE POLICY "records: editors can update"
  ON public.records FOR UPDATE TO authenticated
  USING (public.can_edit_org(auth.uid(), organization_id))
  WITH CHECK (public.can_edit_org(auth.uid(), organization_id));

CREATE POLICY "records: editors can delete"
  ON public.records FOR DELETE TO authenticated
  USING (public.can_edit_org(auth.uid(), organization_id));

CREATE TRIGGER records_set_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) VIEWS
CREATE TABLE public.views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.view_type NOT NULL DEFAULT 'grid',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  submissions_table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT views_public_form_requires_submissions
    CHECK (type <> 'public_form' OR submissions_table_id IS NOT NULL)
);
CREATE INDEX views_table_id_idx ON public.views(table_id);
CREATE INDEX views_org_id_idx ON public.views(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.views TO authenticated;
GRANT ALL ON public.views TO service_role;

ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "views: members can read"
  ON public.views FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "views: editors can insert"
  ON public.views FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_org(auth.uid(), organization_id));

CREATE POLICY "views: editors can update"
  ON public.views FOR UPDATE TO authenticated
  USING (public.can_edit_org(auth.uid(), organization_id))
  WITH CHECK (public.can_edit_org(auth.uid(), organization_id));

CREATE POLICY "views: editors can delete"
  ON public.views FOR DELETE TO authenticated
  USING (public.can_edit_org(auth.uid(), organization_id));

CREATE TRIGGER views_set_updated_at
  BEFORE UPDATE ON public.views
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) PERMISSIONS (per-table role overrides)
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, user_id)
);
CREATE INDEX permissions_table_idx ON public.permissions(table_id);
CREATE INDEX permissions_user_idx ON public.permissions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions: members can read"
  ON public.permissions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "permissions: owners can insert"
  ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "permissions: owners can update"
  ON public.permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "permissions: owners can delete"
  ON public.permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'owner'));
