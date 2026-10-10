# AGENTS.md — Guia do Projeto Velo

## Visão Geral
Velo ("Apenas venda."): plataforma de dropshipping com IA para iniciantes brasileiros. O usuário escolhe produtos do catálogo (scraping C7Drop), personaliza com IA e publica no Mercado Livre e Shopee.
Stack: React + TypeScript + Tailwind (frontend); Supabase/Lovable Cloud (Postgres, Auth, Edge Functions Deno, Storage); Gemini via Edge Functions; deploy Lovable Cloud + Vercel.

## Padrões
- UI sempre em português brasileiro; preços em BRL; USD → BRL multiplica por 5.0.
- RLS ativo em todas as tabelas; revisar policies existentes antes de mudar schema.
- Secrets só via `Deno.env.get`; nunca no código-fonte.
- `any` só com comentário justificando.
- Regras de Edge Functions: ver `supabase/functions/AGENTS.md`.

## Tabelas principais
- `profiles`: dados do usuário (nome, plano, preferências, origem do anúncio).
- `user_integrations`: tokens OAuth do Mercado Livre e Shopee.
- `catalog_products`: produtos coletados só pelo scraping C7Drop.
- `user_publications`: anúncios publicados pelo usuário.
- `cj_token_cache`: legada, não usar.

## Integrações
- ML Client ID `5831446135077053`; redirect `https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/ml-callback`.
- Gemini: secret `GEMINI_API_KEY`.

## O que NÃO fazer
- Nunca reintroduzir a API da CJ Dropshipping (descontinuada).
- Nunca usar dados mockados na interface.
- Nunca exibir produtos com `stock_quantity = 0`.
- Nunca criar rotas `src/app/api/`; usar Edge Functions.

## Fluxo principal
Catálogo → importar produto → IA gera título/descrição → usuário revisa → publica no ML (`ml-publish`) → registro em `user_publications`.

## Identidade visual
Azul escuro `#1E3A8A`, azul elétrico `#2563EB`, branco/preto; logo nuvem preta com caixa; fundo da landing gradiente azul/lilás escuro.

- Servidor MCP (Claude etc.): definir ferramentas em `src/lib/mcp/` (o `supabase/functions/mcp` é gerado); só admins, via OAuth e RLS, somente leitura e sem tabelas de tokens — evita exposição de credenciais e ações com dinheiro.
