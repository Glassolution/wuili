-- ============================================================
-- 1) affiliates: padroniza commission_rate como fração e alinha ref/link ao code
-- ============================================================

UPDATE public.affiliates
SET commission_rate = commission_rate / 100.0
WHERE commission_rate IS NOT NULL AND commission_rate > 1;

UPDATE public.affiliates
SET ref = code,
    link = 'https://velods.com.br/ref/' || code
WHERE code IS NOT NULL
  AND (ref IS DISTINCT FROM code OR link IS DISTINCT FROM 'https://velods.com.br/ref/' || code);

ALTER TABLE public.affiliates
  ALTER COLUMN commission_rate SET DEFAULT 0.2;

ALTER TABLE public.affiliates
  DROP CONSTRAINT IF EXISTS affiliates_commission_rate_fraction_check;
ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_commission_rate_fraction_check
  CHECK (commission_rate IS NULL OR (commission_rate > 0 AND commission_rate <= 1));

-- Mantém ref/link sempre sincronizados com code e a taxa sempre em fração
CREATE OR REPLACE FUNCTION public.affiliates_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_rate IS NOT NULL AND NEW.commission_rate > 1 THEN
    NEW.commission_rate := NEW.commission_rate / 100.0;
  END IF;

  IF NEW.code IS NOT NULL THEN
    NEW.ref := NEW.code;
    NEW.link := 'https://velods.com.br/ref/' || NEW.code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliates_normalize ON public.affiliates;
CREATE TRIGGER trg_affiliates_normalize
  BEFORE INSERT OR UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.affiliates_normalize();

-- ============================================================
-- 2) affiliate_settings: padroniza como fração
-- ============================================================

UPDATE public.affiliate_settings
SET commission_rate = commission_rate / 100.0
WHERE commission_rate > 1;

ALTER TABLE public.affiliate_settings
  ALTER COLUMN commission_rate SET DEFAULT 0.2;

ALTER TABLE public.affiliate_settings
  DROP CONSTRAINT IF EXISTS affiliate_settings_commission_rate_fraction_check;
ALTER TABLE public.affiliate_settings
  ADD CONSTRAINT affiliate_settings_commission_rate_fraction_check
  CHECK (commission_rate > 0 AND commission_rate <= 1);

-- ============================================================
-- 3) affiliate_conversions: ciclo de cobrança + taxa em fração
-- ============================================================

ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS cycle_type text NOT NULL DEFAULT 'first',
  ADD COLUMN IF NOT EXISTS cycle_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reference_month date NOT NULL DEFAULT date_trunc('month', now())::date,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- Linhas legadas (se houver) são a primeira assinatura, com mês de referência do created_at
UPDATE public.affiliate_conversions
SET cycle_type = 'first',
    cycle_number = 1,
    reference_month = date_trunc('month', created_at)::date;

ALTER TABLE public.affiliate_conversions
  DROP CONSTRAINT IF EXISTS affiliate_conversions_cycle_type_check;
ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_cycle_type_check
  CHECK (cycle_type IN ('first', 'renewal'));

ALTER TABLE public.affiliate_conversions
  DROP CONSTRAINT IF EXISTS affiliate_conversions_cycle_number_check;
ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_cycle_number_check
  CHECK (cycle_number >= 1);

-- Coerência: ciclo 1 = primeira assinatura; ciclo >= 2 = renovação
ALTER TABLE public.affiliate_conversions
  DROP CONSTRAINT IF EXISTS affiliate_conversions_cycle_coherence_check;
ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_cycle_coherence_check
  CHECK (
    (cycle_number = 1 AND cycle_type = 'first')
    OR (cycle_number > 1 AND cycle_type = 'renewal')
  );

-- Taxa sempre em fração
UPDATE public.affiliate_conversions
SET commission_rate = commission_rate / 100.0
WHERE commission_rate > 1;

ALTER TABLE public.affiliate_conversions
  ALTER COLUMN commission_rate SET DEFAULT 0.2;

ALTER TABLE public.affiliate_conversions
  DROP CONSTRAINT IF EXISTS affiliate_conversions_commission_rate_fraction_check;
ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_commission_rate_fraction_check
  CHECK (commission_rate > 0 AND commission_rate <= 1);

-- Normaliza código do afiliado (uppercase) e taxa antes de gravar
CREATE OR REPLACE FUNCTION public.affiliate_conversions_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_rate IS NOT NULL AND NEW.commission_rate > 1 THEN
    NEW.commission_rate := NEW.commission_rate / 100.0;
  END IF;

  IF NEW.affiliate_code IS NOT NULL THEN
    NEW.affiliate_code := upper(btrim(NEW.affiliate_code));
  END IF;

  IF NEW.reference_month IS NOT NULL THEN
    NEW.reference_month := date_trunc('month', NEW.reference_month)::date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_conversions_normalize ON public.affiliate_conversions;
CREATE TRIGGER trg_affiliate_conversions_normalize
  BEFORE INSERT OR UPDATE ON public.affiliate_conversions
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_conversions_normalize();

-- ============================================================
-- 4) Unique index por ciclo (permite renovação, bloqueia duplicidade)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_conversions_code_subscriber_cycle_key
  ON public.affiliate_conversions (affiliate_code, subscriber_user_id, cycle_number);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_reference_month
  ON public.affiliate_conversions (reference_month);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_subscriber
  ON public.affiliate_conversions (subscriber_user_id);