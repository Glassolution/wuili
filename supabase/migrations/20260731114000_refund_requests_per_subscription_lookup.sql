-- Refund eligibility is per subscription/payment, not a lifetime user lock.

create index if not exists idx_refund_requests_user_subscription
  on public.refund_requests (user_id, subscription_id)
  where subscription_id is not null;

create index if not exists idx_refund_requests_user_payment
  on public.refund_requests (user_id, payment_id)
  where payment_id is not null;
