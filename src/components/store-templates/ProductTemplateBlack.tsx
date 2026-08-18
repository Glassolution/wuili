import { useRef, useState, type CSSProperties } from "react";
import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HandHeart,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Trophy,
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

/**
 * Template "Black" — pagina de produto inspirada em layouts fashion/DTC.
 *
 * A referencia e bem direta: galeria grande, coluna de compra editorial,
 * faixa "as seen on", beneficios em grade, reviews, fotos de clientes,
 * FAQ, recomendados e CTA fixo escuro. O contrato segue os outros templates:
 * dados reais do produto entram por props e os textos de campanha ficam
 * editaveis no canvas.
 */

const INK = "#363636";
const LINE = "#DEDEDE";
const PAPER = "#FFFFFF";
const MIST = "#EFEFEF";
const GREEN = "#00B67A";
const GOLD = "#FFC400";

const resolveTone = (accent: string | undefined) => resolveToneShared(accent, INK);
const renderRichText = (text: string) => renderRichTextShared(text, "font-bold text-[#353535]");

const normalizeSearchText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const buildProductFaqs = (title: string, variants: ProductTemplateProps["variants"]) => {
  const productName = title.trim() || "este produto";
  const search = normalizeSearchText(productName);
  const variantHint = variants.length
    ? ` Confira as opcoes de ${variants.map((group) => group.name.toLowerCase()).join(" e ")} antes de finalizar o pedido.`
    : "";

  const profile = (() => {
    if (/alicate|ferrament|chave|corte|crimp|tesoura|corrente/.test(search)) {
      return {
        use: "ajuda em reparos, ajustes e tarefas manuais que pedem firmeza e precisao.",
        care: "limpe apos o uso, mantenha seco e guarde longe de umidade para preservar o acabamento e a articulacao.",
        durability: "foi pensado para uso frequente em pequenas manutencoes, sempre respeitando a finalidade indicada do produto.",
      };
    }
    if (/balanca|peso|pesagem/.test(search)) {
      return {
        use: "facilita a pesagem rapida de objetos, encomendas ou bagagens sem depender de equipamentos grandes.",
        care: "evite quedas, excesso de carga e contato com agua; guarde em local seco depois de usar.",
        durability: "aguenta uso recorrente quando respeitado o limite de peso informado pelo produto.",
      };
    }
    if (/tenis|sapato|sandalia|chinelo|bota/.test(search)) {
      return {
        use: "combina conforto e praticidade para acompanhar deslocamentos, trabalho e momentos casuais.",
        care: "limpe com pano macio, evite deixar de molho e seque sempre a sombra para preservar o material.",
        durability: "foi selecionado para uso frequente, desde que a limpeza e o armazenamento sejam feitos com cuidado.",
      };
    }
    if (/relogio|pulseira|colar|brinco|joia|anel/.test(search)) {
      return {
        use: "valoriza o visual sem complicar a rotina, funcionando bem tanto no uso diario quanto em ocasioes especiais.",
        care: "evite contato direto com agua, perfume e produtos quimicos; guarde separado para reduzir riscos.",
        durability: "suporta uso recorrente quando protegido de impactos, umidade e atrito excessivo.",
      };
    }
    if (/perfume|fragrancia|creme|serum|oleo|cosmetico/.test(search)) {
      return {
        use: "entra facil na rotina de cuidado pessoal e ajuda a manter uma apresentacao mais agradavel ao longo do dia.",
        care: "mantenha bem fechado, longe de sol direto e calor para preservar melhor a formula e o aroma.",
        durability: "rende melhor quando usado na quantidade indicada e armazenado corretamente.",
      };
    }
    if (/suporte|organizador|porta|prateleira/.test(search)) {
      return {
        use: "ajuda a organizar o ambiente e deixa itens importantes mais faceis de acessar.",
        care: "limpe com pano seco ou levemente umido e evite peso acima do recomendado.",
        durability: "foi feito para uso diario, desde que instalado ou posicionado conforme a indicacao do produto.",
      };
    }
    return {
      use: "traz praticidade para a rotina e foi escolhido para resolver uma necessidade clara do dia a dia.",
      care: "mantenha limpo, seco e bem armazenado, seguindo as indicacoes de uso para conservar melhor o produto.",
      durability: "aguenta uso frequente quando usado dentro da finalidade indicada e com os cuidados basicos de conservacao.",
    };
  })();

  return [
    {
      question: "O que torna este produto util para o meu dia?",
      answer: `${productName} ${profile.use}${variantHint}`,
    },
    {
      question: "Como mantenho o produto em bom estado por mais tempo?",
      answer: `Para conservar ${productName}, ${profile.care}`,
    },
    {
      question: "E se eu precisar receber rapido ou nao ficar satisfeito?",
      answer: "Apos a compra, o pedido segue para preparacao e voce acompanha o envio pelo codigo de rastreio. Se o produto nao atender ao esperado, consulte a politica de troca e devolucao da loja.",
    },
    {
      question: "Ele aguenta uso frequente?",
      answer: `Sim. ${productName} ${profile.durability}`,
    },
    {
      question: "Como posso confiar na qualidade?",
      answer: "A pagina mostra fotos, preco e detalhes do produto selecionado para voce revisar antes da compra. Em caso de duvida, confira as especificacoes e escolha a variacao correta antes de finalizar.",
    },
  ];
};

const buildProductFoldContent = (
  title: string,
  description: string,
  variants: ProductTemplateProps["variants"],
) => {
  const productName = title.trim() || "este produto";
  const search = normalizeSearchText(productName);
  const cleanDescription = description.trim();
  const hasRealDescription =
    cleanDescription.length > 0 &&
    !/descricao de venda deste produto esta sendo gerada pela ia/i.test(normalizeSearchText(cleanDescription));
  const variantHint = variants.length
    ? ` Escolha a opcao correta de ${variants.map((group) => group.name.toLowerCase()).join(" e ")} antes de finalizar.`
    : "";

  const profile = (() => {
    if (/alicate|ferrament|chave|corte|crimp|tesoura|corrente/.test(search)) {
      return {
        description: `${productName} e uma ferramenta pratica para reparos, ajustes e tarefas manuais que pedem firmeza, controle e precisao no uso diario.${variantHint}`,
        shipping: `Seu ${productName} e separado com cuidado e enviado com rastreamento assim que sai do centro de distribuicao.`,
        returnPolicy: `Receba, teste o encaixe na mao e confira se atende ao uso esperado. Se nao ficar satisfeito, a devolucao segue simples em ate 30 dias.`,
      };
    }
    if (/balanca|peso|pesagem/.test(search)) {
      return {
        description: `${productName} ajuda a pesar objetos, encomendas e bagagens com mais agilidade, ocupando pouco espaco na rotina.${variantHint}`,
        shipping: `A balanca e embalada para proteger o visor e os componentes durante o envio, com rastreamento apos a postagem.`,
        returnPolicy: `Teste a leitura de peso ao receber. Se nao atender ao esperado, voce pode solicitar devolucao em ate 30 dias.`,
      };
    }
    if (/tenis|sapato|sandalia|chinelo|bota/.test(search)) {
      return {
        description: `${productName} combina praticidade e conforto para acompanhar trabalho, deslocamentos e momentos casuais.${variantHint}`,
        shipping: `O produto e enviado com rastreamento para voce acompanhar cada etapa ate a entrega.`,
        returnPolicy: `Experimente em casa e confira tamanho e conforto. Se nao servir como esperado, a devolucao continua disponivel por 30 dias.`,
      };
    }
    if (/relogio|pulseira|colar|brinco|joia|anel/.test(search)) {
      return {
        description: `${productName} foi escolhido para valorizar o visual com um detalhe facil de combinar no dia a dia ou em ocasioes especiais.${variantHint}`,
        shipping: `A peca e preparada com cuidado para seguir protegida durante o transporte, sempre com codigo de rastreio.`,
        returnPolicy: `Confira acabamento e modelo ao receber. Se nao for o que voce esperava, solicite a devolucao em ate 30 dias.`,
      };
    }
    return {
      description: `${productName} foi selecionado para trazer mais praticidade a rotina, com fotos e detalhes para voce revisar antes da compra.${variantHint}`,
      shipping: `O pedido e preparado rapidamente e enviado com rastreamento assim que sai do centro de distribuicao.`,
      returnPolicy: `Teste em casa. Se nao for exatamente o que voce esperava, a devolucao continua simples e clara por 30 dias.`,
    };
  })();

  return [
    ["Descricao", hasRealDescription ? cleanDescription : profile.description],
    ["Informacoes de envio", profile.shipping],
    ["Devolucao facil em 30 dias", profile.returnPolicy],
  ];
};

const ProductTemplateBlack = ({
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
  const { reviews, count: reviewCount, average } = useStoreReviewSummary(projectId);
  const relatedTrack = useRef<HTMLDivElement>(null);

  const gridColumns = mobile ? "" : "lg:grid-cols-[minmax(0,1.72fr)_minmax(340px,0.9fr)]";
  const vars = { "--black-tone": tone } as CSSProperties;
  const topImages = gallery.slice(0, 5);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const selectedImageIndex = topImages.length ? activeImageIndex % topImages.length : 0;
  const featureImages = [imageAt(gallery, 1), imageAt(gallery, 2), imageAt(gallery, 3), imageAt(gallery, 4)];
  const customerImages = [0, 1, 2, 3, 4, 5].map((index) => imageAt(gallery, index));
  const productFaqs = buildProductFaqs(title, variants);
  const productFoldContent = buildProductFoldContent(title, description, variants);
  const templatePreviewOnly = !productId;
  const showReviewSection = reviews.length > 0 || templatePreviewOnly;

  const socialLine =
    reviewCount > 0
      ? `Mais de ${reviewCount.toLocaleString("pt-BR")} cliente${reviewCount === 1 ? "" : "s"} verificado${reviewCount === 1 ? "" : "s"}`
      : "Mais de 10.000 clientes satisfeitos";

  const HeroArrow = ({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) => (
    <button
      type="button"
      aria-label={direction === "left" ? "Imagem anterior" : "Proxima imagem"}
      onClick={onClick}
      className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-white/65 text-[#111111] transition hover:bg-white/85 ${
        direction === "left" ? "left-5" : "right-5"
      }`}
    >
      {direction === "left" ? <ChevronLeft size={28} strokeWidth={2.5} /> : <ChevronRight size={28} strokeWidth={2.5} />}
    </button>
  );

  return (
    <div className="bg-white text-[#353535]" style={vars}>
      <style>{`
        .velo-black-shot { display: none; }
        .velo-black-gallery:has(#velo-black-shot-0:checked) .velo-black-shot-0,
        .velo-black-gallery:has(#velo-black-shot-1:checked) .velo-black-shot-1,
        .velo-black-gallery:has(#velo-black-shot-2:checked) .velo-black-shot-2,
        .velo-black-gallery:has(#velo-black-shot-3:checked) .velo-black-shot-3,
        .velo-black-gallery:has(#velo-black-shot-4:checked) .velo-black-shot-4 { display: flex; }
        .velo-black-thumb:has(input:checked) { border-color: #111; }
        .velo-black-chip:has(input:checked) { border-color: #111; box-shadow: inset 0 0 0 1px #111; }
        .velo-black-fold summary::-webkit-details-marker { display: none; }
        .velo-black-fold[open] .velo-black-chevron { transform: rotate(180deg); }
        .velo-black-track { scrollbar-width: none; }
        .velo-black-track::-webkit-scrollbar { display: none; }
      `}</style>

      <section className={`grid gap-5 px-5 py-5 ${gridColumns}`}>
        <div className="velo-black-gallery grid gap-4 md:grid-cols-[112px_minmax(0,1fr)]">
          <div className="hidden flex-col gap-3 md:flex">
            {topImages.map((photo, index) => (
              <label
                key={`${photo}-${index}`}
                className="velo-black-thumb flex aspect-square cursor-pointer items-center justify-center border-2 border-transparent bg-[#F7F7F7] p-3"
              >
                <input
                  type="radio"
                  name="velo-black-shot"
                  id={`velo-black-shot-${index}`}
                  checked={index === selectedImageIndex}
                  onChange={() => setActiveImageIndex(index)}
                  className="sr-only"
                  aria-label={`Foto do produto ${index + 1}`}
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

          <div className="min-w-0">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#EEEEEE] p-8 md:p-12">
              {topImages.map((photo, index) => (
                <span
                  key={`${photo}-large-${index}`}
                  className={`velo-black-shot velo-black-shot-${index} h-full w-full items-center justify-center`}
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
              {topImages.length > 1 ? (
                <>
                  <HeroArrow
                    direction="left"
                    onClick={() => setActiveImageIndex((current) => (current - 1 + topImages.length) % topImages.length)}
                  />
                  <HeroArrow
                    direction="right"
                    onClick={() => setActiveImageIndex((current) => (current + 1) % topImages.length)}
                  />
                </>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-4 bg-[#EFEFEF] px-5 py-5">
              <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full border-2 border-[#353535]">
                <ShieldCheck size={28} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span data-editor-type="text" className="rounded-full bg-[#353535] px-3.5 py-1 text-[13px] font-black uppercase text-white">
                    Sem risco
                  </span>
                  <h2 data-editor-type="text" className="text-[21px] font-black tracking-[-0.03em] md:text-[24px]">
                    Garantia de reembolso em 30 dias
                  </h2>
                </div>
                <p data-editor-type="text" className="mt-2 text-[14px] font-medium leading-snug text-[#444]">
                  Compre sem preocupacao: teste {title} por 30 dias e, se nao for o ideal para voce, devolvemos seu dinheiro sem complicacao.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex flex-col">
          <div className="flex items-center gap-3">
            <span className="inline-flex overflow-hidden">
              {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="grid h-5 w-5 place-items-center border-r border-white bg-[#00B67A] text-white last:border-r-0">
                  <Star size={12} fill="currentColor" strokeWidth={0} />
                </span>
              ))}
            </span>
            <span data-editor-type="text" className="text-[15px] font-bold text-[#3A3A3A]">
              {socialLine}
            </span>
          </div>

          <h1 data-editor-type="text" className="mt-5 text-[34px] font-black uppercase leading-[0.98] tracking-[-0.045em] md:text-[42px]">
            {title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span data-editor-type="text" className="text-[22px] font-black tracking-[-0.04em]">
              {formatBRL(price)}
            </span>
            {hasDiscount ? (
              <span className="text-[20px] font-bold text-[#777] line-through">{formatBRL(originalPrice as number)}</span>
            ) : null}
            {hasDiscount ? (
              <span data-editor-type="text" className="bg-[#353535] px-2.5 py-1.5 text-[12px] font-black uppercase text-white">
                Economize {discount}%
              </span>
            ) : null}
          </div>

          <p data-editor-type="text" className="mt-4 max-w-[500px] text-[18px] font-bold leading-tight text-[#3D3D3D]">
            Tenha mais praticidade com um produto pensado para facilitar sua rotina.
          </p>

          <div className="mt-5 border-y border-[#D7D7D7] py-4">
            {[
              [Trophy, "Mais vendido da temporada"],
              [HandHeart, "Excelente custo-beneficio"],
              [ShieldCheck, "Garantia de 30 dias"],
              [Package, "Pedido enviado com codigo de rastreio"],
            ].map(([Icon, label]) => {
              const BenefitIcon = Icon as typeof Trophy;
              return (
                <div key={label as string} className="flex items-start gap-3 py-1.5 text-[18px] font-medium leading-tight">
                  <BenefitIcon size={21} strokeWidth={1.9} className="mt-0.5 shrink-0 text-[#3A3A3A]" data-editor-icon="true" />
                  <span data-editor-type="text">{label as string}</span>
                </div>
              );
            })}
          </div>

          {variants.map((group) => (
            <div key={group.name} className="mt-5">
              <p data-editor-type="text" className="text-[15px] font-black uppercase tracking-[0.03em] text-[#3D3D3D]">
                {group.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                {group.options.map((option) => (
                  <label
                    key={option}
                    className="velo-black-chip grid h-[44px] min-w-[52px] cursor-pointer place-items-center border-2 border-[#DFDFDF] bg-white px-3.5 text-[16px] font-bold text-[#777]"
                  >
                    <input
                      type="radio"
                      name={`velo-black-variant-${group.name}`}
                      defaultChecked={option === group.options[0]}
                      className="sr-only"
                    />
                    {isColorGroup(group.name) ? (
                      <span
                        className="h-6 w-6 border border-black/10"
                        style={{ backgroundColor: colorSwatch(option) }}
                        aria-label={option}
                      />
                    ) : (
                      <span data-editor-type="text">{option}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            data-editor-role="button"
            className="mt-5 flex h-[64px] w-full items-center justify-center gap-3.5 bg-[#363636] text-[18px] font-black uppercase text-white transition hover:bg-[#242424]"
          >
            <ShoppingCart size={25} strokeWidth={2.2} />
            <span data-editor-type="text">Adicionar ao carrinho</span>
          </button>

          <div className="mt-4 border-y border-[#D7D7D7] py-4">
            <div className="flex flex-wrap justify-center gap-3">
              {["AMEX", "Apple Pay", "VISA", "Mastercard", "PayPal", "G Pay", "shop"].map((method) => (
                <span
                  key={method}
                  data-editor-type="text"
                  className="rounded-[4px] border border-[#E3E3E3] bg-white px-2.5 py-1 text-[11px] font-black text-[#333]"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          <div>
            {productFoldContent.map(([foldTitle, foldText]) => (
              <details key={foldTitle} className="velo-black-fold border-b border-[#D7D7D7]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-4">
                  <span data-editor-type="text" className="text-[18px] font-black uppercase tracking-[-0.02em]">
                    {foldTitle}
                  </span>
                  <ChevronDown className="velo-black-chevron shrink-0 transition-transform" size={21} strokeWidth={2.3} />
                </summary>
                <p data-editor-type="text" className="pb-4 text-[14px] font-medium leading-[1.55] text-[#555]">
                  {renderRichText(foldText)}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 bg-[#EFEFEF] px-4 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[#E88BCE] bg-[#FFE2F6] text-[14px] font-black text-[#343434]">
              K
            </span>
            <p data-editor-type="text" className="text-[15px] font-black italic leading-tight">
              Clientes reais ja escolheram [{title}] para facilitar o dia a dia.
            </p>
          </div>
        </aside>
      </section>

      <section className="bg-[#353535] px-5 py-10 text-white">
        <h2 data-editor-type="text" className="text-center text-[28px] font-black tracking-[-0.04em]">
          Visto em
        </h2>
        <div className="mt-7 flex flex-wrap items-center justify-around gap-7 text-center">
          {["Bloomberg", "COSMOPOLITAN", "Women'sHealth", "allure", "NewScientist", "Bloomberg"].map((name, index) => (
            <span
              key={`${name}-${index}`}
              data-editor-type="text"
              className="text-[24px] font-black text-white/90 md:text-[31px]"
              style={{ fontFamily: index === 2 || index === 3 ? "Georgia, serif" : "inherit" }}
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="px-5 py-12 text-center">
        <h2 data-editor-type="text" className="text-[34px] font-black tracking-[-0.055em] md:text-[42px]">
          Pensado para facilitar sua rotina
        </h2>
        <p data-editor-type="text" className="mx-auto mt-4 max-w-[780px] text-[19px] font-medium text-[#777]">
          Design pratico, boa apresentacao e detalhes que ajudam no uso do dia a dia.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {[
            ["Acabamento resistente", "Materiais pensados para acompanhar o uso frequente."],
            ["Uso confortavel", "Mais praticidade para tarefas longas e repetidas."],
            ["Construcao duravel", "Feito para entregar seguranca e estabilidade no dia a dia."],
            ["Detalhes funcionais", "Uma experiencia simples desde o primeiro uso."],
          ].map(([itemTitle, itemText], index) => (
            <article key={itemTitle} className="border border-[#D7D7D7] bg-white">
              <div className="flex aspect-square items-center justify-center bg-[#EEEEEE] p-7">
                {featureImages[index] ? (
                  <img data-editor-type="image" src={featureImages[index]} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                ) : null}
              </div>
              <div className="px-5 py-5">
                <h3 data-editor-type="text" className="text-[22px] font-black tracking-[-0.035em]">
                  {itemTitle}
                </h3>
                <p data-editor-type="text" className="mt-2.5 text-[17px] font-bold italic leading-snug text-[#555]">
                  {itemText}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showReviewSection ? (
        <section className="px-5 py-14 text-center">
          <div className="flex justify-center gap-2 text-[#FFC400]">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={29} fill="currentColor" strokeWidth={0} />
            ))}
          </div>
          <h2 data-editor-type="text" className="mt-5 text-[36px] font-black tracking-[-0.055em] md:text-[44px]">
            O que os clientes dizem
          </h2>
          <p data-editor-type="text" className="mx-auto mt-4 max-w-[820px] text-[19px] font-medium text-[#777]">
            {reviews.length > 0 ? "Avaliacoes de clientes que ja compraram nesta loja." : "Bloco de exemplo do template. Troque por avaliacoes reais antes de publicar."}
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {(reviews.length > 0 ? reviews.slice(0, 4) : [1, 2, 3, 4]).map((item, index) => {
              const review = typeof item === "number" ? null : item;
              return (
                <article key={review?.id ?? index} className="border-2 border-[#E1E1E1] p-4 text-left">
                  <div className="flex aspect-square items-center justify-center bg-[#EEEEEE] p-7">
                    {imageAt(gallery, index) ? (
                      <img src={imageAt(gallery, index)} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <BadgeCheck size={18} fill="#1D9BF0" className="text-white" />
                    <span data-editor-type="text" className="text-[17px] font-black">
                      {review?.authorName ?? "Cliente verificado"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <Stars value={review?.rating ?? 5} size={19} color={GOLD} />
                  </div>
                  <p data-editor-type="text" className="mt-4 text-[17px] font-medium leading-tight text-[#3F3F3F]">
                    "{review?.comment ?? "Produto bem apresentado, compra simples e entrega dentro do esperado. Recomendo para quem busca praticidade."}"
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {templatePreviewOnly ? (
        <section className="overflow-hidden px-5 py-14 text-center">
          <h2 data-editor-type="text" className="text-[36px] font-black tracking-[-0.055em] md:text-[44px]">
            Veja o produto em uso
          </h2>
          <div className="mt-9 grid grid-cols-2 gap-5 md:grid-cols-4">
            {customerImages.map((photo, index) => (
              <div key={`${photo}-${index}`} className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-[#F2F2F2] p-7">
                {photo ? <img data-editor-type="image" src={photo} alt="" loading="lazy" className="max-h-full max-w-full object-contain opacity-80" /> : null}
                <span data-editor-type="text" className="absolute left-4 right-4 top-7 text-[18px] font-medium leading-tight text-[#777]/80">
                  Clique aqui para trocar pela foto de um cliente.
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="px-5 py-14">
        <h2 data-editor-type="text" className="text-center text-[36px] font-black tracking-[-0.055em] md:text-[44px]">
          Perguntas frequentes
        </h2>
        <div className="mt-7">
          {productFaqs.map((faq) => (
            <details key={faq.question} className="velo-black-fold border-b border-[#D7D7D7]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5">
                <span data-editor-type="text" className="text-[23px] font-black tracking-[-0.03em]">
                  {faq.question}
                </span>
                <ChevronDown className="velo-black-chevron shrink-0 transition-transform" size={24} />
              </summary>
              <p data-editor-type="text" className="max-w-[900px] pb-5 text-[16px] font-medium leading-[1.55] text-[#666]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="px-5 pb-22 pt-4">
          <h2 data-editor-type="text" className="text-center text-[36px] font-black tracking-[-0.045em] md:text-[46px]">
            Produtos recomendados
          </h2>
          <div className="relative mt-14">
            <button
              type="button"
              aria-label="Produtos anteriores"
              onClick={() => scrollCarousel(relatedTrack.current, -1)}
              className="absolute left-0 top-[42%] z-10 grid h-11 w-11 -translate-y-1/2 place-items-center border border-[#D8D8D8] bg-white text-[#999] transition hover:border-[#BDBDBD] hover:text-[#353535]"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              aria-label="Proximos produtos"
              onClick={() => scrollCarousel(relatedTrack.current, 1)}
              className="absolute right-0 top-[42%] z-10 grid h-11 w-11 -translate-y-1/2 place-items-center border border-[#D8D8D8] bg-white text-[#999] transition hover:border-[#BDBDBD] hover:text-[#353535]"
            >
              <ChevronRight size={24} />
            </button>
            <div ref={relatedTrack} className="velo-black-track flex gap-7 overflow-x-auto px-16 pb-3 scroll-smooth">
              {relatedProducts.map((item) => {
                const itemOff =
                  item.originalPrice && item.originalPrice > item.price
                    ? Math.round((1 - item.price / item.originalPrice) * 100)
                    : 0;
                return (
                  <article key={item.id} className="w-[245px] shrink-0 md:w-[270px] lg:w-[310px]">
                    <div className="flex aspect-square items-center justify-center bg-[#F4F4F4] p-7">
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
                    <h3 data-editor-type="text" className="mt-4 line-clamp-2 text-[20px] font-black leading-tight tracking-[-0.03em]">
                      {item.title}
                    </h3>
                    <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap">
                      <span className="text-[16px] font-black">{formatBRL(item.price)}</span>
                      {item.originalPrice && item.originalPrice > item.price ? (
                        <span className="text-[15px] font-bold text-[#8A8A8A] line-through">
                          {formatBRL(item.originalPrice)}
                        </span>
                      ) : null}
                      {itemOff > 0 ? (
                        <span data-editor-type="text" className="shrink-0 bg-[#363636] px-2.5 py-1 text-[12px] font-black uppercase text-white">
                          {itemOff}% OFF
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 z-30 flex items-center justify-between gap-4 bg-[#353535] px-5 py-3 text-white">
        <div className="flex min-w-0 items-center gap-4">
          {gallery[0] ? <img src={gallery[0]} alt="" className="h-[58px] w-[58px] shrink-0 bg-white object-contain p-1.5" /> : null}
          <p data-editor-type="text" className="truncate text-[22px] font-black tracking-[-0.04em] md:text-[26px]">
            {title}
          </p>
        </div>
        <button
          type="button"
          data-editor-role="button"
          className="flex h-[56px] shrink-0 items-center gap-3.5 bg-white px-8 text-[17px] font-black uppercase text-[#353535] transition hover:bg-[#F3F3F3]"
        >
          <ShoppingCart size={24} strokeWidth={2.1} />
          <span data-editor-type="text">Adicionar ao carrinho</span>
        </button>
      </div>

      <span className="sr-only">{brand}</span>
    </div>
  );
};

export default ProductTemplateBlack;
