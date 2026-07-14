import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shirt, Smartphone, Home, PawPrint, Dumbbell, Sparkles, ArrowRight } from "lucide-react";

const NICHES = [
  { id: "moda", label: "Moda e Vestuário", icon: Shirt, category: "moda" },
  { id: "eletronicos", label: "Eletrônicos e Gadgets", icon: Smartphone, category: "eletronicos" },
  { id: "casa", label: "Casa e Jardim", icon: Home, category: "casa" },
  { id: "pets", label: "Pets", icon: PawPrint, category: "pets" },
  { id: "esporte", label: "Esporte e Fitness", icon: Dumbbell, category: "esporte" },
  { id: "beleza", label: "Beleza e Cuidados", icon: Sparkles, category: "beleza" },
];

export default function NichoPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const handleContinue = async () => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      sessionStorage.setItem("velo-onboarding-niche", selected);
      await supabase.from("profiles").update({ onboarding_niche: selected }).eq("user_id", user.id);
      navigate("/onboarding/produto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white flex flex-col">
      <header className="p-6 flex items-center justify-between">
        <div className="text-lg font-semibold tracking-tight">Velo</div>
        <div className="w-40 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-1/4 bg-emerald-400 rounded-full" />
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center px-6 pt-10 pb-16">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Qual é o seu nicho?</h1>
          <p className="mt-3 text-white/60">Escolha o segmento que combina com o seu público. Vamos usar isso para montar a sua demo.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full">
          {NICHES.map((n) => {
            const Icon = n.icon;
            const active = selected === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n.id)}
                className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
                  active
                    ? "border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.4)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                }`}
              >
                <div className={`h-10 w-10 rounded-xl grid place-items-center ${active ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-white/70"}`}>
                  <Icon size={20} />
                </div>
                <span className="font-medium">{n.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-12 max-w-md w-full">
          <button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="w-full h-12 rounded-xl bg-white text-slate-950 font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "Continuar"} <ArrowRight size={18} />
          </button>
          <p className="mt-3 text-center text-xs text-white/40">Passo 1 de 4</p>
        </div>
      </section>
    </main>
  );
}
