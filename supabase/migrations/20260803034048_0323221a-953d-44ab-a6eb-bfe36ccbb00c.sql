CREATE OR REPLACE FUNCTION public.rpc_affiliate_request_withdrawal(p_pix_key text DEFAULT NULL::text, p_pix_key_type text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_debt numeric := 0;
  v_released numeric := 0;
  v_available numeric := 0;
  v_min numeric;
  v_is_first boolean;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT upper(a.code) INTO v_code FROM public.affiliates a WHERE a.user_id = v_uid LIMIT 1;
  IF v_code IS NULL THEN RAISE EXCEPTION 'no_affiliate'; END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_withdrawal_requests w WHERE w.user_id = v_uid AND w.status = 'pending') THEN
    RAISE EXCEPTION 'already_pending';
  END IF;

  DROP TABLE IF EXISTS _eligible;
  DROP TABLE IF EXISTS _debts;

  CREATE TEMP TABLE _eligible ON COMMIT DROP AS
    SELECT c.id, c.commission_value
    FROM public.affiliate_conversions c
    WHERE upper(c.affiliate_code) = v_code
      AND c.status = 'approved' AND c.refunded_at IS NULL AND c.payout_status <> 'paid'
      AND c.created_at <= now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.affiliate_withdrawal_items i
        JOIN public.affiliate_withdrawal_requests w ON w.id = i.withdrawal_id
        WHERE i.conversion_id = c.id AND w.status IN ('pending','approved','paid')
      );

  SELECT COALESCE(SUM(commission_value), 0) INTO v_released FROM _eligible;

  CREATE TEMP TABLE _debts ON COMMIT DROP AS
    SELECT c.id, c.commission_value
    FROM public.affiliate_conversions c
    WHERE upper(c.affiliate_code) = v_code
      AND c.status = 'refunded' AND c.payout_status = 'paid'
      AND c.debt_settled_at IS NULL;

  SELECT COALESCE(SUM(commission_value), 0) INTO v_debt FROM _debts;

  v_available := round(GREATEST(v_released - v_debt, 0), 2);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.affiliate_withdrawal_requests w
    WHERE w.user_id = v_uid AND w.status IN ('approved','paid')
  ) INTO v_is_first;
  v_min := CASE WHEN v_is_first THEN 20 ELSE 1 END;

  IF v_available <= 0 THEN RAISE EXCEPTION 'no_balance'; END IF;
  IF v_available < v_min THEN RAISE EXCEPTION 'below_minimum'; END IF;

  INSERT INTO public.affiliate_withdrawal_requests (user_id, affiliate_code, amount, status, pix_key, pix_key_type)
  VALUES (v_uid, v_code, v_available, 'pending', nullif(btrim(coalesce(p_pix_key,'')),''), nullif(btrim(coalesce(p_pix_key_type,'')),''))
  RETURNING id INTO v_id;

  INSERT INTO public.affiliate_withdrawal_items (withdrawal_id, conversion_id, amount)
  SELECT v_id, e.id, e.commission_value FROM _eligible e;

  IF v_debt > 0 THEN
    UPDATE public.affiliate_conversions c
      SET debt_settled_at = now()
      FROM _debts d
      WHERE c.id = d.id AND c.debt_settled_at IS NULL;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'amount', v_available, 'status', 'pending', 'debt_settled', v_debt);
END;
$function$;