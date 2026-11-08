ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS gallery_urls_hash text;
ALTER TABLE public.catalog_recovery_retry_queue ADD COLUMN IF NOT EXISTS gallery_urls_hash text;
CREATE OR REPLACE FUNCTION public.catalog_gallery_urls_hash(p_images jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT encode(sha256(convert_to(coalesce((SELECT jsonb_agg(btrim(value) ORDER BY ord)::text FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_images)='array' THEN p_images ELSE '[]'::jsonb END) WITH ORDINALITY AS e(value,ord) WHERE btrim(value)<>''),'[]'),'UTF8')),'hex'); $$;
REVOKE ALL ON FUNCTION public.catalog_gallery_urls_hash(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_gallery_urls_hash(jsonb) TO authenticated,service_role;
UPDATE public.catalog_products SET gallery_urls_hash=public.catalog_gallery_urls_hash(images);
CREATE UNIQUE INDEX catalog_gallery_pending_unique ON public.catalog_recovery_retry_queue(product_id,gallery_urls_hash) WHERE state='awaiting_approval' AND gallery_urls_hash IS NOT NULL;
CREATE OR REPLACE FUNCTION public.catalog_record_gallery_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_hash text; new_hash text;
BEGIN
 new_hash:=public.catalog_gallery_urls_hash(NEW.images);
 NEW.gallery_urls_hash:=new_hash;
 IF TG_OP='UPDATE' THEN
  old_hash:=public.catalog_gallery_urls_hash(OLD.images);
  IF old_hash IS DISTINCT FROM new_hash THEN
   INSERT INTO public.catalog_recovery_retry_queue(run_id,product_id,reason,state,attempts,max_attempts,gallery_urls_hash)
   VALUES(gen_random_uuid(),NEW.id,'gallery_urls_changed','awaiting_approval',0,3,new_hash)
   ON CONFLICT(product_id,gallery_urls_hash) WHERE state='awaiting_approval' AND gallery_urls_hash IS NOT NULL DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.catalog_record_gallery_change() FROM PUBLIC;
CREATE TRIGGER catalog_gallery_urls_change BEFORE INSERT OR UPDATE OF images ON public.catalog_products FOR EACH ROW EXECUTE FUNCTION public.catalog_record_gallery_change();
COMMENT ON COLUMN public.catalog_products.gallery_urls_hash IS 'SHA256 of ordered trimmed nonempty gallery URLs; not image content. Changes enqueue manual analysis, never unblock.';