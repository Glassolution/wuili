import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUp, BarChart3, BookOpen, PackagePlus, Sparkles, Store, WandSparkles } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";
import AquasIcon from "@/components/dashboard/AquasIcon";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useProfile } from "@/lib/profileContext";

type QuickStartCard = {
  title: string;
  description: string;
  cta: string;
  visual: "products" | "marketplace" | "chart" | "aquas";
  onClick: () => void;
};

type CatalogPreviewProduct = Pick<Database["public"]["Tables"]["catalog_products"]["Row"], "id" | "title" | "images" | "suggested_price">;

type LearnCard = {
  title: string;
  to: string;
  Icon: React.ElementType;
  gradient: string;
};

const fadeUp: any = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

const cardShadow =
  "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(17,24,39,0.028), 0 14px 34px rgba(17,24,39,0.052), 0 30px 68px rgba(30,58,138,0.038)";

const quickCardShadow =
  "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(17,17,17,0.03), 0 14px 34px rgba(17,17,17,0.055)";

const showcaseShadow = "0 4px 12px rgba(0,0,0,0.08)";

const salesPreviewData = [
  { name: "Seg", value: 34 },
  { name: "Ter", value: 52 },
  { name: "Qua", value: 42 },
  { name: "Qui", value: 68 },
  { name: "Sex", value: 58 },
  { name: "Sáb", value: 76 },
];

const extractImages = (images: Json | null): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.filter((image): image is string => typeof image === "string" && image.length > 0);
  }
  if (typeof images === "string") {
    try {
      const parsed: unknown = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((image): image is string => typeof image === "string" && image.length > 0)
        : [images];
    } catch {
      return [images];
    }
  }
  return [];
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const getFirstName = (name?: string | null, email?: string | null) => {
  const raw = (name || email?.split("@")[0] || "Velo").trim();
  return raw.split(/[\s._-]+/).filter(Boolean)[0] || "Velo";
};

const learnCards: LearnCard[] = [
  {
    title: "Como precificar seus produtos para maximizar margem",
    to: "/docs",
    Icon: BarChart3,
    gradient: "linear-gradient(135deg, #DBEAFE 0%, #FFFFFF 54%, #D1FAE5 100%)",
  },
  {
    title: "Estratégias para reduzir falhas de publicação no Mercado Livre",
    to: "/docs",
    Icon: Store,
    gradient: "linear-gradient(135deg, #FEF3C7 0%, #FFFFFF 55%, #DBEAFE 100%)",
  },
  {
    title: "Como usar o Aquas para encontrar produtos vencedores",
    to: "/docs",
    Icon: WandSparkles,
    gradient: "linear-gradient(135deg, #E0E7FF 0%, #FFFFFF 55%, #FCE7F3 100%)",
  },
];

const ProductStackVisual = ({ products }: { products: CatalogPreviewProduct[] }) => {
  const previews = products
    .flatMap((product) => extractImages(product.images).slice(0, 1).map((image) => ({ image, title: product.title })))
    .slice(0, 3);

  return (
    <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-[18px] border border-black/[0.04] bg-white/46">
      <div className="absolute inset-x-7 bottom-5 h-5 rounded-full bg-black/[0.06] blur-xl" aria-hidden="true" />
      {previews.length > 0 ? (
        previews.map((product, index) => {
          const transforms = ["-translate-x-16 rotate-[-7deg]", "translate-x-0 rotate-[2deg]", "translate-x-16 rotate-[7deg]"];
          const zIndex = index === 1 ? "z-20" : "z-10";

          return (
            <div
              key={`${product.image}-${index}`}
              className={`absolute h-[92px] w-[92px] overflow-hidden rounded-[18px] border border-white bg-[#F8F8F8] ${transforms[index]} ${zIndex}`}
              style={{ boxShadow: showcaseShadow }}
            >
              <img src={product.image} alt={product.title} className="h-full w-full object-cover grayscale-[18%] saturate-0" loading="lazy" />
            </div>
          );
        })
      ) : (
        <div className="grid h-[92px] w-[92px] place-items-center rounded-[18px] border border-black/[0.06] bg-white text-[#8B8B8F]" style={{ boxShadow: showcaseShadow }}>
          <PackagePlus className="h-7 w-7" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
};

const MarketplaceVisual = ({ product }: { product?: CatalogPreviewProduct }) => {
  const image = product ? extractImages(product.images)[0] : null;

  return (
    <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-[18px] border border-black/[0.04] bg-white/46">
      <div className="absolute h-[106px] w-[150px] rotate-[-5deg] rounded-[18px] border border-black/[0.05] bg-white/76" style={{ boxShadow: showcaseShadow }} />
      <div className="relative z-10 w-[156px] rotate-[3deg] overflow-hidden rounded-[18px] border border-black/[0.06] bg-white" style={{ boxShadow: showcaseShadow }}>
        <div className="h-[58px] bg-[#F4F4F5]">
          {image ? <img src={image} alt={product?.title || "Produto"} className="h-full w-full object-cover grayscale-[20%] saturate-0" loading="lazy" /> : null}
        </div>
        <div className="space-y-2 p-3">
          <div className="h-2 w-[84%] rounded-full bg-black/[0.13]" />
          <div className="h-2 w-[52%] rounded-full bg-black/[0.08]" />
          <div className="mt-3 h-3 w-[44%] rounded-full bg-black/[0.18]" />
        </div>
      </div>
    </div>
  );
};

const SalesChartVisual = () => (
  <div className="relative h-[132px] overflow-hidden rounded-[18px] border border-black/[0.04] bg-white/46 px-3 py-4">
    <div className="absolute left-5 top-5 h-2 w-20 rounded-full bg-black/[0.12]" />
    <div className="absolute left-5 top-10 h-2 w-12 rounded-full bg-black/[0.07]" />
    <div className="absolute inset-x-5 bottom-4 h-px bg-black/[0.08]" />
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={salesPreviewData} margin={{ top: 30, right: 10, left: 10, bottom: 0 }}>
        <Bar dataKey="value" radius={[7, 7, 2, 2]} fill="#111111" opacity={0.78} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const AquasVisual = () => (
  <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-[18px] border border-black/[0.04] bg-white/46">
    <div className="absolute h-24 w-24 rounded-full border border-black/[0.04] bg-white/60 blur-[1px]" />
    <div className="absolute left-[21%] top-[22%] grid h-8 w-8 -rotate-6 place-items-center rounded-full border border-black/[0.06] bg-white" style={{ boxShadow: showcaseShadow }}>
      <Sparkles className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
    </div>
    <div className="absolute bottom-[20%] right-[19%] h-8 w-12 rotate-[7deg] rounded-[16px] border border-black/[0.06] bg-white" style={{ boxShadow: showcaseShadow }} />
    <AquasIcon size={72} inverted className="relative z-10 rotate-[2deg]" />
  </div>
);

const QuickCardVisual = ({ card, products }: { card: QuickStartCard; products: CatalogPreviewProduct[] }) => {
  if (card.visual === "products") return <ProductStackVisual products={products} />;
  if (card.visual === "marketplace") return <MarketplaceVisual product={products[0]} />;
  if (card.visual === "chart") return <SalesChartVisual />;
  return <AquasVisual />;
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nome } = useProfile();
  const [chatPrompt, setChatPrompt] = useState("");

  const firstName = useMemo(() => getFirstName(nome, user?.email), [nome, user?.email]);
  const greeting = useMemo(() => getGreeting(), []);
  const { data: previewProducts = [] } = useQuery({
    queryKey: ["dashboard-quick-actions-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id, title, images, suggested_price")
        .in("source", ["c7drop", "cj", "b2drop"])
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(4);

      if (error) throw error;
      return data ?? [];
    },
    enabled: isSupabaseEnabled,
    staleTime: 1000 * 60 * 10,
  });

  const openAquas = (prompt?: string) => {
    const cleanPrompt = prompt?.trim();
    const qs = cleanPrompt ? `?first=${encodeURIComponent(cleanPrompt)}` : "";
    navigate(`/dashboard/atlas${qs}`);
  };

  const quickStartCards: QuickStartCard[] = [
    {
      title: "Importar produtos",
      description: "Escolha itens do fornecedor C7Drop.",
      cta: "Importar agora",
      visual: "products",
      onClick: () => navigate("/dashboard/catalogo"),
    },
    {
      title: "Gerenciar Mercado Livre",
      description: "Acompanhe integrações e publicações.",
      cta: "Ver publicações",
      visual: "marketplace",
      onClick: () => navigate("/dashboard/produtos-ml"),
    },
    {
      title: "Ver análise de vendas",
      description: "Indicadores de margem e performance.",
      cta: "Ver relatório completo",
      visual: "chart",
      onClick: () => navigate("/dashboard/catalogo?tab=metricas"),
    },
    {
      title: "Perguntar ao Aquas",
      description: "O que devo importar hoje?",
      cta: "Conversar com Aquas",
      visual: "aquas",
      onClick: () => openAquas("O que devo importar hoje?"),
    },
  ];

  return (
    <main
      className="relative -m-5 min-h-[calc(100%+40px)] overflow-visible bg-[#F7F8FA] px-5 pb-24 pt-5 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+48px)] sm:px-6 sm:pt-6 lg:-m-7 lg:min-h-[calc(100%+56px)] lg:px-7 lg:pt-7"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 14%, rgba(255,255,255,0.92) 0%, rgba(219,234,254,0.36) 28%, rgba(255,255,255,0) 58%), radial-gradient(circle at 88% 84%, rgba(255,237,213,0.65) 0%, rgba(255,255,255,0) 34%)",
        }}
        aria-hidden="true"
      />

      <section className="relative z-10 mx-auto flex w-full max-w-[820px] flex-col px-4 pt-[8vh] sm:px-6 lg:pt-[11vh]">
        <motion.div
          className="flex justify-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <button
            type="button"
            onClick={() => navigate("/checkout")}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-white/70 bg-white/76 px-3 text-[12px] font-semibold text-[#6B7280] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_10px_22px_rgba(17,24,39,0.06)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:text-[#1E3A8A]"
          >
            Plano Velo
            <span className="text-[#B45309]">Upgrade</span>
          </button>
        </motion.div>

        <motion.header
          className="mt-12 text-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.08}
        >
          <h1 className="text-[42px] font-medium leading-[0.98] tracking-[-0.06em] text-neutral-950 sm:text-[62px]">
            {greeting}, {firstName}
          </h1>
        </motion.header>

        <motion.form
          onSubmit={(event) => {
            event.preventDefault();
            openAquas(chatPrompt || "Como posso vender mais hoje?");
          }}
          className="mt-10 overflow-hidden rounded-[26px] bg-white/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.03),0_20px_50px_rgba(17,24,39,0.09)] backdrop-blur-2xl"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.16}
        >
          <div className="flex min-h-[96px] items-start px-2 pt-2">
            <textarea
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
              rows={2}
              placeholder="Pergunte ao Aquas... Como posso te ajudar hoje?"
              className="min-h-[62px] flex-1 resize-none bg-transparent pt-1 text-[15px] font-medium leading-6 text-neutral-800 outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
          <div className="mt-1 flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#6B7280]">
              <AquasIcon size={22} inverted />
              <span>Aquas</span>
              <span className="font-medium text-[#9CA3AF]">seu agente de vendas</span>
            </div>
            <button
              type="submit"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#111111] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_rgba(17,24,39,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#1E3A8A] active:translate-y-0"
              aria-label="Enviar pergunta ao Aquas"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </motion.form>

        <motion.section
          className="mt-7"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.24}
        >
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF]">Ações rápidas</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickStartCards.map((card, index) => (
              <motion.button
                key={card.title}
                type="button"
                onClick={card.onClick}
                className="group flex min-h-[284px] flex-col rounded-[22px] border border-white/70 bg-white/72 p-5 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
                style={{ boxShadow: quickCardShadow }}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.3 + index * 0.05}
              >
                <span className="block">
                  <span className="block text-[18px] font-bold leading-tight tracking-[-0.03em] text-neutral-950">{card.title}</span>
                  <span className="mt-2 block text-[14px] font-medium leading-5 text-[#737373]">{card.description}</span>
                </span>

                <span className="mt-5 block w-full">
                  <QuickCardVisual card={card} products={previewProducts} />
                </span>

                <span className="mt-auto pt-5">
                  <span className="inline-flex h-9 items-center rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.06)] transition-transform group-hover:translate-x-0.5">
                    {card.cta}
                  </span>
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="pt-12"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.52}
        >
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#1E3A8A]" strokeWidth={1.9} />
            <h2 className="text-[22px] font-bold tracking-[-0.035em] text-neutral-950">Aprenda a vender mais</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {learnCards.map((card, index) => {
              const Icon = card.Icon;
              return (
                <motion.button
                  key={card.title}
                  type="button"
                  onClick={() => navigate(card.to)}
                  className="group overflow-hidden rounded-[28px] border border-white/70 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-1"
                  style={{ background: "rgba(255,255,255,0.86)", boxShadow: cardShadow }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={0.58 + index * 0.06}
                >
                  <div
                    className="relative flex aspect-[1.65] items-center justify-center overflow-hidden"
                    style={{ background: card.gradient }}
                  >
                    <div className="absolute left-5 top-5 rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-[#1E3A8A] shadow-sm">
                      Guia
                    </div>
                    <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_34px_rgba(17,24,39,0.09)] transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-9 w-9 text-[#2563EB]" strokeWidth={1.8} />
                    </div>
                    <Sparkles className="absolute bottom-6 right-7 h-5 w-5 text-[#1E3A8A]/45" strokeWidth={1.7} />
                  </div>
                  <div className="p-5">
                    <h3 className="text-[15px] font-bold leading-snug tracking-[-0.02em] text-neutral-950">
                      {card.title}
                    </h3>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </section>
    </main>
  );
};

export default DashboardHomePage;
