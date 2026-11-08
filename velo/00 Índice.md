---
atualizado: 2026-11-08
---
# Índice do cofre Velo

Ponto de entrada. Leia isto, abra **só** a nota do assunto e, se ainda precisar, os arquivos que ela aponta em "Onde está no código".

## Como usar
- Notas curtas: cada uma diz *o que é*, *regras*, *onde está no código* e *links*.
- Nota e código divergem → o código vale; corrija a nota.
- Reembolso, cancelamento e padrões recentes: o `AGENTS.md` da raiz é a fonte mais atual. As notas resumem e apontam para ele.
- Manutenção: ver [[Como manter o cofre]].

## Procura X? Abra Y
| Assunto | Nota |
|---|---|
| O que é a Velo, público, fluxo principal | [[Visão geral do produto]] |
| Planos, preços, limites | [[Planos e preços]] |
| O que nunca prometer / textos | [[Regras de comunicação]] |
| Stack, pastas, onde fica cada coisa | [[Arquitetura geral]] |
| Rotas e telas do app | [[Frontend]] |
| Qual Edge Function faz o quê | [[Edge Functions]] |
| Helpers do servidor (`_shared`) | [[Módulos compartilhados]] |
| Deploy, comandos, testes | [[Deploy e comandos]] |
| Tabelas (mapa geral) | [[Banco de dados]] |
| Migrations não aplicadas | [[Migrations pendentes]] |
| Mercado Livre | [[Mercado Livre]] |
| Pagamentos (ValidaPay) | [[ValidaPay]] |
| Fornecedor / catálogo | [[C7Drop]] |
| IA (Gemini, Lovable AI) | [[IA e modelos]] |
| Pixels TikTok/Meta/GA | [[Pixels e medição]] |
| E-mail transacional | [[E-mail]] |
| CJ, Stripe, Mercado Pago, Shopify… | [[Integrações legadas]] |
| Bugs e dívidas conhecidas | [[Bugs conhecidos]] |
| O que falta fazer | [[Próximos passos]] |

## Banco (por domínio)
[[Tabelas - Usuários e acesso]] · [[Tabelas - Catálogo]] · [[Tabelas - Publicações ML]] · [[Tabelas - Pedidos e dropshipping]] · [[Tabelas - Assinaturas e pagamentos]] · [[Tabelas - Reembolsos]] · [[Tabelas - Suporte e Central de Ajuda]] · [[Tabelas - Afiliados, lojas e outros]]

## Funcionalidades
[[Catálogo]] · [[Publicação no Mercado Livre]] · [[Pedidos e dropshipping]] · [[Assinatura e checkout]] · [[Cancelamento e reembolso]] · [[Central de Ajuda]] · [[Suporte com IA]] · [[Atlas]] · [[Painel admin]] · [[Landing e cadastro]] · [[Lojas públicas e páginas de venda]] · [[Afiliados]]

## Decisões (por quê)
[[Reembolso só pela Central de Ajuda]] · [[Cancelamento confirmado no provedor]] · [[Vitalício com pagamento único]] · [[Cooldown de reembolso]] · [[ME2 não bloqueia publicação]] · [[Token ML morto não é renovado]] · [[Webhook ML com fila]] · [[Vínculo anúncio-catálogo]] · [[Pagamento antes da conta de vendedor]] · [[Não lido do suporte calculado no banco]] · [[Admin paginado no servidor]] · [[MCP somente leitura]] · [[CJ Dropshipping descontinuada]] · [[Reembolso de cortesia]] · [[Validação de imagens do catálogo]] · [[Cofre Obsidian como memória]]

## Fontes de verdade (quando a nota não basta)
- Regras recentes: `AGENTS.md` e `supabase/functions/AGENTS.md`.
- Esquema do banco: `src/integrations/supabase/types.ts` (gerado; não tem o que está em [[Migrations pendentes]]).
- Histórico de entregas: `roadmap.md`.
- **Desatualizados, não usar como verdade:** `README.md` (spec antiga "Wuili" com dados mock), relatórios `00_`–`03_*_relatorio.md` (ago/2026), `SECURITY_*.md`, `*_LAYOUT.md`/`SIDEBAR_*.md` (mai/2026).
