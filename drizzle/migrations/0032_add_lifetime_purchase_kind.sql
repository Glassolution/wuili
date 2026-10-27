ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS purchase_kind text NOT NULL DEFAULT 'recurring';
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_purchase_kind_check CHECK (purchase_kind IN ('recurring', 'lifetime'));
COMMENT ON COLUMN public.subscriptions.purchase_kind IS 'Lifetime applies only to new one-time purchases; existing subscriptions remain recurring.';
CREATE OR REPLACE FUNCTION public.enforce_lifetime_subscription_period() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.purchase_kind = 'lifetime' THEN
    NEW.current_period_end := NULL;
    NEW.next_charge_at := NULL;
    NEW.next_charge_amount := NULL;
    NEW.cancel_at_period_end := false;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_lifetime_subscription_period BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.enforce_lifetime_subscription_period();