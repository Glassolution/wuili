# CLAUDE.md — Guia do Projeto Velo

## 1. Visão Geral

**Nome:** Velo  
**Slogan:** "Apenas venda."  
**O que é:** Plataforma de dropshipping com IA para iniciantes brasileiros. Permite que o usuário escolha produtos do catálogo Velo alimentado por scraping de fornecedores brasileiros, personalize com IA e publique no Mercado Livre e Shopee.
**Stack principal:** Next.js 14 + TypeScript + Tailwind CSS + Supabase + Lovable

---

## 2. Estrutura de Pastas

```
/
├── src/
│   ├── app/             # Rotas Next.js (App Router)
│   ├── components/      # Componentes React reutilizáveis
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Clientes e utilitários (supabase.ts, etc.)
│   ├── types/           # Tipos TypeScript globais
│   └── styles/          # CSS global
├── supabase/
│   ├── functions/       # Edge Functions (Deno/TypeScript)
│   └── migrations/      # Migrations SQL do banco
├── public/              # Assets estáticos (imagens, ícones)
└── CLAUDE.md
```

---

## 3. Stack e Tecnologias

| Camada       | Tecnologia                                      |
|--------------|-------------------------------------------------|
| Frontend     | React + TypeScript + Tailwind CSS               |
| Backend      | Supabase (PostgreSQL + Auth + Edge Functions + Storage) |
| IA           | Google Gemini via Supabase Edge Functions       |
| Integrações  | Mercado Livre OAuth + API, scrapers brasileiros de fornecedores |
| Deploy       | Lovable Cloud + Vercel                          |

---

## 4. Padrões do Projeto

- **Idioma da UI:** todos os textos, labels e mensagens de erro em **português brasileiro**
- **Edge Functions:** escritas em **Deno/TypeScript** (sem Node.js)
- **RLS:** habilitado em **todas** as tabelas do Supabase — nunca desativar sem revisão
- **Secrets:** acessados via `Deno.env.get('SECRET_NAME')` — **nunca hardcodados**
- **Moeda:** preços sempre em **BRL**
- **Conversão USD → BRL:** multiplicar por `5.0`
- **TypeScript:** evitar `any` sem justificativa explícita em comentário

---

## 5. Tabelas Principais do Supabase

| Tabela               | Descrição                                          |
|----------------------|----------------------------------------------------|
| `profiles`           | Dados do usuário (nome, plano, preferências)       |
| `user_integrations`  | Tokens OAuth do Mercado Livre e Shopee             |
| `catalog_products`   | Produtos coletados exclusivamente pelo scraping C7Drop |
| `user_publications`  | Anúncios publicados no Mercado Livre pelo usuário  |
| `cj_token_cache`     | Tabela legada descontinuada — não usar             |

> Todas as tabelas possuem RLS ativo. Sempre revisar policies antes de qualquer alteração de schema.

---

## 6. Edge Functions Existentes

| Função              | Descrição                                              |
|---------------------|--------------------------------------------------------|
| `ml-publish`        | Publica produto no Mercado Livre via API               |
| `ml-connect`        | Inicia fluxo OAuth do Mercado Livre                    |
| `ml-callback`       | Recebe callback OAuth e salva token em `user_integrations` |
| `scrape-c7drop`     | Scraper principal do catálogo Velo via C7Drop          |
| `catalog`           | Serve produtos paginados para o frontend               |
| `chat`              | IA conversacional via Gemini para geração de descrições|

---

## 7. Integrações e Credenciais

| Item                   | Valor / Localização                                              |
|------------------------|------------------------------------------------------------------|
| ML Client ID           | `5831446135077053`                                               |
| ML Redirect URI        | `https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/ml-callback` |
| Supabase Project Ref   | `nqzpoioxvbqavrtphtoa`                                           |
| Gemini API Key         | Secret `GEMINI_API_KEY` nas Edge Functions                       |

> **Todas as secrets ficam nas Edge Functions do Supabase. NUNCA no código-fonte.**

---

## 8. O Que NÃO Fazer

- Nunca hardcodar secrets, tokens ou API keys no código
- Nunca reintroduzir, chamar ou depender da API da CJ Dropshipping; essa integração foi descontinuada definitivamente
- Nunca usar dados mockados na interface — sempre dados reais do Supabase
- Nunca exibir produtos com `stock_quantity = 0`
- Nunca alterar RLS de tabelas sem revisar as policies existentes
- Nunca usar `any` em TypeScript sem comentário justificando
- Nunca criar rotas em `src/app/api/` — usar exclusivamente Supabase Edge Functions
- Nunca instalar pacotes Node.js para uso dentro de Edge Functions (são Deno)

---

## 9. Fluxo Principal

```
Usuário navega no catálogo Velo alimentado pelo scraping C7Drop
  → Importa o produto para sua conta
  → IA (Gemini) gera título e descrição otimizados
  → Usuário revisa e personaliza
  → Publica no Mercado Livre via OAuth (ml-publish)
  → Pedido registrado em user_publications
```

---

## 10. Identidade Visual

| Elemento       | Valor                                      |
|----------------|--------------------------------------------|
| Azul escuro    | `#1E3A8A`                                  |
| Azul elétrico  | `#2563EB`                                  |
| Neutros        | Branco `#FFFFFF` e Preto `#000000`         |
| Logo           | Nuvem preta com ícone de caixa/envio       |
| Fontes         | `Inter`, `system-ui`, sans-serif           |
| Fundo landing  | Gradiente azul/lilás escuro                |

---

## 11. Comandos Úteis

```bash
# Desenvolvimento local
npm run dev

# Build de produção
npm run build

# Deploy de Edge Function (via Supabase CLI)
supabase functions deploy <nome-da-function>

# Rodar migrations
supabase db push
```
