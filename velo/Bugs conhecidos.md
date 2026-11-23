---
atualizado: 2026-11-23
---
# Bugs conhecidos

Formato: **problema** — onde — origem/data. Ao corrigir, mova para "Resolvidos" com a data.

## Abertos (confirmados)
- ValidaPay: 34 linhas da auditoria ficaram inalteradas por PAID recente (15) ou estado não confirmado (22, com sobreposição de três); revisão individual necessária. A correção de acesso e auditoria horária tem 52 testes aprovados, mas ainda não foi publicada — 2026-11-23.
- **`README.md` é a spec antiga "Wuili"** com dados mock (contradiz "sem dados mock"). Não usar como referência. — nov/2026.
- **Check Deno do `ml-publish` com erros preexistentes.** — roadmap, nov/2026.
- **Stripe: 2 assinaturas ativas cobrando sem sincronizar período**; **MP: 2 preapprovals** pedem conferência manual. — roadmap (auditoria out/2026).
- **Central de Ajuda, coleção `pos-venda`:** card sem descrição (correção no `PROMPT_LOVABLE_COLECOES_AJUDA.md`, ainda não aplicada); resumo do artigo "Cliente comprou mas o fornecedor sumiu" mostra link Markdown cru com âncora antiga (`#pos-venda-fluxo`). — 2026-11-08.
- **`validapay-overdue-check`** é diagnóstico temporário: apagar depois do uso. — nov/2026.

## Achados de ago/2026 — status não reconferido
Fonte: `00_maestro_relatorio.md` (18–19/08/2026). Verificar no código antes de agir.
- Função das lojas públicas devolve `user_id` do dono a visitantes sem login → [[Lojas públicas e páginas de venda]]
- Descrição de produto renderizada sem sanitizar em 3 telas (2 públicas) — risco de XSS.
- Comissão de afiliado: código paga 20% recorrente; comentário de migration diz "30% uma vez" → [[Afiliados]]
- Scraper C7Drop sem agendamento automático (preços podem congelar) → [[C7Drop]]
- `ml-publish` não reconfere no banco se o produto continua liberado.
- Plano calculado de dois jeitos (`usePlan` vs cota de imagens IA) em quem tem 2 assinaturas: unificado no código em 23/11/2026, sem publicação.
- Botão "Simular Venda" grava pedidos falsos no banco real.
- "Fikri Store" (nome de kit de UI) na tela de detalhe de publicação.
- Restrição do "Start Mode" aparentemente desligada sem querer.
- 4 botões sem ação (3 em Saldos, 1 no chat de fornecedores); avisos de aprovar/rejeitar afiliado não aparecem.
- Muito código morto (páginas `*Old`, `DashboardRedesignPage`, ~37 componentes, ~34 pacotes).

## Resolvidos
- Status ValidaPay ativos com período vencido: 620 confirmados EXPIRED e 222 DEFAULT corrigidos em 23/11/2026, com backup reversível e exclusão de PAID recente/vitalícios/incertos. Nenhum período ou provedor legado alterado. Código de acesso compartilhado pronto, aguardando publicação.
- Publicação com fotos sem veredito quebrava antes da IA (Fire Stick, 16/11): reserva gravava "sem veredito" em coluna que não aceitava vazio; depois, evidência sem data de análise e chave repetida em nova tentativa; a fila automática travava após qualquer análise bem-sucedida (trava lia estado vazio como "bloqueado") e o aviso de 24h usava tipo de chamado inválido, derrubando toda rodada. Reserva da foto (45 s) podia expirar durante a reserva do Google e o resultado pago era descartado sem aviso. Corrigido com migrations 0061–0064; erros internos agora ficam em `ml_publish_errors` como `IMAGE_REVIEW_INTERNAL_ERROR` — 2026-11-17.
- AliExpress podia ser publicado por conta comum e consultado na ficha completa do Atlas; proteção restritiva no banco e autorização no servidor antes de publicar, sem mudar anúncios existentes — 2026-11-12. Ver [[Catálogo]].
- Anúncios AliExpress já no ar: em 2026-11-12 o dono mandou encerrar todos (ML não desfaz). Função admin `admin-close-aliexpress-listings` (preview/inspect/execute com confirmação), log em `aliexpress_listing_closures`. 160 encerrados; 49 o ML não deixou mexer (já fora do ar: em análise/proibido/excluído); 32 de 11 vendedores com conexão ML expirada ficaram sem confirmação. Ver [[Catálogo]].
- Suporte parava ao marcar `needs_human`, antes de um humano responder — removida a interrupção antecipada; resposta pública do admin/pausa manual continuam parando a IA, com conferência antes de enviar. Repetições filtradas e histórico completo — 2026-11-12.
- `CLAUDE.md` §1–2 dizia Next.js 14 e `src/app/` — corrigido para Vite + React Router em 2026-11-08.
- Widget `atlas-search` aceitava identidade informada pelo cliente — corrigido no commit `b5643859` (ago/2026).
