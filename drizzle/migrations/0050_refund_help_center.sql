-- Pedido de reembolso da assinatura passa a ser feito pela Central de Ajuda
-- (artigo pagamentos-e-planos/pedir-reembolso), não mais pelas
-- Configurações. Esta migration:
--
--   1. fecha a brecha de INSERT direto em refund_requests pelo cliente;
--   2. guarda a resposta do admin, quem analisou e de onde veio o pedido;
--   3. cria o histórico (refund_request_events), alimentado por gatilho para
--      que nenhuma função que muda o status esqueça de registrar;
--   4. reescreve os artigos de reembolso e cancelamento.

-- ── 1. Só o servidor cria pedidos ────────────────────────────────────────────
-- A policy antiga deixava o cliente inserir uma linha com qualquer status
-- (inclusive 'approved') direto pela API, pulando prazo, identidade e
-- notificação aos admins. O único caminho é a função request-refund, que usa
-- service_role e não depende desta policy.
DROP POLICY IF EXISTS "Users can create own refund requests" ON public.refund_requests;
REVOKE INSERT, UPDATE, DELETE ON public.refund_requests FROM anon, authenticated;

-- ── 2. Campos da análise ─────────────────────────────────────────────────────
ALTER TABLE public.refund_requests
  -- Texto que o cliente lê (notificação, artigo e histórico).
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  -- 'help_center' (formulário do artigo), 'settings' (tela antiga), 'admin'.
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'settings',
  -- Momento em que o cliente marcou que entende que o acesso acaba se aprovado.
  ADD COLUMN IF NOT EXISTS access_end_acknowledged_at timestamptz;

-- ── 3. Histórico ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid NOT NULL REFERENCES public.refund_requests(id) ON DELETE CASCADE,
  -- created: pedido aberto · status: mudança de status · response: mensagem
  -- ao cliente · note: anotação interna (o cliente nunca vê).
  kind text NOT NULL CHECK (kind IN ('created', 'status', 'response', 'note')),
  from_status text,
  to_status text,
  message text CHECK (message IS NULL OR length(message) <= 4000),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT 'system' CHECK (actor_role IN ('customer', 'admin', 'system')),
  visible_to_customer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refund_request_events_request_idx
  ON public.refund_request_events (refund_request_id, created_at);

ALTER TABLE public.refund_request_events ENABLE ROW LEVEL SECURITY;

-- Escrita só pelo servidor (funções com service_role e o gatilho abaixo).
REVOKE ALL ON public.refund_request_events FROM anon, authenticated;
GRANT SELECT ON public.refund_request_events TO authenticated;
GRANT ALL ON public.refund_request_events TO service_role;

DROP POLICY IF EXISTS "Cliente vê o histórico do próprio pedido" ON public.refund_request_events;
CREATE POLICY "Cliente vê o histórico do próprio pedido"
  ON public.refund_request_events FOR SELECT TO authenticated
  USING (
    visible_to_customer
    AND EXISTS (
      SELECT 1 FROM public.refund_requests r
      WHERE r.id = refund_request_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins veem todo o histórico de reembolso" ON public.refund_request_events;
CREATE POLICY "Admins veem todo o histórico de reembolso"
  ON public.refund_request_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Toda criação e toda troca de status vira uma linha, venha de onde vier
-- (request-refund, admin-refund-action, check-pending-refunds...).
CREATE OR REPLACE FUNCTION public.refund_requests_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.refund_request_events
      (refund_request_id, kind, to_status, message, actor_id, actor_role)
    VALUES
      (NEW.id, 'created', NEW.status, NEW.reason, NEW.user_id,
       CASE WHEN NEW.source = 'admin' THEN 'admin' ELSE 'customer' END);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.refund_request_events
      (refund_request_id, kind, from_status, to_status, actor_id, actor_role)
    VALUES
      (NEW.id, 'status', OLD.status, NEW.status,
       CASE WHEN NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN NEW.reviewed_by END,
       CASE WHEN NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by AND NEW.reviewed_by IS NOT NULL
            THEN 'admin' ELSE 'system' END);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_requests_log_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS refund_requests_log_event ON public.refund_requests;
CREATE TRIGGER refund_requests_log_event
  AFTER INSERT OR UPDATE OF status ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.refund_requests_log_event();

-- Pedidos que já existiam ganham a linha de abertura, para o histórico não
-- começar vazio. Só insere se ainda não houver evento para o pedido.
INSERT INTO public.refund_request_events (refund_request_id, kind, to_status, message, actor_id, actor_role, created_at)
SELECT r.id, 'created', 'pending', r.reason, r.user_id, 'customer', coalesce(r.requested_at, r.created_at)
FROM public.refund_requests r
WHERE NOT EXISTS (SELECT 1 FROM public.refund_request_events e WHERE e.refund_request_id = r.id);

INSERT INTO public.refund_request_events (refund_request_id, kind, from_status, to_status, actor_role, created_at)
SELECT r.id, 'status', 'pending', r.status, 'system', coalesce(r.processed_at, r.updated_at)
FROM public.refund_requests r
WHERE r.status <> 'pending'
  AND NOT EXISTS (SELECT 1 FROM public.refund_request_events e WHERE e.refund_request_id = r.id AND e.kind = 'status');

-- ── 4. Artigos ───────────────────────────────────────────────────────────────
-- A categoria passa a se chamar como a área de Configurações. O endereço
-- (slug) fica igual para não quebrar links.
UPDATE public.help_categories
SET title = 'Assinatura e cobrança',
    description = 'Planos, cobranças, cancelamento e reembolso da assinatura da Velo.'
WHERE slug = 'pagamentos-e-planos';

-- O artigo "Pedir reembolso de uma cobrança" ganha o texto completo e mantém o
-- endereço (pedir-reembolso), que já circula nas respostas do suporte. O link
-- para o atendimento de reembolso (/ajuda/reembolso, chat com a IA) fica
-- discreto, no passo a passo da seção "Como funciona o atendimento".
UPDATE public.help_articles a
SET slug = 'pedir-reembolso',
    title = 'Pedir reembolso de uma cobrança',
    summary = 'Quem tem direito, como funciona o atendimento de reembolso, quanto tempo leva e o que acontece com o seu acesso. O pedido é feito no atendimento de reembolso, explicado aqui.',
    keywords = ARRAY['reembolso', 'estorno', 'devolução', 'dinheiro de volta', '7 dias', 'arrependimento', 'cdc', 'código de defesa do consumidor', 'garantia', 'cancelar e pedir reembolso'],
    status = 'published',
    position = 10,
    content = $md$A Velo devolve o valor da assinatura para quem desiste nos **primeiros 7 dias** depois da contratação. O pedido é feito no **atendimento de reembolso**, um chat só para isso: a assistente confere a sua assinatura, entende o que aconteceu e envia o pedido para a análise da nossa equipe.

Como abrir o atendimento está explicado na seção **Como funciona o atendimento de reembolso**. Antes, vale ler as regras abaixo: elas explicam quem tem direito, quanto tempo leva e o que acontece com a sua conta.

## Resumo rápido

| Tema | Como funciona |
| --- | --- |
| **Prazo** | Até **7 dias corridos** depois da contratação |
| **Onde pedir** | No atendimento de reembolso (veja como abrir mais abaixo), logado na conta que foi cobrada |
| **Quem decide** | A equipe da Velo. A assistente envia o pedido, mas não aprova nem recusa |
| **Tempo de análise** | Até **5 a 7 dias úteis** |
| **Como o dinheiro volta** | Pelo **mesmo meio de pagamento** usado na compra |
| **Seu acesso** | A renovação é cancelada quando o pedido é enviado. Se for aprovado, o plano termina na hora |

## Quem tem direito

O Código de Defesa do Consumidor (art. 49) garante o **direito de arrependimento**: quem contrata pela internet pode desistir em até 7 dias e receber de volta o que pagou. A Velo aplica essa garantia a **todos os planos**, inclusive o vitalício.

Você pode pedir o reembolso quando **todas** as condições abaixo valem:

- a assinatura está **paga e ativa** na conta em que você está logado;
- o pedido é feito em até **7 dias corridos** a partir da data da contratação;
- não existe outro pedido seu **em análise**;
- você ainda **não recebeu um reembolso** da Velo antes, nesta conta ou em outra com o mesmo e-mail ou a mesma chave Pix.

A assistente confere tudo isso no começo da conversa e mostra a data da cobrança, o valor e quantos dias ainda restam.

### Quando não é pedido de reembolso

Algumas situações parecem reembolso, mas seguem outro caminho:

- **Cobrança duplicada ou cobrança depois de cancelar:** é um erro de cobrança, e a equipe corrige **sem o prazo de 7 dias**. Veja [Cobrança que não reconheço](/ajuda/pagamentos-e-planos/cobranca-nao-reconhecida).
- **Pedido que você pagou na fornecedora** para enviar uma venda: esse dinheiro não é da assinatura Velo. Veja [Paguei na fornecedora e quero cancelar ou ser reembolsado](/ajuda/pos-venda/reembolso-fornecedora).
- **Tarifas do Mercado Livre:** são cobradas pelo Mercado Livre, não pela Velo. Veja [Como funcionam as tarifas do Mercado Livre](/ajuda/mercado-livre/tarifas-mercado-livre).
- **Passou dos 7 dias:** não há reembolso, mas você pode **cancelar a renovação** a qualquer momento, sem análise. Veja a comparação mais abaixo.

## Antes de pedir: talvez dê para resolver

Muitos pedidos de reembolso nascem de um problema que tem solução, e às vezes em poucos minutos. Se o seu motivo for um destes, confira primeiro:

| Problema | Artigo que ajuda |
| --- | --- |
| Não consegui conectar o Mercado Livre | [Como conectar minha conta do Mercado Livre](/ajuda/mercado-livre/conectar-conta) |
| O Mercado Livre diz que a conta não está verificada | [Não consigo publicar: conta não verificada](/ajuda/mercado-livre/conta-verificada-mercado-pago) |
| Deu erro ao publicar | [Deu erro ao publicar: o que verificar](/ajuda/publicacao/erro-ao-publicar) |
| O anúncio ficou pausado | [Meu anúncio está pausado. E agora?](/ajuda/publicacao/anuncio-pausado) |
| Publiquei e ainda não vendi | [Anúncio ativo mas sem vendas](/ajuda/publicacao/anuncio-sem-vendas) |
| Paguei e o plano não aparece | [Entrei na Velo e meu plano não aparece](/ajuda/conta-e-suporte/plano-nao-aparece) |

No atendimento, a assistente também pergunta o motivo e pode sugerir uma solução. Isso **nunca impede** o envio: se você quiser o reembolso, ela segue com o pedido.

## Como funciona o atendimento de reembolso

O atendimento de reembolso é um chat separado do suporte comum, feito só para pedidos de reembolso da assinatura. Você conversa com a assistente da Velo, e ela envia o pedido no final.

1. **Entre na conta que foi cobrada.** Se você não estiver logado, o atendimento pede o login e volta para a conversa depois.
2. **Abra o atendimento.** Ele fica [nesta página de atendimento](/ajuda/reembolso), com você logado na conta certa.
3. **Conte o que aconteceu.** A assistente confere a sua assinatura e mostra a data da cobrança, o valor e o prazo.
4. **Revise o que acontece com a sua conta.** Ela explica como ficam o acesso e os anúncios se o reembolso for aprovado e pede a sua confirmação.
5. **Confirme o envio.** Com a sua confirmação, o pedido vai para a equipe e a confirmação aparece na própria conversa.

### O que a assistente faz e o que não faz

| A assistente faz | A assistente não faz |
| --- | --- |
| Confere se você está dentro do prazo e das regras | Aprovar ou recusar o reembolso: quem decide é a equipe |
| Mostra a data da cobrança, o valor e os dias restantes | Devolver dinheiro fora das regras desta página |
| Registra o motivo com as suas palavras | Alterar cartão, chave Pix ou dados de pagamento |
| Explica o que acontece com o acesso e os anúncios | Cancelar pedidos feitos na fornecedora |
| Envia o pedido com a sua confirmação | Prometer prazo diferente do que está nesta página |

### Se a assistente não encontrar a sua assinatura

Isso costuma acontecer quando você entrou com **outra conta** ou pagou com **outro e-mail**. Confira se está logado na conta certa. Se a assinatura continuar sem aparecer, a assistente passa a conversa para uma pessoa da equipe.

## Prazo de análise e de devolução

- A equipe analisa o pedido em até **5 a 7 dias úteis**.
- Aprovado, o valor volta **pelo mesmo meio de pagamento** usado na compra.
- No **cartão de crédito**, o estorno pode aparecer só na **próxima fatura**, e em alguns bancos leva até **30 dias**. Esse prazo é do banco emissor, não da Velo.
- Você é avisado nas **notificações** da Velo a cada mudança, e a resposta da equipe também aparece no atendimento de reembolso.

Passou desse prazo e o valor não apareceu? Fale com o suporte com a data da aprovação em mãos: veja [Como falar com o suporte humano](/ajuda/conta-e-suporte/falar-com-suporte).

## Acompanhar o pedido

| Situação | O que significa |
| --- | --- |
| **Em análise** | O pedido chegou e está com a equipe. Você continua usando a Velo normalmente |
| **Concluído** | O reembolso foi aprovado e o estorno foi enviado ao meio de pagamento |
| **Recusado** | O pedido não atende às regras. A equipe sempre explica o motivo na resposta |

Só existe **um pedido em análise por vez**. Se quiser acrescentar alguma informação, escreva no próprio atendimento de reembolso.

## O que acontece com o seu acesso

| Momento | O que acontece |
| --- | --- |
| Ao enviar o pedido | A **renovação é cancelada na hora**, para não haver nova cobrança. Você continua usando a Velo normalmente durante a análise. |
| Se for aprovado | O plano é **encerrado imediatamente**, os anúncios publicados pela Velo no seu Mercado Livre são **encerrados** e novas publicações ficam **bloqueadas por 30 dias**. |
| Se for recusado | Você **mantém o acesso até o fim do período já pago**. A renovação continua cancelada; para seguir depois disso, é só assinar de novo em Configurações → Plano. |

**Vendas que já aconteceram continuam sendo suas.** Conclua o envio dos pedidos em andamento, mesmo depois do reembolso: o comprador do Mercado Livre continua esperando o produto. Veja [O que fazer depois de uma venda](/ajuda/pos-venda/pos-venda-fluxo).

## Cancelar a assinatura x pedir reembolso

| | Cancelar a renovação | Pedir reembolso |
| --- | --- | --- |
| Quando | A qualquer momento | Até 7 dias depois da contratação |
| Dinheiro | Não há devolução do que já foi pago | O valor pago é devolvido |
| Acesso | Continua até o fim do período já pago | Termina quando o reembolso é aprovado |
| Anúncios | Continuam no Mercado Livre | Os publicados pela Velo são encerrados |
| Onde fazer | Página Gerenciar assinatura (veja [Cancelar minha assinatura ou conta](/ajuda/pagamentos-e-planos/cancelar-assinatura)) | No atendimento de reembolso (veja Como funciona o atendimento de reembolso) |
| Análise | Vale na hora, sem análise | Passa pela equipe |

## Perguntas frequentes

### Comprei o plano vitalício. Também posso pedir?

Sim. O vitalício segue a mesma regra: até 7 dias depois da compra. Depois disso não há reembolso, e também não há renovação para cancelar, porque o vitalício é um pagamento único.

### Posso assinar de novo depois do reembolso?

Pode. Ao assinar um novo plano pago, o bloqueio de 30 dias para publicar é retirado assim que o pagamento for confirmado.

### Já recebi reembolso em outra conta. Posso pedir de novo?

Não. O reembolso vale **uma vez por pessoa**: a regra considera o e-mail e a chave Pix, mesmo que a conta seja outra.

### Enviei o pedido. A renovação volta se ele for recusado?

Não. A renovação é cancelada no envio e continua cancelada. Se quiser seguir na Velo depois do período pago, assine de novo em Configurações → Plano.

### Por que não existe um botão de reembolso nas Configurações?

Porque o pedido passa por uma conversa: a assistente confere as regras com você, tenta resolver o problema quando dá e só então envia. Assim o pedido chega completo para a equipe e a análise é mais rápida.$md$
FROM public.help_categories c
WHERE a.category_id = c.id
  AND c.slug = 'pagamentos-e-planos'
  AND a.slug IN ('pedir-reembolso', 'como-solicitar-reembolso');

UPDATE public.help_articles a
SET summary = 'Cancelar a renovação vale na hora e mantém o acesso até o fim do período pago. Excluir a conta apaga seus dados.',
    content = $md$Existem duas coisas diferentes:

- **Cancelar a renovação:** a cobrança para de se repetir. Sua conta continua existindo e você usa a Velo até o fim do período já pago.
- **Excluir a conta:** apaga sua conta e seus dados da Velo **permanentemente**.

Quer o **dinheiro de volta**? Isso é um pedido de reembolso, que só vale nos 7 primeiros dias: veja [Pedir reembolso de uma cobrança](/ajuda/pagamentos-e-planos/pedir-reembolso).

## Cancelar a renovação

1. Abra a página [Gerenciar assinatura](/dashboard/configuracoes/central-da-assinatura) com você logado na sua conta. Ela não fica nos menus das Configurações: se perder este link, peça o cancelamento no chat de suporte e enviamos de novo.
2. Clique em **Cancelar renovação**, escreva o motivo e confirme.

**O que acontece:** não haverá novas cobranças, você mantém o acesso até a data mostrada na tela e os anúncios que já publicou continuam no Mercado Livre. Não há devolução do valor já pago.

## Excluir a conta

**Atenção:** essa ação **não pode ser desfeita**.

1. Abra **Configurações → Segurança → Excluir conta**.
2. Confirme nas duas janelas de confirmação.

Cancele a renovação **antes** de excluir a conta, para garantir que não haja nova cobrança.

## Perguntas comuns

**Posso voltar depois?** Sim. É só assinar um plano de novo em Configurações → Plano.

**Quero que apaguem meus dados (LGPD).** Use **Excluir conta** ou peça pelo suporte.$md$
FROM public.help_categories c
WHERE a.category_id = c.id
  AND c.slug = 'pagamentos-e-planos'
  AND a.slug = 'cancelar-assinatura';