-- Fluxo de aprovação de afiliados no admin.
--
-- 1. Aprovar/rejeitar passa a ser chaveado por user_id (a solicitação), não pelo
--    código — antes era impossível aprovar quem ainda não tinha linha em `affiliates`.
-- 2. `rpc_admin_affiliates_summary` passa a listar afiliados ativos mesmo sem
--    conversão no período (antes o ranking nascia de `affiliate_conversions`).
-- 3. `rpc_admin_affiliate_applications` serve a lista + o detalhe do formulário
--    numa chamada só, com identidade já resolvida.

-- ---------------------------------------------------------------------------
-- affiliates.commission_rate está descontinuada
-- ---------------------------------------------------------------------------
-- A taxa é fixa para todo o programa e derivada do ciclo (30% no ciclo 1, 20%
-- nas renovações) em supabase/functions/_shared/affiliateCommission.ts. O valor
-- gravado por conversão fica em `affiliate_conversions.commission_rate`.
COMMENT ON COLUMN public.affiliates.commission_rate IS
  'DESCONTINUADA - nao usar. A taxa e fixa por ciclo (30% ciclo 1 / 20% renovacoes), '
  'calculada em _shared/affiliateCommission.ts e gravada em affiliate_conversions.commission_rate. '
  'Nao existe taxa por afiliado.';

-- ---------------------------------------------------------------------------
-- Portão de ativação (idempotente)
-- ---------------------------------------------------------------------------
-- A policy "Users update own affiliate" é USING (auth.uid() = user_id), então o
-- próprio afiliado consegue dar UPDATE na sua linha — inclusive em is_active.
-- Sem este trigger, qualquer um se auto-aprova e a aprovação pelo admin vira
-- enfeite. Isto também está em 20260808024500, mas repetimos aqui porque aquela
-- migration pode não ter sido aplicada neste banco.
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.affiliates_admin_only_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NOT public.is_admin(auth.uid()) THEN
    NEW.is_active := false;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.is_active IS DISTINCT FROM OLD.is_active
    AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'affiliate_activation_admin_only';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliates_admin_only_activation ON public.affiliates;
CREATE TRIGGER trg_affiliates_admin_only_activation
BEFORE INSERT OR UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.affiliates_admin_only_activation();

-- ---------------------------------------------------------------------------
-- Geração de código (espelha buildAffiliateCode do frontend)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.affiliate_generate_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_hex text;
  v_base text;
  v_tail text;
  v_candidate text;
  v_attempt int := 0;
BEGIN
  SELECT au.email INTO v_email FROM auth.users au WHERE au.id = p_user_id;

  v_hex := regexp_replace(upper(replace(p_user_id::text, '-', '')), '[^A-Z0-9]', '', 'g');

  v_base := left(
    coalesce(nullif(left(regexp_replace(upper(coalesce(split_part(v_email, '@', 1), '')), '[^A-Z0-9]', '', 'g'), 4), ''), 'VELO')
    || coalesce(nullif(left(v_hex, 4), ''), '0000'),
    8
  );
  v_base := rpad(v_base, 8, 'X');
  v_tail := right(v_hex, 4);

  v_candidate := v_base;

  WHILE EXISTS (SELECT 1 FROM public.affiliates a WHERE upper(a.code) = v_candidate) AND v_attempt < 20 LOOP
    v_attempt := v_attempt + 1;
    v_candidate := left(v_base || v_tail, 10 - length(v_attempt::text)) || v_attempt::text;
  END LOOP;

  RETURN v_candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_generate_code(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.affiliate_generate_code(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Lista de solicitações (lista + detalhe do formulário)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_affiliate_applications(
  p_status text DEFAULT 'pending'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text := lower(btrim(coalesce(p_status, 'pending')));
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF v_status NOT IN ('pending', 'approved', 'rejected', 'all') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT COALESCE(jsonb_agg(t.r ORDER BY t.sort_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      COALESCE(ap.updated_at, ap.created_at) AS sort_at,
      jsonb_build_object(
        'user_id', ap.user_id,
        'code', upper(COALESCE(NULLIF(btrim(ap.affiliate_code), ''), a.code, '')),
        'status', COALESCE(ap.status, 'pending'),
        'full_name',
          COALESCE(
            NULLIF(btrim(ap.full_name), ''),
            NULLIF(btrim(pr.display_name), ''),
            NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
            NULLIF(btrim(au.raw_user_meta_data->>'name'), ''),
            NULLIF(split_part(COALESCE(ap.email, au.email, ''), '@', 1), '')
          ),
        'email', COALESCE(NULLIF(btrim(ap.email), ''), NULLIF(btrim(pr.email), ''), au.email),
        'phone', ap.phone,
        'cpf', ap.cpf,
        'socials', ap.socials,
        'audience_range', ap.audience_range,
        'content_niche', ap.content_niche,
        'pix_keys', ap.pix_keys,
        'promotion_plan', ap.promotion_plan,
        'agreed_terms', ap.agreed_terms,
        'created_at', ap.created_at,
        'updated_at', ap.updated_at,
        'is_active', COALESCE(a.is_active, false)
      ) AS r
    FROM public.affiliate_applications ap
    LEFT JOIN public.affiliates a ON a.user_id = ap.user_id
    LEFT JOIN public.profiles pr ON pr.user_id = ap.user_id
    LEFT JOIN auth.users au ON au.id = ap.user_id
    WHERE ap.agreed_terms = true
      AND (v_status = 'all' OR COALESCE(ap.status, 'pending') = v_status)
  ) t;

  RETURN jsonb_build_object('status', v_status, 'applications', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_affiliate_applications(text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliate_applications(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliate_applications(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Aprovar / rejeitar por user_id
-- ---------------------------------------------------------------------------
-- As versões antigas recebiam p_affiliate_code e falhavam com 'not_found' quando
-- o solicitante ainda não tinha linha em `affiliates`.
DROP FUNCTION IF EXISTS public.rpc_admin_accept_affiliate_application(text);
DROP FUNCTION IF EXISTS public.rpc_admin_reject_affiliate_application(text);

CREATE OR REPLACE FUNCTION public.rpc_admin_accept_affiliate_application(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_application public.affiliate_applications%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_code text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_affiliate';
  END IF;

  SELECT * INTO v_application
  FROM public.affiliate_applications
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT * INTO v_affiliate
  FROM public.affiliates
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Solicitante sem link gerado ainda: cria a linha já ativa.
    v_code := upper(COALESCE(
      NULLIF(regexp_replace(upper(btrim(COALESCE(v_application.affiliate_code, ''))), '[^A-Z0-9]', '', 'g'), ''),
      public.affiliate_generate_code(p_user_id)
    ));

    INSERT INTO public.affiliates (user_id, code, ref, link, is_active)
    VALUES (p_user_id, v_code, v_code, 'https://velods.com.br/ref/' || v_code, true)
    RETURNING * INTO v_affiliate;
  ELSE
    UPDATE public.affiliates
    SET is_active = true,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_affiliate;
  END IF;

  UPDATE public.affiliate_applications
  SET status = 'approved',
      affiliate_code = upper(v_affiliate.code),
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', v_affiliate.user_id,
    'code', upper(v_affiliate.code),
    'is_active', v_affiliate.is_active,
    'status', 'approved'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_reject_affiliate_application(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_application public.affiliate_applications%rowtype;
  v_affiliate public.affiliates%rowtype;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_affiliate';
  END IF;

  SELECT * INTO v_application
  FROM public.affiliate_applications
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Rejeitar não cria linha em `affiliates`; só desativa se já existir.
  UPDATE public.affiliates
  SET is_active = false,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_affiliate;

  UPDATE public.affiliate_applications
  SET status = 'rejected',
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'code', upper(COALESCE(v_affiliate.code, v_application.affiliate_code, '')),
    'is_active', false,
    'status', 'rejected'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_accept_affiliate_application(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_accept_affiliate_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_accept_affiliate_application(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_admin_reject_affiliate_application(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_affiliate_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_affiliate_application(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Ranking: afiliado ativo aparece mesmo com zero conversão no período
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_affiliates_summary(
  p_from timestamptz DEFAULT (now() - interval '30 days'),
  p_to timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funnel jsonb;
  v_commissions jsonb;
  v_ranking jsonb;
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
    'pending_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'pending'), 0),
    'pending_count', COUNT(*) FILTER (WHERE v.status = 'pending'),
    'approved_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'approved'), 0),
    'approved_count', COUNT(*) FILTER (WHERE v.status = 'approved'),
    'paid_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0),
    'paid_count', COUNT(*) FILTER (WHERE v.payout_status = 'paid'),
    'refunded_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'refunded'), 0),
    'refunded_count', COUNT(*) FILTER (WHERE v.status = 'refunded'),
    'debt_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'refunded' AND v.payout_status = 'paid'), 0),
    'debt_count', COUNT(*) FILTER (WHERE v.status = 'refunded' AND v.payout_status = 'paid'),
    'gmv', COALESCE(SUM(v.plan_value), 0)
  )
  INTO v_commissions
  FROM public.affiliate_conversions v
  WHERE v.created_at >= p_from AND v.created_at < p_to;

  WITH period_conv AS (
    SELECT upper(v.affiliate_code) AS code,
           COUNT(*) AS conversions,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.status <> 'refunded'), 0) AS commission_value,
           COALESCE(SUM(v.plan_value), 0) AS gmv
    FROM public.affiliate_conversions v
    WHERE v.created_at >= p_from AND v.created_at < p_to
    GROUP BY 1
  ),
  period_clicks AS (
    SELECT upper(c.affiliate_code) AS code,
           COUNT(*) AS clicks,
           COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL) AS signups
    FROM public.affiliate_clicks c
    WHERE c.created_at >= p_from AND c.created_at < p_to
    GROUP BY 1
  ),
  -- Base: todo afiliado aprovado (mesmo sem conversão) + qualquer código que
  -- gerou conversão no período (cobre afiliado desativado depois).
  codes AS (
    SELECT upper(a.code) AS code
    FROM public.affiliates a
    WHERE a.is_active = true AND COALESCE(btrim(a.code), '') <> ''
    UNION
    SELECT pc.code FROM period_conv pc WHERE COALESCE(btrim(pc.code), '') <> ''
  )
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'commission_value')::numeric DESC, r->>'affiliate_code'), '[]'::jsonb)
  INTO v_ranking
  FROM (
    SELECT jsonb_build_object(
      'affiliate_code', k.code,
      'user_id', a.user_id,
      'display_name',
        COALESCE(
          NULLIF(btrim(pr.display_name), ''),
          NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
          NULLIF(btrim(au.raw_user_meta_data->>'name'), ''),
          NULLIF(split_part(au.email, '@', 1), ''),
          'Afiliado ' || k.code
        ),
      'email', COALESCE(NULLIF(btrim(pr.email), ''), au.email),
      'is_active', COALESCE(a.is_active, false),
      'created_at', a.created_at,
      'conversions', COALESCE(x.conversions, 0),
      'commission_value', COALESCE(x.commission_value, 0),
      'gmv', COALESCE(x.gmv, 0),
      'clicks', COALESCE(cl.clicks, 0),
      'signups', COALESCE(cl.signups, 0)
    ) AS r
    FROM codes k
    LEFT JOIN period_conv x ON x.code = k.code
    LEFT JOIN period_clicks cl ON cl.code = k.code
    LEFT JOIN public.affiliates a ON upper(a.code) = k.code
    LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
    LEFT JOIN auth.users au ON au.id = a.user_id
  ) ranked;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'funnel', COALESCE(v_funnel, '{}'::jsonb),
    'commissions', COALESCE(v_commissions, '{}'::jsonb),
    'ranking', v_ranking
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_affiliates_summary(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliates_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliates_summary(timestamptz, timestamptz) TO service_role;