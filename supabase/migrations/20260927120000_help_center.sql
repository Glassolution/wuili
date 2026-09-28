-- Central de Ajuda do Velo.
--
-- Duas tabelas: categorias (menu lateral + cards de acesso rápido) e artigos
-- (conteúdo em Markdown). Leitura pública só do que está publicado; escrita só
-- de admin. A view help_center_documents e a função search_help_articles já
-- entregam o conteúdo no formato que o futuro assistente de suporte por IA vai
-- consultar: uma linha por artigo, com categoria, título, resumo e texto.

CREATE TABLE IF NOT EXISTS public.help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  -- Nome de um ícone do lucide-react (ex.: "Rocket"). O front cai num ícone
  -- padrão quando não reconhece o nome.
  icon text,
  -- Grupo do menu lateral ("Central de ajuda", "Outros"...).
  section text NOT NULL DEFAULT 'Central de ajuda',
  -- Aparece nos cards de acesso rápido do topo.
  featured boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.help_categories(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  -- Uma ou duas frases: aparece abaixo do título e é o que a IA lê primeiro.
  summary text,
  -- Corpo em Markdown (parágrafos, listas numeradas de passos, "> Dica: ...").
  content text NOT NULL DEFAULT '',
  -- Termos que o usuário usaria para perguntar ("pausado", "senha"...).
  keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  position integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  search_vector tsvector,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS help_articles_category_idx ON public.help_articles (category_id, position);
CREATE INDEX IF NOT EXISTS help_articles_status_idx ON public.help_articles (status);
CREATE INDEX IF NOT EXISTS help_articles_search_idx ON public.help_articles USING gin (search_vector);

-- Mantém search_vector e published_at. Trigger (e não coluna gerada) porque
-- array_to_string não é IMMUTABLE.
CREATE OR REPLACE FUNCTION public.help_articles_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', array_to_string(coalesce(NEW.keywords, '{}'), ' ')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'C');

  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS help_articles_before_write ON public.help_articles;
CREATE TRIGGER help_articles_before_write
  BEFORE INSERT OR UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.help_articles_before_write();

DROP TRIGGER IF EXISTS help_categories_updated_at ON public.help_categories;
CREATE TRIGGER help_categories_updated_at
  BEFORE UPDATE ON public.help_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS help_articles_updated_at ON public.help_articles;
CREATE TRIGGER help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Permissões ────────────────────────────────────────────────────────────────
GRANT SELECT ON public.help_categories, public.help_articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.help_categories, public.help_articles TO authenticated;
GRANT ALL ON public.help_categories, public.help_articles TO service_role;

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- As policies de admin ficam só em "authenticated": public.is_admin não pode
-- ser executada por anon, e uma policy que a chame quebraria a leitura pública.
DROP POLICY IF EXISTS "Todos veem categorias da central de ajuda" ON public.help_categories;
CREATE POLICY "Todos veem categorias da central de ajuda"
  ON public.help_categories FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins gerenciam categorias da central de ajuda" ON public.help_categories;
CREATE POLICY "Admins gerenciam categorias da central de ajuda"
  ON public.help_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Todos veem artigos publicados" ON public.help_articles;
CREATE POLICY "Todos veem artigos publicados"
  ON public.help_articles FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Admins gerenciam artigos da central de ajuda" ON public.help_articles;
CREATE POLICY "Admins gerenciam artigos da central de ajuda"
  ON public.help_articles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── Leitura para a IA ─────────────────────────────────────────────────────────
-- Uma linha por artigo publicado, já com a categoria. security_invoker faz a
-- view respeitar o RLS de quem consulta (anon só vê publicado de qualquer jeito).
CREATE OR REPLACE VIEW public.help_center_documents
WITH (security_invoker = true) AS
SELECT
  a.id,
  c.slug AS category_slug,
  c.title AS category_title,
  a.slug,
  a.title,
  a.summary,
  a.content,
  a.keywords,
  '/ajuda/' || c.slug || '/' || a.slug AS path,
  a.published_at,
  a.updated_at
FROM public.help_articles a
JOIN public.help_categories c ON c.id = a.category_id
WHERE a.status = 'published';

GRANT SELECT ON public.help_center_documents TO anon, authenticated, service_role;

-- Busca em português por relevância. É o ponto de entrada do assistente:
-- recebe a pergunta do usuário e devolve os artigos mais próximos.
CREATE OR REPLACE FUNCTION public.search_help_articles(p_query text, p_limit integer DEFAULT 5)
RETURNS TABLE (
  id uuid,
  category_slug text,
  category_title text,
  slug text,
  title text,
  summary text,
  content text,
  path text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('portuguese', coalesce(p_query, '')) AS tsq
  )
  SELECT
    a.id,
    c.slug,
    c.title,
    a.slug,
    a.title,
    a.summary,
    a.content,
    '/ajuda/' || c.slug || '/' || a.slug,
    ts_rank(a.search_vector, q.tsq) AS rank
  FROM public.help_articles a
  JOIN public.help_categories c ON c.id = a.category_id
  CROSS JOIN q
  WHERE a.status = 'published'
    AND a.search_vector @@ q.tsq
  ORDER BY rank DESC, a.position
  LIMIT greatest(1, least(coalesce(p_limit, 5), 20));
$$;

GRANT EXECUTE ON FUNCTION public.search_help_articles(text, integer) TO anon, authenticated, service_role;

-- ── Conteúdo inicial ──────────────────────────────────────────────────────────
-- Categorias pedidas para a primeira versão. Os artigos vêm dos guias que já
-- estavam no ar em "Comunidade e Ajuda" (src/pages/help/guides.ts), agora
-- editáveis pelo admin. Só insere se a categoria ainda não existe, para a
-- migration poder rodar de novo sem duplicar nem sobrescrever edições.
INSERT INTO public.help_categories (slug, title, description, icon, section, featured, position) VALUES
  ('primeiros-passos', 'Primeiros passos', 'Como a Velo funciona e o caminho até a primeira venda.', 'Rocket', 'Central de ajuda', true, 10),
  ('mercado-livre', 'Conexão com Mercado Livre', 'Conectar sua conta, verificação no Mercado Pago, tarifas e saldo.', 'Plug', 'Central de ajuda', true, 20),
  ('publicacao', 'Publicação de produtos', 'Erros ao publicar, anúncios pausados, reprovados ou sem vendas.', 'Send', 'Central de ajuda', false, 30),
  ('pagamentos-e-planos', 'Pagamentos e planos', 'Assinatura, cobranças, reembolso e cancelamento.', 'CreditCard', 'Central de ajuda', true, 40),
  ('conta-e-suporte', 'Conta e suporte', 'Senha, email da conta e como falar com a equipe.', 'LifeBuoy', 'Outros', false, 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position)
SELECT c.id, v.slug, v.title, v.summary, v.content, v.keywords, 'published', v.position
FROM (VALUES
  -- Primeiros passos
  ('primeiros-passos', 'como-a-velo-funciona', 'Como a Velo funciona',
   'Você escolhe produtos do catálogo Velo, personaliza com IA e publica no seu Mercado Livre.',
   E'A Velo reúne produtos de fornecedores brasileiros em um catálogo pronto para vender. Você não precisa ter estoque: escolhe o produto, ajusta o anúncio e publica na sua conta do Mercado Livre.\n\n## O caminho até a primeira publicação\n\n1. Conecte sua conta do Mercado Livre em **Integrações**.\n2. Abra o **Catálogo** e escolha um produto.\n3. Importe o produto para a sua conta.\n4. Use a IA para gerar título e descrição otimizados — revise e ajuste o que quiser.\n5. Publique. O anúncio aparece em **Publicações**.\n\n> **Dica:** para publicar é preciso ter uma assinatura ativa e a conta verificada no Mercado Pago. Veja os artigos de Conexão com Mercado Livre e Pagamentos e planos.',
   ARRAY['começar', 'primeiro acesso', 'como funciona', 'catálogo', 'importar'], 10),

  -- Conexão com Mercado Livre
  ('mercado-livre', 'conectar-conta', 'Como conectar minha conta do Mercado Livre',
   'A conexão é feita uma vez por OAuth oficial do Mercado Livre.',
   E'1. Vá em **Integrações** no painel da Velo.\n2. Clique em **Conectar Mercado Livre**.\n3. Você é redirecionado para o site oficial do ML — faça login com a conta que vai vender.\n4. Autorize os permissionamentos solicitados.\n5. Você volta automaticamente para a Velo com a conexão ativa.\n\n> **Dica:** sempre conecte a conta principal de venda. Contas secundárias podem não ter todos os permissionamentos.',
   ARRAY['conectar', 'integração', 'oauth', 'mercado livre', 'ml'], 10),
  ('mercado-livre', 'conta-verificada-mercado-pago', 'Não consigo publicar: conta não verificada',
   'Para publicar no Mercado Livre é obrigatório ter a conta verificada pelo Mercado Pago.',
   E'1. Acesse mercadopago.com.br → Sua conta → Dados pessoais.\n2. Envie um documento com foto (RG ou CNH) válido.\n3. Confirme seu endereço residencial.\n4. Confirme que você tem 18 anos ou mais (menores de idade não podem vender).\n5. Aguarde a validação — normalmente sai em até 24h.\n6. Depois de aprovado, tente publicar novamente pela Velo.\n\n> **Dica:** a validação é feita pelo Mercado Pago, não pela Velo. Nós não conseguimos acelerar esse processo.',
   ARRAY['verificação', 'documento', 'mercado pago', 'não consigo publicar'], 20),
  ('mercado-livre', 'tarifas-mercado-livre', 'Como funcionam as tarifas do Mercado Livre',
   'A Velo não cobra por venda. As tarifas são do próprio ML.',
   E'1. O Mercado Livre desconta uma porcentagem por venda, que varia por categoria.\n2. Anúncios Clássicos têm tarifa menor; Premium têm mais visibilidade e tarifa maior.\n3. Consulte a tarifa exata da sua categoria em mercadolivre.com.br/vender/precos.\n4. O valor já entra descontado no seu saldo do Mercado Pago quando o comprador libera a compra.',
   ARRAY['tarifa', 'taxa', 'comissão', 'clássico', 'premium'], 30),
  ('mercado-livre', 'dinheiro-das-vendas', 'Onde vejo o dinheiro das vendas',
   'As vendas caem direto no seu Mercado Pago, não na Velo.',
   E'1. Acesse mercadopago.com.br com a mesma conta que você conectou aqui.\n2. Vá em **Atividade** para ver cada venda.\n3. O ML libera o dinheiro após a entrega confirmada (normalmente até 2 dias depois).\n4. Você pode transferir para sua conta bancária a qualquer momento, sem taxa.',
   ARRAY['saldo', 'dinheiro', 'receber', 'mercado pago', 'saque'], 40),

  -- Publicação de produtos
  ('publicacao', 'erro-ao-publicar', 'Deu erro ao publicar — o que verificar',
   'Erros de publicação normalmente vêm de conta desconectada, categoria inválida ou dados obrigatórios ausentes.',
   E'1. Vá em **Integrações** e confirme que sua conta Mercado Livre está conectada (status verde).\n2. Se estiver vermelho ou expirado, clique em **Reconectar**.\n3. Confira se o produto ainda tem estoque no fornecedor (produtos zerados são bloqueados).\n4. Se o erro mencionar categoria, tente publicar de novo — a Velo tenta detectar a categoria correta automaticamente.\n5. Persistindo, abra chamado no Suporte com o print da mensagem exata.',
   ARRAY['erro', 'falha', 'publicar', 'categoria', 'reconectar'], 10),
  ('publicacao', 'anuncio-pausado', 'Meu anúncio está pausado. E agora?',
   'Um anúncio pode ser pausado pelo Mercado Livre por falta de estoque, atributo obrigatório ausente ou infração de política.',
   E'1. Entre em Mercado Livre → Minha conta → Anúncios e localize o item pausado.\n2. Clique no anúncio e leia o motivo exato exibido pelo ML (aparece em vermelho no topo).\n3. Se o motivo for atributo obrigatório (ex.: marca, modelo, GTIN), corrija diretamente no anúncio pelo painel do ML.\n4. Se for problema de estoque, o próprio scraper vai reativar assim que o fornecedor repuser — normalmente em algumas horas.\n5. Se não conseguir identificar o motivo, abra um chamado no Suporte da Velo com o print do erro.\n\n> **Dica:** anúncios pausados por falta de estoque voltam sozinhos quando o produto retorna ao fornecedor. Não precisa republicar.',
   ARRAY['pausado', 'estoque', 'atributo', 'gtin'], 20),
  ('publicacao', 'reprovado-marca-modelo', 'Anúncio reprovado por marca ou modelo',
   'Algumas categorias do Mercado Livre exigem marca e modelo específicos (não aceitam "Genérica").',
   E'1. Abra o anúncio no painel do Mercado Livre.\n2. Vá na aba **Ficha técnica** e ajuste os campos Marca e Modelo com valores válidos para a categoria.\n3. Salve — o anúncio é reavaliado automaticamente em minutos.\n4. Se não souber qual marca/modelo usar, procure o mesmo produto em outros anúncios já ativos da categoria.',
   ARRAY['reprovado', 'marca', 'modelo', 'ficha técnica'], 30),
  ('publicacao', 'anuncio-sem-vendas', 'Anúncio ativo mas sem vendas',
   'Anúncio publicado, no ar, mas sem visitas ou vendas.',
   E'1. Confira se o preço está competitivo comparando com os 3 primeiros anúncios da mesma busca.\n2. Verifique se o título tem palavras-chave que o comprador realmente pesquisa.\n3. Adicione 3 a 6 fotos boas — anúncios com uma foto só rendem muito menos.\n4. Considere ativar frete grátis ou o Mercado Envios Full quando disponível.\n\n> **Dica:** nas primeiras 48h o ML testa o anúncio com pouco tráfego. Só ajuste depois desse período.',
   ARRAY['sem vendas', 'visitas', 'preço', 'título', 'fotos'], 40),
  ('publicacao', 'reativar-anuncio', 'Como reativar um anúncio fechado',
   'Anúncios fechados por muito tempo pausado ou por infração precisam de ação manual.',
   E'1. Vá em Mercado Livre → Anúncios → Finalizados.\n2. Clique em **Reativar**. Se o ML pedir correções, resolva antes.\n3. Se o anúncio foi encerrado pela Velo (por reembolso, por exemplo), publique novamente pela plataforma — não force reativação no ML.',
   ARRAY['reativar', 'finalizado', 'fechado'], 50),

  -- Pagamentos e planos
  ('pagamentos-e-planos', 'preciso-pagar-para-publicar', 'Preciso pagar para publicar?',
   'Sim. A Velo funciona com plano mensal ativo.',
   E'1. Publicações via Velo exigem uma assinatura ativa.\n2. O plano cobre o acesso ao catálogo, publicação automatizada, sincronização de estoque e suporte.\n3. O Mercado Livre em si não cobra por publicar no formato Clássico. A tarifa de venda só é descontada quando o produto é vendido.\n4. Consulte a página **Planos** dentro do painel para ver os valores atuais.',
   ARRAY['plano', 'assinatura', 'preço', 'pagar', 'mensalidade'], 10),
  ('pagamentos-e-planos', 'cobranca-nao-reconhecida', 'Cobrança que não reconheço',
   'A cobrança da Velo aparece na fatura como Mercado Pago com nossa descrição.',
   E'1. Verifique no painel da Velo, em **Pagamentos**, se existe uma assinatura ativa no seu nome.\n2. Se sim, essa é a cobrança recorrente do plano.\n3. Se não reconhecer mesmo assim, abra chamado no Suporte com o valor exato e a data — devolvemos rapidamente em caso de erro.',
   ARRAY['cobrança', 'fatura', 'cartão', 'não reconheço'], 20),
  ('pagamentos-e-planos', 'pedir-reembolso', 'Pedir reembolso de uma cobrança',
   'Reembolsos são analisados caso a caso e processados via Mercado Pago.',
   E'1. Vá em **Pagamentos → Solicitar reembolso**.\n2. Informe qual cobrança e o motivo.\n3. Nossa equipe responde em até 48h úteis.\n4. Reembolsos aprovados caem no mesmo meio de pagamento original em 5 a 10 dias úteis (prazo do Mercado Pago).',
   ARRAY['reembolso', 'estorno', 'devolução', 'dinheiro de volta'], 30),
  ('pagamentos-e-planos', 'cancelar-assinatura', 'Cancelar minha assinatura ou conta',
   'Você pode cancelar a assinatura a qualquer momento.',
   E'1. Vá em **Pagamentos → Minha assinatura → Cancelar**.\n2. O acesso continua até o fim do ciclo já pago.\n3. Anúncios já publicados no seu Mercado Livre continuam lá — cancelar a Velo não apaga anúncios.\n4. Para excluir os dados da conta em definitivo, abra chamado no Suporte pedindo exclusão (LGPD).',
   ARRAY['cancelar', 'cancelamento', 'excluir conta', 'lgpd'], 40),

  -- Conta e suporte
  ('conta-e-suporte', 'esqueci-minha-senha', 'Esqueci minha senha',
   'Recuperação por email em 2 minutos.',
   E'1. Na tela de login, clique em **Esqueci minha senha**.\n2. Informe o email cadastrado.\n3. Abra o email da Velo (verifique também a caixa de spam) e clique no link.\n4. Defina uma nova senha e faça login.',
   ARRAY['senha', 'login', 'acesso', 'recuperar'], 10),
  ('conta-e-suporte', 'trocar-email', 'Trocar o email da conta',
   'Por segurança, a troca de email é feita pelo suporte.',
   E'1. Abra um chamado no Suporte informando o email atual e o novo email desejado.\n2. Envie do email atual — precisamos confirmar que é você.\n3. Fazemos a troca em até 24h úteis.',
   ARRAY['email', 'trocar email', 'alterar conta'], 20),
  ('conta-e-suporte', 'fornecedor-sem-produto', 'Cliente comprou mas o fornecedor sumiu',
   'Casos raros, mas quando acontece a Velo intervém direto.',
   E'1. Abra chamado no Suporte com o número do pedido do Mercado Livre.\n2. A gente contata o fornecedor pelos nossos canais.\n3. Se não houver solução em 48h, reembolsamos o comprador em nome do vendedor para preservar sua reputação no ML.\n4. Você não perde nota na reputação por problema de fornecedor da nossa base.\n\n> **Dica:** nossa base de fornecedores é auditada, mas o suporte rápido existe justamente pra esses casos.',
   ARRAY['fornecedor', 'pedido', 'entrega', 'reputação'], 30),
  ('conta-e-suporte', 'falar-com-suporte', 'Como falar com o suporte humano',
   'Atendemos por chat interno em horário comercial.',
   E'1. Vá em **Suporte** no menu principal.\n2. Clique em **Novo chamado**, escolha a categoria e descreva o problema.\n3. Anexe prints quando possível — acelera muito a resolução.\n4. Respondemos em até algumas horas em dias úteis.',
   ARRAY['suporte', 'atendimento', 'chamado', 'contato', 'ajuda'], 40)
) AS v(category_slug, slug, title, summary, content, keywords, position)
JOIN public.help_categories c ON c.slug = v.category_slug
ON CONFLICT (category_id, slug) DO NOTHING;
