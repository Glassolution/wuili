-- Status da solicitação de afiliado.
--
-- Esta migration cuida SÓ da coluna. As funções de aprovar/rejeitar ficam na
-- migration seguinte (20260808070000), que as dropa e recria recebendo
-- p_user_id uuid — criá-las aqui em (text) só para dropar depois quebrava com
-- "42P13: cannot change return type of existing function", porque a versão que
-- já existe no banco devolve boolean.

ALTER TABLE public.affiliate_applications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.affiliate_applications
  DROP CONSTRAINT IF EXISTS affiliate_applications_status_check;

ALTER TABLE public.affiliate_applications
  ADD CONSTRAINT affiliate_applications_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

UPDATE public.affiliate_applications
SET status = 'pending'
WHERE agreed_terms = true
  AND status IS DISTINCT FROM 'approved'
  AND status IS DISTINCT FROM 'rejected';