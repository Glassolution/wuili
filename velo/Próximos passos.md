---
atualizado: 2026-11-27
---
# Próximos passos

## Utmify (27/11)
- [x] Código e migration 0074 aprovados/implementados; log protegido, 32 testes simulados, token salvo; sem publicação ou envio.
- [ ] Informar taxa ValidaPay e autorizar inclusão da Utmify na política de privacidade (primeiro nome/e-mail real já autorizados; renovações não enviadas).
- [ ] Autorizar publicação e um teste de pedido explicitamente selecionado, com modo teste ligado; não executar backfill para simular um único teste.
- [ ] Confirmar idempotência oficial antes de envio real; índice de sucesso sozinho não evita POSTs concorrentes/entrega incerta. Se necessário, pedir nova aprovação de reserva atômica.
- [ ] Cobertura de vitalícios sem webhook exige evidência específica e nova aprovação de integração; não alterar reconciliação nesta etapa. Ver [[Avisos Utmify isolados]].

## Loja de qualquer coisa + Atlas da landing (25/11)
- [x] Modo demonstração do Atlas para ver a conversa (`src/lib/atlasDemo.ts`, só no dev) → [[Atlas]]
- [ ] Testar de verdade: apagar `VITE_ATLAS_DEMO` (e o `localhost:8000` do `.env.local`) e conferir landing → login → Atlas respondendo
- [ ] Celular: o painel do Atlas não existe lá (o Atlas é a página `/dashboard/atlas`), então a ideia da landing é consumida e se perde; levar a ideia para essa página no celular
- [x] Criar loja pelo chat: roteiro, botão "Criar meu site", modal e construção passo a passo (front pronto; testado no modo demonstração) → [[Atlas]]
- [ ] **Pedido à Lovable em 26/11/2026** (prompt no chat do Claude: publicar a função, salvar a imagem no Storage no bucket público `store-banners` e devolver a URL, exigir login, registrar modelo/tamanho/tempo nos logs, testar as 4 cenas) — Publicar `generate-store-banner` com o modo `layout: "tela-cheia"` (capa de ponta a ponta nas cores da pessoa, 16:9, modelo de imagem Pro em 2K; com `scene` e `people` por variação de capa, 26/11/2026) — precisa de aprovação do dono; a função é gerida pela Lovable (o conector Supabase daqui não lê nem publica)
- [ ] Capa da loja a partir de foto de banco com licença comercial (Pexels/Unsplash) + IA só ajustando cores/proporção → [[Imagem do tema gerada por IA]]; precisa de chave da API (secret)
- [ ] Vitrine editorial virar template de verdade ("loja-3"): editor `GeneratedStoreEditorPage`, loja pública, página de produto e conta; e a loja criada pelo Atlas gravar com ele
- [ ] Chat de baixo do `AtlasEditorAoVivo` pedir mudanças na loja (hoje o enviar fica desligado)
- [x] **Lovable (26/11/2026, feito em c70f3782):** `atlas-chat` segue o roteiro de criar loja (marca, fonte, público, personalidade, cores, diferencial, produtos, resumo + `create_store`), em `supabase/functions/atlas-chat/roteiroDaLoja.ts`.
- [x] **Lovable (26/11/2026, feito em f1f633b9):** no `roteiroDaLoja.ts`, o `pedeLoja` só pode abrir o roteiro com pedido de criar loja nova ("quero mudar o banner da minha loja" hoje vira "loja de: mudar o banner…"); e copiar do `atlasDemo.ts` as correções de 26/11 ("uma marca **elegante**: discreta…" e o resumo sem repetir a descrição quando a personalidade veio em texto livre) — prompt colado no chat do Claude.
- [x] **Lovable (26/11/2026, feito):** publicar a `generate-store-banner` com o Gemini direto (`GEMINI_API_KEY`, gateway de reserva) e confirmar que a chave tem cobrança ativada para imagem; conferir `provedor: "gemini"` numa imagem de teste — prompt colado no chat do Claude.
- [ ] Loja por tipo de verdade: entrega digital (infoproduto), área do aluno (curso), campos de nick/ID no checkout (jogo), agendamento (serviço) — hoje o editor só tem os modelos de loja física
- [ ] Banco de fotos com licença (Pexels/Unsplash) como alternativa à imagem gerada por IA

## Oferta de boas-vindas no anual (24/11)
- [x] Frontend pronto e desligado (`OFERTA_BOAS_VINDAS.ativa = false`, `src/lib/ofertaBoasVindas.ts`) → [[Frontend]]
- [ ] Lovable: liberar `cycle: "annual"` na `validapay-checkout` e criar o cupom `BOASVINDAS` (30%, só anual, 1ª cobrança, conta < 48h e sem pagamento anterior; 400 quando não tiver direito)
- [ ] Depois do deploy: virar `ativa` para `true` e testar um checkout anual no sandbox

## Teste sem Vitalício (20/11 → ~04/12)
- [x] Vitalício escondido da venda com `LIFETIME_PLAN_ENABLED = false` → [[Planos e preços]]
- [ ] Em ~04/12, comparar a conversão com as 2 semanas anteriores e decidir: manter fora ou voltar para `true`

## Purchase da Meta pelo servidor (18/11)
- [x] Navegador usa `purchase_<sid>` e guarda o clique (`velo_meta_click`) → [[Pixels e medição]]
- [x] Lovable sincronizou as colunas `meta_*` em `types.ts` (merge c62356b0)
- [x] Gravar `velo_meta_click` no perfil na criação da conta (só se vazio)
- [ ] Conferir numa conta real criada por `?fbclid=` que as colunas `meta_*` foram preenchidas (RLS)
- [ ] Ligar o envio do Purchase no `validapay-webhook`
- [x] `/assinatura/confirmada` só dispara Purchase com a assinatura do `sid` em `active` (18/11)
- [ ] Pix que demora mais de 30 s: Purchase do navegador não sai; fica só o do servidor (quando ligado)

## Founder Mode — proposta da etapa 1 (09/11)
- [x] Reconferir histórico 0000–0050 e preparar recuperação seletiva, sem reaplicar
- [x] Propor acesso próprio, aquisição atômica e consultas agregadas fechadas → [[Founder Mode isolado]]
- [ ] Integrar ao design original — aguarda arquivos Founder Mode do Mac
- [ ] SQL completo, implementação e testes isolados após revisão da proposta; sem autorização de migration/deploy nesta etapa

## Publicar o novo fluxo de reembolso e da Central
- [x] Código na `main` do GitHub (08/11)
- [x] Coleções novas da Central aplicadas (`drizzle/migrations/0049`, Lovable)
- [x] Lovable aplicou a `0050` e publicou as 14 funções (incluindo `refund-assistant`)
- [ ] Publicar o site na Lovable (até lá, `/ajuda/reembolso` mostra "Artigo não encontrado" no endereço publicado)
- [ ] Conferir em produção: link no artigo, atendimento `/ajuda/reembolso` com IA real, envio, histórico, admin, respostas fixas do chat

## Atendimento de reembolso com IA (feito no local, 08/11)
- [x] Artigo completo de reembolso na migration `20261107120000` (marcador `[[atendimento-reembolso]]`)
- [x] Tela/rota `/ajuda/reembolso` (chat próprio, exige login), link discreto no artigo `pedir-reembolso`, `RefundRequestForm` removido
- [x] Função `refund-assistant` + `_shared/refundAssistant.ts` (8 testes); IA propõe, cliente confirma no cartão, `request-refund` envia
- [x] `refundPolicy.ts` e respostas fixas do `support-assistant` falam em atendimento, não formulário
- [x] Bullet de atualização do reembolso acrescentado no `AGENTS.md`
- [ ] Testar com o Gemini de verdade depois do deploy (no local foi testado com a função simulada)

## Pagamentos (auditoria out/2026)
- [ ] ETAPA 3: expiração em modo simulação + aviso de 7 dias para migrados — aguarda aprovação
- [ ] Monitorar se algum webhook real foi recusado com 401
- [ ] Resolver Stripe (2 ativas) e MP (2 preapprovals) → [[Bugs conhecidos]]
- [ ] Apagar `validapay-overdue-check` após o diagnóstico

## Produto
- [ ] Repor saldo pré-pago do Google da `GEMINI_API_KEY`: a reserva direta da validação de fotos respondeu 402 em 16/11; fila continua aguardando, sem trocar modelo nem publicar sem veredito
- [ ] Decidir se os lembretes de conta ML pendente também vão por e-mail → [[Pagamento antes da conta de vendedor]]
- [ ] Conferir conversa real e cartão de reembolso no suporte admin (faltou acesso de admin)
- [ ] Reconferir os achados de ago/2026 listados em [[Bugs conhecidos]]

## Documentação
- [x] Corrigir §1–2 do `CLAUDE.md` (Vite, não Next.js) — feito em 2026-11-08
- [ ] Completar notas com o que surgir: crons exatos (`cron.job`), policies RLS das tabelas centrais
- Reexecutar `admin-close-aliexpress-listings` (execute, `retry_failed: true`) para os 32 anúncios AliExpress de vendedores com conexão ML expirada quando reconectarem, e para os 49 em análise caso o ML os reative.
- [x] **Lovable (26/11/2026, feito no commit 75f572fc):** em `generate-store-banner`, tirar do `promptTelaCheia` as frases que fixam o título à esquerda ("The left side is simply more of that same background" e "(the left side, or around the center…)") para valer o lado que vem na `scene`; e trocar 4K por 2K. Com a pessoa à esquerda, o texto fixo às vezes faz a IA dividir a imagem.
- [x] **Lovable (26/11/2026, feito em f3746a49):** `generate-store-banner` aceitar `formato: "detalhe"` (imagens dos cards e atalhos no estilo criativo da loja): prompt próprio (foto de detalhe da mesma campanha, sem espaço para título), 4:3 em 1K no Pro com queda para o Flash. Até lá o campo é descartado pelo zod e o detalhe sai como capa 16:9 (prompt colado no chat do Claude; a Lovable fez só a parte do lado esquerdo e do 2K em 75f572fc — reenviar só este pedido).
