CREATE TABLE public.affiliate_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  affiliate_code text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected','cancelled')),
  pix_key text,
  pix_key_type text,
  admin_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.affiliate_withdrawal_requests TO authenticated;
GRANT ALL ON public.affiliate_withdrawal_requests TO service_role;
ALTER TABLE public.affiliate_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Afiliado ve seus saques" ON public.affiliate_withdrawal_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admin gerencia saques" ON public.affiliate_withdrawal_requests
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_awr_user ON public.affiliate_withdrawal_requests(user_id, status);
CREATE UNIQUE INDEX idx_awr_one_pending ON public.affiliate_withdrawal_requests(user_id) WHERE status = 'pending';

CREATE TRIGGER trg_awr_updated_at BEFORE UPDATE ON public.affiliate_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.affiliate_withdrawal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.affiliate_withdrawal_requests(id) ON DELETE CASCADE,
  conversion_id uuid NOT NULL REFERENCES public.affiliate_conversions(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  is_live boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_withdrawal_items TO authenticated;
GRANT ALL ON public.affiliate_withdrawal_items TO service_role;
ALTER TABLE public.affiliate_withdrawal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Afiliado ve itens dos seus saques" ON public.affiliate_withdrawal_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.affiliate_withdrawal_requests w
      WHERE w.id = withdrawal_id AND (w.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE INDEX idx_awi_withdrawal ON public.affiliate_withdrawal_items(withdrawal_id);

-- Uma comissão só pode estar em um saque "vivo" (pending/approved/paid).
CREATE UNIQUE INDEX idx_awi_conversion_live
  ON public.affiliate_withdrawal_items(conversion_id)
  WHERE is_live;

CREATE OR REPLACE FUNCTION public.affiliate_withdrawal_sync_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.affiliate_withdrawal_items
    SET is_live = (NEW.status IN ('pending','approved','paid'))
    WHERE withdrawal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_awr_sync_items AFTER UPDATE ON public.affiliate_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_withdrawal_sync_items();

-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.rpc_affiliate_withdrawal_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    COALESCE(SUM(c.commission_value) FILTER (WHERE c.status = 'refunded' AND c.payout_status = 'paid'), 0)
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
$$;

CREATE OR REPLACE FUNCTION public.rpc_affiliate_request_withdrawal(p_pix_key text DEFAULT NULL, p_pix_key_type text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT COALESCE(SUM(c.commission_value), 0) INTO v_debt
  FROM public.affiliate_conversions c
  WHERE upper(c.affiliate_code) = v_code AND c.status = 'refunded' AND c.payout_status = 'paid';

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

  RETURN jsonb_build_object('id', v_id, 'amount', v_available, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_affiliate_cancel_withdrawal(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.affiliate_withdrawal_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_id AND user_id = v_uid AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN RAISE EXCEPTION 'not_cancellable'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_affiliate_withdrawal_history()
RETURNS TABLE(id uuid, amount numeric, status text, requested_at timestamptz, decided_at timestamptz, paid_at timestamptz, cancelled_at timestamptz, pix_key_type text, admin_note text, items_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.amount, w.status, w.requested_at, w.decided_at, w.paid_at, w.cancelled_at,
         w.pix_key_type, w.admin_note,
         (SELECT COUNT(*) FROM public.affiliate_withdrawal_items i WHERE i.withdrawal_id = w.id)
  FROM public.affiliate_withdrawal_requests w
  WHERE w.user_id = auth.uid()
  ORDER BY w.requested_at DESC
  LIMIT 50;
$$;