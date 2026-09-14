ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.affiliates
  ALTER COLUMN is_active SET DEFAULT false;

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

CREATE OR REPLACE FUNCTION public.rpc_admin_accept_affiliate_application(
  p_affiliate_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_affiliate public.affiliates%rowtype;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  v_code := upper(btrim(coalesce(p_affiliate_code, '')));

  IF v_code = '' THEN
    RAISE EXCEPTION 'invalid_affiliate';
  END IF;

  UPDATE public.affiliates
  SET is_active = true,
      updated_at = now()
  WHERE upper(code) = v_code
  RETURNING * INTO v_affiliate;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN jsonb_build_object(
    'code', upper(v_affiliate.code),
    'user_id', v_affiliate.user_id,
    'is_active', v_affiliate.is_active,
    'updated_at', v_affiliate.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_accept_affiliate_application(text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_accept_affiliate_application(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_accept_affiliate_application(text) TO service_role;
