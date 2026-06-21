import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VeloLogo } from "@/components/VeloLogo";
import { veloToast } from "@/components/ui/velo-toast";
import { getLeadOrigin, trackOnboardingEvent, upsertOnboardingProfile } from "@/lib/onboardingAnalytics";
import { attachReferralToCurrentUser } from "@/lib/affiliateFunnel";

const categories = ["Moda", "Eletrônicos", "Casa", "Beleza", "Fitness", "Geral"];
const marketplaces = ["Mercado Livre", "Shopee", "TikTok Shop", "Loja própria", "Ainda não sei"];
const referralSources = ["Instagram", "TikTok", "YouTube", "Google", "Indicação", "Outro"];

const loadingMessages = [
  "Analisando oportunidades",
  "Configurando seu painel",
  "Organizando produtos",
  "Conectando marketplaces",
];

const smooth = { duration: 0.64, ease: [0.22, 1, 0.36, 1] as const };
const chipTransition = { duration: 0.46, ease: [0.22, 1, 0.36, 1] as const };

type Step = 1 | 2 | 3;

const stepTitles: Record<Step, string> = {
  1: "O que você quer vender?",
  2: "Onde você quer vender?",
  3: "Onde conheceu a Velo?",
};

const SetupPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    void attachReferralToCurrentUser(user.id);
    void upsertOnboardingProfile({
      userId: user.id,
      fullName: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
      email: user.email ?? null,
      onboardingStep: step,
      onboardingCompleted: false,
      paymentStatus: "not_started",
      leadOrigin: getLeadOrigin(),
      userStatus: "in_setup",
    });
  }, [step, user]);

  useEffect(() => {
    if (!finishing) return;
    const messageTimer = window.setInterval(() => {
      setLoadingIndex((c) => (c + 1) % loadingMessages.length);
    }, 620);
    const finishTimer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2600);
    return () => {
      window.clearInterval(messageTimer);
      window.clearTimeout(finishTimer);
    };
  }, [finishing, navigate]);

  const handleNext = () => {
    if (step === 1 && !category) return veloToast.error("Escolha uma categoria para continuar.");
    if (step === 2 && !marketplace) return veloToast.error("Escolha um marketplace para continuar.");
    if (step === 3 && !referralSource) return veloToast.error("Informe onde conheceu a Velo.");
    if (step === 3) return handleFinish();
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  };

  const handleFinish = async () => {
    const payload = {
      category,
      marketplace,
      referralSource,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem("velo_setup_profile", JSON.stringify(payload));

    if (user) {
      setSaving(true);
      const toastId = veloToast.loading("Salvando configurações...");
      try {
        // Dados PRINCIPAIS (não pode falhar)
        const { error } = await supabase
          .from("profiles")
          .update({
            categorias: [category],
            onboarding_completed: true,
          })
          .eq("user_id", user.id);

        if (error) {
          console.error("[setup] erro ao salvar perfil:", { error, userId: user.id, payload });
          veloToast.error("Não foi possível salvar seu perfil. Tente novamente.", { id: toastId });
          return;
        }

        // Dados secundários (analytics/inteligência) — NÃO bloquear o usuário
        const onboardingPayload = {
          userId: user.id,
          fullName: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
          email: user.email ?? null,
          category,
          marketplace,
          referralSource,
          onboardingStep: 3,
          onboardingCompleted: true,
          paymentStatus: "not_started",
          leadOrigin: getLeadOrigin(),
          userStatus: "setup_completed",
        };

        const { error: profileError } = await upsertOnboardingProfile(onboardingPayload);
        if (profileError) {
          console.error("[setup] falha ao salvar user_profiles (não bloqueante):", {
            table: "user_profiles",
            error: profileError,
            onboardingPayload,
          });
        }

        const { error: eventError } = await trackOnboardingEvent(user.id, "completed_setup", "setup", {
          category,
          marketplace,
          referral_source: referralSource,
        });
        if (eventError) {
          console.error("[setup] falha ao salvar onboarding_events (não bloqueante):", {
            table: "onboarding_events",
            error: eventError,
            userId: user.id,
            payload: { category, marketplace, referral_source: referralSource },
          });
        }

        veloToast.success("Configurações salvas com sucesso.", { id: toastId });
      } catch (err) {
        veloToast.error("Erro inesperado ao salvar perfil.", { id: toastId });
      } finally {
        setSaving(false);
      }
    }

    setFinishing(true);
  };

  if (finishing) {
    return (
      <main className="relative grid min-h-screen place-items-center bg-[#030807] text-white antialiased">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={smooth}
          className="text-center"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035]">
            <Loader2 className="h-5 w-5 animate-spin text-white/72" strokeWidth={1.6} />
          </div>
          <h1 className="mt-6 text-[25px] font-[380] leading-tight tracking-[-0.04em]">
            Preparando sua operação...
          </h1>
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingMessages[loadingIndex]}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="mt-2.5 text-[13px] font-[350] text-white/44"
            >
              {loadingMessages[loadingIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </main>
    );
  }

  const currentOptions =
    step === 1 ? categories : step === 2 ? marketplaces : referralSources;
  const isSelected = (item: string) => {
    if (step === 1) return category === item;
    if (step === 2) return marketplace === item;
    return referralSource === item;
  };
  const handleSelect = (item: string) => {
    if (step === 1) {
      setCategory(item);
      if (user) {
        void upsertOnboardingProfile({ userId: user.id, category: item, onboardingStep: 1, userStatus: "in_setup" });
        void trackOnboardingEvent(user.id, "selected_category", item, { step: 1 });
      }
      return;
    }
    if (step === 2) {
      setMarketplace(item);
      if (user) {
        void upsertOnboardingProfile({ userId: user.id, marketplace: item, onboardingStep: 2, userStatus: "in_setup" });
        void trackOnboardingEvent(user.id, "selected_marketplace", item, { step: 2 });
      }
      return;
    }
    setReferralSource(item);
    if (user) {
      void upsertOnboardingProfile({ userId: user.id, referralSource: item, onboardingStep: 3, userStatus: "in_setup" });
      void trackOnboardingEvent(user.id, "selected_referral_source", item, { step: 3 });
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030807] text-white antialiased [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(28,57,52,0.12),transparent_42%),radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.025),transparent_24%),#030807]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.018] [background-image:radial-gradient(circle,rgba(255,255,255,0.78)_0.7px,transparent_0.7px)] [background-size:6px_6px]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <VeloLogo size="md" variant="light" />
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-82px)] items-start justify-center px-5 pb-16 pt-[6vh] sm:pt-[7vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16, filter: "blur(7px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(7px)" }}
            transition={smooth}
            className="w-full max-w-[470px]"
          >
            <div className="mb-5 text-center">
              <p className="text-[10px] font-[500] uppercase tracking-[0.16em] text-white/30">
                Passo {step} de 3
              </p>
              <h1 className="mt-3 text-[25px] font-[390] leading-[1.05] tracking-[-0.04em] text-white sm:text-[28px]">
                {stepTitles[step]}
              </h1>
              <p className="mt-2 text-[13px] font-[350] tracking-[-0.01em] text-white/45">
                {step === 1
                  ? "Escolha o ponto de partida da sua operação."
                  : "Selecione a opção que melhor descreve você."}
              </p>
            </div>

            <div className="relative">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="absolute -left-12 top-0 hidden h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.05] bg-white/[0.08] text-[18px] text-white/58 transition hover:bg-white/[0.12] hover:text-white sm:flex"
                  aria-label="Voltar"
                >
                  ←
                </button>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ ...smooth, delay: 0.14 }}
                className="rounded-[10px] bg-[#fbfaf7] p-5 text-[#111] shadow-[0_18px_70px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.04] sm:p-6"
              >
                <div className="flex flex-wrap gap-2">
                  {currentOptions.map((item, index) => (
                    <OptionPill
                      key={item}
                      label={item}
                      selected={isSelected(item)}
                      onClick={() => handleSelect(item)}
                      index={index}
                    />
                  ))}
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-[0.34fr_0.66fr]">
                  {step > 1 && (
                    <button
                      onClick={() => setStep((s) => (s - 1) as Step)}
                      className="h-10 rounded-[8px] border border-black/[0.08] bg-black/[0.025] text-[13px] font-[390] tracking-[-0.01em] text-black/62 transition hover:bg-black/[0.045] hover:text-black sm:hidden"
                    >
                      Voltar
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#06100f] text-[13px] font-[430] tracking-[-0.01em] text-white transition duration-300 hover:bg-[#111b19] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {step === 3 ? "Finalizar configuração" : "Continuar"}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
};

const OptionPill = ({
  label,
  selected,
  onClick,
  index,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  index: number;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, y: 7 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...chipTransition, delay: 0.2 + index * 0.04 }}
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.985 }}
    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-[430] tracking-[-0.006em] transition duration-300 ${
      selected
        ? "border-[#06100f] bg-[#06100f] text-white shadow-[0_5px_16px_rgba(0,0,0,0.1)]"
        : "border-transparent bg-[#f1f2f0] text-black/70 hover:bg-[#e9ebe8] hover:text-black"
    }`}
  >
    {selected ? <Check size={12} strokeWidth={2.1} /> : <span className="text-[14px] leading-none text-current">+</span>}
    {label}
  </motion.button>
);

export default SetupPage;
