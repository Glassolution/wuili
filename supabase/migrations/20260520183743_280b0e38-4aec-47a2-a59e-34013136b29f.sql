ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS categorias text[],
  ADD COLUMN IF NOT EXISTS disponibilidade_semanal text,
  ADD COLUMN IF NOT EXISTS experiencia text;