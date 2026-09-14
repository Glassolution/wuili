ALTER TABLE public.profiles DISABLE TRIGGER prevent_self_admin_escalation_trg;

UPDATE public.profiles
SET plano = 'base', refund_cooldown_until = NULL
WHERE lower(email) = 'lucasvfalcao11@gmail.com';

ALTER TABLE public.profiles ENABLE TRIGGER prevent_self_admin_escalation_trg;