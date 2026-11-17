import { useState, type Ref } from "react";
import { ImagemResponsiva } from "@/components/landing/ImagemResponsiva";

/*
  Landing do celular (< 640px). Linguagem editorial escura: foto em tela cheia
  com headline fina, botão branco em pílula, painel escuro arredondado com cards
  deslizantes e cards escuros para os passos. O desktop continua em Index.tsx.

  Regras da landing (CLAUDE.md §11): nada de "grátis", nada de envio automático,
  nenhuma promessa de ganho. Os números chegam prontos de Index.tsx.
*/

type Passo = { titulo: string; texto: string };
type Pergunta = { question: string; answer: string };

type Props = {
  lojistasTexto: string;
  vendasMes: string;
  logado: boolean;
  heroCtaRef: Ref<HTMLButtonElement>;
  passos: Passo[];
  faq: Pergunta[];
  /** Registra o clique de cadastro (funil, TikTok, Meta) e leva ao cadastro. */
  onCriarConta: (evento: string) => void;
  onEntrar: () => void;
  onEvento: (evento: string) => void;
};

const FONTE = "[font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif] [font-feature-settings:normal]";
const TITULO = `font-light tracking-[-0.035em] text-white antialiased ${FONTE}`;

const CARDS = [
  {
    id: "catalogo",
    titulo: "Catálogo com margem na tela",
    texto: "Custo do fornecedor, preço sugerido e lucro de cada produto.",
  },
  {
    id: "atlas",
    titulo: "Atlas, seu agente de vendas",
    texto: "Peça ideias de produto e o próximo passo para vender.",
  },
  {
    id: "pagina",
    titulo: "Página de vendas pronta",
    texto: "Crie uma página para o produto em poucos cliques.",
  },
] as const;

function BotaoBranco({
  children,
  onClick,
  botaoRef,
}: {
  children: string;
  onClick: () => void;
  botaoRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={botaoRef}
      type="button"
      onClick={onClick}
      className="h-14 w-full rounded-full bg-white text-[17px] font-medium tracking-[-0.01em] text-black transition-transform duration-150 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function VisualCard({ id }: { id: (typeof CARDS)[number]["id"] }) {
  if (id === "catalogo") {
    return (
      <>
        <ImagemResponsiva
          base="card-catalogo-fundo"
          larguras={[800]}
          original="/landing/card-catalogo-fundo-800.webp"
          sizes="80vw"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 top-[14%] flex justify-center">
          <div className="h-full w-[62%] rounded-t-[26px] bg-[#0d0d0d] p-[5px] pb-0 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <div className="relative h-full overflow-hidden rounded-t-[21px] bg-white">
              <ImagemResponsiva
                base="hero-painel-catalogo"
                larguras={[480, 720]}
                original="/hero-painel-catalogo.webp"
                sizes="50vw"
                alt="Produto no catálogo da Velo com preço de venda, custo do fornecedor e margem"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-3.5 w-12 -translate-x-1/2 rounded-full bg-[#0d0d0d]" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (id === "atlas") {
    return (
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#1C2A3F_0%,#0E1726_100%)]">
        <div className="absolute inset-x-4 top-6 bottom-0 overflow-hidden rounded-t-[16px] bg-white">
          <ImagemResponsiva
            base="prova-atlas"
            larguras={[640, 960, 1360]}
            original="/prova-atlas.webp"
            sizes="80vw"
            alt="Conversa com o Atlas sugerindo um produto do catálogo"
            className="h-full w-full object-cover object-[0%_0%]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#E9E4DA]">
      <div className="absolute inset-x-4 top-6 bottom-0 overflow-hidden rounded-t-[16px] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
        <ImagemResponsiva
          base="card-pagina-vendas"
          larguras={[630]}
          original="/landing/card-pagina-vendas-630.webp"
          sizes="80vw"
          alt="Modelo de página de vendas da Velo com preço, variações e botão de compra"
          className="h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

export function LandingMobile({
  lojistasTexto,
  vendasMes,
  logado,
  heroCtaRef,
  passos,
  faq,
  onCriarConta,
  onEntrar,
  onEvento,
}: Props) {
  const [faqAberta, setFaqAberta] = useState<number | null>(0);
  const rotuloCta = logado ? "Ir para o painel" : "Criar minha conta";

  const irPara = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  return (
    <div className={`bg-black text-white ${FONTE}`}>
      {/* Hero: foto em tela cheia, escurecida onde o texto vive. */}
      <section className="relative isolate flex min-h-[min(100svh,780px)] flex-col overflow-hidden px-6 pb-20 pt-[108px]">
        <ImagemResponsiva
          base="pessoa-03"
          larguras={[640, 960, 1280]}
          original="/pessoa%2003.webp"
          sizes="100vw"
          alt=""
          aria-hidden
          prioritaria
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_50%]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/45" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.15)_32%,rgba(0,0,0,0.35)_62%,rgba(0,0,0,0.92)_100%)]"
        />

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-medium leading-[18px] text-white/90 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" aria-hidden="true" />+{lojistasTexto} lojistas ativos
        </span>

        <h1 className={`mt-6 text-[46px] leading-[1.04] ${TITULO}`}>Venda no Mercado Livre sem comprar estoque</h1>

        <p className="mt-6 text-[17px] leading-[1.5] tracking-[-0.01em] text-white/90">
          Escolha produtos de fornecedores brasileiros, publique no seu Mercado Livre em minutos e fique com a diferença para o
          custo do fornecedor.
        </p>

        <div className="mt-auto pt-10">
          {!logado && <p className="mb-3 text-[12px] leading-[16px] text-white/60">Leva menos de 1 minuto. Sem comprar estoque.</p>}
          <BotaoBranco botaoRef={heroCtaRef} onClick={() => onCriarConta("cta_hero_signup_click")}>
            {rotuloCta}
          </BotaoBranco>
          <button
            type="button"
            onClick={() => {
              onEvento("cta_how_it_works_click");
              irPara("como-funciona-mobile");
            }}
            className="mx-auto mt-5 flex min-h-[44px] items-center text-[16px] text-white underline decoration-white/60 underline-offset-[5px]"
          >
            Ver como funciona
          </button>
        </div>
      </section>

      {/* Painel escuro que sobe por cima do fim da foto. */}
      <section id="recursos-mobile" className="relative -mt-8 scroll-mt-16 rounded-t-[32px] border-t border-white/10 bg-[#0A1010] pb-16 pt-14">
        <h2 className={`px-6 text-[36px] leading-[1.08] ${TITULO}`}>
          Venda onde o Brasil compra.{" "}
          <span className="text-white/45">Catálogo pronto e anúncio no ar em minutos.</span>
        </h2>

        <ul
          className="mt-10 flex snap-x snap-mandatory gap-3 [scroll-padding-inline:24px] overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="O que você encontra na Velo"
        >
          {CARDS.map((card) => (
            <li key={card.id} className="w-[78%] shrink-0 snap-start">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[20px]">
                <VisualCard id={card.id} />
              </div>
              <p className="mt-4 text-[16px] font-medium leading-[22px] tracking-[-0.01em] text-white">{card.titulo}</p>
              <p className="mt-1 text-[14px] leading-[20px] text-white/55">{card.texto}</p>
            </li>
          ))}
        </ul>

        <dl className="mx-6 mt-12 grid grid-cols-[1fr_1.3fr_1fr] divide-x divide-white/10 border-y border-white/10 py-6">
          {[
            { numero: `${lojistasTexto}+`, rotulo: "lojistas assinantes" },
            { numero: vendasMes, rotulo: "vendidos por mês" },
            { numero: "100%", rotulo: "fornecedores nacionais" },
          ].map((item) => (
            <div key={item.rotulo} className="flex flex-col-reverse items-center px-1.5 text-center">
              <dt className="mt-1 text-[12px] leading-[16px] text-white/55">{item.rotulo}</dt>
              <dd className="whitespace-nowrap text-[22px] font-normal leading-[28px] tracking-[-0.03em] text-white">{item.numero}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Como funciona: card escuro com os três passos. */}
      <section id="como-funciona-mobile" className="scroll-mt-16 bg-black px-4 py-6">
        <div className="rounded-[24px] border border-white/[0.08] bg-[#0E1616] px-6 pb-8 pt-7">
          <div className="flex" aria-hidden="true">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white ring-2 ring-[#0E1616]">
              <img src="/brand/mercado-livre.png" alt="" width={200} height={200} className="h-8 w-8 object-contain" />
            </span>
            <span className="-ml-2 grid h-11 w-11 place-items-center rounded-full bg-white ring-2 ring-[#0E1616]">
              <ImagemResponsiva base="logo" larguras={[96]} original="/logo.png" sizes="28px" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            </span>
          </div>

          <h2 className={`mt-6 text-[34px] leading-[1.08] ${TITULO}`}>Como funciona</h2>
          <p className="mt-3 text-[16px] leading-[1.5] text-white/60">Três passos, tudo pelo painel da Velo.</p>

          <ol className="mt-8 space-y-7">
            {passos.map((passo, indice) => (
              <li key={passo.titulo} className="border-t border-white/10 pt-6">
                <span className="text-[13px] font-medium tabular-nums text-white/45">0{indice + 1}</span>
                <h3 className={`mt-2 text-[18px] font-semibold leading-[24px] tracking-[-0.01em] text-white ${FONTE}`}>{passo.titulo}</h3>
                <p className="mt-1.5 text-[15px] leading-[23px] text-white/60">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Perguntas frequentes. */}
      <section id="perguntas-frequentes-mobile" className="scroll-mt-16 bg-black px-6 pb-6 pt-16">
        <h2 className={`text-[34px] leading-[1.08] ${TITULO}`}>Perguntas frequentes</h2>
        <div className="mt-8 border-t border-white/10">
          {faq.map((item, indice) => {
            const aberta = faqAberta === indice;
            return (
              <div key={item.question} className="border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setFaqAberta(aberta ? null : indice)}
                  aria-expanded={aberta}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[17px] leading-[24px] tracking-[-0.01em] text-white">{item.question}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={`shrink-0 text-white/70 transition-transform duration-200 ${aberta ? "rotate-45" : ""}`}
                  >
                    <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
                  </svg>
                </button>
                {aberta && <p className="-mt-1 pb-5 text-[15px] leading-[23px] text-white/60">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Chamada final. */}
      <section className="bg-black px-6 pb-14 pt-16">
        <h2 className={`text-[38px] leading-[1.06] ${TITULO}`}>
          Seu próximo produto já está no catálogo. <span className="text-white/45">Comece hoje.</span>
        </h2>
        <div className="mt-8">
          <BotaoBranco onClick={() => onCriarConta("cta_final_signup_click")}>{rotuloCta}</BotaoBranco>
        </div>
        {!logado && (
          <button
            type="button"
            onClick={onEntrar}
            className="mx-auto mt-5 flex min-h-[44px] items-center text-[16px] text-white underline decoration-white/60 underline-offset-[5px]"
          >
            Já tenho conta
          </button>
        )}
      </section>

      <footer className="border-t border-white/10 bg-black px-6 pb-28 pt-8">
        <div className="flex items-center gap-2.5">
          <ImagemResponsiva base="logo" larguras={[96]} original="/logo.png" sizes="32px" alt="Velo" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-[22px] font-bold leading-none tracking-[-0.06em] text-white">Velo</span>
        </div>
        <nav className="mt-6 flex flex-wrap gap-x-6 text-[15px] text-white/70" aria-label="Rodapé">
          <button type="button" onClick={() => irPara("como-funciona-mobile")} className="min-h-[44px]">
            Como funciona
          </button>
          <button type="button" onClick={() => irPara("perguntas-frequentes-mobile")} className="min-h-[44px]">
            Perguntas frequentes
          </button>
          <button type="button" onClick={onEntrar} className="min-h-[44px]">
            Entrar
          </button>
        </nav>
        <p className="mt-6 text-[12px] leading-[18px] text-[#888]">
          A Velo é uma plataforma independente e não faz parte do Mercado Livre.
        </p>
      </footer>
    </div>
  );
}
