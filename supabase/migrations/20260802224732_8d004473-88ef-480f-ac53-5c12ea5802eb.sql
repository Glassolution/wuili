ALTER TABLE public.affiliate_conversions
  DROP CONSTRAINT IF EXISTS affiliate_conversions_status_check;

ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'refunded'::text]));

CREATE INDEX IF NOT EXISTS affiliate_conversions_refunded_at_idx
  ON public.affiliate_conversions (refunded_at)
  WHERE refunded_at IS NOT NULL;