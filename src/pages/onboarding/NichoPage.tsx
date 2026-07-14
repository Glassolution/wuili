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
      backTo="/dashboard"
      footer={
        <>
          <button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#f3efe8] text-[16px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-black/80"
          >
            {saving ? "Salvando..." : "Continuar"} <ArrowRight size={17} />
          </button>
          <p className="mt-3 text-center text-[11px] text-white/35">Experimente grátis</p>
        </>
      }
    >
      <div className="mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {NICHES.map((n) => {
          const Icon = n.icon;
          const active = selected === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n.id)}
              className={`group relative flex min-h-[142px] flex-col rounded-[9px] bg-white/[0.06] p-5 text-left outline-none transition hover:-translate-y-0.5 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-white/50 ${
                active ? "bg-white/[0.12] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : ""
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-white/70">
                <Icon size={19} />
              </div>
              <span className="mt-5 block text-[14px] font-semibold leading-snug text-white/92">{n.label}</span>
              <span className="mt-1 block text-[12px] leading-relaxed text-white/52">{n.hint}</span>
              {active && (
                <Check size={15} className="absolute right-4 top-4 text-white/75" />
              )}
            </button>
          );
        })}
      </div>
    </OnboardingQuizLayout>
  );
}
