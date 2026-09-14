-- Registro de uso do Atlas, por requisição.
--
-- Serve para medir custo real em vez de estimar. Uma linha por resposta do
-- Atlas, inclusive as que não chamam o modelo: sem elas não dá para saber que
-- fatia da conversa é IA de verdade e que fatia é lógica de código.
--
-- Escrita só pela Edge Function (service role). O usuário lê apenas o próprio
-- histórico.

CREATE TABLE IF NOT EXISTS public.atlas_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 'modelo' quando a resposta veio do LLM, 'codigo' quando veio de texto fixo.
  origem text NOT NULL CHECK (origem IN ('modelo', 'codigo')),

  -- Em que ponto da conversa a resposta foi produzida. Ex: 'guia_passo_2',
  -- 'pergunta_livre', 'conversa_solta', 'recusa', 'fallback_gateway'.
  etapa text,

  modelo text,

  -- NULL quando a resposta não passou pelo modelo, para não confundir
  -- "não usou" com "usou e custou zero".
  tokens_entrada integer,
  tokens_saida integer,
  tokens_cache integer,
  tokens_total integer,

  duracao_ms integer,
  erro text
);

COMMENT ON TABLE public.atlas_usage_logs IS
  'Uma linha por resposta do Atlas. origem=modelo tem tokens; origem=codigo tem tokens NULL.';

-- Consulta típica é "quanto gastei nos últimos N dias", por isso a data manda
-- no índice. O parcial acelera os relatórios de custo, que só olham o modelo.
CREATE INDEX IF NOT EXISTS atlas_usage_logs_created_at_idx
  ON public.atlas_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS atlas_usage_logs_modelo_created_at_idx
  ON public.atlas_usage_logs (created_at DESC)
  WHERE origem = 'modelo';

CREATE INDEX IF NOT EXISTS atlas_usage_logs_user_created_at_idx
  ON public.atlas_usage_logs (user_id, created_at DESC);

ALTER TABLE public.atlas_usage_logs ENABLE ROW LEVEL SECURITY;

-- Sem policy de INSERT/UPDATE/DELETE de propósito: só a service role escreve,
-- e ela ignora RLS. Cliente autenticado não consegue forjar registro de custo.
DROP POLICY IF EXISTS "atlas_usage_logs_select_own" ON public.atlas_usage_logs;
CREATE POLICY "atlas_usage_logs_select_own"
  ON public.atlas_usage_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
