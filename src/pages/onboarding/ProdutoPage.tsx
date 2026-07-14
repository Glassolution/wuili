import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

type Product = {
  id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  images: any;
  category: string | null;
};

const NICHE_KEYWORDS: Record<string, string[]> = {
  moda: ["moda", "roupa", "vestido", "camisa", "calça"],
  eletronicos: ["eletronic", "gadget", "fone", "celular", "acessorio"],
  casa: ["casa", "cozinha", "decoracao", "utensilio"],
  pets: ["pet", "cachorro", "gato", "animal"],
  esporte: ["esporte", "fitness", "treino"],
  beleza: ["beleza", "cosmetico", "maquiagem", "cuidado"],
};

export default function ProdutoPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
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
      // Buscar produtos com stock; filtro por category/title contendo keywords
      let query = (supabase as any).from("catalog_products")
        .select("id, title, price, image_url, images, category")
        .gt("stock_quantity", 0)
        .limit(9);
      const { data, error } = await query;
      if (error || !data) { setProducts([]); setFetching(false); return; }
      const filtered = (data as Product[]).filter((p) => {
        const hay = `${p.category ?? ""} ${p.title ?? ""}`.toLowerCase();
        return keywords.length === 0 || keywords.some((k) => hay.includes(k));
      });
      setProducts(filtered.length > 0 ? filtered.slice(0, 9) : (data as Product[]).slice(0, 9));
      setFetching(false);
    })();
  }, [navigate]);

  const handleContinue = () => {
    if (!selected) return;
    sessionStorage.setItem("velo-onboarding-product-id", selected);
    navigate("/onboarding/gerando");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white flex flex-col">
      <header className="p-6 flex items-center justify-between">
        <button onClick={() => navigate("/onboarding/nicho")} className="flex items-center gap-2 text-white/60 hover:text-white text-sm">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="w-40 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-2/4 bg-emerald-400 rounded-full" />
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center px-6 pt-6 pb-16">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Escolha um produto pra começar</h1>
          <p className="mt-3 text-white/60">Vamos gerar uma landing page pronta pra vender esse produto. Depois você pode criar quantas quiser.</p>
        </div>

        {fetching ? (
          <div className="mt-16 flex items-center gap-3 text-white/60"><Loader2 className="animate-spin" size={18} /> Carregando produtos...</div>
        ) : products.length === 0 ? (
          <p className="mt-16 text-white/50">Nenhum produto disponível para este nicho.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl w-full">
            {products.map((p) => {
              const active = selected === p.id;
              const img = p.image_url || (Array.isArray(p.images) ? p.images[0] : null);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`group text-left rounded-2xl border overflow-hidden transition-all ${
                    active ? "border-emerald-400/70 shadow-[0_0_0_1px_rgba(52,211,153,0.4)]" : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="aspect-square bg-white/[0.04]">
                    {img ? <img src={img} alt={p.title} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="p-4 bg-white/[0.02]">
                    <p className="text-sm line-clamp-2 min-h-[2.5rem]">{p.title}</p>
                    <p className="mt-2 text-emerald-300 font-semibold">R$ {p.price?.toFixed(2) ?? "—"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-12 max-w-md w-full">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full h-12 rounded-xl bg-white text-slate-950 font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Gerar minha página <ArrowRight size={18} />
          </button>
          <p className="mt-3 text-center text-xs text-white/40">Passo 2 de 4</p>
        </div>
      </section>
    </main>
  );
}
