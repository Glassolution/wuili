---
atualizado: 2026-11-17
fontes: [CLAUDE.md §11]
---
# Landing e cadastro

Regras completas no `CLAUDE.md` §11. Resumo:
- `/` = `src/pages/Index.tsx`, otimizada para celular 4G. Imagens WebP em `public/landing/` (script `scripts/otimizar-imagens-landing.sh`); use `<ImagemResponsiva>`, nunca `<picture>`.
- Botão principal → `/cadastro` (`LoginPage` no passo "Crie sua conta"). `/login` para quem já tem conta.
- Números reais via `landing-stats` (piso `LANDING_MIN_ASSINANTES`=50).
- Proibido: números/depoimentos inventados, promessa de ganho, "grátis" → [[Regras de comunicação]].
- **Hero do desktop (≥ 640px):** carrossel de fotos `pessoa-01..03` em tela cheia com headline "Comece a vender" + frase digitada (`useHeroCarousel`, `useTypewriter`, `HeroBackdrop`), botão branco e "Ver como funciona"; preload da `pessoa-01` no `index.html`. **Não mexer no desktop sem pedido explícito** — em 17/11/2026 ele foi trocado por um hero claro com mockup e voltou ao carrossel a pedido do dono. `LOJISTAS_ATIVOS_PISO` e `VENDAS_MES_LOJISTAS` (números informados pela operação) hoje só alimentam a `LandingMobile`.
- **Celular (< 640px):** página própria em `src/components/landing/LandingMobile.tsx`, escura e editorial: foto `pessoa-03` em tela cheia, headline fina, botão branco em pílula, painel com cards deslizantes (catálogo, Atlas, página de vendas), números, card "Como funciona", FAQ, chamada final e rodapé com o aviso. As seções do desktop ficam em `hidden sm:block`. Âncoras do celular têm sufixo `-mobile` (`scrollToSection` escolhe a visível). Hero do celular tem campo de e-mail: vai para o cadastro por estado de navegação (`state.email`, lido no `LoginPage` junto com `?email=`), nunca na URL, porque o Pixel da Meta envia a URL inteira. Header fica escuro no celular, com "Criar conta" sublinhado. Preload do `index.html` escolhe a imagem pela largura.
- Abaixo do hero (desktop): seção de prova visual (`#como-funciona`, `SecaoProvaVisual`). Barra de CTA fixa só no celular, quando o CTA do hero sai da tela.
- Não dizer que o envio é automático nem falar em teste grátis.
- Onboarding/quiz pós-cadastro: `/bem-vindo`, `/onboarding/*`, `src/lib/perfilDoQuiz.ts`.

Medição: [[Pixels e medição]].
