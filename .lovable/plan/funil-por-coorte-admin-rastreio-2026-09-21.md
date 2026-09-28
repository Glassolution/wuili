# Funil por coorte (admin › Rastreio)

## O que confirmei nos dados e no código

1. **Fontes misturadas** — as etapas 1-2 vêm dos eventos da landing, 5-12 dos eventos de dentro do app, e 3, 13 e 15 de tabelas (contas, assinaturas, publicações) contando o período inteiro. Como as tabelas têm anos de histórico e os eventos só existem desde **20/09/2026 15h32** (landing) e **20/09 21h54** (app), as taxas estouram (catálogo 308 x landing 68, 420 assinaturas pagas).
2. **Populações diferentes** — as etapas do app contam qualquer pessoa logada, inclusive assinantes antigos que usam a Velo todo dia.
3. **"Onboarding concluído" = 0**: é **falha de medição, não de produto**. O onboarding novo, ao terminar, grava o nome no perfil e desliga a marca `velo_onboarding_pending` no cadastro/login — mas **nunca escreve `onboarding_completed` no perfil**, e a coluna `onboarding_completed_at` está vazia em 100% das contas. O painel lia justamente essa coluna. **Ninguém fica preso repetindo o onboarding**, porque o gatilho de exibição usa a marca do cadastro, não a coluna. Já existem eventos `onboarding_complete` gravados (desde 21/09), que passam a ser a fonte.
4. **Etapas puladas** aparecem como perda: quem já tinha Mercado Livre conectado não passa por "conectar", quem já assina não vê planos.
5. **Entrada direta no cadastro** (anúncio → cadastro) não é contada no topo.
6. **"Conta de vendedor apta"** hoje olha só se existe conta do Mercado Livre ligada.

## O que vou fazer

**Nova função de funil por coorte** (`rpc_admin_cohort_funnel`), substituindo a lógica atual sem apagar a antiga:

- **Coorte** = pessoas cuja conta foi criada dentro do período **e** que não tinham assinatura paga antes do período. Visitantes anônimos da landing entram só nas duas primeiras etapas, ligados à conta pelo identificador de visitante.
- **Mesma janela para todas as etapas**, inclusive contas, assinaturas e publicações — nada mais de contagem histórica.
- **Data de início da medição** visível no topo do painel (a maior entre a primeira medição da etapa e o início do período), com aviso quando o período pedido começa antes disso.
- **Etapas puladas** viram "não precisava" (contadas como avançadas, em cinza, com o número separado): conexão do Mercado Livre para quem já estava conectado, planos/pagamento para quem já era pagante.
- **Entrada**: dois números no topo — "entrou pela landing" e "entrou direto no cadastro" (sem passar pela landing), somando o topo real.
- **Sem percentual quando a base é pequena** (menos de 30 pessoas na etapa anterior): mostra só o número de pessoas com o aviso "base pequena".
- **"Conta de vendedor apta"** passa a se chamar **"Mercado Livre conectado"**, e ganha ao lado a etapa real de "conseguiu publicar" — que é a prova de aptidão que temos hoje.
- **Pagou sem conta de vendedor** passa a usar a mesma coorte.

**Correção de medição**: ao concluir o onboarding, gravar também `onboarding_completed` e `onboarding_completed_at` no perfil, para as duas fontes baterem daqui pra frente.

## Detalhes técnicos

- Migration nova: `rpc_admin_cohort_funnel(p_days, p_offset_days, p_origem, p_device, p_browser)` retornando `ordem, etapa, definicao, pessoas, nao_precisava, medicao_desde`; `rpc_admin_paid_without_seller` recebendo a mesma coorte; coluna `onboarding_completed_at` já existe.
- Frontend: `AdminFunnelPanel.tsx` passa a consumir a RPC nova, exibe entrada (landing/direto), data de início da medição, coluna "não precisava" e oculta percentuais em base pequena. `AdminTrackingPage.tsx` e a aba "Visão geral" ficam intactos.
- `DashboardLayout.tsx`: grava a conclusão do onboarding no perfil.

## O que ainda não vai ser confiável

- Períodos anteriores a 20/09/2026 não têm eventos — o funil por coorte só é honesto de lá pra frente, e a tela vai dizer isso.
- "Apto a vender" de verdade (documentos/limites do Mercado Livre) exigiria consultar a conta de cada vendedor na API; por isso a etapa foi renomeada em vez de fingir medir.
