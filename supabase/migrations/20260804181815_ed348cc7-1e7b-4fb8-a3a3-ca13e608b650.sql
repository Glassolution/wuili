DROP POLICY IF EXISTS "AI character images are publicly readable" ON storage.objects;

CREATE POLICY "Users read their own AI character images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-characters' AND (storage.foldername(name))[1] = auth.uid()::text);