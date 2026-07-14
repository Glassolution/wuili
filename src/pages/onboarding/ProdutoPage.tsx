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
      footer={
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            Gerar minha página <ArrowRight size={17} />
          </button>
          <button onClick={() => navigate("/onboarding/nicho")} className="mx-auto flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-slate-700">
            <ArrowLeft size={14} /> Trocar nicho
          </button>
        </div>
      }
    >
      {fetching ? (
        <div className="mt-16 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-500 shadow-sm">
          <Loader2 className="animate-spin text-blue-600" size={18} /> Carregando produtos do catálogo...
        </div>
      ) : products.length === 0 ? (
        <div className="mt-14 flex max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">
            <PackageSearch size={24} />
          </div>
          <p className="mt-4 font-semibold text-slate-950">Nenhum produto disponível para este nicho.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Volte e escolha outro segmento para montar a primeira página.</p>
        </div>
      ) : (
        <div className="mt-9 grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const active = selected === p.id;
            const img = getProductImage(p.images);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`group relative overflow-hidden rounded-3xl border bg-white text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_70px_rgba(37,99,235,0.10)] ${
                  active ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-200"
                }`}
              >
                <div className="aspect-[4/3] bg-gradient-to-b from-slate-50 to-white p-5">
                  {img ? (
                    <img src={img} alt={p.title} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="grid h-full w-full place-items-center rounded-2xl bg-slate-50 text-slate-300">
                      <PackageSearch size={34} />
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 p-5">
                  <p className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-5 text-slate-950">{p.title}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-base font-bold text-blue-600">{currencyFormatter.format(p.suggested_price)}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {p.category ?? "Catálogo"}
                    </span>
                  </div>
                </div>
                {active && (
                  <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                    <Check size={16} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </OnboardingQuizLayout>
  );
}
