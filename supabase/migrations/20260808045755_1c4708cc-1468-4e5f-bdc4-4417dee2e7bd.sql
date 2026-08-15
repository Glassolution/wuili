UPDATE public.ml_api_circuit
SET open_until = NULL, failure_count = 0, window_started_at = NULL, updated_at = now()
WHERE id = 'mercadolivre';