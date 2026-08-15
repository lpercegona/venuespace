REVOKE ALL ON FUNCTION public.prevent_message_content_tampering() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_standard_fields_to_table(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "venue-uploads: authenticated insert" ON storage.objects;
CREATE POLICY "venue-uploads: authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'venue-uploads'
  AND owner = auth.uid()
  AND (
    (storage.foldername(name))[1] IS DISTINCT FROM 'orcamentos'
    OR (
      name ~ '^orcamentos/[0-9a-fA-F-]{36}/'
      AND public.is_org_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

DROP POLICY IF EXISTS "venue-uploads: owner update" ON storage.objects;
CREATE POLICY "venue-uploads: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'venue-uploads' AND owner = auth.uid())
WITH CHECK (
  bucket_id = 'venue-uploads'
  AND owner = auth.uid()
  AND (
    (storage.foldername(name))[1] IS DISTINCT FROM 'orcamentos'
    OR (
      name ~ '^orcamentos/[0-9a-fA-F-]{36}/'
      AND public.is_org_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);