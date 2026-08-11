CREATE POLICY "venue-uploads: org members read quotes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'venue-uploads'
  AND name ~ '^orcamentos/[0-9a-fA-F-]{36}/'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
);