ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS shipping_label_wait_alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dropship_orders_refund_status_check'
      AND conrelid = 'public.dropship_orders'::regclass
  ) THEN
    ALTER TABLE public.dropship_orders
      ADD CONSTRAINT dropship_orders_refund_status_check
      CHECK (refund_status IN ('not_required', 'pending', 'requested', 'succeeded', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dropship_orders_shipping_label_wait_idx
  ON public.dropship_orders (created_at)
  WHERE needs_shipping_label = true
    AND etiqueta_ml_url IS NULL
    AND shipping_label_wait_alerted_at IS NULL;

CREATE INDEX IF NOT EXISTS dropship_orders_refund_pending_idx
  ON public.dropship_orders (updated_at)
  WHERE refund_required = true
    AND refund_status IN ('pending', 'failed');

UPDATE public.dropship_orders
SET needs_shipping_label = true
WHERE etiqueta_ml_url IS NULL;
