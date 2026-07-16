-- Harden self-service escalation: block users from changing is_admin or plano on their own row.
CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.plano := OLD.plano;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Also enforce it at policy level via WITH CHECK so the update is rejected if
-- someone tries to change is_admin/plano to a different value than the current row.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_admin(auth.uid())
    OR (
      is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.user_id = auth.uid())
      AND plano   IS NOT DISTINCT FROM (SELECT p.plano   FROM public.profiles p WHERE p.user_id = auth.uid())
    )
  )
);