CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invited_user_id uuid,
  payment_ref text NOT NULL,
  months integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'pending',
  applied_subscription_id uuid,
  previous_period_end timestamptz,
  new_period_end timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_referral_unique ON public.referral_rewards(referral_id);
CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_payment_unique ON public.referral_rewards(payment_ref);
CREATE INDEX IF NOT EXISTS referral_rewards_inviter_idx ON public.referral_rewards(inviter_id, status);

GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inviters can view their referral rewards" ON public.referral_rewards;
CREATE POLICY "Inviters can view their referral rewards"
ON public.referral_rewards FOR SELECT TO authenticated
USING (inviter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all referral rewards" ON public.referral_rewards;
CREATE POLICY "Admins can view all referral rewards"
ON public.referral_rewards FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_pending_referral_rewards(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.referral_rewards%ROWTYPE;
  v_sub RECORD;
  v_new_end timestamptz;
  v_count integer := 0;
BEGIN
  FOR v_reward IN
    SELECT * FROM public.referral_rewards
    WHERE inviter_id = p_user_id AND status = 'pending'
    ORDER BY created_at
  LOOP
    SELECT id, current_period_end INTO v_sub
    FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;

    IF v_sub.id IS NULL THEN
      EXIT;
    END IF;

    v_new_end := GREATEST(COALESCE(v_sub.current_period_end, now()), now())
                 + (v_reward.months || ' months')::interval;

    UPDATE public.subscriptions
    SET current_period_end = v_new_end,
        next_charge_at = v_new_end,
        updated_at = now()
    WHERE id = v_sub.id;

    UPDATE public.referral_rewards
    SET status = 'applied',
        applied_subscription_id = v_sub.id,
        previous_period_end = v_sub.current_period_end,
        new_period_end = v_new_end,
        applied_at = now(),
        updated_at = now()
    WHERE id = v_reward.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_referral_inviter_months(
  p_referral_id uuid,
  p_payment_ref text,
  p_months integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_reward_id uuid;
BEGIN
  SELECT * INTO v_ref FROM public.referrals WHERE id = p_referral_id;
  IF v_ref.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'referral_not_found');
  END IF;

  INSERT INTO public.referral_rewards (referral_id, inviter_id, invited_user_id, payment_ref, months, status)
  VALUES (p_referral_id, v_ref.inviter_id, v_ref.invited_user_id, p_payment_ref, COALESCE(p_months, 3), 'pending')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_reward_id;

  IF v_reward_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_granted');
  END IF;

  PERFORM public.apply_pending_referral_rewards(v_ref.inviter_id);

  RETURN (
    SELECT jsonb_build_object(
      'ok', true,
      'code', CASE WHEN status = 'applied' THEN 'applied' ELSE 'queued' END,
      'reward_id', id,
      'months', months,
      'new_period_end', new_period_end
    )
    FROM public.referral_rewards WHERE id = v_reward_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_referral_inviter_months(uuid, text, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_pending_referral_rewards(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_inviter_months(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_pending_referral_rewards(uuid) TO service_role;