ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS signup_user_id uuid,
  ADD COLUMN IF NOT EXISTS signup_at timestamptz,
  ADD COLUMN IF NOT EXISTS reached_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_visitor ON public.affiliate_clicks (affiliate_code, visitor_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_signup_user ON public.affiliate_clicks (signup_user_id) WHERE signup_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_clicks_code_signup_user_uidx ON public.affiliate_clicks (affiliate_code, signup_user_id) WHERE signup_user_id IS NOT NULL;

GRANT SELECT, INSERT ON public.affiliate_clicks TO authenticated;
GRANT INSERT ON public.affiliate_clicks TO anon;
GRANT ALL ON public.affiliate_clicks TO service_role;

-- ── RPC 1: registra o clique/visita no link ─────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_record_affiliate_visit(
  p_affiliate_code text,
  p_referrer text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_visitor_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_visitor text;
BEGIN
  v_code := upper(btrim(coalesce(p_affiliate_code, '')));
  IF v_code = '' THEN RETURN false; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.affiliates a WHERE upper(a.code) = v_code) THEN
    RETURN false;
  END IF;

  v_visitor := nullif(btrim(coalesce(p_visitor_id, '')), '');

  -- dedupe: se ja existe clique desse visitante nesse codigo, nao duplica
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
$$;

GRANT EXECUTE ON FUNCTION public.rpc_record_affiliate_visit(text, text, text, text) TO anon, authenticated;

-- ── RPC 2: associa o cadastro ao clique ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_affiliate_attach_signup(
  p_affiliate_code text,
  p_visitor_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT a.user_id INTO v_owner FROM public.affiliates a WHERE upper(a.code) = v_code LIMIT 1;
  IF v_owner IS NULL OR v_owner = v_uid THEN RETURN false; END IF;

  -- ja associado a esse usuario
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
    -- clique perdido (cookie sem visitor_id, outro device): cria linha de funil
    INSERT INTO public.affiliate_clicks (affiliate_code, visitor_id, signup_user_id, signup_at)
    VALUES (v_code, v_visitor, v_uid, now());
  ELSE
    UPDATE public.affiliate_clicks
      SET signup_user_id = v_uid, signup_at = now()
      WHERE id = v_click_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_affiliate_attach_signup(text, text) TO authenticated;

-- ── RPC 3: marca que chegou no checkout ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_affiliate_mark_reached_payment(
  p_affiliate_code text,
  p_visitor_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  v_code := upper(btrim(coalesce(p_affiliate_code, '')));
  IF v_code = '' THEN RETURN false; END IF;

  SELECT a.user_id INTO v_owner FROM public.affiliates a WHERE upper(a.code) = v_code LIMIT 1;
  IF v_owner IS NULL OR v_owner = v_uid THEN RETURN false; END IF;

  UPDATE public.affiliate_clicks
    SET reached_payment_at = COALESCE(reached_payment_at, now())
    WHERE affiliate_code = v_code AND signup_user_id = v_uid;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- sem cadastro associado ainda: cria a linha ja no estagio de pagamento
    INSERT INTO public.affiliate_clicks (affiliate_code, visitor_id, signup_user_id, signup_at, reached_payment_at)
    VALUES (v_code, nullif(btrim(coalesce(p_visitor_id, '')), ''), v_uid, now(), now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_affiliate_mark_reached_payment(text, text) TO authenticated;

-- ── RPC 4 (service role): carimba conversao quando a comissao ciclo 1 nasce
CREATE OR REPLACE FUNCTION public.rpc_affiliate_mark_converted(
  p_affiliate_code text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_updated int;
BEGIN
  v_code := upper(btrim(coalesce(p_affiliate_code, '')));
  IF v_code = '' OR p_user_id IS NULL THEN RETURN false; END IF;

  UPDATE public.affiliate_clicks
    SET converted_at = COALESCE(converted_at, now()),
        reached_payment_at = COALESCE(reached_payment_at, now())
    WHERE affiliate_code = v_code AND signup_user_id = p_user_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    INSERT INTO public.affiliate_clicks (affiliate_code, signup_user_id, signup_at, reached_payment_at, converted_at)
    VALUES (v_code, p_user_id, now(), now(), now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_affiliate_mark_converted(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_affiliate_mark_converted(text, uuid) TO service_role;