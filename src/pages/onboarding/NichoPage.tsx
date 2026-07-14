import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shirt, Smartphone, Home, PawPrint, Dumbbell, Sparkles, ArrowRight, Check } from "lucide-react";
import { OnboardingQuizLayout, VeloOnboardingIllustration } from "./OnboardingQuizLayout";

const NICHES = [
  { id: "moda", label: "Moda e Vestuário", hint: "Looks, acessórios e itens de rotina", icon: Shirt },
  { id: "eletronicos", label: "Eletrônicos e Gadgets", hint: "Acessórios úteis, compactos e fáceis de demonstrar", icon: Smartphone },
  { id: "casa", label: "Casa e Jardim", hint: "Organização, decoração e praticidade", icon: Home },
  { id: "pets", label: "Pets", hint: "Cuidados, passeio e bem-estar animal", icon: PawPrint },
  { id: "esporte", label: "Esporte e Fitness", hint: "Treino em casa, performance e acessórios", icon: Dumbbell },
  { id: "beleza", label: "Beleza e Cuidados", hint: "Skincare, autocuidado e itens portáteis", icon: Sparkles },
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
    <OnboardingQuizLayout
      step={1}
      totalSteps={4}
      eyebrow="Primeira vitrine"
      title="Escolha o nicho da sua loja"
      subtitle="A Velo usa essa escolha para separar produtos reais do catálogo e montar uma primeira página com cara de loja pronta."
      footer={
        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {saving ? "Salvando..." : "Continuar"} <ArrowRight size={17} />
        </button>
      }
    >
      <VeloOnboardingIllustration />

      <div className="mt-8 grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NICHES.map((n) => {
          const Icon = n.icon;
          const active = selected === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n.id)}
              className={`group relative min-h-[118px] rounded-2xl border bg-white p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_22px_60px_rgba(37,99,235,0.10)] ${
                active ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${active ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500"}`}>
                  <Icon size={21} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold leading-5 text-slate-950">{n.label}</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">{n.hint}</p>
                </div>
              </div>
              {active && (
                <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white">
                  <Check size={14} strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </OnboardingQuizLayout>
  );
}
