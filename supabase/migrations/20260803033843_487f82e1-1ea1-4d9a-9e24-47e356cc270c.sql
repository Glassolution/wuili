ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS debt_settled_at timestamptz;

-- 1) Saldo: débito só conta se ainda não foi abatido em um saque
CREATE OR REPLACE FUNCTION public.rpc_affiliate_withdrawal_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_released numeric := 0;
  v_holding numeric := 0;
  v_locked numeric := 0;
  v_debt numeric := 0;
  v_available numeric := 0;
  v_is_first boolean := true;
  v_pending jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT upper(a.code) INTO v_code FROM public.affiliates a WHERE a.user_id = v_uid LIMIT 1;
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('has_affiliate', false, 'available', 0, 'released_gross', 0,
      'holding', 0, 'pending_locked', 0, 'debt', 0, 'minimum', 20, 'is_first_withdrawal', true,
      'has_pending_request', false, 'pending_request', null);
  END IF;

  SELECT
    COALESCE(SUM(c.commission_value) FILTER (
      WHERE c.status = 'approved' AND c.refunded_at IS NULL AND c.payout_status <> 'paid'
        AND c.created_at <= now() - interval '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM public.affiliate_withdrawal_items i
          JOIN public.affiliate_withdrawal_requests w ON w.id = i.withdrawal_id
          WHERE i.conversion_id = c.id AND w.status IN ('pending','approved','paid')
        )
    ), 0),
    COALESCE(SUM(c.commission_value) FILTER (
      WHERE c.status = 'approved' AND c.refunded_at IS NULL AND c.payout_status <> 'paid'
        AND c.created_at > now() - interval '7 days'
    ), 0),
    COALESCE(SUM(c.commission_value) FILTER (
      WHERE c.refunded_at IS NULL AND c.payout_status <> 'paid'
        AND EXISTS (
          SELECT 1 FROM public.affiliate_withdrawal_items i
          JOIN public.affiliate_withdrawal_requests w ON w.id = i.withdrawal_id
          WHERE i.conversion_id = c.id AND w.status IN ('pending','approved')
        )
    ), 0),
    COALESCE(SUM(c.commission_value) FILTER (
      WHERE c.status = 'refunded' AND c.payout_status = 'paid' AND c.debt_settled_at IS NULL
    ), 0)
  INTO v_released, v_holding, v_locked, v_debt
  FROM public.affiliate_conversions c
  WHERE upper(c.affiliate_code) = v_code;

  v_available := GREATEST(v_released - v_debt, 0);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.affiliate_withdrawal_requests w
    WHERE w.user_id = v_uid AND w.status IN ('approved','paid')
  ) INTO v_is_first;

  SELECT to_jsonb(t) INTO v_pending FROM (
    SELECT w.id, w.amount, w.status, w.requested_at, w.pix_key_type,
           (SELECT COUNT(*) FROM public.affiliate_withdrawal_items i WHERE i.withdrawal_id = w.id) AS items_count
    FROM public.affiliate_withdrawal_requests w
    WHERE w.user_id = v_uid AND w.status = 'pending'
    LIMIT 1
  ) t;

  RETURN jsonb_build_object(
    'has_affiliate', true,
    'affiliate_code', v_code,
    'available', round(v_available, 2),
    'released_gross', round(v_released, 2),
    'holding', round(v_holding, 2),
    'pending_locked', round(v_locked, 2),
    'debt', round(v_debt, 2),
    'minimum', CASE WHEN v_is_first THEN 20 ELSE 1 END,
    'is_first_withdrawal', v_is_first,
    'has_pending_request', v_pending IS NOT NULL,
    'pending_request', v_pending
  );
END;
$function$;

-- 2) Pedido de saque: quita o débito abatido para não descontar de novo
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

  -- O débito já foi abatido do valor solicitado: marca como quitado para não
  -- ser descontado novamente em saques futuros.
  IF v_debt > 0 THEN
    UPDATE public.affiliate_conversions c
      SET debt_settled_at = now()
      FROM _debts d
      WHERE c.id = d.id AND c.debt_settled_at IS NULL;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'amount', v_available, 'status', 'pending', 'debt_settled', v_debt);
END;
$function$;

-- 3) Cancelamento: devolve o débito quitado por esse pedido
CREATE OR REPLACE FUNCTION public.rpc_affiliate_cancel_withdrawal(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_rows int;
  v_code text;
  v_requested timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT w.affiliate_code, w.requested_at INTO v_code, v_requested
  FROM public.affiliate_withdrawal_requests w
  WHERE w.id = p_id AND w.user_id = v_uid AND w.status = 'pending';

  UPDATE public.affiliate_withdrawal_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_id AND user_id = v_uid AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN RAISE EXCEPTION 'not_cancellable'; END IF;

  UPDATE public.affiliate_conversions c
    SET debt_settled_at = NULL
    WHERE upper(c.affiliate_code) = upper(v_code)
      AND c.status = 'refunded' AND c.payout_status = 'paid'
      AND c.debt_settled_at IS NOT NULL
      AND c.debt_settled_at >= v_requested;

  RETURN true;
END;
$function$;

-- 4) Admin: listar solicitações de saque
CREATE OR REPLACE FUNCTION public.rpc_admin_withdrawal_requests(p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.requested_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT w.id, w.affiliate_code, w.amount, w.status, w.pix_key, w.pix_key_type,
           w.admin_note, w.requested_at, w.decided_at, w.paid_at, w.cancelled_at,
           pr.display_name, pr.email,
           (SELECT COUNT(*) FROM public.affiliate_withdrawal_items i WHERE i.withdrawal_id = w.id) AS items_count
    FROM public.affiliate_withdrawal_requests w
    LEFT JOIN public.profiles pr ON pr.user_id = w.user_id
    WHERE p_status IS NULL OR p_status = '' OR p_status = 'all' OR w.status = p_status
    ORDER BY w.requested_at DESC
    LIMIT 200
  ) t;

  RETURN jsonb_build_object('requests', v_rows);
END;
$function$;

-- 5) Admin: decidir sobre a solicitação
CREATE OR REPLACE FUNCTION public.rpc_admin_withdrawal_decide(p_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_new text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT status INTO v_status FROM public.affiliate_withdrawal_requests WHERE id = p_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  IF p_action = 'approve' THEN
    IF v_status <> 'pending' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    v_new := 'approved';
    UPDATE public.affiliate_withdrawal_requests
      SET status = v_new, decided_at = now(), admin_note = COALESCE(nullif(btrim(coalesce(p_note,'')),''), admin_note)
      WHERE id = p_id;

  ELSIF p_action = 'reject' THEN
    IF v_status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    v_new := 'rejected';
    UPDATE public.affiliate_withdrawal_requests
      SET status = v_new, decided_at = now(), admin_note = COALESCE(nullif(btrim(coalesce(p_note,'')),''), admin_note)
      WHERE id = p_id;
    -- devolve o débito eventualmente quitado por este pedido
    UPDATE public.affiliate_conversions c
      SET debt_settled_at = NULL
      FROM public.affiliate_withdrawal_requests w
      WHERE w.id = p_id
        AND upper(c.affiliate_code) = upper(w.affiliate_code)
        AND c.status = 'refunded' AND c.payout_status = 'paid'
        AND c.debt_settled_at IS NOT NULL
        AND c.debt_settled_at >= w.requested_at;

  ELSIF p_action = 'pay' THEN
    IF v_status <> 'approved' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    v_new := 'paid';
    UPDATE public.affiliate_withdrawal_requests
      SET status = v_new, paid_at = now(), decided_at = COALESCE(decided_at, now()),
          admin_note = COALESCE(nullif(btrim(coalesce(p_note,'')),''), admin_note)
      WHERE id = p_id;
    UPDATE public.affiliate_conversions c
      SET payout_status = 'paid', paid_at = COALESCE(c.paid_at, now())
      FROM public.affiliate_withdrawal_items i
      WHERE i.withdrawal_id = p_id AND i.conversion_id = c.id;

  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;

  RETURN jsonb_build_object('id', p_id, 'status', v_new);
END;
$function$;