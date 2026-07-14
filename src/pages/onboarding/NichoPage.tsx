import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shirt, Smartphone, Home, PawPrint, Dumbbell, Sparkles, ArrowRight, Check } from "lucide-react";
import { OnboardingQuizLayout } from "./OnboardingQuizLayout";

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
      previewTitle="Nicho da loja"
      previewSubtitle={selected ? "Segmento selecionado. O próximo passo traz produtos reais do catálogo." : "Escolha um segmento para começar a montar a sua primeira vitrine."}
      footer={
        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving ? "Salvando..." : "Continuar"} <ArrowRight size={17} />
        </button>
      }
    >
      <div className="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {NICHES.map((n) => {
          const Icon = n.icon;
          const active = selected === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n.id)}
              className={`group relative min-h-[88px] rounded-xl border bg-white p-4 text-left transition hover:border-slate-400 ${
                active ? "border-slate-950 ring-2 ring-slate-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-500"}`}>
                  <Icon size={18} />
                </div>
                <div className="pr-5">
                  <p className="text-[13px] font-semibold leading-5 text-slate-950">{n.label}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{n.hint}</p>
                </div>
              </div>
              {active && (
                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-slate-950 text-white">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </OnboardingQuizLayout>
  );
}
