import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database, Json } from "@/integrations/supabase/types";
import { ArrowLeft, ArrowRight, Check, Loader2, PackageSearch } from "lucide-react";
import { OnboardingQuizLayout } from "./OnboardingQuizLayout";

type CatalogProduct = Pick<
  Database["public"]["Tables"]["catalog_products"]["Row"],
  "id" | "title" | "suggested_price" | "images" | "category"
>;

const NICHE_KEYWORDS: Record<string, string[]> = {
  moda: ["moda", "roupa", "vestido", "camisa", "calça"],
  eletronicos: ["eletronic", "gadget", "fone", "celular", "acessorio"],
  casa: ["casa", "cozinha", "decoracao", "utensilio"],
  pets: ["pet", "cachorro", "gato", "animal"],
  esporte: ["esporte", "fitness", "treino"],
  beleza: ["beleza", "cosmetico", "maquiagem", "cuidado"],
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function getProductImage(images: Json | null) {
  if (Array.isArray(images)) {
    return images.find((image): image is string => typeof image === "string") ?? null;
  }

  if (images && typeof images === "object") {
    return Object.values(images).find((image): image is string => typeof image === "string") ?? null;
  }

  return null;
}

export default function ProdutoPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const niche = sessionStorage.getItem("velo-onboarding-niche");
    if (!niche) {
      navigate("/onboarding/nicho", { replace: true });
      return;
    }
    (async () => {
      setFetching(true);
      const keywords = NICHE_KEYWORDS[niche] ?? [];
      const query = supabase
        .from("catalog_products")
        .select("id, title, suggested_price, images, category")
        .gt("stock_quantity", 0)
        .limit(9);
      const { data, error } = await query;
      if (error || !data) { setProducts([]); setFetching(false); return; }
      const filtered = data.filter((p) => {
        const hay = `${p.category ?? ""} ${p.title ?? ""}`.toLowerCase();
        return keywords.length === 0 || keywords.some((k) => hay.includes(k));
      });
      setProducts(filtered.length > 0 ? filtered.slice(0, 9) : data.slice(0, 9));
      setFetching(false);
    })();
  }, [navigate]);

  const handleContinue = () => {
    if (!selected) return;
    sessionStorage.setItem("velo-onboarding-product-id", selected);
    navigate("/onboarding/gerando");
  };

  return (
    <OnboardingQuizLayout
      step={2}
      totalSteps={4}
      compact
      eyebrow="Produto inicial"
      title="Escolha o primeiro produto"
      subtitle="Esse item vira a sua primeira página de venda. Depois você pode adicionar mais produtos no painel."
      previewTitle="Produto da primeira página"
      previewSubtitle={selected ? "Produto selecionado para gerar a página de venda." : "Selecione um produto real do catálogo Velo para continuar."}
      previewIcon="📦"
      backTo="/onboarding/nicho"
      footer={
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#f3efe8] text-[16px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-black/80"
          >
            Gerar minha página <ArrowRight size={17} />
          </button>
          <button onClick={() => navigate("/onboarding/nicho")} className="mx-auto flex items-center gap-2 text-[11px] font-medium text-white/35 transition hover:text-white/70">
            <ArrowLeft size={14} /> Trocar nicho
          </button>
        </div>
      }
    >
      {fetching ? (
        <div className="mt-8 flex items-center gap-3 rounded-[9px] bg-white/[0.06] px-5 py-4 text-[13px] font-medium text-white/52">
          <Loader2 className="animate-spin text-white/75" size={17} /> Carregando produtos do catálogo...
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 flex max-w-md flex-col items-center rounded-[9px] bg-white/[0.06] p-6 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.05] text-white/45">
            <PackageSearch size={21} />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-white/92">Nenhum produto disponível para este nicho.</p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/52">Volte e escolha outro segmento para montar a primeira página.</p>
        </div>
      ) : (
        <div className="mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {products.map((p) => {
            const active = selected === p.id;
            const img = getProductImage(p.images);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`group relative overflow-hidden rounded-[9px] bg-white/[0.06] text-left outline-none transition hover:-translate-y-0.5 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-white/50 ${
                  active ? "bg-white/[0.12] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : ""
                }`}
              >
                <div className="aspect-[4/3] bg-white/[0.04] p-3">
                  {img ? (
                    <img src={img} alt={p.title} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="grid h-full w-full place-items-center rounded-[7px] bg-white/[0.04] text-white/25">
                      <PackageSearch size={28} />
                    </div>
                  )}
                </div>
                <div className="border-t border-white/[0.07] p-3.5">
                  <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-white/92">{p.title}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#f3efe8]">{currencyFormatter.format(p.suggested_price)}</p>
                    <span className="truncate rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">
                      {p.category ?? "Catálogo"}
                    </span>
                  </div>
                </div>
                {active && (
                  <Check size={15} className="absolute right-4 top-4 text-white/75" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </OnboardingQuizLayout>
  );
}
