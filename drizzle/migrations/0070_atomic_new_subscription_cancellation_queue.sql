CREATE OR REPLACE FUNCTION public.enqueue_new_subscription_cancellation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_cancelled boolean;
  old_cancelled boolean := false;
BEGIN
  new_cancelled := NEW.cancel_at_period_end OR NEW.cancelled_at IS NOT NULL OR NEW.status IN ('cancelled','refunded','refunded_duplicate','cancel_scheduled');
  IF TG_OP = 'UPDATE' THEN
    old_cancelled := OLD.cancel_at_period_end OR OLD.cancelled_at IS NOT NULL OR OLD.status IN ('cancelled','refunded','refunded_duplicate','cancel_scheduled');
  END IF;
  IF new_cancelled AND NEW.purchase_kind IS DISTINCT FROM 'lifetime'
    AND NEW.provider IS DISTINCT FROM 'sandbox'
    AND NEW.validapay_subscription_id LIKE 'sub\_%' ESCAPE '\'
    AND (NOT old_cancelled OR (TG_OP = 'UPDATE' AND NEW.validapay_subscription_id IS DISTINCT FROM OLD.validapay_subscription_id)) THEN
    INSERT INTO public.provider_cancellation_requests(subscription_id,user_id,provider_subscription_id,reason,state,confirmed_at,next_retry_at)
    VALUES (NEW.id,NEW.user_id,NEW.validapay_subscription_id,coalesce(nullif(NEW.cancellation_reason,''),'Cancelamento registrado na Velo'),
      CASE WHEN NEW.provider_cancelled_at IS NOT NULL THEN 'confirmed' ELSE 'pending' END,
      NEW.provider_cancelled_at, CASE WHEN NEW.provider_cancelled_at IS NULL THEN now() ELSE NULL END)
    ON CONFLICT (subscription_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_new_subscription_cancellation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_new_subscription_cancellation() TO service_role;
CREATE TRIGGER enqueue_new_subscription_cancellation AFTER INSERT OR UPDATE OF status,cancel_at_period_end,cancelled_at,validapay_subscription_id ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.enqueue_new_subscription_cancellation();