WITH real_pm AS (
  SELECT charge_id,
         MAX(payload->'currentCycle'->>'paymentMethod') AS pm
  FROM public.validapay_webhook_events
  WHERE charge_id IS NOT NULL
    AND payload->'currentCycle'->>'paymentMethod' IS NOT NULL
  GROUP BY charge_id
)
UPDATE public.subscriptions s
SET payment_method = CASE WHEN lower(r.pm) IN ('creditcard','credit_card','card') THEN 'credit_card' ELSE 'pix' END,
    updated_at = now()
FROM real_pm r
WHERE s.validapay_charge_id = r.charge_id
  AND s.payment_method IS DISTINCT FROM (CASE WHEN lower(r.pm) IN ('creditcard','credit_card','card') THEN 'credit_card' ELSE 'pix' END);