---
atualizado: 2026-11-08
fontes: [CLAUDE.md, AGENTS.md, roadmap.md]
---
# Visão geral do produto

**Velo** — "Apenas venda." Plataforma de dropshipping com IA para **iniciantes brasileiros**, a maioria no **celular com 4G**. (Nome antigo do projeto: *Wuili*; ainda aparece em pastas e no README.)

## Fluxo principal
1. Usuário escolhe produto no catálogo (scraping da [[C7Drop]]) → [[Catálogo]]
2. Importa para a conta; IA gera título e descrição → [[IA e modelos]]
3. Revisa, conecta o [[Mercado Livre]] e publica (`ml-publish`) → [[Publicação no Mercado Livre]]
4. Venda chega por webhook do ML → pedido em `dropship_orders`; o bot compra na C7Drop e paga com Pix → [[Pedidos e dropshipping]]
5. Para publicar precisa de plano pago → [[Assinatura e checkout]] / [[Planos e preços]]

## Peças em volta
- Suporte com IA + humano → [[Suporte com IA]]; assistente geral **Atlas** → [[Atlas]]
- [[Central de Ajuda]] (só por endereço direto), [[Cancelamento e reembolso]]
- [[Painel admin]], [[Afiliados]], [[Lojas públicas e páginas de venda]]
- Ferramentas extras de IA: imagens, vídeos, personagens, páginas com IA.

## Canais
Mercado Livre é o canal real. Shopee, TikTok Shop, Shopify e AliExpress têm código, mas são secundários/legados → [[Integrações legadas]].

Ver também: [[Regras de comunicação]], [[Arquitetura geral]].
