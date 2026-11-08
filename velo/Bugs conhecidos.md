---
atualizado: 2026-11-08
---
# Bugs conhecidos

Formato: **problema** — onde — origem/data. Ao corrigir, mova para "Resolvidos" com a data.

## Abertos (confirmados)
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
- Plano calculado de dois jeitos (`usePlan` vs cota de imagens IA) em quem tem 2 assinaturas.
- Botão "Simular Venda" grava pedidos falsos no banco real.
- "Fikri Store" (nome de kit de UI) na tela de detalhe de publicação.
- Restrição do "Start Mode" aparentemente desligada sem querer.
- 4 botões sem ação (3 em Saldos, 1 no chat de fornecedores); avisos de aprovar/rejeitar afiliado não aparecem.
- Muito código morto (páginas `*Old`, `DashboardRedesignPage`, ~37 componentes, ~34 pacotes).

## Resolvidos
- `CLAUDE.md` §1–2 dizia Next.js 14 e `src/app/` — corrigido para Vite + React Router em 2026-11-08.
- Widget `atlas-search` aceitava identidade informada pelo cliente — corrigido no commit `b5643859` (ago/2026).
