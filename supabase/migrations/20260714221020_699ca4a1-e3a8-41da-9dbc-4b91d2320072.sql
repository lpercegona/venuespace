
-- Iteração 10: layout público por categoria + campos de sistema (org/table/record) + system_data

-- 1. Layout público por categoria
CREATE TYPE public.field_source_kind AS ENUM ('org_field', 'table_field', 'record_field', 'record_data_field');

CREATE TABLE public.organization_category_public_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.organization_categories(id) ON DELETE CASCADE,
  field_source public.field_source_kind NOT NULL,
  field_ref text NOT NULL,
  icon text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  label_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.organization_category_public_layouts (category_id, order_index);

GRANT SELECT ON public.organization_category_public_layouts TO anon, authenticated;
GRANT ALL ON public.organization_category_public_layouts TO service_role;
ALTER TABLE public.organization_category_public_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read layouts" ON public.organization_category_public_layouts FOR SELECT USING (true);
CREATE POLICY "super admin manage layouts" ON public.organization_category_public_layouts FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tg_layouts_updated_at BEFORE UPDATE ON public.organization_category_public_layouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Campos de sistema (3 tabelas independentes, mesmo motor de tipos)
CREATE TABLE public.organization_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.table_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.record_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organization_fields TO anon, authenticated;
GRANT ALL ON public.organization_fields TO service_role;
GRANT SELECT ON public.table_fields TO anon, authenticated;
GRANT ALL ON public.table_fields TO service_role;
GRANT SELECT ON public.record_fields TO anon, authenticated;
GRANT ALL ON public.record_fields TO service_role;

ALTER TABLE public.organization_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read org fields" ON public.organization_fields FOR SELECT USING (true);
CREATE POLICY "super admin manage org fields" ON public.organization_fields FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "public read table fields" ON public.table_fields FOR SELECT USING (true);
CREATE POLICY "super admin manage table fields" ON public.table_fields FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "public read record fields" ON public.record_fields FOR SELECT USING (true);
CREATE POLICY "super admin manage record fields" ON public.record_fields FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER tg_org_fields_updated_at BEFORE UPDATE ON public.organization_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_table_fields_updated_at BEFORE UPDATE ON public.table_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_record_fields_updated_at BEFORE UPDATE ON public.record_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Colunas system_data para armazenar valores dos campos de sistema
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS system_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tables        ADD COLUMN IF NOT EXISTS system_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.records       ADD COLUMN IF NOT EXISTS system_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Descartar system_form_fields legado (só carregava label/ícone)
DROP TABLE IF EXISTS public.system_form_fields CASCADE;
