DROP POLICY IF EXISTS "super admin manage org fields" ON public.organization_fields;
CREATE POLICY "super admin manage org fields" ON public.organization_fields
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin manage table fields" ON public.table_fields;
CREATE POLICY "super admin manage table fields" ON public.table_fields
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin manage record fields" ON public.record_fields;
CREATE POLICY "super admin manage record fields" ON public.record_fields
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));