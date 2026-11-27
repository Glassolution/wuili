# Integração de vendas Velo → Utmify

## Objetivo e limite desta aprovação
Adicionar avisos de compras e reembolsos confirmados à Utmify, sem modificar pagamentos, acesso, status, cancelamentos, comissões, e-mails, pixels ou telas.

**Neste momento:** somente investigação e plano. Nenhuma tabela, variável, publicação ou envio foi realizado. A tabela `utmify_order_events` ainda não existe; as cinco variáveis solicitadas não estão configuradas.

Aprovar este plano autoriza implementação e aplicação **somente da migration nova abaixo**, com testes locais simulados. Não autoriza ativar envios, executar backfill ou fazer teste externo. Publicação será confirmada separadamente antes de colocar os avisos em operação.

## Decisões confirmadas e pendentes
- **Dados do comprador — autorizado:** primeiro nome e e-mail real, sem telefone, CPF ou IP. A API exige `customer.name` e `customer.email`. Antes do primeiro envio, conferir se a política de privacidade informa esse compartilhamento; qualquer mudança nela requer autorização adicional.
- **Renovações — não enviar:** Felipe escolheu contar somente compras novas. Manter `UTMIFY_SEND_RENEWALS` ausente. Há incompatibilidade no texto: o limite oficial usa `createdAt`, mas o pedido mantém a data original da assinatura. Uma renovação mensal com essa data teria mais de sete dias e seria pulada. Se futuramente renovações forem escolhidas, confirmar com a Utmify a representação de cada ciclo e apresentar o ajuste antes de implementá-lo.
- **Taxa ValidaPay:** aguardar percentual; padrão técnico 0, não apresentado como lucro líquido confirmado.
- **Credencial:** solicitar `UTMIFY_API_TOKEN` pelo formulário seguro, só depois da aprovação. O Felipe a obtém em Utmify → Integrações → Webhooks → Credenciais de API → Adicionar Credencial → Criar Credencial.

## Comportamento previsto
1. Criar `_shared/utmify.ts`, com `sendUtmifyOrder(admin, { subscriptionId, status, triggerSource, approvedAt?, refundedAt?, cycleNumber? })`.
2. Ler apenas campos necessários de `subscriptions` e `profiles`, vinculados por `user_id`; aceitar somente assinaturas ValidaPay. Montar corpo oficial, valores em centavos e datas UTC `YYYY-MM-DD HH:MM:SS`. O identificador é o UUID da assinatura; ciclos usam `UUID-cN`, nunca o ID da cobrança.
3. Produtos: `velo_<plan>`, nome/plano mensal ou vitalício, quantidade 1 e custo da assinatura. UTMs vêm do perfil, vazias como null. Comissão = total menos taxa configurada, BRL.
4. Ausência de `UTMIFY_ENABLED=true` registra `skipped_disabled`, sem chamada externa. Teste depende de `UTMIFY_TEST_MODE=true`. Renovação exige flag explícita e ciclo inteiro válido; nunca inferir ciclo ou reenviar como compra inicial.
5. Consultar sucesso real anterior por pedido/status; duplicados registram `skipped_duplicate`. Pedido pago com idade superior a sete dias ou reembolso superior a 45 registra `skipped_too_old`. Os limites vêm da documentação oficial: https://docs.utmify.com.br/envio-de-vendas.
6. POST oficial com token apenas no header, timeout de cinco segundos abrangendo a leitura da resposta, `AbortController`, `try/catch` e tarefas registradas em `EdgeRuntime.waitUntil`. Falhas de envio ou de gravação nunca alteram a resposta ou o resultado financeiro do fluxo existente.
7. Registrar resultado, HTTP e erro sanitizado até 500 caracteres, nunca corpo bruto da requisição/resposta. Não registrar token, nome, e-mail, telefone, CPF ou IP. UTMs também devem ser tratadas para não persistir dados pessoais acidentais. Falha no registro gera somente diagnóstico técnico seguro, sem reexecutar pagamento.

## Pontos de integração e ressalvas encontradas
- `validapay-webhook/index.ts`: import e aviso da primeira compra no bloco existente de `trackMetaPurchase` (atualmente linhas 526–550), após ativação. O aviso deve iniciar somente depois de concluir o fluxo atual, sem modificar o bloco Meta/TikTok. Eventual renovação é separada e opt-in. Upgrades interceptados por `handleUpgradePayment` continuam fora.
- `_shared/confirmedRefundLifecycle.ts`: após conclusão bem-sucedida das atualizações existentes, registrar tarefa de aviso de reembolso. Não enviar para `keep_access` como se fosse reembolso integral da compra inicial; sem ciclo verificado, evitar atribuir estorno de renovação a outro pedido.
- `_shared/adminCourtesyRefund.ts`: também escreve `refunded`, mas pode fazê-lo com resposta financeira `PROCESSING`. Avisar somente quando o estorno estiver efetivamente confirmado, não apenas porque o status local mudou. Reutilizar o caminho de confirmação quando possível, sem mudar a lógica de cortesia.
- `_shared/subscriptionLifecycle.ts`: sua escrita `refunded` restaura estado terminal baseado em evidência anterior; não é uma confirmação nova de estorno. Não adicionar envio nesse guard, evitando aviso falso/histórico.
- `process-refund/index.ts`: já é endpoint retirado (HTTP 410); não reativar nem modificar.
- **Vitalício:** a confirmação ONE_TIME também pode ocorrer por `lifetimeCharge.ts` sem webhook. Este escopo não garante capturar todas as compras vitalícias automaticamente. Não alterar reconciliação/ativação para ampliar a cobertura sem aprovação adicional; o backfill manual pode cobrir as elegíveis dentro do prazo.

## Arquivos previstos
Criar:
- `drizzle/migrations/0074_utmify_order_events.sql` (numeração a reconferir antes de aplicar).
- `supabase/functions/_shared/utmify.ts`.
- `supabase/functions/_shared/utmify.test.ts`.
- `supabase/functions/utmify-backfill/index.ts` e teste de autorização/limites.

Alterar:
- `supabase/functions/validapay-webhook/index.ts` — apenas agendamento dos avisos.
- `supabase/functions/_shared/confirmedRefundLifecycle.ts` — apenas aviso após confirmação.
- `supabase/functions/_shared/adminCourtesyRefund.ts` — somente se necessário para cobrir confirmação imediata, sem tocar no estorno.
- Testes adjacentes dos caminhos alterados, documentação e roadmap. Metadados de migration/schema gerados pela plataforma, somente se exigidos pela aplicação da migration nova; nunca reaplicar anteriores.

Sem frontend, preços, assinatura, políticas existentes, checkout ou pixels alterados.

## SQL completo proposto
```sql
CREATE TABLE public.utmify_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  utmify_status text NOT NULL CHECK (utmify_status IN (
    'waiting_payment', 'paid', 'refused', 'refunded', 'chargedback'
  )),
  trigger_source text NOT NULL CHECK (trigger_source IN (
    'webhook_first_purchase', 'webhook_renewal', 'refund', 'backfill', 'manual_test'
  )),
  is_test boolean NOT NULL DEFAULT false,
  payment_method text CHECK (payment_method IN ('pix', 'credit_card')),
  total_cents integer,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  http_status integer,
  ok boolean NOT NULL DEFAULT false,
  result text CHECK (result IN (
    'sent', 'failed', 'skipped_disabled', 'skipped_duplicate', 'skipped_too_old'
  )),
  error text CHECK (char_length(error) <= 500),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON TABLE public.utmify_order_events TO service_role;
REVOKE ALL ON TABLE public.utmify_order_events FROM PUBLIC, anon, authenticated;

ALTER TABLE public.utmify_order_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX utmify_order_events_real_success_uidx
  ON public.utmify_order_events (order_id, utmify_status)
  WHERE ok AND NOT is_test;

CREATE INDEX utmify_order_events_subscription_created_idx
  ON public.utmify_order_events (subscription_id, created_at);
```
**Nenhuma policy.** Apenas service role lê/grava; nenhum acesso direto de cliente/admin pela Data API.

**Limite da deduplicação solicitada:** o índice evita dois sucessos gravados, mas consulta antes do POST não impede duas chamadas simultâneas nem reenvio após timeout com entrega incerta. Não prometer exatamente um envio. Antes de habilitar produção, confirmar idempotência oficial por `orderId`/status; se não existir, apresentar reserva atômica como ajuste de schema para nova aprovação. Não reenviar automaticamente resultados incertos.

## Backfill: criar, não executar
- CORS, autenticação validada no servidor e permissão administrativa existente; não usar papel de metadados/localStorage nem assumir que `private.has_role` existe.
- `days` inteiro entre 1 e 7, `dry_run` booleano padrão true; rejeitar entrada inválida.
- Só `provider=validapay`, estados `active`, `cancel_scheduled`, `refunded`, criadas no intervalo; leitura completa paginada. Dry-run devolve contagem e IDs, sem comprador ou escrita de eventos.
- Com `dry_run=false`, enviar pelos mesmos controles. `refunded` só vira aviso refunded quando houver evidência de estorno confirmado, não apenas estado local. Não inventar aprovação na data atual para um pagamento histórico sem evidência.
- A função não será invocada nesta implementação. O exemplo `days=1, dry_run=false` pode enviar várias vendas, portanto **não serve para autorizar exatamente um teste**. Antes do teste externo, selecionar explicitamente um único pedido e aprovar essa chamada limitada.

## Variáveis esperadas — nenhuma existente
`UTMIFY_API_TOKEN`, `UTMIFY_ENABLED`, `UTMIFY_TEST_MODE`, `UTMIFY_SEND_RENEWALS`, `UTMIFY_GATEWAY_FEE_PERCENT`.

Após aprovação, solicitar credencial de forma segura; configurar modo teste inicialmente true somente com autorização. Manter habilitação ausente/desligada até o teste externo ser autorizado. Nunca revelar valores da credencial.

## Validação e entrega
- Testes simulados: flags desligadas, corpo/UTC/centavos/taxa, limites de 7/45 dias, duplicados, timeout, HTTP inválido, sanitização de dados, distinção teste/real, ciclo, autorização e limites do backfill.
- Testar que aviso falho não modifica resposta/status/acesso e que estorno pendente não gera confirmação Utmify. Nenhuma compra, estorno, ativação ou chamada real nos testes.
- Aplicar apenas a migration nova após o ok; conferir GRANT, RLS e ausência de policies por SELECT.
- Entregar arquivos/linhas, testes, hash do commit, limitações e esta consulta:
```sql
SELECT trigger_source, utmify_status, is_test, result, http_status, count(*)
FROM public.utmify_order_events
WHERE created_at >= now() - interval '1 day'
GROUP BY 1,2,3,4,5 ORDER BY 1;
```