-- Origem completa do cadastro para os anúncios da Velo no TikTok.
-- ttclid: identificador do clique no anúncio, que o TikTok coloca no link.
-- tiktok_ttp: cookie _ttp do pixel, que identifica o navegador para o TikTok.
-- Os dois serão usados pela Events API quando o pagamento for confirmado.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ttclid text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ttclid_captured_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tiktok_ttp text;
