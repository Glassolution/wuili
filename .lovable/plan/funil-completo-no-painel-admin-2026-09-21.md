# Funil completo no painel admin

Nova aba "Funil" dentro de Rastreio, do primeiro acesso ao anúncio publicado.

## O que encontrei hoje (medição atual)

Duas fontes separadas:

- **Antes da conta** (`landing_events`, por visitante anônimo): visita à landing e cliques nos botões de criar conta. Só guarda evento, visitante, aparelho e de onde veio (referência) — **não guarda UTM**.
- **Depois do login** (`mobile_home_events`, por pessoa logada): catálogo, produto, importar, conexão com o Mercado Livre, revisão, planos, pagamento clicado, conta apta e publicação. **Não guarda aparelho nem origem** — isso vem do perfil da pessoa.

Dados reais dos últimos dias: 68 visitantes na landing, 19 clicaram em criar conta, 26 viram a home, 30 viram produto, 22 abriram importar, 11 viram planos, 5 clicaram em pagar, 4 publicaram.

## Lacunas que precisam de correção

1. **Cadastro e onboarding não estão sendo gravados.** O código chama os eventos (`signup_view`, `signup_success`, `onboarding_complete`…), mas não existe nenhuma linha gravada. Vou descobrir a causa e corrigir — sem isso, o buraco entre "clicou em criar conta" e "conta criada" fica cego.
2. **Origem (Instagram/TikTok/UTM) não é guardada nos eventos da landing.** Vou adicionar os campos de origem e passar a gravá-los; o perfil já guarda a origem de quem criou conta, então o filtro funciona nas duas metades.
3. **Aparelho e navegador interno de rede social** só existem antes da conta. Vou gravar aparelho e tipo de navegador também nos eventos de quem já entrou.
4. **Não há ponte entre o visitante anônimo e a conta criada.** Vou gravar o identificador do visitante no perfil no momento do cadastro, para ligar as duas metades da jornada.
5. **Conta criada / pagamento confirmado** serão contados pelas tabelas reais (contas e assinaturas), não por evento — assim o número nunca depende do navegador ter conseguido avisar.

## O que vou entregar

- **Funil em ordem**, 14 etapas: visita → clique criar conta → conta criada → onboarding concluído → catálogo → produto → clique em publicar → conexão iniciada → conexão concluída → revisão concluída → planos vistos → pagamento iniciado → pagamento confirmado → conta de vendedor apta → anúncio publicado.
- Em cada etapa: **pessoas únicas**, avanço em relação à etapa anterior, acumulado desde o início, e destaque em vermelho nas maiores perdas em número absoluto.
- **Filtros**: período, origem, aparelho, navegador interno de rede social, e comparação com o período anterior.
- Uma linha curta em cada etapa explicando **como ela é contada**.
- **Pagou sem conta de vendedor**: quantos ativaram, tempo até ativar e quantos pediram reembolso.
- **Erros por tipo** (cadastro, conexão, pagamento) com frequência.
- **Aviso automático de medição falhando** quando uma etapa tem zero pessoas mas a seguinte tem gente.
- Tudo legível no celular; nada do painel atual muda de lugar.

## Detalhes técnicos

- Nova migration: colunas de origem/aparelho em `landing_events` e `mobile_home_events`, coluna `visitor_id` em `profiles`, e RPC `rpc_admin_full_funnel(p_days, p_offset_days, p_origem, p_device, p_browser)` (security definer, só admin) devolvendo etapa, pessoas, definição e comparação.
- RPCs auxiliares: `rpc_admin_paid_without_seller` e `rpc_admin_error_breakdown`.
- Frontend: nova aba em `AdminTrackingPage.tsx` + componente `AdminFunnelPanel.tsx`; nenhum gráfico existente é alterado.
- Ajustes de gravação em `signupFunnel.ts`, `mobileHomeTracking.ts`, `LoginPage.tsx` e `Index.tsx`.
