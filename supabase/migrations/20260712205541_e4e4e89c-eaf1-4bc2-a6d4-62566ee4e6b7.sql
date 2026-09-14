
-- 1) affiliate_settings: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated read settings" ON public.affiliate_settings;

CREATE POLICY "Admins read settings"
ON public.affiliate_settings
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) assets bucket: explicit object-level policies
DROP POLICY IF EXISTS "Public read assets bucket" ON storage.objects;
CREATE POLICY "Public read assets bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "Authenticated upload own assets" ON storage.objects;
CREATE POLICY "Authenticated upload own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated update own assets" ON storage.objects;
CREATE POLICY "Authenticated update own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated delete own assets" ON storage.objects;
CREATE POLICY "Authenticated delete own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) product-images: explicit public read policy
DROP POLICY IF EXISTS "Public read product-images bucket" ON storage.objects;
CREATE POLICY "Public read product-images bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
