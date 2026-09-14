ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_conversions_payout_status_check'
  ) THEN
    ALTER TABLE public.affiliate_conversions
      ADD CONSTRAINT affiliate_conversions_payout_status_check
      CHECK (payout_status IN ('pending', 'paid'));
  END IF;
END $$;