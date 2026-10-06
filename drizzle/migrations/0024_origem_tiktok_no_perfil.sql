-- Adiciona colunas de rastreamento de origem (TikTok/UTM) na tabela profiles.
-- Idempotente: IF NOT EXISTS permite reexecutar sem erro; nada é apagado ou alterado.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ttclid TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ttclid_captured_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tiktok_ttp TEXT;