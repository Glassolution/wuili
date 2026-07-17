
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','linked','subscribed','invalid','expired')),
  invite_token text NOT NULL UNIQUE,
  inviter_rewarded boolean NOT NULL DEFAULT false,
  invited_rewarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  subscribed_at timestamptz,
  linked_at timestamptz
);

CREATE INDEX referrals_inviter_idx ON public.referrals(inviter_id);
CREATE INDEX referrals_invited_email_idx ON public.referrals(lower(invited_email));
CREATE INDEX referrals_invited_user_idx ON public.referrals(invited_user_id);
CREATE INDEX referrals_token_idx ON public.referrals(invite_token);

-- Um mesmo email não pode ter 2 convites ativos (pending/linked) do mesmo inviter
CREATE UNIQUE INDEX referrals_unique_active_invite
  ON public.referrals (inviter_id, lower(invited_email))
  WHERE status IN ('pending','linked');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviter can view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invited_user_id);

CREATE POLICY "Inviter can insert own referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Inviter can update own referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);

CREATE TRIGGER referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas em subscriptions para rastrear desconto
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_percent numeric,
  ADD COLUMN IF NOT EXISTS original_amount numeric;
