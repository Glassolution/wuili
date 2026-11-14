CREATE TABLE public.plan_upgrade_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 subscription_id uuid NOT NULL REFERENCES public.subscriptions(id), provider_subscription_id text NOT NULL,
 from_plan text NOT NULL, to_plan text NOT NULL, amount numeric(12,2) NOT NULL, recurring_amount numeric(12,2) NOT NULL,
 period_start timestamptz, period_end timestamptz NOT NULL, next_charge_date timestamptz NOT NULL,
 provider_item_id text NOT NULL, target_price_id text NOT NULL, difference_price_id text,
 charge_id text UNIQUE, state text NOT NULL DEFAULT 'quoted' CHECK (state IN ('quoted','charging','awaiting_payment','paid','replacing','completed','review','expired')),
 provider_response jsonb, error text, expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_upgrade_requests TO authenticated;
GRANT ALL ON public.plan_upgrade_requests TO service_role;
ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own upgrade" ON public.plan_upgrade_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE UNIQUE INDEX plan_upgrade_one_open ON public.plan_upgrade_requests(subscription_id) WHERE state NOT IN ('completed','expired');
CREATE INDEX plan_upgrade_recovery ON public.plan_upgrade_requests(state,updated_at) WHERE state IN ('charging','awaiting_payment','paid','replacing');
CREATE FUNCTION public.complete_plan_upgrade(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.plan_upgrade_requests; s public.subscriptions;
BEGIN
 SELECT * INTO r FROM public.plan_upgrade_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF r.state='completed' THEN RETURN true; END IF;
 IF r.state NOT IN ('paid','replacing') THEN RAISE EXCEPTION 'upgrade_not_paid'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE id=r.subscription_id FOR UPDATE;
 IF s.status <> 'active' OR s.cancelled_at IS NOT NULL OR s.cancel_at_period_end OR s.plan <> r.from_plan
 OR s.current_period_end IS DISTINCT FROM r.period_end OR s.current_period_start IS DISTINCT FROM r.period_start
 OR s.validapay_subscription_id <> r.provider_subscription_id THEN RAISE EXCEPTION 'upgrade_subscription_changed'; END IF;
 UPDATE public.subscriptions SET plan=r.to_plan,amount=r.recurring_amount,next_charge_amount=r.recurring_amount,updated_at=now() WHERE id=s.id;
 UPDATE public.profiles SET plano=r.to_plan WHERE user_id=r.user_id;
 UPDATE public.plan_upgrade_requests SET state='completed',error=NULL,updated_at=now() WHERE id=r.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.complete_plan_upgrade(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_plan_upgrade(uuid) TO service_role;