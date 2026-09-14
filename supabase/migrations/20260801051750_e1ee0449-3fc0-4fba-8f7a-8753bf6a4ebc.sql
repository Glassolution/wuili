ALTER TABLE public.ai_product_pages
  ADD CONSTRAINT ai_product_pages_source_present_check
  CHECK (catalog_product_id IS NOT NULL OR source_url IS NOT NULL) NOT VALID;

ALTER TABLE public.ai_product_pages VALIDATE CONSTRAINT ai_product_pages_source_present_check;

CREATE INDEX IF NOT EXISTS idx_ai_product_pages_cooldown
  ON public.ai_product_pages (user_id, created_at DESC)
  WHERE status = 'gerando';

CREATE INDEX IF NOT EXISTS idx_ai_product_pages_provider_page_id
  ON public.ai_product_pages (provider_page_id)
  WHERE provider_page_id IS NOT NULL;