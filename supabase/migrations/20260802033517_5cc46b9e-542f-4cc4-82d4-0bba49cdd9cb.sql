UPDATE public.refund_requests
SET status = 'pending',
    processed_at = NULL,
    provider_response = jsonb_build_object('error','INSUFFICIENT_BALANCE','message','Saldo insuficiente para devolução na ValidaPay'),
    updated_at = now()
WHERE id = '55aa5675-5d73-42b9-9322-11953fa4fa15';

UPDATE public.subscriptions
SET status = 'active', updated_at = now()
WHERE id = 'ff92838b-8bb8-416d-829f-d16a34a43958';

UPDATE public.profiles
SET plano = 'base', refund_cooldown_until = NULL, updated_at = now()
WHERE user_id = '2af69ba1-536e-42a9-970f-ef69508b7880';