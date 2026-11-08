# Prompt para a Lovable — atendimento de reembolso com IA

Cole o texto abaixo (da linha "Olá" até o fim) no chat da Lovable, depois que ela puxar a `main` do GitHub.

---

Olá! O código do novo fluxo de reembolso já está na `main`. Preciso que você aplique o banco e publique as Edge Functions. **Não altere nenhum arquivo de código nem o texto dos artigos**: faça só o que está listado abaixo, na ordem.

## 1. Banco de dados (uma migration nova)

Crie `drizzle/migrations/0050_refund_help_center.sql` com **exatamente** o conteúdo de `supabase/migrations/20261107120000_refund_help_center.sql` (copie o arquivo inteiro, sem resumir nem reescrever) e aplique.

O que ela faz:
- fecha o INSERT/UPDATE/DELETE direto do cliente em `refund_requests` (só as funções com service role gravam). A `0045` já removeu a policy de INSERT; esta migration repete o `DROP POLICY IF EXISTS`, o que não causa erro;
- acrescenta em `refund_requests` as colunas `admin_response`, `reviewed_by`, `reviewed_at`, `source` (padrão `'settings'`) e `access_end_acknowledged_at`;
- cria a tabela `refund_request_events` (histórico do pedido) com RLS, as policies de leitura do cliente e do admin, a função `refund_requests_log_event` e o gatilho `refund_requests_log_event`, e preenche o histórico dos pedidos que já existem;
- renomeia a coleção `pagamentos-e-planos` para "Assinatura e cobrança" (o endereço continua o mesmo);
- troca o texto do artigo `pedir-reembolso` ("Pedir reembolso de uma cobrança") pelo texto completo novo. **O endereço do artigo não muda**;
- atualiza o artigo `cancelar-assinatura`.

Não reaplique a `0049` (coleções novas da Central): ela já foi aplicada.

Depois de aplicar, atualize `src/integrations/supabase/types.ts` com as colunas e a tabela novas.

## 2. Edge Functions

Publique estas funções:

- `refund-assistant` (**nova**: a IA do atendimento de reembolso em `/ajuda/reembolso`; usa o secret `GEMINI_API_KEY`, que já existe, e mantém a verificação de JWT padrão);
- `request-refund`, `support-assistant`, `admin-refund-action`, `cancel-subscription`, `atlas-chat`;
- `validapay-webhook`, `send-verification-email`, `create-referral`, `mp-webhook`, `mp-checkout`, `mp-verify-payment`, `mp-charge-trial`. Essas usam o link de cancelamento dos e-mails, que mudou para a página Gerenciar assinatura;
- `validapay-overdue-check` (**nova**, temporária: diagnóstico só de leitura, restrito a admins).

Confirme que o secret `GEMINI_API_KEY` está configurado. Não crie nenhum secret novo.

## 3. Conferência (só leitura) — me mostre o resultado

```sql
-- Artigo novo no lugar, com o link discreto para o atendimento
SELECT slug, title, length(content) AS tamanho,
       position('/ajuda/reembolso' IN content) > 0 AS tem_link_atendimento
FROM public.help_articles
WHERE slug IN ('pedir-reembolso', 'cancelar-assinatura');

-- Colunas novas em refund_requests
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'refund_requests'
  AND column_name IN ('admin_response', 'reviewed_by', 'reviewed_at', 'source', 'access_end_acknowledged_at');

-- Histórico criado e preenchido
SELECT count(*) AS eventos FROM public.refund_request_events;

-- O cliente não grava mais direto na tabela
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'refund_requests';
```

Resultado esperado:
- `pedir-reembolso` com título "Pedir reembolso de uma cobrança", texto com mais de 9.000 caracteres e `tem_link_atendimento = true`;
- as 5 colunas listadas;
- eventos ≥ número de pedidos de reembolso existentes;
- nenhuma policy de INSERT para clientes em `refund_requests`.

Por fim, me diga:
- se a função `refund-assistant` aparece como publicada;
- se a página `/ajuda/reembolso` abre no site publicado.
