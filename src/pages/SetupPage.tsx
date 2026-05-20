import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VeloLogo } from "@/components/VeloLogo";
import { toast } from "sonner";

const categories = ["Moda", "Eletrônicos", "Casa", "Beleza", "Fitness", "Geral"];
const channels = ["Mercado Livre", "Shopee", "TikTok Shop", "Loja própria", "Ainda não sei"];
const loadingMessages = [
  "Analisando oportunidades",
  "Configurando seu painel",
  "Organizando produtos",
  "Conectando marketplaces",
];

const enter = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const smooth = { duration: 0.64, ease: [0.22, 1, 0.36, 1] as const };
const chipTransition = { duration: 0.46, ease: [0.22, 1, 0.36, 1] as const };

const SetupPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState("");
  const [channel, setChannel] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    if (!finishing) return;

    const messageTimer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingMessages.length);
    }, 620);

    const finishTimer = window.setTimeout(() => {
      navigate("/cadastro?offer=1", { replace: true });
    }, 2600);

    return () => {
      window.clearInterval(messageTimer);
      window.clearTimeout(finishTimer);
    };
  }, [finishing, navigate]);

  const handleContinue = () => {
    if (!category) {
      toast.error("Escolha uma categoria para continuar.");
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!channel) {
      toast.error("Escolha onde você quer vender.");
      return;
    }

    const payload = {
      category,
      channel,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem("velo_setup_profile", JSON.stringify(payload));

    if (user) {
      await supabase
        .from("profiles")
        .update({
          objetivo: category,
          onboarding_completed: true,
        })
        .eq("user_id", user.id);
    }

    setFinishing(true);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030807] text-white antialiased [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(28,57,52,0.12),transparent_42%),radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.025),transparent_24%),#030807]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_62%,rgba(0,0,0,0.62)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.018] [background-image:radial-gradient(circle,rgba(255,255,255,0.78)_0.7px,transparent_0.7px)] [background-size:6px_6px]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <motion.div {...enter} transition={{ ...smooth, delay: 0.08 }}>
          <VeloLogo size="md" variant="light" />
        </motion.div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-82px)] items-start justify-center px-5 pb-16 pt-[6vh] sm:pt-[7vh]">
        <AnimatePresence mode="wait">
          {finishing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -18, filter: "blur(8px)" }}
              transition={smooth}
              className="text-center"
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] shadow-[0_0_48px_rgba(151,197,166,0.12)]">
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
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16, filter: "blur(7px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(7px)" }}
              transition={smooth}
              className="w-full max-w-[470px]"
            >
              <motion.div
                initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ ...smooth, delay: 0.06 }}
                className="mb-5 text-center"
              >
                <p className="text-[10px] font-[500] uppercase tracking-[0.16em] text-white/30">
                  Passo {step} de 2
                </p>
                <h1 className="mt-3 text-[25px] font-[390] leading-[1.05] tracking-[-0.04em] text-white sm:text-[28px]">
                  {step === 1 ? "Vamos começar" : "Quase pronto"}
                </h1>
                <p className="mt-2 text-[13px] font-[350] tracking-[-0.01em] text-white/45">
                  Adicione algumas informações para personalizar sua configuração.
                </p>
              </motion.div>

              <div className="relative">
                {step === 2 && (
                  <motion.button
                    type="button"
                    onClick={() => setStep(1)}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...smooth, delay: 0.12 }}
                    className="absolute -left-12 top-0 hidden h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.05] bg-white/[0.08] text-[18px] text-white/58 transition hover:bg-white/[0.12] hover:text-white sm:flex"
                    aria-label="Voltar"
                  >
                    ←
                  </motion.button>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ ...smooth, delay: 0.14 }}
                  className="rounded-[10px] bg-[#fbfaf7] p-5 text-[#111] shadow-[0_18px_70px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.04] sm:p-6"
                >
                  {step === 1 ? (
                    <>
                      <p className="text-[13px] font-[430] tracking-[-0.01em] text-[#111]">
                        O que você quer vender?
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {categories.map((item, index) => (
                          <OptionPill
                            key={item}
                            label={item}
                            selected={category === item}
                            onClick={() => setCategory(item)}
                            index={index}
                          />
                        ))}
                      </div>
                      <button
                        onClick={handleContinue}
                        className="mt-6 flex h-10 w-full items-center justify-center rounded-[8px] bg-[#06100f] text-[13px] font-[430] tracking-[-0.01em] text-white transition duration-300 hover:bg-[#111b19]"
                      >
                        Continuar
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-[430] tracking-[-0.01em] text-[#111]">
                        Onde você quer vender?
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {channels.map((item, index) => (
                          <OptionPill
                            key={item}
                            label={item}
                            selected={channel === item}
                            onClick={() => setChannel(item)}
                            index={index}
                          />
                        ))}
                      </div>
                      <div className="mt-6 grid gap-2 sm:grid-cols-[0.34fr_0.66fr]">
                        <button
                          onClick={() => setStep(1)}
                          className="h-10 rounded-[8px] border border-black/[0.08] bg-black/[0.025] text-[13px] font-[390] tracking-[-0.01em] text-black/62 transition hover:bg-black/[0.045] hover:text-black sm:hidden"
                        >
                          Voltar
                        </button>
                        <button
                          onClick={handleFinish}
                          className="flex h-10 items-center justify-center rounded-[8px] bg-[#06100f] text-[13px] font-[430] tracking-[-0.01em] text-white transition duration-300 hover:bg-[#111b19] sm:col-span-2"
                        >
                          Finalizar configuração
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
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
