
-- AFFILIATES
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own affiliate" ON public.affiliates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own affiliate" ON public.affiliates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own affiliate" ON public.affiliates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all affiliates" ON public.affiliates
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages affiliates" ON public.affiliates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_affiliates_code ON public.affiliates(code);

-- AFFILIATE CLICKS
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_code TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clicks" ON public.affiliate_clicks
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owners view own clicks" ON public.affiliate_clicks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.code = affiliate_clicks.affiliate_code AND a.user_id = auth.uid())
  );
CREATE POLICY "Admins view all clicks" ON public.affiliate_clicks
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages clicks" ON public.affiliate_clicks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_affiliate_clicks_code ON public.affiliate_clicks(affiliate_code);

-- AFFILIATE CONVERSIONS
CREATE TABLE public.affiliate_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_code TEXT NOT NULL,
  subscriber_user_id UUID NOT NULL,
  subscription_id UUID,
  plan_value NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 20,
  commission_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own conversions" ON public.affiliate_conversions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.code = affiliate_conversions.affiliate_code AND a.user_id = auth.uid())
  );
CREATE POLICY "Admins view all conversions" ON public.affiliate_conversions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages conversions" ON public.affiliate_conversions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_affiliate_conversions_code ON public.affiliate_conversions(affiliate_code);

-- AFFILIATE SETTINGS
CREATE TABLE public.affiliate_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  commission_rate NUMERIC NOT NULL DEFAULT 20,
  minimum_payout NUMERIC NOT NULL DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_settings_singleton CHECK (id = 1)
);
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read settings" ON public.affiliate_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.affiliate_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages settings" ON public.affiliate_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.affiliate_settings (id, commission_rate, minimum_payout)
VALUES (1, 20, 50)
ON CONFLICT (id) DO NOTHING;
