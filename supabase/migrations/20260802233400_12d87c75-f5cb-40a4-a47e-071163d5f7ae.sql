-- Backfill histórico do funil de afiliados.
-- ATENÇÃO: os carimbos abaixo são APROXIMAÇÃO HISTÓRICA, não dado real de funil.
-- Conversões criadas antes da Fase 4 (tracking de clique) não têm clique/cadastro/
-- checkout registrados; usamos created_at da própria comissão nas 3 etapas.
INSERT INTO public.affiliate_clicks (
  affiliate_code, visitor_id, signup_user_id, signup_at, reached_payment_at, converted_at, created_at
)
SELECT
  c.affiliate_code,
  'backfill:' || c.id::text AS visitor_id,
  c.subscriber_user_id,
  c.created_at,
  c.created_at,
  c.created_at,
  c.created_at
FROM public.affiliate_conversions c
WHERE c.cycle_number = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.affiliate_clicks k
    WHERE k.affiliate_code = c.affiliate_code
      AND k.signup_user_id = c.subscriber_user_id
  );