-- ============================================================
-- Iteração 9 — Configurações Gerais da Instância
-- ============================================================

-- 1) instance_settings (singleton)
CREATE TABLE public.instance_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  default_currency text NOT NULL DEFAULT 'BRL',
  currency_display jsonb NOT NULL DEFAULT '{"symbol":"R$","position":"before","decimal":",","thousand":"."}'::jsonb,
  allow_user_field_management boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.instance_settings TO anon;
GRANT SELECT ON public.instance_settings TO authenticated;
GRANT ALL ON public.instance_settings TO service_role;

ALTER TABLE public.instance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instance_settings_read_all"
  ON public.instance_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "instance_settings_update_super_admin"
  ON public.instance_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "instance_settings_insert_super_admin"
  ON public.instance_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER instance_settings_touch
  BEFORE UPDATE ON public.instance_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.instance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- 2) platform_labels
CREATE TABLE public.platform_labels (
  key text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_labels TO anon;
GRANT SELECT ON public.platform_labels TO authenticated;
GRANT ALL ON public.platform_labels TO service_role;

ALTER TABLE public.platform_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_labels_read_all"
  ON public.platform_labels FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "platform_labels_write_super_admin"
  ON public.platform_labels FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER platform_labels_touch
  BEFORE UPDATE ON public.platform_labels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.platform_labels (key, label, icon) VALUES
  ('organization', 'Organização', 'Building2'),
  ('organizations', 'Organizações', 'Building2'),
  ('table', 'Tabela', 'Table'),
  ('tables', 'Tabelas', 'Table'),
  ('record', 'Registro', 'FileText'),
  ('records', 'Registros', 'FileText'),
  ('view', 'View', 'Layout'),
  ('views', 'Views', 'Layout'),
  ('field', 'Campo', 'Columns3'),
  ('fields', 'Campos', 'Columns3'),
  ('membership', 'Membro', 'User'),
  ('memberships', 'Membros', 'Users'),
  ('conversation', 'Conversa', 'MessageSquare'),
  ('conversations', 'Conversas', 'MessagesSquare'),
  ('message', 'Mensagem', 'MessageCircle'),
  ('messages', 'Mensagens', 'MessagesSquare'),
  ('campaign', 'Campanha', 'HeartHandshake'),
  ('campaigns', 'Campanhas', 'HeartHandshake'),
  ('contribution', 'Contribuição', 'HandCoins'),
  ('contributions', 'Contribuições', 'HandCoins'),
  ('booking', 'Reserva', 'CalendarDays'),
  ('bookings', 'Reservas', 'CalendarDays'),
  ('category', 'Categoria', 'Tag'),
  ('categories', 'Categorias', 'Tags')
ON CONFLICT (key) DO NOTHING;


-- 3) system_form_fields
CREATE TABLE public.system_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key text NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  icon text,
  order_index int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_key, field_key),
  CHECK (form_key IN ('create_organization', 'create_table', 'create_record'))
);

GRANT SELECT ON public.system_form_fields TO anon;
GRANT SELECT ON public.system_form_fields TO authenticated;
GRANT ALL ON public.system_form_fields TO service_role;

ALTER TABLE public.system_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sff_read_all"
  ON public.system_form_fields FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "sff_write_super_admin"
  ON public.system_form_fields FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER sff_touch
  BEFORE UPDATE ON public.system_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.system_form_fields (form_key, field_key, label, icon, order_index) VALUES
  ('create_organization', 'name', 'Nome da organização', 'Building2', 0),
  ('create_organization', 'slug', 'Identificador (URL)', 'Link', 1),
  ('create_organization', 'description', 'Descrição', 'AlignLeft', 2),
  ('create_organization', 'category_id', 'Categoria', 'Tag', 3),
  ('create_table', 'name', 'Nome da tabela', 'Table', 0),
  ('create_table', 'description', 'Descrição', 'AlignLeft', 1),
  ('create_table', 'icon', 'Ícone', 'Sparkles', 2),
  ('create_table', 'bookable', 'Reservável', 'CalendarDays', 3),
  ('create_record', 'title', 'Título', 'Type', 0),
  ('create_record', 'status', 'Status', 'Flag', 1)
ON CONFLICT (form_key, field_key) DO NOTHING;


-- 4) organization_categories
CREATE TABLE public.organization_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

GRANT SELECT ON public.organization_categories TO anon;
GRANT SELECT ON public.organization_categories TO authenticated;
GRANT ALL ON public.organization_categories TO service_role;

ALTER TABLE public.organization_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_cat_read_all"
  ON public.organization_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "org_cat_write_super_admin"
  ON public.organization_categories FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER org_cat_touch
  BEFORE UPDATE ON public.organization_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 5) organizations: novos campos
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.organization_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS currency_display jsonb;

CREATE INDEX IF NOT EXISTS organizations_category_id_idx ON public.organizations (category_id);


-- 6) organization_category_default_fields
CREATE TABLE public.organization_category_default_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, field_key)
);

GRANT SELECT ON public.organization_category_default_fields TO authenticated;
GRANT ALL ON public.organization_category_default_fields TO service_role;

ALTER TABLE public.organization_category_default_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocdf_read_authenticated"
  ON public.organization_category_default_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ocdf_write_super_admin"
  ON public.organization_category_default_fields FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS ocdf_category_id_idx ON public.organization_category_default_fields (category_id, order_index);