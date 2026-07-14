-- venue-uploads bucket RLS policies on storage.objects
-- Authenticated users can upload, read, update, and delete their own uploads.
-- Signed URLs are used for public consumption (generated server-side).

CREATE POLICY "venue-uploads: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'venue-uploads');

CREATE POLICY "venue-uploads: authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'venue-uploads' AND owner = auth.uid());

CREATE POLICY "venue-uploads: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'venue-uploads' AND owner = auth.uid())
WITH CHECK (bucket_id = 'venue-uploads' AND owner = auth.uid());

CREATE POLICY "venue-uploads: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'venue-uploads' AND owner = auth.uid());