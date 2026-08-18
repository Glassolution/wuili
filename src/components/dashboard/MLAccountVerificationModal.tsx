import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { X, ArrowRight, ArrowLeft, ExternalLink, ShieldCheck, Check } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * Chamado quando o usuário conclui o tutorial (etapa 3, "Entendi").
   * Use para retomar o fluxo de publicação de onde parou.
   */
  onFinish?: () => void;
};

type Step = 1 | 2 | 3;

const ML_PROFILE_URL = "https://www.mercadolivre.com.br/vender";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/*
  O conteúdo de texto entra em cascata a cada troca de etapa: o container escalona
  os filhos e cada bloco sobe alguns pixels enquanto aparece.
*/
const textGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};

const textItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeIn" } },
};

const STEPS: Record<Step, { title: string; body: React.ReactNode }> = {
  1: {
    title: "Antes de publicar, verifique sua conta",
    body: (
      <>
        O Mercado Livre exige que sua conta esteja <strong className="font-semibold text-[#0A0A0A]">verificada</strong> e
        em <strong className="font-semibold text-[#0A0A0A]">modo vendedor</strong> para receber publicações feitas via
        integração. Sem isso, o anúncio pode falhar ou não aparecer para os compradores.
      </>
    ),
  },
  2: {
    title: "Acesse seu perfil no Mercado Livre",
    body: (
      <>
        Você será direcionado à <strong className="font-semibold text-[#0A0A0A]">área de vender</strong> para ativar o
        modo vendedor, aceitar o Mercado Envios e cadastrar o endereço de retirada. O botão "Vender" fica no topo da
        página.
      </>
    ),
  },
  3: {
    title: "Pronto! Você já pode continuar",
    body: (
      <>
        Depois de concluir a verificação no Mercado Livre, volte aqui e publique normalmente. Se ainda não terminou,
        deixe a aba aberta — <strong className="font-semibold text-[#0A0A0A]">o produto continua esperando você</strong>.
      </>
    ),
  },
};

/* Cartão flutuante que dá o "produto" do painel: usado na etapa final. */
const PanelCard = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 18, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -14, scale: 0.97 }}
    transition={{ duration: 0.5, ease: EASE_OUT }}
    className="m-auto w-[min(300px,100%)] rounded-[18px] bg-white p-5 shadow-[0_24px_56px_-22px_rgba(120,80,40,0.4)]"
  >
    {children}
  </motion.div>
);

/*
  Prints do tutorial (public/tutorial 01.png e 02.png): telas reais do Mercado Livre
  mostrando o que o usuário precisa fazer. O painel usa o mesmo creme do fundo das fotos,
  então elas entram sem moldura nem sombra — o print parece continuar no painel. A folga
  em volta existe para o "X" desenhado dentro do print não encostar no botão de fechar.
*/
const TutorialShot = ({ src, alt }: { src: string; alt: string }) => (
  <motion.img
    src={src}
    alt={alt}
    initial={{ opacity: 0, y: 18, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -14, scale: 0.97 }}
    transition={{ duration: 0.5, ease: EASE_OUT }}
    className="max-h-full w-auto max-w-full object-contain"
  />
);

const StepVisual = ({ step }: { step: Step }) => {
  if (step === 1) {
    return (
      <TutorialShot
        src="/tutorial 01.png"
        alt="Tela do Mercado Livre para ativar o modo vendedor: botão 'Ativar modo vendedor' e formulário com nome, CPF, telefone, CEP e endereço"
      />
    );
  }

  if (step === 2) {
    return (
      <TutorialShot
        src="/tutorial 02.png"
        alt="Menu do Mercado Livre com a opção 'Minha conta' destacada e o cursor sobre ela"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
      <PanelCard>
        <div className="flex flex-col items-center py-2 text-center">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 320, damping: 18 }}
            className="grid h-14 w-14 place-items-center rounded-full bg-[#2563EB]"
          >
            <Check size={26} strokeWidth={3} className="text-white" />
          </motion.span>
          <p className="mt-4 text-[14px] font-semibold text-[#0A0A0A]">Tudo certo!</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#6B6B6B]">
            Volte para a Velo assim que terminar a verificação e publique seu produto.
          </p>
        </div>
      </PanelCard>
    </div>
  );
};

const MLAccountVerificationModal = ({ open, onClose, onFinish }: Props) => {
  const [step, setStep] = useState<Step>(1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [open]);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  // Esc fecha o modal e o body para de rolar enquanto ele está aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openMLProfile = () => {
    window.open(ML_PROFILE_URL, "_blank", "noopener,noreferrer");
    setStep(3);
  };

  const primaryAction = () => {
    if (step === 1) return setStep(2);
    if (step === 2) return openMLProfile();
    close();
    setTimeout(() => onFinish?.(), 240);
  };

  const primaryLabel =
    step === 1 ? "Continuar" : step === 2 ? "Acessar página do Mercado Livre" : "Entendi";

  return createPortal(
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 bg-[#0A0F1F]/45 backdrop-blur-[3px]"
            onClick={close}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={STEPS[step].title}
            initial={{ opacity: 0, y: 24, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.975 }}
            transition={{ duration: 0.42, ease: EASE_OUT }}
            className="relative grid w-full max-w-[780px] max-h-[92vh] overflow-hidden rounded-[22px] bg-white shadow-[0_40px_120px_-30px_rgba(8,20,60,0.55)] md:h-[580px] md:max-h-[88vh] md:grid-cols-2"
          >
            {/* Coluna de texto */}
            <div className="order-2 flex flex-col overflow-y-auto p-7 sm:p-9 md:order-1 md:p-10">
              <span className="inline-flex w-fit items-center rounded-full bg-[#EFF4FF] px-2.5 py-1 text-[11.5px] font-semibold tracking-[-0.01em] text-[#2563EB]">
                Passo {step} de 3
              </span>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  variants={textGroup}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="mt-7"
                >
                  <motion.h2
                    variants={textItem}
                    className="font-['Inter_Tight',_Inter,_sans-serif] text-[29px] font-semibold leading-[1.13] tracking-[-0.035em] text-[#0A0A0A] sm:text-[33px]"
                  >
                    {STEPS[step].title}
                  </motion.h2>

                  <motion.p
                    variants={textItem}
                    className="mt-4 text-[14.5px] leading-[1.62] text-[#5C5F66]"
                  >
                    {STEPS[step].body}
                  </motion.p>

                  {step === 1 && (
                    <motion.div variants={textItem} className="mt-5 flex items-start gap-2.5">
                      <ShieldCheck size={15} className="mt-[3px] shrink-0 text-[#9AA0AA]" />
                      <p className="text-[12.5px] leading-[1.55] text-[#8A8F98]">
                        Mesmo com o perfil pessoal completo, o ML exige um cadastro separado como vendedor. É feito uma
                        única vez.
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-auto pt-8">
                <button onClick={primaryAction} className="btn-primary btn-primary--md w-full">
                  {primaryLabel}
                  {step === 2 ? <ExternalLink size={14} /> : <ArrowRight size={14} />}
                </button>

                {step > 1 && (
                  <button
                    onClick={() => setStep((step - 1) as Step)}
                    className="mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-[#8A8F98] transition-colors duration-150 hover:text-[#0A0A0A]"
                  >
                    <ArrowLeft size={13} /> Voltar
                  </button>
                )}
              </div>
            </div>

            {/* Painel visual */}
            <div className="relative order-1 h-[250px] shrink-0 overflow-hidden bg-[#FEF3E7] md:order-2 md:h-auto">
              {/* Mesmo gradiente do fundo dos prints, para a foto encostar sem emenda. */}
              <div className="absolute inset-0 bg-[linear-gradient(158deg,#FEEFDE_0%,#FEF4E9_48%,#FEF8F2_100%)]" />

              <div className="relative flex h-full w-full items-center justify-center p-4 pt-16 sm:pt-16 md:pt-4">
                <AnimatePresence mode="wait">
                  <StepVisual key={step} step={step} />
                </AnimatePresence>
              </div>
            </div>

            <button
              onClick={close}
              aria-label="Fechar"
              className="absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-full border border-black/[0.06] bg-white text-[#0A0A0A] shadow-[0_2px_10px_rgba(120,80,40,0.18)] transition-all duration-150 hover:shadow-[0_4px_14px_rgba(120,80,40,0.28)]"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default MLAccountVerificationModal;
