import { useRef, type CSSProperties } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Feather,
  Heart,
  PackageOpen,
  RotateCcw,
  Ruler,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  X,
  Zap,
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
  tint,
  useStoreReviewSummary,
  type ProductTemplateProps,
} from "@/components/store-templates/productTemplateShared";

/**
 * Template "Blue" — segundo modelo de página de produto da Velo.
 *
 * Página longa de conversão em azul/índigo: dobra de compra com acordeões,
 * faixa de urgência, ticker de benefícios, provas sociais, estatísticas,
 * comparativo e garantia. O contrato de dados é o mesmo do template Velo
 * (productTemplateShared), então editor e página publicada não precisam saber
 * qual dos dois está montado.
 *
 * As regras não mudam: dado de produto é dinâmico, prova social só sai de
 * avaliação real e o resto é placeholder editável pelo canvas do editor.
 */

// --- Identidade visual ------------------------------------------------------

/** Azul/índigo forte da marca deste template. */
const INK = "#2727CC";
/** Lavanda claríssimo das seções alternadas. */
const MIST = "#F4F4FF";
/** Cinza das molduras de foto. */
const FRAME = "#EDEDED";
/** Vermelho do aviso de urgência e dos "X" do comparativo. */
const ALERT = "#DC2626";

const resolveTone = (accent: string | undefined) => resolveToneShared(accent, INK);
const renderRichText = (text: string) => renderRichTextShared(text, "font-bold text-[#111114]");

const ProductTemplateBlue = ({
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
  const twoColumns = mobile ? "" : "lg:grid-cols-2";
  // O selo "#1 mais vendido de [ano]" precisa do ano corrente, não de um número
  // fixo que envelhece na página do lojista.
  const anoAtual = new Date().getFullYear();

  const { reviews, count: reviewCount, average, distribution } = useStoreReviewSummary(projectId);

  const percentOf = (value: number) => (reviewCount > 0 ? (value / reviewCount) * 100 : null);
  const stats: Array<{ percent: number | null; label: string }> = [
    { percent: percentOf(distribution[5]), label: "Avaliaram com 5 estrelas" },
    { percent: percentOf(distribution[4] + distribution[5]), label: "Recomendam o produto" },
    { percent: average === null ? null : (average / 5) * 100, label: "Nota média da loja" },
    {
      percent: percentOf(reviews.filter((review) => review.comment.trim().length > 0).length),
      label: "Deixaram um comentário",
    },
  ];

  // Depoimentos: avaliação real ganha do placeholder. Os placeholders existem
  // para o bloco não sumir numa loja nova — o lojista troca o texto no canvas.
  const depoimentos =
    reviews.length > 0
      ? reviews.slice(0, 8).map((review) => ({
          id: review.id,
          authorName: review.authorName,
          rating: review.rating,
          comment: review.comment,
        }))
      : [1, 2, 3].map((indice) => ({
          id: `placeholder-${indice}`,
          authorName: "Nome do cliente",
          rating: 5,
          comment:
            "Escreva aqui o depoimento de um cliente real da sua loja — o que ele resolveu com o produto.",
        }));

  const featuredTrack = useRef<HTMLDivElement>(null);
  const reviewsTrack = useRef<HTMLDivElement>(null);
  const relatedTrack = useRef<HTMLDivElement>(null);

  const galleryVars = { "--velo-tone": tone } as CSSProperties;

  const Seta = ({ onClick, label, direcao }: { onClick: () => void; label: string; direcao: "prev" | "next" }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-[0_6px_18px_rgba(17,17,20,0.10)] transition hover:brightness-95 ${
        direcao === "prev" ? "-left-2" : "-right-2"
      }`}
      style={{ color: INK }}
    >
      {direcao === "prev" ? <ChevronLeft size={19} /> : <ChevronRight size={19} />}
    </button>
  );

  return (
    <div className="bg-white text-[#111114]" style={galleryVars}>
      {/* Interações sem estado React: galeria, variações e acordeões trocam via
          input:checked + :has, então nada re-renderiza e o editor não perde as
          edições aplicadas no DOM. */}
      <style>{`
        .velo-blue-shot { display: none; }
        .velo-blue-gallery:has(#velo-blue-shot-0:checked) .velo-blue-shot-0,
        .velo-blue-gallery:has(#velo-blue-shot-1:checked) .velo-blue-shot-1,
        .velo-blue-gallery:has(#velo-blue-shot-2:checked) .velo-blue-shot-2,
        .velo-blue-gallery:has(#velo-blue-shot-3:checked) .velo-blue-shot-3,
        .velo-blue-gallery:has(#velo-blue-shot-4:checked) .velo-blue-shot-4,
        .velo-blue-gallery:has(#velo-blue-shot-5:checked) .velo-blue-shot-5 { display: flex; }
        .velo-blue-thumb { border: 1.5px solid rgba(0,0,0,0.08); }
        .velo-blue-thumb:has(input:checked) { border-color: #111114; }
        .velo-blue-chip { border: 1.5px solid rgba(0,0,0,0.12); }
        .velo-blue-chip:has(input:checked) { border-color: var(--velo-tone); box-shadow: inset 0 0 0 1px var(--velo-tone); }
        .velo-blue-track { scrollbar-width: none; }
        .velo-blue-track::-webkit-scrollbar { display: none; }
        .velo-blue-fold summary::-webkit-details-marker { display: none; }
        .velo-blue-fold[open] .velo-blue-chevron { transform: rotate(180deg); }
        @keyframes veloBlueTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .velo-blue-ticker { animation: veloBlueTicker 26s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .velo-blue-ticker { animation: none; } }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Dobra de compra                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 py-8 sm:px-8">
        <div className={`mx-auto grid max-w-[1280px] items-start gap-8 lg:gap-12 ${twoColumns}`}>
          {/* Galeria — fica fixa enquanto a coluna de compra rola ao lado. */}
          <div className="velo-blue-gallery lg:sticky lg:top-6 lg:self-start">
            <div
              className="relative flex aspect-square max-h-[62vh] items-center justify-center overflow-hidden rounded-[14px] p-10"
              style={{ backgroundColor: FRAME }}
            >
              {gallery.map((photo, index) => (
                <span
                  key={photo}
                  className={`velo-blue-shot velo-blue-shot-${index} h-full w-full items-center justify-center`}
                >
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

              {/* Selo circular de garantia, sobreposto no canto. */}
              <span className="pointer-events-none absolute right-4 top-4 flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full border-2 border-[#111114] bg-white text-center">
                <span data-editor-type="text" className="text-[8px] font-bold uppercase tracking-[0.08em]">
                  Garantia
                </span>
                <span data-editor-type="text" className="text-[22px] font-bold leading-none">
                  7
                </span>
                <span data-editor-type="text" className="text-[8px] font-bold uppercase tracking-[0.08em]">
                  dias
                </span>
              </span>

              {gallery.length > 1 ? (
                <>
                  <span className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black/45">
                    <ChevronLeft size={18} />
                  </span>
                  <span className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black/45">
                    <ChevronRight size={18} />
                  </span>
                </>
              ) : null}
            </div>

            {gallery.length > 1 ? (
              <div className="mt-3 flex gap-3">
                {gallery.slice(0, 6).map((photo, index) => (
                  <label
                    key={photo}
                    className="velo-blue-thumb flex aspect-square w-[19%] cursor-pointer items-center justify-center overflow-hidden rounded-[12px] p-2"
                    style={{ backgroundColor: FRAME }}
                  >
                    <input
                      type="radio"
                      name="velo-blue-shot"
                      id={`velo-blue-shot-${index}`}
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

          {/* Coluna de compra */}
          <div className="flex flex-col">
            {/* Selo de destaque com o ano corrente. */}
            <div
              className="flex w-fit items-center gap-3 rounded-[10px] px-3 py-2.5 text-white"
              style={{ backgroundColor: tone }}
            >
              <span data-editor-type="text" className="rounded-[6px] bg-white/20 px-2 py-1 text-[13px] font-bold">
                #1
              </span>
              <span className="min-w-0">
                <span data-editor-type="text" className="block text-[13px] font-bold uppercase tracking-[0.04em]">
                  Mais vendido de {anoAtual}
                </span>
                <span data-editor-type="text" className="block text-[12px] italic text-white/75">
                  Escolhido por quem já comprou na loja
                </span>
              </span>
            </div>

            <h1
              data-editor-type="text"
              className="mt-4 text-[34px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[42px]"
            >
              {title}
            </h1>

            {/* Nota da loja: real quando há avaliação, editável enquanto não há. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Stars value={average ?? 5} size={18} color={tone} />
              <span data-editor-type="text" className="text-[14.5px] text-black/70">
                Nota{" "}
                <strong className="font-bold text-[#111114]">
                  {average !== null ? `${average.toFixed(1).replace(".", ",")}/5` : "5,0/5"}
                </strong>
                {reviewCount > 0 ? ` · ${reviewCount} ${reviewCount === 1 ? "avaliação" : "avaliações"}` : " · avaliações da loja"}
              </span>
            </div>

            {/* Proposta de valor em 2x2 — texto e ícone editáveis. */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                [Heart, "Qualidade conferida"],
                [Feather, "Uso simples no dia a dia"],
                [Ruler, "Medidas certas para você"],
                [ShieldCheck, "Feito para durar"],
              ].map(([Icon, label]) => {
                const BadgeIcon = Icon as typeof Heart;
                return (
                  <div key={label as string} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10">
                      <BadgeIcon size={17} data-editor-icon="true" className="text-[#111114]" />
                    </span>
                    <span data-editor-type="text" className="text-[14.5px] text-black/80">
                      {label as string}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 h-px w-full bg-black/[0.09]" />

            {/* Preço: riscado e desconto só com promoção real cadastrada. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              {hasDiscount ? (
                <span className="text-[19px] font-medium text-black/35 line-through">
                  {formatBRL(originalPrice as number)}
                </span>
              ) : null}
              <span data-editor-type="text" className="text-[27px] font-bold tracking-[-0.02em]">
                {formatBRL(price)}
              </span>
              {hasDiscount ? (
                <span
                  data-editor-type="text"
                  className="rounded-[7px] px-2.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-white"
                  style={{ backgroundColor: tone }}
                >
                  Economize {discount}%
                </span>
              ) : null}
            </div>

            {/* Variações reais do fornecedor. Sem variação, nada é exibido. */}
            {variants.map((group) => (
              <div key={group.name} className="mt-6">
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
                      className="velo-blue-chip flex cursor-pointer items-center gap-2 rounded-[10px] bg-white px-3.5 py-2.5 text-[14px] font-semibold"
                    >
                      <input
                        type="radio"
                        name={`velo-blue-variant-${group.name}`}
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
              className="mt-6 flex h-[62px] w-full items-center justify-center gap-3 rounded-[10px] text-[17px] font-bold uppercase tracking-[0.02em] text-white transition hover:brightness-110"
              style={{ backgroundColor: tone }}
            >
              <ShoppingCart size={20} />
              <span data-editor-type="text">Adicionar ao carrinho</span>
            </button>

            {/* Selos de confiança */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
              {[
                [ShieldCheck, "Garantia de 7 dias"],
                [PackageOpen, "Troca facilitada"],
              ].map(([Icon, label]) => {
                const SealIcon = Icon as typeof ShieldCheck;
                return (
                  <span key={label as string} className="flex items-center gap-2 text-[13px] font-semibold text-black/70">
                    <SealIcon size={16} data-editor-icon="true" style={{ color: tone }} />
                    <span data-editor-type="text">{label as string}</span>
                  </span>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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

            {/* Acordeões: a descrição real do produto abre o primeiro. */}
            <div className="mt-6 space-y-2.5">
              {[
                ["Descrição", description],
                [
                  "Como usar",
                  "Explique em poucas linhas o passo a passo de uso do produto — o lojista edita este texto pelo editor.",
                ],
                [
                  "Frete e devoluções",
                  "Envio para todo o Brasil com código de rastreio. Devolução em até 7 dias após o recebimento, conforme o Código de Defesa do Consumidor.",
                ],
              ].map(([foldTitle, foldText]) => (
                <details key={foldTitle} className="velo-blue-fold rounded-[10px] border border-black/[0.08] bg-[#F7F7FA]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5">
                    <span data-editor-type="text" className="text-[15px] font-semibold">
                      {foldTitle}
                    </span>
                    <ChevronDown size={18} className="velo-blue-chevron shrink-0 text-black/45 transition-transform" />
                  </summary>
                  <p data-editor-type="text" className="px-4 pb-4 text-[14px] leading-[1.6] text-black/65">
                    {renderRichText(foldText)}
                  </p>
                </details>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 rounded-[10px] border border-black/[0.08] px-4 py-3">
              <Heart size={16} data-editor-icon="true" style={{ color: tone }} />
              <span data-editor-type="text" className="text-[13.5px] font-semibold text-black/70">
                Quase ninguém precisa acionar nossa garantia
              </span>
            </div>

            {/* Depoimento em destaque */}
            <div className="relative mt-5">
              <div
                ref={featuredTrack}
                className="velo-blue-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth rounded-[12px] border-2"
                style={{ borderColor: tint(tone, 0.35) }}
              >
                {depoimentos.map((item, index) => (
                  <figure key={item.id} className="w-full shrink-0 snap-start p-5" style={{ backgroundColor: MIST }}>
                    <div className="flex justify-center">
                      <Stars value={item.rating} size={16} color={tone} />
                    </div>
                    <blockquote data-editor-type="text" className="mt-3 text-center text-[14px] leading-[1.6] text-black/75">
                      "{item.comment}"
                    </blockquote>
                    <figcaption className="mt-3 flex items-center justify-center gap-2">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ backgroundColor: tone }}
                      >
                        {item.authorName.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <span data-editor-type="text" className="text-[13.5px] font-bold">
                        {item.authorName}
                      </span>
                      <BadgeCheck size={15} style={{ color: tone }} />
                      <span className="text-[11.5px] font-semibold text-black/35">
                        {index + 1}/{depoimentos.length}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              {depoimentos.length > 1 ? (
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

            {/* 2. Aviso de urgência — texto editável pelo lojista. */}
            <div className="mt-5 rounded-[10px] border border-dashed p-4" style={{ borderColor: ALERT }}>
              <span className="flex items-center gap-2">
                <AlertCircle size={17} style={{ color: ALERT }} />
                <span data-editor-type="text" className="text-[14.5px] font-bold" style={{ color: ALERT }}>
                  Estoque limitado
                </span>
              </span>
              <p data-editor-type="text" className="mt-2 text-[13.5px] leading-[1.6] text-black/70">
                Escreva aqui o aviso de urgência da sua loja — quantas vezes o produto esgotou, o prazo da oferta ou o
                que for verdade no seu estoque.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Ticker de benefícios                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="overflow-hidden py-3.5" style={{ backgroundColor: tone }}>
        <div className="velo-blue-ticker flex w-max gap-3">
          {[0, 1].map((copia) => (
            <div key={copia} className="flex gap-3" aria-hidden={copia === 1}>
              {[
                [Zap, "Fácil de usar"],
                [Sparkles, "Acabamento premium"],
                [Clock, "Envio rápido"],
                [Feather, "Leve no dia a dia"],
                [ShieldCheck, "Compra segura"],
                [RotateCcw, "Troca facilitada"],
              ].map(([Icon, label]) => {
                const TickerIcon = Icon as typeof Zap;
                return (
                  <span
                    key={`${copia}-${label as string}`}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold"
                    style={{ color: tone }}
                  >
                    <TickerIcon size={16} data-editor-icon="true" />
                    <span data-editor-type="text">{label as string}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Confiança                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className={`mx-auto grid max-w-[1280px] items-center gap-10 lg:gap-16 ${twoColumns}`}>
          <div>
            <h2
              data-editor-type="text"
              className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] md:text-[40px]"
            >
              Escolhido por quem não abre mão de qualidade
            </h2>
            <p data-editor-type="text" className="mt-4 max-w-[520px] text-[15px] leading-[1.65] text-black/65">
              Conte aqui por que a sua loja é a escolha certa: o cuidado no envio, a curadoria dos produtos e o
              atendimento que você oferece.
            </p>
            <button
              type="button"
              data-editor-role="button"
              className="mt-7 h-[58px] w-full rounded-[10px] text-[16px] font-bold uppercase tracking-[0.02em] text-white transition hover:brightness-110 sm:w-[320px]"
              style={{ backgroundColor: tone }}
            >
              <span data-editor-type="text">Quero o meu</span>
            </button>
            <div className="mt-4 flex items-center gap-2">
              <Stars value={average ?? 5} size={16} color={tone} />
              <span data-editor-type="text" className="text-[13.5px] text-black/65">
                {reviewCount > 0
                  ? `Nota ${(average as number).toFixed(1).replace(".", ",")}/5 em ${reviewCount} avaliações`
                  : "As avaliações da loja aparecem aqui"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((posicao) => (
              <div key={posicao} className="aspect-square overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
                {imageAt(gallery, posicao) ? (
                  <img
                    data-editor-type="image"
                    src={imageAt(gallery, posicao)}
                    alt=""
                    className="h-full w-full object-contain p-8"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Como funciona                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 pb-16 sm:px-8">
        <div className={`mx-auto grid max-w-[1280px] items-center gap-10 lg:gap-16 ${twoColumns}`}>
          <div>
            <h2 data-editor-type="text" className="text-[30px] font-bold tracking-[-0.03em] md:text-[36px]">
              Como funciona?
            </h2>
            <p data-editor-type="text" className="mt-5 max-w-[520px] text-[15px] leading-[1.7] text-black/70">
              {renderRichText(description)}
            </p>
            <p data-editor-type="text" className="mt-4 max-w-[520px] text-[15px] leading-[1.7] text-black/70">
              Complete aqui com o passo a passo do produto: o que ele resolve, como usar e em quanto tempo o cliente
              percebe o resultado.
            </p>
            <button
              type="button"
              data-editor-role="button"
              className="mt-7 h-[58px] w-full rounded-[10px] text-[16px] font-bold uppercase tracking-[0.02em] text-white transition hover:brightness-110 sm:w-[320px]"
              style={{ backgroundColor: tone }}
            >
              <span data-editor-type="text">Comprar agora</span>
            </button>
          </div>
          <div className="aspect-square overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
            {imageAt(gallery, 3) ? (
              <img data-editor-type="image" src={imageAt(gallery, 3)} alt="" className="h-full w-full object-contain p-10" />
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Benefícios numerados                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 py-16 sm:px-8" style={{ backgroundColor: MIST }}>
        <div className={`mx-auto grid max-w-[1280px] items-center gap-10 lg:gap-14 ${twoColumns}`}>
          <div className="aspect-square overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
            {imageAt(gallery, 4) ? (
              <img data-editor-type="image" src={imageAt(gallery, 4)} alt="" className="h-full w-full object-contain p-10" />
            ) : null}
          </div>

          <div>
            <h2
              data-editor-type="text"
              className="text-center text-[30px] font-bold leading-[1.15] tracking-[-0.03em] md:text-[36px] lg:text-left"
            >
              5 motivos para levar hoje
            </h2>
            <p data-editor-type="text" className="mt-2 text-center text-[14.5px] text-black/60 lg:text-left">
              O que muda no seu dia a dia com este produto.
            </p>

            <ol className="mt-6 space-y-5 rounded-[16px] border border-black/[0.07] bg-white p-6">
              {[
                [Zap, "Pronto para usar", "Chega funcionando: sem montagem complicada nem configuração demorada."],
                [Check, "Qualidade conferida", "Cada peça passa por checagem antes de sair do estoque."],
                [Sparkles, "Acabamento caprichado", "Materiais escolhidos para aguentar o uso frequente."],
                [Heart, "Feito para o dia a dia", "Simples o bastante para virar hábito na primeira semana."],
                [Clock, "Resultado consistente", "Entrega o mesmo desempenho do primeiro ao último dia."],
              ].map(([Icon, itemTitle, itemText], index) => {
                const BenefitIcon = Icon as typeof Zap;
                return (
                  <li key={itemTitle as string} className="flex gap-3.5">
                    <BenefitIcon size={20} data-editor-icon="true" className="mt-0.5 shrink-0" style={{ color: tone }} />
                    <span>
                      <span data-editor-type="text" className="block text-[16px] font-bold">
                        {index + 1}. {itemTitle as string}
                      </span>
                      <span data-editor-type="text" className="mt-1 block text-[14px] leading-[1.6] text-black/65">
                        {itemText as string}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Depoimentos + menções                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col items-center text-center">
            <span
              className="flex items-center gap-2 rounded-full border px-4 py-2"
              style={{ borderColor: tint(tone, 0.35), backgroundColor: MIST }}
            >
              <Stars value={average ?? 5} size={15} color={tone} />
              <span data-editor-type="text" className="text-[13px] font-semibold">
                {reviewCount > 0
                  ? `Nota ${(average as number).toFixed(1).replace(".", ",")}/5 · ${reviewCount} avaliações`
                  : "Avaliações da sua loja aparecem aqui"}
              </span>
            </span>
            <h2 data-editor-type="text" className="mt-4 text-[32px] font-bold tracking-[-0.03em] md:text-[38px]">
              Clientes satisfeitos
            </h2>
            <p data-editor-type="text" className="mt-3 max-w-[720px] text-[15px] text-black/60">
              Nada nos deixa mais felizes que cliente satisfeito — leia as histórias de quem já comprou.
            </p>
          </div>

          <div className="relative mt-10">
            <Seta direcao="prev" label="Anterior" onClick={() => scrollCarousel(reviewsTrack.current, -1)} />
            <Seta direcao="next" label="Próximo" onClick={() => scrollCarousel(reviewsTrack.current, 1)} />
            <div ref={reviewsTrack} className="velo-blue-track flex gap-5 overflow-x-auto scroll-smooth pb-2">
              {depoimentos.map((item) => (
                <article
                  key={`carrossel-${item.id}`}
                  className="w-[280px] shrink-0 rounded-[16px] border border-black/[0.07] bg-white p-5"
                >
                  <div className="aspect-square overflow-hidden rounded-[12px]" style={{ backgroundColor: FRAME }}>
                    {gallery[0] ? <img src={gallery[0]} alt="" loading="lazy" className="h-full w-full object-contain p-6" /> : null}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <BadgeCheck size={15} style={{ color: tone }} />
                    <span data-editor-type="text" className="truncate text-[14px] font-bold">
                      {item.authorName}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Stars value={item.rating} size={14} color={tone} />
                  </div>
                  <p data-editor-type="text" className="mt-2.5 text-[13.5px] leading-[1.6] text-black/70">
                    "{item.comment}"
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Faixa de menções: nomes editáveis. Não estampamos logo de imprensa por
          conta própria — dizer que um veículo citou a loja sem ter citado é
          propaganda enganosa. */}
      <div className="px-5 py-8 sm:px-8" style={{ backgroundColor: MIST }}>
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            ["Veículo 1", "Coloque aqui uma citação real"],
            ["Veículo 2", "Outra menção verdadeira da loja"],
            ["Veículo 3", "Ou um prêmio que você recebeu"],
          ].map(([veiculo, citacao]) => (
            <span key={veiculo} className="flex items-center gap-3">
              <span data-editor-type="text" className="text-[16px] font-bold text-black/70">
                {veiculo}
              </span>
              <span data-editor-type="text" className="text-[13px] italic text-black/50">
                "{citacao}"
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 8. Estatísticas                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <h2
            data-editor-type="text"
            className="text-center text-[30px] font-bold tracking-[-0.03em] md:text-[36px]"
          >
            O que os clientes relatam
          </h2>
          <p data-editor-type="text" className="mx-auto mt-3 max-w-[720px] text-center text-[14.5px] text-black/60">
            {reviewCount > 0
              ? "Números calculados a partir das avaliações reais da sua loja."
              : "Os números aparecem sozinhos assim que os primeiros clientes avaliarem."}
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const raio = 42;
              const circunferencia = 2 * Math.PI * raio;
              const preenchido = stat.percent === null ? 0 : Math.max(0, Math.min(100, stat.percent));
              return (
                <div
                  key={stat.label}
                  className="rounded-[16px] p-6 text-center text-white"
                  style={{ background: `linear-gradient(150deg, ${tone}, ${tone}CC)` }}
                >
                  <div className="relative mx-auto h-[104px] w-[104px]">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r={raio} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
                      {/* Sem dado o arco não é desenhado: com linecap redondo, um
                          arco de 0% ainda pintaria um ponto e parece 1%. */}
                      {preenchido > 0 ? (
                        <circle
                          cx="50"
                          cy="50"
                          r={raio}
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={`${(preenchido / 100) * circunferencia} ${circunferencia}`}
                        />
                      ) : null}
                    </svg>
                    <span
                      data-editor-type="text"
                      className="absolute inset-0 flex items-center justify-center text-[24px] font-bold"
                    >
                      {stat.percent === null ? "—" : `${Math.round(stat.percent)}%`}
                    </span>
                  </div>
                  <p data-editor-type="text" className="mt-4 text-[14.5px] font-semibold leading-snug">
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 9. Galeria de contexto                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <h2 data-editor-type="text" className="text-center text-[30px] font-bold tracking-[-0.03em] md:text-[36px]">
            O produto por dentro
          </h2>
          <p data-editor-type="text" className="mx-auto mt-3 max-w-[720px] text-center text-[14.5px] text-black/60">
            Mostre o produto em uso, os detalhes de acabamento e o que vem na caixa.
          </p>
          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {[1, 2, 3].map((posicao) => (
              <div key={posicao} className="aspect-[4/5] overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
                {imageAt(gallery, posicao) ? (
                  <img
                    data-editor-type="image"
                    src={imageAt(gallery, posicao)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-8"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 10. Comparativo                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-5 pb-16 sm:px-8">
        <div className={`mx-auto grid max-w-[1280px] items-center gap-10 lg:gap-16 ${twoColumns}`}>
          <div>
            <h2 data-editor-type="text" className="text-[30px] font-bold tracking-[-0.03em] md:text-[36px]">
              Por que escolher o nosso
            </h2>
            <p data-editor-type="text" className="mt-5 max-w-[520px] text-[15px] leading-[1.7] text-black/65">
              {renderRichText(
                "Deixe explícito o que a sua loja entrega e a concorrência não: **prazo de envio**, curadoria dos produtos e atendimento em português.",
              )}
            </p>
            <button
              type="button"
              data-editor-role="button"
              className="mt-7 h-[58px] w-full rounded-[10px] text-[16px] font-bold uppercase tracking-[0.02em] text-white transition hover:brightness-110 sm:w-[320px]"
              style={{ backgroundColor: tone }}
            >
              <span data-editor-type="text">Quero o meu</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[340px] overflow-hidden rounded-[16px] border border-black/[0.08]">
              <div className="grid grid-cols-[1fr_120px_110px] items-center border-b border-black/[0.08]">
                <span />
                <span
                  data-editor-type="text"
                  className="py-4 text-center text-[13.5px] font-bold text-white"
                  style={{ backgroundColor: tone }}
                >
                  Nosso produto
                </span>
                <span data-editor-type="text" className="py-4 text-center text-[13.5px] font-semibold text-black/50">
                  Outros
                </span>
              </div>
              {["Fácil de usar", "Durabilidade", "Conferido antes do envio", "Suporte em português", "Custo-benefício"].map(
                (row, index, all) => (
                  <div
                    key={row}
                    className={`grid grid-cols-[1fr_120px_110px] items-center ${
                      index === all.length - 1 ? "" : "border-b border-black/[0.06]"
                    }`}
                  >
                    <span data-editor-type="text" className="px-4 py-4 text-[14px] text-black/75">
                      {row}
                    </span>
                    <span className="flex justify-center py-4 text-white" style={{ backgroundColor: tint(tone, 0.1) }}>
                      <Check size={18} strokeWidth={2.6} style={{ color: tone }} />
                    </span>
                    <span className="flex justify-center py-4">
                      <X size={18} strokeWidth={2.6} style={{ color: ALERT }} />
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 11. Banner de garantia                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-5 pb-16 sm:px-8">
        <div
          className={`mx-auto grid max-w-[1280px] items-center gap-8 overflow-hidden rounded-[18px] p-6 sm:p-10 ${twoColumns}`}
          style={{ backgroundColor: tone }}
        >
          <div className="aspect-[4/3] overflow-hidden rounded-[14px]" style={{ backgroundColor: FRAME }}>
            {imageAt(gallery, 5) ? (
              <img data-editor-type="image" src={imageAt(gallery, 5)} alt="" className="h-full w-full object-contain p-8" />
            ) : null}
          </div>

          <div className="text-center text-white lg:text-left">
            <Heart size={34} data-editor-icon="true" className="mx-auto lg:mx-0" />
            <h2 data-editor-type="text" className="mt-4 text-[30px] font-bold leading-[1.15] tracking-[-0.03em] md:text-[36px]">
              Garantia de satisfação
            </h2>
            <p data-editor-type="text" className="mt-3 text-[15px] leading-[1.65] text-white/80">
              Sete dias para trocar ou devolver, como manda o Código de Defesa do Consumidor. Se não for para você,
              devolvemos o valor.
            </p>
            <button
              type="button"
              data-editor-role="button"
              className="mt-6 flex h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-white text-[16px] font-bold uppercase tracking-[0.02em] transition hover:brightness-95 sm:w-[300px]"
              style={{ color: tone }}
            >
              <span data-editor-type="text">Comprar agora</span>
            </button>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {["Pix", "Visa", "Mastercard", "Elo", "Boleto"].map((method) => (
                <span
                  key={method}
                  data-editor-type="text"
                  className="rounded-[7px] bg-white/15 px-3 py-1.5 text-[11.5px] font-bold text-white"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 12. Recomendados                                                    */}
      {/* ------------------------------------------------------------------ */}
      {relatedProducts.length > 0 ? (
        <section className="bg-white px-5 pb-16 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <h2 data-editor-type="text" className="text-center text-[30px] font-bold tracking-[-0.03em] md:text-[36px]">
              Você também pode gostar
            </h2>

            <div className="relative mt-9">
              <Seta direcao="prev" label="Anterior" onClick={() => scrollCarousel(relatedTrack.current, -1)} />
              <Seta direcao="next" label="Próximo" onClick={() => scrollCarousel(relatedTrack.current, 1)} />
              <div ref={relatedTrack} className="velo-blue-track flex gap-5 overflow-x-auto scroll-smooth pb-2">
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
                            loading="lazy"
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
                        {itemOff > 0 ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                            style={{ backgroundColor: tone }}
                          >
                            {itemOff}% OFF
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* 13. Barra fixa de compra                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="sticky bottom-0 z-30 flex items-center justify-between gap-4 px-5 py-3.5 sm:px-8"
        style={{ backgroundColor: tone }}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          {gallery[0] ? (
            <img src={gallery[0]} alt="" className="h-12 w-12 shrink-0 rounded-[10px] bg-white/15 object-contain p-1.5" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-white">{title}</p>
            <p className="text-[13px] font-semibold text-white/75">{formatBRL(price)}</p>
          </div>
        </div>
        <button
          type="button"
          data-editor-role="button"
          className="flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] bg-white px-6 text-[14px] font-bold uppercase tracking-[0.02em] transition hover:brightness-95"
          style={{ color: tone }}
        >
          <ShoppingCart size={17} />
          <span data-editor-type="text">Adicionar ao carrinho</span>
        </button>
      </div>

      <span className="sr-only">{brand}</span>
    </div>
  );
};

export default ProductTemplateBlue;
