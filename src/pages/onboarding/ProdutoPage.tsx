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
      footer={
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
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
        <div className="mt-10 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-500">
          <Loader2 className="animate-spin text-slate-950" size={17} /> Carregando produtos do catálogo...
        </div>
      ) : products.length === 0 ? (
        <div className="mt-10 flex max-w-md flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-400">
            <PackageSearch size={21} />
          </div>
          <p className="mt-4 font-semibold text-slate-950">Nenhum produto disponível para este nicho.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Volte e escolha outro segmento para montar a primeira página.</p>
        </div>
      ) : (
        <div className="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {products.map((p) => {
            const active = selected === p.id;
            const img = getProductImage(p.images);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`group relative overflow-hidden rounded-xl border bg-white text-left transition hover:border-slate-400 ${
                  active ? "border-slate-950 ring-2 ring-slate-200" : "border-slate-200"
                }`}
              >
                <div className="aspect-[4/3] bg-slate-50 p-3">
                  {img ? (
                    <img src={img} alt={p.title} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="grid h-full w-full place-items-center rounded-lg bg-white text-slate-300">
                      <PackageSearch size={28} />
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 p-3.5">
                  <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-slate-950">{p.title}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-950">{currencyFormatter.format(p.suggested_price)}</p>
                    <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {p.category ?? "Catálogo"}
                    </span>
                  </div>
                </div>
                {active && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-white">
                    <Check size={14} strokeWidth={2.5} />
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
