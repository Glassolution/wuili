DROP POLICY IF EXISTS "Users can create own refund requests" ON public.refund_requests;
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_pending_standard_per_user
  ON public.refund_requests (user_id)
  WHERE status = 'pending' AND refund_kind = 'standard';