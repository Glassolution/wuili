# Redesenho do Fluxo de Usuário Velo

Fluxo travado em 5 estágios, com o fluxo antigo `/comecar` escondido da sidebar admin (rotas mantidas).

## Estágio 1 — Cadastro (fricção mínima)

**Rota:** `/signup` (nova, substitui parcialmente `/login`)

- Form único: email + senha. Sem cartão, sem nome, sem confirmação de email obrigatória para começar.
- Google OAuth opcional (já suportado no Cloud, mantém baixa fricção).
- Após cadastro → redireciona direto para `/onboarding/nicho`.
- Não mostra IA nem catálogo para visitante anônimo — só depois de criar conta.

**Motivo:** você resolveu o custo de geração aberto. Ninguém anônimo dispara IA.

## Estágio 2 — Onboarding-demo (o "reveal")

Cinco telas encadeadas, cada uma em rota própria pra permitir voltar:

### 2.1 `/onboarding/nicho`
Grid visual com 6 nichos (Moda, Eletrônicos, Casa & Jardim, Pets, Esporte & Fitness, Beleza). Ícones grandes, seleção única, botão Continuar. Referência visual: imagem 148 anexada.

### 2.2 `/onboarding/produto`
Mostra 6–9 produtos do catálogo Velo filtrados pelo nicho escolhido (query `catalog_products` por categoria, `stock_quantity > 0`). Usuário escolhe **UM**. Card com imagem, título, preço sugerido.

### 2.3 `/onboarding/gerando`
Labor illusion — 8–10 segundos com mensagens rotativas ("Analisando concorrentes...", "Escrevendo copy persuasiva...", "Montando a landing...", "Otimizando imagens..."). Barra de progresso. Enquanto isso, edge function `generate-sales-page` roda de verdade:
- Gemini gera: headline, subheadline, 3 benefícios, prova social fake plausível, CTA.
- Salva em nova tabela `generated_sales_pages` (colunas: id, user_id, catalog_product_id, headline, subheadline, benefits jsonb, cta_text, published boolean default false, slug text unique, created_at).

### 2.4 `/preview/:slug`
Landing single-product estilo Shopify:
- Hero com imagem grande + headline + subheadline + CTA "Comprar agora"
- Seção de 3 benefícios em cards
- Prova social (depoimentos gerados)
- Garantia + CTA final
- **Banner sticky topo**: "Modo Preview — publique para tornar público"
- **Coluna lateral (só visual, não clicável ainda)** com dois cards discretos:
  - "📦 Seu catálogo completo — 500+ produtos prontos"
  - "🚀 Publique no Mercado Livre em 1 clique"
- Ao clicar em "Comprar agora" (do lado consumidor): abre modal amigável "Esta é uma prévia — publique sua página para ativar vendas"

### 2.5 Botão "Publicar" fixo no rodapé da preview
Ao clicar → dispara Estágio 3.

## Estágio 3 — Paywall no publicar

Modal (não redirect) sobre a preview:
- Headline: "Publique sua página em velo.app/sua-loja"
- Lista de benefícios: link real, SSL, sem badge Velo, edições ilimitadas
- Um único plano visível (Pro / R$ X/mês) — sem tabela comparativa, sem escolha
- Botão único: "Assinar e publicar"
- Integra com fluxo Mercado Pago já existente (`mp-checkout`, `mp-webhook`)
- Após pagamento aprovado (webhook seta `subscriptions.status = 'active'`):
  - `generated_sales_pages.published = true`
  - `generated_sales_pages.slug` fica reservado
  - Redireciona pra `/bem-vindo`

**Route serving:** subdomínio Velo é resolvido por rota pública `/loja/:slug` que renderiza a página só se `published = true`. Sem custom domain de verdade nessa fase.

## Estágio 4 — Boas-vindas + upsell único

**Rota:** `/bem-vindo` (aparece uma vez, depois nunca mais)

Referência visual: imagem 146 + 150 anexadas.

- Título: "Bem-vindo, {nome}! 🎉"
- Subheadline: "Sua página está no ar em velo.app/{slug}"
- Botão secundário: "Ver minha página"
- Card de upsell grande:
  - **"Quer que a IA monte sua loja completa?"**
  - "Você acabou de ver funcionando com 1 produto. Deixa a Velo montar sua loja inteira com todos os produtos do seu nicho, prontos pra publicar no Mercado Livre."
  - Preço único: R$ 49 (one-time)
  - Botão "Sim, montar minha loja completa"
  - Link discreto embaixo: "Continuar sem"
- **Timer visual** (não bloqueia, é psicológico): "Esta oferta some quando você sair desta tela"
- Ao clicar em "Continuar sem" → modal de confirmação (imagem 151):
  - "Tem certeza?"
  - "Esta oferta única não voltará a aparecer."
  - Botões: "Cancelar" / "Sim, pular oferta"
- Após confirmação ou compra → redireciona pra `/dashboard` e dispara o tutorial.

Nova coluna em `profiles`: `full_store_upsell_status text` ('shown'|'accepted'|'skipped').

## Estágio 5 — Tutorial guiado 9 passos

Overlay no dashboard, um passo por vez, com destaque circular no elemento:
1. "Este é seu dashboard"
2. "Aqui está sua página publicada" (destaque no card da página)
3. "Catálogo — 500+ produtos do seu nicho" (destaque sidebar Catálogo)
4. "Crie mais páginas de vendas assim" (destaque botão Nova Página)
5. "Importe pro Mercado Livre em 1 clique" (destaque Integrações)
6. "Acompanhe pedidos aqui" (destaque Pedidos)
7. "Financeiro em tempo real" (destaque Transações)
8. "Suporte quando precisar" (destaque Ajuda)
9. "Pronto pra vender! 🚀"

- Rodapé: "Passo N de 9", botões "Anterior" / "Próximo" / "Pular tour"
- Estado persistido em `profiles.tutorial_completed boolean`
- Referência visual: imagem 149 anexada
- Nunca reaparece após concluir/pular

## Sidebar admin — limpeza

- Remover item "Criar Loja" do `AdminNewSidebar.tsx` e `AdminSidebar.tsx`
- Manter rotas `/comecar`, `/onboarding/lingua`, `/onboarding/persona`, `/onboarding/angulo-vendas`, `/onboarding/gerando-imagens`, `/onboarding/preparando-loja`, `/loja-gerada` funcionando (acesso via URL direta pra teste)

---

## Detalhes técnicos

### Migrations
```sql
CREATE TABLE public.generated_sales_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_product_id uuid REFERENCES public.catalog_products(id),
  slug text UNIQUE NOT NULL,
  headline text NOT NULL,
  subheadline text,
  benefits jsonb DEFAULT '[]'::jsonb,
  testimonials jsonb DEFAULT '[]'::jsonb,
  cta_text text DEFAULT 'Comprar agora',
  hero_image_url text,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_sales_pages TO authenticated;
GRANT SELECT ON public.generated_sales_pages TO anon;  -- páginas publicadas são públicas
GRANT ALL ON public.generated_sales_pages TO service_role;
ALTER TABLE public.generated_sales_pages ENABLE ROW LEVEL SECURITY;

-- Dono lê/escreve as próprias
CREATE POLICY "owner_all" ON public.generated_sales_pages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Público lê apenas publicadas
CREATE POLICY "public_read_published" ON public.generated_sales_pages FOR SELECT TO anon
  USING (published = true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_store_upsell_status text,
  ADD COLUMN IF NOT EXISTS tutorial_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_niche text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
```

### Edge Function nova
`supabase/functions/generate-sales-page/index.ts` — recebe `{ catalog_product_id }`, chama Lovable AI (`google/gemini-2.5-flash`) com prompt estruturado (output Zod: headline, subheadline, benefits[3], testimonials[3], cta_text), gera slug único a partir do título, insere em `generated_sales_pages`, retorna `{ slug }`.

### Arquivos frontend novos
- `src/pages/onboarding/NichoPage.tsx`
- `src/pages/onboarding/ProdutoPage.tsx`
- `src/pages/onboarding/GerandoPage.tsx`
- `src/pages/PreviewPage.tsx` — rota `/preview/:slug` e `/loja/:slug`
- `src/pages/BemVindoPage.tsx`
- `src/components/tutorial/TutorialOverlay.tsx` — dispara no primeiro load do dashboard se `!tutorial_completed`

### Arquivos alterados
- `src/App.tsx` — novas rotas
- `src/pages/LoginPage.tsx` — remover fricção extra, redirect pós-signup vai pra `/onboarding/nicho` se `!onboarding_completed_at`
- `src/components/admin/AdminNewSidebar.tsx` e `AdminSidebar.tsx` — esconder "Criar Loja"
- `src/lib/adminAccess.ts` (se necessário) — sem alteração de acesso, só visibilidade

### Não mexer
- Fluxo antigo `/comecar` e derivados: rotas continuam registradas em `src/App.tsx`, só saem da sidebar
- Não desconectar Mercado Livre nem CJ (já descontinuada)
- Não alterar RLS de tabelas existentes
- Não tocar em `AuthContext.tsx`

---

## Ordem de implementação

1. Migration (tabela + colunas em profiles)
2. Edge function `generate-sales-page`
3. Páginas onboarding (nicho, produto, gerando)
4. Página preview + rota pública `/loja/:slug`
5. Modal paywall + integração com `mp-checkout` existente + hook no `mp-webhook` para publicar página
6. Página bem-vindo + upsell
7. Tutorial overlay
8. Esconder "Criar Loja" da sidebar admin
9. Ajustar redirect pós-login no `LoginPage` conforme `onboarding_completed_at`

Cada passo é verificável isoladamente. Vou implementar em sequência e testar o build entre estágios grandes (após 3, 5, 7).