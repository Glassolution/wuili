-- Documenta a regra oficial de comissão de afiliado (corrige comentário
-- desatualizado da migration 20260814162500, que dizia "uma única vez").
-- Regra correta: 30% no PRIMEIRO pagamento e 20% em TODAS as renovações,
-- recorrente, mês a mês, sem limite de ciclos e sem prazo de expiração.
COMMENT ON TABLE public.affiliate_conversions IS
  'Comissões de afiliado. Regra oficial: 30% no primeiro pagamento (cycle_type=first) e 20% em todas as renovações (cycle_type=renewal), recorrente e sem prazo de expiração enquanto o indicado continuar pagando.';

COMMENT ON COLUMN public.affiliates.commission_rate IS
  'Taxa base do primeiro ciclo (0.30). Renovações usam 0.20 automaticamente, sem limite de ciclos.';

COMMENT ON COLUMN public.affiliate_settings.commission_rate IS
  'Taxa padrão do primeiro ciclo (0.30). Renovações usam 0.20, recorrente e sem expiração.';