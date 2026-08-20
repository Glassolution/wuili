ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid;

COMMENT ON COLUMN public.affiliates.is_active IS
  'Afiliado aprovado ativo (true) ou temporariamente inativo/pausado (false). Nao confundir com removed_at.';
COMMENT ON COLUMN public.affiliates.removed_at IS
  'Data em que o admin removeu a pessoa do programa. Link para de gerar cliques/comissoes; historico permanece.';

CREATE OR REPLACE FUNCTION public.rpc_record_affiliate_visit(
  p_affiliate_code text,
  p_referrer text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_visitor_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_visitor text;
BEGIN
  v_code := upper(btrim(coalesce(p_affiliate_code, '')));
  IF v_code = '' THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE upper(a.code) = v_code AND a.removed_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  v_visitor := nullif(btrim(coalesce(p_visitor_id, '')), '');

  IF v_visitor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.affiliate_clicks c
    WHERE c.affiliate_code = v_code AND c.visitor_id = v_visitor
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.affiliate_clicks (affiliate_code, referrer, user_agent, visitor_id)
  VALUES (v_code, nullif(btrim(p_referrer), ''), nullif(btrim(p_user_agent), ''), v_visitor);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_affiliate_attach_signup(
  p_affiliate_code text,
  p_visitor_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_visitor text;
  v_click_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  v_code := upper(btrim(coalesce(p_affiliate_code, '')));
  IF v_code = '' THEN RETURN false; END IF;

  SELECT a.user_id INTO v_owner
  FROM public.affiliates a
  WHERE upper(a.code) = v_code AND a.removed_at IS NULL
  LIMIT 1;
  IF v_owner IS NULL OR v_owner = v_uid THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.affiliate_clicks c
    WHERE c.affiliate_code = v_code AND c.signup_user_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  v_visitor := nullif(btrim(coalesce(p_visitor_id, '')), '');

  SELECT c.id INTO v_click_id
  FROM public.affiliate_clicks c
  WHERE c.affiliate_code = v_code
    AND c.signup_user_id IS NULL
    AND (v_visitor IS NOT NULL AND c.visitor_id = v_visitor)
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_click_id IS NULL THEN
    INSERT INTO public.affiliate_clicks (affiliate_code, visitor_id, signup_user_id, signup_at)
    VALUES (v_code, v_visitor, v_uid, now());
  ELSE
    UPDATE public.affiliate_clicks
      SET signup_user_id = v_uid, signup_at = now()
      WHERE id = v_click_id;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_affiliate_mark_reached_payment(
  p_affiliate_code text,
  p_visitor_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  v_code := upper(btrim(coalesce(p_affiliate_code, '')));
  IF v_code = '' THEN RETURN false; END IF;

  SELECT a.user_id INTO v_owner
  FROM public.affiliates a
  WHERE upper(a.code) = v_code AND a.removed_at IS NULL
  LIMIT 1;
  IF v_owner IS NULL OR v_owner = v_uid THEN RETURN false; END IF;

  UPDATE public.affiliate_clicks
    SET reached_payment_at = COALESCE(reached_payment_at, now())
    WHERE affiliate_code = v_code AND signup_user_id = v_uid;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    INSERT INTO public.affiliate_clicks (affiliate_code, visitor_id, signup_user_id, signup_at, reached_payment_at)
    VALUES (v_code, nullif(btrim(coalesce(p_visitor_id, '')), ''), v_uid, now(), now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_admin_affiliates_summary(
  p_from timestamptz DEFAULT (now() - '30 days'::interval),
  p_to timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_funnel jsonb;
  v_commissions jsonb;
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT jsonb_build_object(
    'clicks', COUNT(*),
    'signups', COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL),
    'checkouts', COUNT(*) FILTER (WHERE c.reached_payment_at IS NOT NULL),
    'conversions', COUNT(*) FILTER (WHERE c.converted_at IS NOT NULL)
  )
  INTO v_funnel
  FROM public.affiliate_clicks c
  WHERE c.created_at >= p_from AND c.created_at < p_to;

  SELECT jsonb_build_object(
    'total_value', COALESCE(SUM(v.commission_value), 0),
    'total_count', COUNT(*),
    'pending_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status <> 'paid'), 0),
    'paid_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0),
    'gmv', COALESCE(SUM(v.plan_value), 0)
  )
  INTO v_commissions
  FROM public.affiliate_conversions v
  WHERE v.created_at >= p_from AND v.created_at < p_to;

  WITH conv AS (
    SELECT upper(v.affiliate_code) AS code,
           COUNT(DISTINCT v.subscriber_user_id) AS signups,
           COUNT(DISTINCT v.subscriber_user_id) FILTER (
             WHERE v.status IN ('reached_payment','paid','approved','active','authorized')
           ) AS reached_payment,
           COUNT(DISTINCT v.subscriber_user_id) FILTER (
             WHERE v.status IN ('paid','approved','active','authorized')
           ) AS payers,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status <> 'paid' AND v.status <> 'refunded'), 0) AS commission_pending,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0) AS commission_paid,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.status <> 'refunded'), 0) AS commission_value,
           COALESCE(SUM(v.plan_value), 0) AS gmv,
           COUNT(*) AS conversions
    FROM public.affiliate_conversions v
    GROUP BY 1
  ),
  clicks AS (
    SELECT upper(c.affiliate_code) AS code,
           COUNT(*) AS clicks,
           COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL) AS signups,
           COUNT(*) FILTER (WHERE c.reached_payment_at IS NOT NULL) AS reached_payment
    FROM public.affiliate_clicks c
    GROUP BY 1
  ),
  codes AS (
    SELECT upper(a.code) AS code
    FROM public.affiliates a
    WHERE a.removed_at IS NULL AND COALESCE(btrim(a.code), '') <> ''
    UNION
    SELECT cv.code FROM conv cv WHERE COALESCE(btrim(cv.code), '') <> ''
  )
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'commission_pending')::numeric DESC, r->>'code'), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'affiliate_user_id', COALESCE(a.user_id, ap.user_id),
      'user_id', COALESCE(a.user_id, ap.user_id),
      'code', k.code,
      'affiliate_code', k.code,
      'link', 'https://velods.com.br/ref/' || k.code,
      'affiliate_name',
        COALESCE(
          NULLIF(btrim(pr.display_name), ''),
          NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
          NULLIF(btrim(ap.full_name), ''),
          NULLIF(split_part(COALESCE(au.email, ap.email, ''), '@', 1), ''),
          'Afiliado ' || k.code
        ),
      'display_name',
        COALESCE(NULLIF(btrim(pr.display_name), ''), NULLIF(btrim(ap.full_name), ''), 'Afiliado ' || k.code),
      'affiliate_email', COALESCE(NULLIF(btrim(pr.email), ''), au.email, NULLIF(btrim(ap.email), '')),
      'email', COALESCE(NULLIF(btrim(pr.email), ''), au.email, NULLIF(btrim(ap.email), '')),
      'is_active', COALESCE(a.is_active, false),
      'removed_at', a.removed_at,
      'created_at', COALESCE(a.created_at, ap.created_at, now()),
      'clicks', COALESCE(cl.clicks, 0),
      'signups', GREATEST(COALESCE(cl.signups, 0), COALESCE(cv.signups, 0)),
      'reached_payment', GREATEST(COALESCE(cl.reached_payment, 0), COALESCE(cv.reached_payment, 0)),
      'payers', COALESCE(cv.payers, 0),
      'commission_pending', COALESCE(cv.commission_pending, 0),
      'commission_paid', COALESCE(cv.commission_paid, 0),
      'commission_value', COALESCE(cv.commission_value, 0),
      'conversions', COALESCE(cv.conversions, 0),
      'gmv', COALESCE(cv.gmv, 0)
    ) AS r
    FROM codes k
    LEFT JOIN conv cv ON cv.code = k.code
    LEFT JOIN clicks cl ON cl.code = k.code
    LEFT JOIN public.affiliates a ON upper(a.code) = k.code AND a.removed_at IS NULL
    LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
    LEFT JOIN auth.users au ON au.id = a.user_id
    LEFT JOIN LATERAL (
      SELECT s.user_id, s.full_name, s.email, s.created_at
      FROM public.affiliate_applications s
      WHERE (a.user_id IS NOT NULL AND s.user_id = a.user_id)
         OR (a.user_id IS NULL AND upper(COALESCE(s.affiliate_code, '')) = k.code)
      ORDER BY s.created_at DESC
      LIMIT 1
    ) ap ON true
  ) t;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'funnel', v_funnel,
    'commissions', v_commissions,
    'ranking', v_rows,
    'affiliates', v_rows
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_admin_remove_affiliate(p_user_id uuid DEFAULT NULL, p_code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aff public.affiliates%rowtype;
  v_code text := upper(btrim(coalesce(p_code, '')));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_user_id IS NULL AND v_code = '' THEN
    RAISE EXCEPTION 'invalid_affiliate';
  END IF;

  UPDATE public.affiliates
  SET is_active = false,
      removed_at = COALESCE(removed_at, now()),
      removed_by = auth.uid(),
      updated_at = now()
  WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
     OR (p_user_id IS NULL AND upper(code) = v_code)
  RETURNING * INTO v_aff;

  UPDATE public.affiliate_applications
  SET status = 'removed', updated_at = now()
  WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
     OR (p_user_id IS NULL AND upper(COALESCE(affiliate_code, '')) = v_code);

  RETURN jsonb_build_object(
    'user_id', COALESCE(v_aff.user_id, p_user_id),
    'code', upper(COALESCE(v_aff.code, v_code)),
    'removed_at', COALESCE(v_aff.removed_at, now()),
    'status', 'removed'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_admin_remove_affiliate(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_remove_affiliate(uuid, text) TO authenticated;