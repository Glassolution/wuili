ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS lifetime_match_source text;
COMMENT ON COLUMN public.subscriptions.lifetime_match_source IS 'Como a recuperação vitalícia achou a cobrança: email (da conta) ou time (só por valor e horário). Permite auditar ativações sem confirmação por email.';

-- Uma cobrança só pode ativar um vitalício. Com duplicatas já gravadas o índice não pode
-- ser criado: avisa em vez de travar a migration, pois decidir qual linha fica é manual.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE purchase_kind = 'lifetime' AND validapay_charge_id IS NOT NULL
    GROUP BY validapay_charge_id HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'subscriptions_lifetime_charge_unique não criado: há cobranças vitalícias duplicadas';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_lifetime_charge_unique
      ON public.subscriptions (validapay_charge_id)
      WHERE purchase_kind = 'lifetime' AND validapay_charge_id IS NOT NULL;
  END IF;
END $$;
