import { useRef, type CSSProperties } from "react";
import {
  Activity,
  Apple,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Dumbbell,
  Heart,
  Leaf,
  PackageOpen,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  X,
} from "lucide-react";

import { formatPriceBRL as formatBRL } from "@/lib/priceFormat";
import {
  buildGallery,
  colorSwatch,
  imageAt,
  isColorGroup,
  renderRichText as renderRichTextShared,
  resolveTone as resolveToneShared,
  scrollCarousel,
  Stars,
  useStoreReviewSummary,
  type ProductTemplateProps,
} from "@/components/store-templates/productTemplateShared";

export type { ProductTemplateProps, RelatedProduct } from "@/components/store-templates/productTemplateShared";

/**
 * Único template de página de produto da Velo.
 *
 * A estrutura e o visual seguem a referência aprovada: dobra de compra em duas
 * colunas, seções alternando verde escuro e creme, anéis de estatística,
 * comparativo, depoimentos, produtos recomendados e barra fixa de compra.
 *
 * Três regras que explicam as decisões daqui:
 *
 * 1. Dado do produto é sempre dinâmico. Título, preço, fotos, variações e
 *    produtos recomendados vêm do cadastro; nada de valor fixo no código.
 * 2. Nada de número inventado. Nota, quantidade de avaliações, depoimentos e
 *    as porcentagens de "o que os clientes relatam" saem de avaliações reais
 *    (store_reviews). Sem avaliação, esses blocos entram em estado vazio —
 *    fabricar prova social é publicidade enganosa (CDC art. 37).
 * 3. Interação sem estado React onde dá. Galeria, variações e acordeão usam
 *    input + CSS (`:has`), porque o editor aplica as edições do lojista
 *    direto no DOM já montado: um re-render apagaria essas edições.
 *
 * Todo texto e ícone carrega `data-editor-*`, então o lojista edita qualquer
 * bloco pelo canvas do editor.
 */

// --- Identidade visual ------------------------------------------------------

/** Verde escuro das seções de destaque. */
const INK = "#23371F";
/** Creme das seções claras. */
const CREAM = "#F7F8EC";
/** Verde claro dos selos, anéis e destaques sobre fundo escuro. */
const SOFT = "#E6EFC7";
/** Cinza das molduras de foto. */
const FRAME = "#EDEDEB";

// --- Ajustes deste template -------------------------------------------------

const resolveTone = (accent: string | undefined) => resolveToneShared(accent, INK);
const renderRichText = (text: string) => renderRichTextShared(text, "font-bold text-[#1A1D19]");

// --- Blocos pequenos --------------------------------------------------------

/** Anel de progresso das estatísticas. `percent` null = ainda sem dado. */
const StatRing = ({ percent, label, note }: { percent: number | null; label: string; note: string }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = percent === null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-6 text-center">
      <div className="relative mx-auto h-[104px] w-[104px]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="4" />
          {/* Sem dado o arco não é desenhado: com `strokeLinecap: round`, um
              arco de 0% ainda pintaria um pontinho — parece 1% preenchido. */}
          {filled > 0 ? (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={SOFT}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(filled / 100) * circumference} ${circumference}`}
            />
          ) : null}
        </svg>
        <span
          data-editor-type="text"
          className="absolute inset-0 flex items-center justify-center text-[24px] font-bold text-white"
        >
          {percent === null ? "—" : `${Math.round(percent)}%`}
        </span>
      </div>
      <p data-editor-type="text" className="mt-4 text-[17px] font-bold leading-tight text-white">
        {label}
      </p>
      <p data-editor-type="text" className="mt-1 text-[13px] text-white/60">
        {note}
      </p>
    </div>
  );
};

const CarouselArrows = ({
  onPrev,
  onNext,
  tone,
}: {
  onPrev: () => void;
  onNext: () => void;
  tone: string;
}) => (
  <>
    <button
      type="button"
      onClick={onPrev}
      aria-label="Anterior"
      className="absolute -left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] transition hover:brightness-95"
      style={{ color: tone }}
    >
      <ChevronLeft size={19} />
    </button>
    <button
      type="button"
      onClick={onNext}
      aria-label="Próximo"
      className="absolute -right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] transition hover:brightness-95"
      style={{ color: tone }}
    >
      <ChevronRight size={19} />
    </button>
  </>
);

// --- Template ---------------------------------------------------------------

const ProductPageTemplate = ({
  brand,
  title,
  description,
  price,
  originalPrice,
  image,
  images,
  productId,
  projectId,
  accent,
  mobile = false,
  variants = [],
  relatedProducts = [],
}: ProductTemplateProps) => {
  const tone = resolveTone(accent);
  const gallery = buildGallery(images, image);
  const hasDiscount = Boolean(originalPrice && originalPrice > price);
  const discount = hasDiscount ? Math.round((1 - price / (originalPrice as number)) * 100) : 0;
  // Responsividade de verdade: a página nasce em uma coluna e abre em duas a
  // partir de `lg`. `mobile` é o preview de celular do editor, que trava em uma
  // coluna independentemente da largura da janela.
  const twoColumns = mobile ? "" : "lg:grid-cols-2";

  // Avaliações reais da loja. Sem projeto (preview do editor) ou sem avaliação,
  // os blocos de prova social ficam em estado vazio em vez de inventar número.
  const reviewSummary = useStoreReviewSummary(projectId);
  const { reviews, count: reviewCount, average, distribution } = reviewSummary;
  const percentOf = (value: number) => (reviewCount > 0 ? (value / reviewCount) * 100 : null);
  const stats: Array<{ percent: number | null; label: string; note: string }> = [
    { percent: percentOf(distribution[5]), label: "Deram 5 estrelas", note: "Entre quem já avaliou" },
    {
      percent: percentOf(distribution[4] + distribution[5]),
      label: "Recomendariam",
      note: "Avaliaram com 4 ou 5 estrelas",
    },
    { percent: average === null ? null : (average / 5) * 100, label: "Nota média", note: "Média de todas as avaliações" },
    {
      percent: percentOf(reviews.filter((review) => review.comment.trim().length > 0).length),
      label: "Deixaram um comentário", note: "Contaram como foi a experiência",
    },
  ];

  const reviewsTrack = useRef<HTMLDivElement>(null);
  const relatedTrack = useRef<HTMLDivElement>(null);
  const featuredTrack = useRef<HTMLDivElement>(null);

  // Depoimentos do bloco em destaque: avaliação real ganha do placeholder. Os
  // placeholders existem para o bloco não sumir numa loja recém-criada — o
  // lojista troca o texto de cada cartão pelo canvas do editor.
  const featuredTestimonials: Array<{
    id: string;
    authorName: string;
    rating: number;
    comment: string;
    photo?: string;
  }> =
    reviews.length > 0
      ? reviews.slice(0, 6).map((review) => ({
          id: review.id,
          authorName: review.authorName,
          rating: review.rating,
          comment: review.comment,
        }))
      : [
          {
            id: "placeholder-1",
            authorName: "Nome do cliente",
            rating: 5,
            comment: "Escreva aqui o depoimento de um cliente real da sua loja — o que ele resolveu com o produto.",
          },
          {
            id: "placeholder-2",
            authorName: "Nome do cliente",
            rating: 5,
            comment: "Um segundo depoimento ajuda quem está em dúvida a se enxergar na compra.",
          },
          {
            id: "placeholder-3",
            authorName: "Nome do cliente",
            rating: 5,
            comment: "Depoimento sobre entrega, atendimento ou qualidade — o que mais gera dúvida antes de comprar.",
          },
        ];

  const galleryVars = { "--velo-tone": tone } as CSSProperties;

  return (
    <div className="bg-white text-[#1A1D19]" style={galleryVars}>
      {/* CSS das interações sem estado: galeria, variações e acordeão trocam
          via input:checked + :has, então nada re-renderiza. */}
      <style>{`
        .velo-shot { display: none; }
        .velo-gallery:has(#velo-shot-0:checked) .velo-shot-0,
        .velo-gallery:has(#velo-shot-1:checked) .velo-shot-1,
        .velo-gallery:has(#velo-shot-2:checked) .velo-shot-2,
        .velo-gallery:has(#velo-shot-3:checked) .velo-shot-3,
        .velo-gallery:has(#velo-shot-4:checked) .velo-shot-4,
        .velo-gallery:has(#velo-shot-5:checked) .velo-shot-5 { display: flex; }
        .velo-thumb { border: 1.5px solid rgba(0,0,0,0.08); }
        .velo-thumb:has(input:checked) { border-color: var(--velo-tone); }
        .velo-chip { border: 1.5px solid rgba(0,0,0,0.12); }
        .velo-chip:has(input:checked) { border-color: var(--velo-tone); box-shadow: inset 0 0 0 1px var(--velo-tone); }
        .velo-track { scrollbar-width: none; }
        .velo-track::-webkit-scrollbar { display: none; }
        .velo-fold summary::-webkit-details-marker { display: none; }
        .velo-fold[open] .velo-fold-chevron { transform: rotate(180deg); }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Dobra de compra                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 py-8 sm:px-8">
        {/* `items-start` é o que permite a coluna da galeria grudar: sem ele o
            item de grid estica até a altura da linha e não sobra caminho para o
            sticky percorrer. */}
        <div className={`mx-auto grid max-w-[1240px] items-start gap-8 lg:gap-12 ${twoColumns}`}>
          {/* Galeria — fica fixa enquanto a coluna de compra rola ao lado.
              O deslocamento do topo é o mesmo em todas as telas para a foto não
              encostar na barra do editor. */}
          <div className="velo-gallery lg:sticky lg:top-6 lg:self-start">
            {/* O teto de altura é o que mantém o sticky utilizável em telas
                baixas: sem ele, a moldura quadrada passa da viewport e o rodapé
                da galeria fica sempre fora da tela. A foto é object-contain, então
                acompanha o espaço que sobra. */}
            <div
              className="relative flex aspect-square max-h-[62vh] items-center justify-center overflow-hidden rounded-[14px] p-10"
              style={{ backgroundColor: FRAME }}
            >
              {gallery.map((photo, index) => (
                <span key={photo} className={`velo-shot velo-shot-${index} h-full w-full items-center justify-center`}>
                  <img
                    data-editor-type="image"
                    data-editor-product="true"
                    data-editor-product-id={productId}
                    src={photo}
                    alt={index === 0 ? title : ""}
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
              ))}
            </div>

            {gallery.length > 1 ? (
              <div className="mt-3 flex gap-3">
                {gallery.slice(0, 6).map((photo, index) => (
                  <label
                    key={photo}
                    className="velo-thumb flex aspect-square w-[19%] cursor-pointer items-center justify-center overflow-hidden rounded-[12px] p-2"
                    style={{ backgroundColor: FRAME }}
                  >
                    <input
                      type="radio"
                      name="velo-shot"
                      id={`velo-shot-${index}`}
                      defaultChecked={index === 0}
                      className="sr-only"
                      aria-label={`Foto ${index + 1}`}
                    />
                    <img
                      data-editor-type="image"
                      data-editor-product="true"
                      data-editor-product-id={productId}
                      src={photo}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {/* Compra */}
          <div className="flex flex-col">
            {/* Nota da loja. Com avaliações reais (store_reviews) os números saem
                delas; sem avaliação ainda, ficam como texto editável para o
                lojista informar a nota que ele pratica — quem publica responde
                pelo número, então o padrão abaixo é placeholder, não promessa. */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Stars value={average ?? 5} size={17} />
              <span data-editor-type="text" className="text-[14.5px] font-bold">
                {average !== null ? `${average.toFixed(1).replace(".", ",")}/5` : "5,0/5"}
              </span>
              <span data-editor-type="text" className="text-[14.5px] text-black/55">
                {reviewCount > 0
                  ? `em ${reviewCount} ${reviewCount === 1 ? "avaliação" : "avaliações"}`
                  : "com base nas avaliações da loja"}
              </span>
            </div>

            <h1
              data-editor-type="text"
              className="mt-3.5 text-[34px] font-bold leading-[1.05] tracking-[-0.025em] md:text-[42px]"
            >
              {title}
            </h1>

            {/* Selo de destaque — o lojista troca o texto pelo que for verdade
                na loja dele ("Mais vendido", "Novidade", "Últimas unidades"). */}
            <span
              data-editor-type="text"
              className="mt-3.5 inline-flex w-fit items-center rounded-[8px] px-3 py-1.5 text-[13px] font-bold"
              style={{ backgroundColor: SOFT, color: INK }}
            >
              Mais vendido
            </span>

            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span data-editor-type="text" className="text-[27px] font-bold tracking-[-0.02em]">
                {formatBRL(price)}
              </span>
              {/* Preço "de" e desconto só aparecem com promoção real cadastrada
                  no produto — preço de referência inventado é propaganda
                  enganosa (CDC art. 37). */}
              {hasDiscount ? (
                <>
                  <span className="text-[19px] font-medium text-black/35 line-through">
                    {formatBRL(originalPrice as number)}
                  </span>
                  <span
                    data-editor-type="text"
                    className="translate-y-[-2px] rounded-[7px] px-2.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.04em]"
                    style={{ backgroundColor: SOFT, color: INK }}
                  >
                    Economize {discount}%
                  </span>
                </>
              ) : null}
            </div>

            {/* Descrição do produto. Aceita marcação leve (**negrito** e
                __sublinhado__) para os trechos de destaque, como na referência —
                sem HTML solto, que viria do fornecedor e é risco de injeção. */}
            <p data-editor-type="text" className="mt-4 max-w-[560px] text-[15px] leading-[1.65] text-black/70">
              {renderRichText(description)}
            </p>

            <div className="mt-6 h-px w-full bg-black/[0.09]" />

            {/* Benefícios editáveis: o lojista troca por lista real do produto. */}
            <ul className="mt-6 space-y-4">
              {[
                [Leaf, "Feito com materiais selecionados"],
                [Apple, "Qualidade conferida antes do envio"],
                [Droplet, "Pronto para usar no dia a dia"],
                [Heart, "Pensado para durar na sua rotina"],
              ].map(([Icon, label]) => {
                const BenefitIcon = Icon as typeof Leaf;
                return (
                  <li key={label as string} className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10">
                      <BenefitIcon size={18} data-editor-icon="true" style={{ color: tone }} />
                    </span>
                    <span data-editor-type="text" className="text-[15px] text-black/80">
                      {label as string}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Variações reais do fornecedor. Produto sem variação não mostra
                seletor nenhum. */}
            {variants.map((group) => (
              <div key={group.name} className="mt-7">
                <p
                  data-editor-type="text"
                  className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-black/50"
                >
                  {group.name}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {group.options.map((option) => (
                    <label
                      key={option}
                      className="velo-chip flex cursor-pointer items-center gap-2 rounded-[10px] bg-white px-3.5 py-2.5 text-[14px] font-semibold"
                    >
                      <input
                        type="radio"
                        name={`velo-variant-${group.name}`}
                        defaultChecked={option === group.options[0]}
                        className="sr-only"
                      />
                      {isColorGroup(group.name) ? (
                        <span
                          className="h-5 w-5 rounded-[6px] border border-black/10"
                          style={{ backgroundColor: colorSwatch(option) }}
                        />
                      ) : null}
                      <span data-editor-type="text">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              data-editor-role="button"
              className="mt-7 flex h-[62px] w-full items-center justify-center gap-3 rounded-[10px] text-[17px] font-bold text-white transition hover:brightness-110"
              style={{ backgroundColor: tone }}
            >
              <ShoppingCart size={20} />
              <span data-editor-type="text">Adicionar ao carrinho</span>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {["Pix", "Visa", "Mastercard", "Elo", "Boleto", "Cartão"].map((method) => (
                <span
                  key={method}
                  data-editor-type="text"
                  className="rounded-[7px] border border-black/10 bg-white px-3 py-1.5 text-[11.5px] font-bold text-black/65"
                >
                  {method}
                </span>
              ))}
            </div>

            {/* Depoimento em destaque. Com avaliações reais, são elas que rodam
                aqui; sem nenhuma, ficam três cartões editáveis pelo canvas para
                o lojista colocar depoimentos que ele tenha recebido. */}
            <div className="relative mt-7">
              <div ref={featuredTrack} className="velo-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth">
                {featuredTestimonials.map((item, index) => (
                  <figure
                    key={item.id}
                    className="w-full shrink-0 snap-start rounded-[14px] border border-black/[0.08] bg-[#FCFCF7] p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-bold text-white"
                        style={{ backgroundColor: tone }}
                      >
                        {item.photo ? (
                          <img data-editor-type="image" src={item.photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          item.authorName.trim().charAt(0).toUpperCase() || "?"
                        )}
                      </span>
                      <figcaption className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span data-editor-type="text" className="truncate text-[14px] font-bold">
                            {item.authorName}
                          </span>
                          <BadgeCheck size={15} className="shrink-0" style={{ color: tone }} />
                        </span>
                        <Stars value={item.rating} size={13} />
                      </figcaption>
                      <span className="shrink-0 text-[11.5px] font-semibold text-black/35">
                        {index + 1}/{featuredTestimonials.length}
                      </span>
                    </div>
                    <blockquote data-editor-type="text" className="mt-3 text-[14px] leading-[1.6] text-black/70">
                      "{item.comment}"
                    </blockquote>
                  </figure>
                ))}
              </div>

              {featuredTestimonials.length > 1 ? (
                <div className="mt-2.5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => scrollCarousel(featuredTrack.current, -1)}
                    aria-label="Depoimento anterior"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white transition hover:bg-black/[0.04]"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel(featuredTrack.current, 1)}
                    aria-label="Próximo depoimento"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white transition hover:bg-black/[0.04]"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Pesquisa + marcos de uso                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 py-14 sm:px-8" style={{ backgroundColor: INK }}>
        <div className={`mx-auto grid max-w-[1240px] items-start gap-10 lg:gap-14 ${twoColumns}`}>
          <div className="aspect-square overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
            {imageAt(gallery, 1) ? (
              <img data-editor-type="image" src={imageAt(gallery, 1)} alt="" className="h-full w-full object-contain p-10" />
            ) : null}
          </div>

          <div>
            <h2
              data-editor-type="text"
              className="text-[32px] font-bold leading-[1.12] tracking-[-0.02em] text-white md:text-[40px]"
            >
              Feito com cuidado, aprovado no uso real
            </h2>
            <p data-editor-type="text" className="mt-5 text-[15px] leading-[1.65] text-white/70">
              {description}
            </p>

            <div className="mt-8">
              {[
                ["7 dias", "Primeiras impressões", "O tempo de tirar da caixa, testar e entender como encaixa na sua rotina."],
                ["14 dias", "Virando hábito", "Você já sabe onde ele faz diferença e usa sem pensar duas vezes."],
                ["21 dias", "Rotina consolidada", "O uso vira automático e o resultado aparece com regularidade."],
                ["30 dias", "Benefício percebido", "Ao completar o mês fica claro o que mudou no seu dia a dia."],
              ].map(([badge, foldTitle, text]) => (
                <details key={badge} className="velo-fold border-b border-white/15 py-4">
                  <summary className="flex cursor-pointer list-none flex-col gap-2">
                    <span
                      data-editor-type="text"
                      className="w-fit rounded-[7px] px-2.5 py-1 text-[12px] font-bold"
                      style={{ backgroundColor: SOFT, color: INK }}
                    >
                      {badge}
                    </span>
                    <span className="flex items-center justify-between gap-4">
                      <span data-editor-type="text" className="text-[17px] font-semibold text-white">
                        {foldTitle}
                      </span>
                      <ChevronDown size={18} className="velo-fold-chevron shrink-0 text-white/60 transition-transform" />
                    </span>
                  </summary>
                  <p data-editor-type="text" className="mt-3 text-[14px] leading-[1.6] text-white/65">
                    {text}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Base do dia a dia + selos (com transição diagonal)               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative bg-white px-5 pb-24 pt-16 sm:px-8">
        <div className={`mx-auto grid max-w-[1240px] items-center gap-10 lg:gap-16 ${twoColumns}`}>
          <div>
            <h2
              data-editor-type="text"
              className="text-[32px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[40px]"
              style={{ color: INK }}
            >
              A base do seu dia a dia
            </h2>
            <p data-editor-type="text" className="mt-5 max-w-[520px] text-[15px] leading-[1.65] text-black/65">
              Simples de usar, feito para durar e pronto para entrar na sua rotina sem complicação.
            </p>

            <button
              type="button"
              data-editor-role="button"
              className="mt-7 h-[58px] w-full rounded-[10px] text-[16px] font-bold text-white transition hover:brightness-110 sm:w-[320px]"
              style={{ backgroundColor: tone }}
            >
              <span data-editor-type="text">Comprar agora</span>
            </button>

            <div className="mt-8 grid max-w-[520px] grid-cols-3 gap-4">
              {[
                [Truck, "Envio rápido"],
                [ShieldCheck, "Garantia de 7 dias"],
                [RotateCcw, "Troca facilitada"],
              ].map(([Icon, label]) => {
                const SealIcon = Icon as typeof Truck;
                return (
                  <div key={label as string} className="flex flex-col items-center gap-2 text-center">
                    <SealIcon size={24} data-editor-icon="true" style={{ color: INK }} />
                    <span data-editor-type="text" className="text-[13px] font-semibold leading-tight text-black/70">
                      {label as string}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="aspect-square overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
            {imageAt(gallery, 2) ? (
              <img data-editor-type="image" src={imageAt(gallery, 2)} alt="" className="h-full w-full object-contain p-10" />
            ) : null}
          </div>
        </div>

        {/* Transição diagonal para a seção escura seguinte. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px]"
          style={{ backgroundColor: INK, clipPath: "polygon(0 100%, 100% 34%, 100% 100%)" }}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Por que faz parte da rotina                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 py-16 sm:px-8" style={{ backgroundColor: INK }}>
        <div className="mx-auto max-w-[1240px]">
          <h2
            data-editor-type="text"
            className="text-center text-[32px] font-bold leading-[1.12] tracking-[-0.02em] text-white md:text-[40px]"
          >
            Por que ele merece um lugar na sua rotina
          </h2>
          <p data-editor-type="text" className="mx-auto mt-4 max-w-[760px] text-center text-[15px] leading-[1.65] text-white/70">
            Os pontos que mais aparecem quando alguém decide levar este produto para casa.
          </p>

          <div className="mt-11 rounded-[20px] border border-white/10 p-6 sm:p-10">
            <div className={`grid items-center gap-8 lg:gap-10 ${mobile ? "" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]"}`}>
              <div className="grid gap-10">
                {[
                  [Heart, "Qualidade no detalhe", "Acabamento conferido peça por peça antes de sair do estoque."],
                  [Leaf, "Uso simples", "Nada de manual complicado: dá para usar já no primeiro dia."],
                ].map(([Icon, cardTitle, text]) => {
                  const CardIcon = Icon as typeof Heart;
                  return (
                    <div key={cardTitle as string} className="text-center lg:text-left">
                      <span
                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full lg:mx-0"
                        style={{ backgroundColor: SOFT }}
                      >
                        <CardIcon size={20} data-editor-icon="true" style={{ color: INK }} />
                      </span>
                      <h3 data-editor-type="text" className="mt-4 text-[19px] font-bold text-white">
                        {cardTitle as string}
                      </h3>
                      <p data-editor-type="text" className="mt-2 text-[14px] leading-[1.6] text-white/65">
                        {text as string}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-full" style={{ backgroundColor: FRAME }}>
                {imageAt(gallery, 3) ? (
                  <img data-editor-type="image" src={imageAt(gallery, 3)} alt="" className="h-full w-full object-contain p-10" />
                ) : null}
              </div>

              <div className="grid gap-10">
                {[
                  [Dumbbell, "Feito para aguentar", "Materiais escolhidos para o uso frequente, não para a vitrine."],
                  [Activity, "Resultado consistente", "Entrega o mesmo desempenho do primeiro ao último dia."],
                ].map(([Icon, cardTitle, text]) => {
                  const CardIcon = Icon as typeof Dumbbell;
                  return (
                    <div key={cardTitle as string} className="text-center lg:text-right">
                      <span
                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full lg:ml-auto lg:mr-0"
                        style={{ backgroundColor: SOFT }}
                      >
                        <CardIcon size={20} data-editor-icon="true" style={{ color: INK }} />
                      </span>
                      <h3 data-editor-type="text" className="mt-4 text-[19px] font-bold text-white">
                        {cardTitle as string}
                      </h3>
                      <p data-editor-type="text" className="mt-2 text-[14px] leading-[1.6] text-white/65">
                        {text as string}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. O que os clientes relatam (dados reais de store_reviews)          */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 pb-16 sm:px-8" style={{ backgroundColor: INK }}>
        <div className="mx-auto max-w-[1240px]">
          <h2
            data-editor-type="text"
            className="text-center text-[30px] font-bold tracking-[-0.02em] text-white md:text-[36px]"
          >
            O que os clientes relatam
          </h2>

          {reviewCount === 0 ? (
            <p data-editor-type="text" className="mx-auto mt-4 max-w-[720px] text-center text-[14px] text-white/60">
              Os números aparecem sozinhos assim que os primeiros clientes avaliarem a sua loja.
            </p>
          ) : null}

          <div className={`mt-9 grid items-center gap-8 ${mobile ? "" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]"}`}>
            <div className="grid gap-5 sm:grid-cols-2">
              {stats.map((stat) => (
                <StatRing key={stat.label} percent={stat.percent} label={stat.label} note={stat.note} />
              ))}
            </div>
            <div className="aspect-square overflow-hidden rounded-[16px]" style={{ backgroundColor: FRAME }}>
              {imageAt(gallery, 4) ? (
                <img data-editor-type="image" src={imageAt(gallery, 4)} alt="" className="h-full w-full object-contain p-10" />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Comparativo + faixa de menções                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className={`mx-auto grid max-w-[1240px] items-center gap-10 lg:gap-16 ${twoColumns}`}>
          <div>
            <h2
              data-editor-type="text"
              className="text-[32px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[40px]"
              style={{ color: INK }}
            >
              Por que escolher o nosso
            </h2>
            <p data-editor-type="text" className="mt-5 max-w-[520px] text-[15px] leading-[1.65] text-black/65">
              A comparação que o cliente faz antes de decidir — deixe explícito o que a sua loja entrega e a concorrência não.
            </p>
            <button
              type="button"
              data-editor-role="button"
              className="mt-7 h-[58px] w-full rounded-[10px] text-[16px] font-bold text-white transition hover:brightness-110 sm:w-[320px]"
              style={{ backgroundColor: tone }}
            >
              <span data-editor-type="text">Quero o meu</span>
            </button>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Pix", "Visa", "Mastercard", "Elo", "Boleto"].map((method) => (
                <span
                  key={method}
                  data-editor-type="text"
                  className="rounded-[7px] border border-black/10 bg-white px-3 py-1.5 text-[11.5px] font-bold text-black/65"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[340px] rounded-[16px] border border-black/[0.08]">
              <div className="grid grid-cols-[1fr_110px_110px] items-center border-b border-black/[0.08] px-4 py-4">
                <span />
                <span data-editor-type="text" className="text-center text-[13.5px] font-bold" style={{ color: INK }}>
                  Nosso produto
                </span>
                <span data-editor-type="text" className="text-center text-[13.5px] font-semibold text-black/50">
                  Outros
                </span>
              </div>
              {[
                "Fácil de usar",
                "Material de qualidade",
                "Conferido antes do envio",
                "Suporte em português",
                "Custo-benefício",
              ].map((row, index, all) => (
                <div
                  key={row}
                  className={`grid grid-cols-[1fr_110px_110px] items-center px-4 py-4 ${
                    index === all.length - 1 ? "" : "border-b border-black/[0.06]"
                  }`}
                >
                  <span data-editor-type="text" className="text-[14px] text-black/75">
                    {row}
                  </span>
                  <span className="flex justify-center rounded-[8px] py-1.5" style={{ backgroundColor: SOFT }}>
                    <Check size={18} strokeWidth={2.6} style={{ color: INK }} />
                  </span>
                  <span className="flex justify-center">
                    <X size={18} strokeWidth={2.6} className="text-[#DC2626]" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Faixa de menções: nomes editáveis. Não estampamos logo de veículo de
          imprensa por conta própria — dizer que a Bloomberg citou a loja sem
          ter citado é propaganda enganosa. O lojista preenche com o que for
          verdade. */}
      <div className="px-5 py-7 sm:px-8" style={{ backgroundColor: INK }}>
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {["Sua marca na imprensa", "Veículo 1", "Veículo 2", "Veículo 3"].map((label) => (
            <span key={label} data-editor-type="text" className="text-[17px] font-bold text-white/70">
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Depoimentos reais                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 py-16 sm:px-8" style={{ backgroundColor: CREAM }}>
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col items-center text-center">
            {/* Cinco estrelas vazias no topo pareceriam nota zero. */}
            {average !== null ? <Stars value={average} size={20} color={INK} /> : null}
            <h2
              data-editor-type="text"
              className="mt-3 text-[32px] font-bold tracking-[-0.02em] md:text-[38px]"
              style={{ color: INK }}
            >
              Nossos clientes
            </h2>
            <p data-editor-type="text" className="mt-3 max-w-[720px] text-[15px] text-black/60">
              {reviewCount > 0
                ? "Quem já comprou contou como foi — leia antes de decidir."
                : "As avaliações dos seus clientes aparecem aqui assim que a loja receber a primeira."}
            </p>
          </div>

          {reviews.length > 0 ? (
            <div className="relative mt-10">
              <CarouselArrows
                tone={INK}
                onPrev={() => scrollCarousel(reviewsTrack.current, -1)}
                onNext={() => scrollCarousel(reviewsTrack.current, 1)}
              />
              <div ref={reviewsTrack} className="velo-track flex gap-5 overflow-x-auto scroll-smooth pb-2">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="w-[280px] shrink-0 rounded-[16px] border border-black/[0.07] bg-white p-5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ backgroundColor: INK }}
                      >
                        {review.authorName.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{review.authorName}</span>
                      <BadgeCheck size={16} style={{ color: INK }} />
                    </div>
                    <div className="mt-3">
                      <Stars value={review.rating} size={14} color={INK} />
                    </div>
                    <p className="mt-3 text-[13.5px] leading-[1.6] text-black/70">"{review.comment}"</p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-10 rounded-[16px] border border-dashed border-black/15 bg-white/60 px-6 py-12 text-center">
              <PackageOpen size={26} className="mx-auto text-black/30" />
              <p data-editor-type="text" className="mt-3 text-[14px] font-semibold text-black/60">
                Ainda sem avaliações nesta loja
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 8. Produtos recomendados (outros produtos do projeto)               */}
      {/* ------------------------------------------------------------------ */}
      {relatedProducts.length > 0 ? (
        <section className="bg-white px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-[1240px]">
            <h2
              data-editor-type="text"
              className="text-center text-[32px] font-bold tracking-[-0.02em] md:text-[38px]"
              style={{ color: INK }}
            >
              Você também pode gostar
            </h2>

            <div className="relative mt-10">
              <CarouselArrows
                tone={INK}
                onPrev={() => scrollCarousel(relatedTrack.current, -1)}
                onNext={() => scrollCarousel(relatedTrack.current, 1)}
              />
              <div ref={relatedTrack} className="velo-track flex gap-5 overflow-x-auto scroll-smooth pb-2">
                {relatedProducts.map((item) => {
                  const itemOff =
                    item.originalPrice && item.originalPrice > item.price
                      ? Math.round((1 - item.price / item.originalPrice) * 100)
                      : 0;
                  return (
                    <article key={item.id} className="w-[230px] shrink-0">
                      <div
                        className="flex aspect-square items-center justify-center overflow-hidden rounded-[14px] p-6"
                        style={{ backgroundColor: FRAME }}
                      >
                        {item.imageUrl ? (
                          <img
                            data-editor-type="image"
                            data-editor-product="true"
                            data-editor-product-id={item.id}
                            src={item.imageUrl}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : null}
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-[15px] font-bold leading-tight">{item.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold">{formatBRL(item.price)}</span>
                        {itemOff > 0 ? (
                          <span className="text-[13px] text-black/40 line-through">
                            {formatBRL(item.originalPrice as number)}
                          </span>
                        ) : null}
                      </div>
                      {itemOff > 0 ? (
                        <span
                          className="mt-2 inline-block rounded-[6px] px-2 py-1 text-[11.5px] font-bold"
                          style={{ backgroundColor: SOFT, color: INK }}
                        >
                          {itemOff}% OFF
                        </span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* 9. Barra fixa de compra                                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="sticky bottom-0 z-30 flex items-center justify-between gap-4 px-5 py-3.5 sm:px-8"
        style={{ backgroundColor: INK }}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          {gallery[0] ? (
            <img
              src={gallery[0]}
              alt=""
              className="h-12 w-12 shrink-0 rounded-[10px] bg-white/10 object-contain p-1.5"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-white">{title}</p>
            <p className="text-[13px] font-semibold" style={{ color: SOFT }}>
              {formatBRL(price)}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-editor-role="button"
          className="flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] bg-white px-6 text-[14px] font-bold transition hover:brightness-95"
          style={{ color: INK }}
        >
          <ShoppingCart size={17} />
          <span data-editor-type="text">Adicionar ao carrinho</span>
        </button>
      </div>

      <span className="sr-only">{brand}</span>
    </div>
  );
};

export default ProductPageTemplate;
