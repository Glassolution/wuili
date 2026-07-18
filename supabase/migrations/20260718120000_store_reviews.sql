-- Avaliações reais deixadas pelos clientes na loja publicada.
--
-- Até aqui os templates exibiam depoimentos, notas e contagens fixos no código
-- ("4.9/5 por 888+ pessoas", "Camila Souza", "1.250 avaliacoes"). Além de
-- contrariar a regra do projeto de nunca usar dado mockado na interface,
-- avaliação inventada em página de venda é publicidade enganosa (CDC art. 37).
-- Esta tabela guarda o que o visitante realmente escreveu.
--
-- Modelo escolhido: visitante anônimo escreve e publica na hora (sem login e
-- sem moderação). Por isso os limites de tamanho e a faixa da nota são
-- garantidos por CHECK no banco, não só na UI.

CREATE TABLE IF NOT EXISTS public.store_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  -- Qual produto do projeto foi avaliado. NULL = avaliação da loja em geral.
  product_id uuid,
  author_name text NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 2 AND 60),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_reviews_project_created_idx
  ON public.store_reviews (project_id, created_at DESC);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

-- Leitura pública: a vitrine é aberta, o visitante não autentica.
DROP POLICY IF EXISTS "store_reviews_public_read" ON public.store_reviews;
CREATE POLICY "store_reviews_public_read"
  ON public.store_reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita pública, mas só para projeto que existe. Os CHECK da tabela cuidam
-- de nota e tamanho; aqui impedimos avaliação órfã/apontando para nada.
DROP POLICY IF EXISTS "store_reviews_public_insert" ON public.store_reviews;
CREATE POLICY "store_reviews_public_insert"
  ON public.store_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_projects p WHERE p.id = project_id)
  );

-- Só o dono do projeto remove uma avaliação (spam/ofensa). Ninguém edita:
-- alterar o texto de um cliente descaracterizaria a avaliação.
DROP POLICY IF EXISTS "store_reviews_owner_delete" ON public.store_reviews;
CREATE POLICY "store_reviews_owner_delete"
  ON public.store_reviews
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );
