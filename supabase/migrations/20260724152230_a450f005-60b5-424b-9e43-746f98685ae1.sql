-- Reconciliar pedido pendente do Victor Alves: MP já devolveu o valor
-- (refund #3194498884, R$79,80, suspected_fraud em 24/07).
UPDATE public.refund_requests
SET status = 'refunded_by_mp',
    processed_at = now(),
    updated_at = now(),
    provider_response = jsonb_build_object(
      'origin', 'reconciled_after_mp_auto_refund',
      'mp_refund_id', 3194498884,
      'amount', 79.80,
      'reason', 'suspected_fraud'
    )
WHERE id = '0e8495cf-9baf-4534-8af4-d1c1c42a67ba'
  AND status = 'pending';

UPDATE public.subscriptions
SET status = 'cancelled', updated_at = now()
WHERE id = '9a4e0dcc-82bc-44ee-928d-58ed0579900c';

UPDATE public.profiles
SET plano = 'gratis',
    refund_cooldown_until = now() + interval '30 days'
WHERE user_id = 'b07ebe54-604a-4334-a424-90da35151633';