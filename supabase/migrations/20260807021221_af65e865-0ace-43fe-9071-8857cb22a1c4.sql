ALTER TABLE public.profiles DISABLE TRIGGER prevent_self_admin_escalation_trg;

UPDATE public.profiles
SET plano = 'base'
WHERE lower(email) = 'felipe@gmail.com';

ALTER TABLE public.profiles ENABLE TRIGGER prevent_self_admin_escalation_trg;