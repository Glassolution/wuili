import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, ArrowLeft, ExternalLink, ShieldCheck, UserCircle2, CheckCircle2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * Chamado quando o usuário conclui o tutorial (etapa 3, "Entendi").
   * Use para retomar o fluxo de publicação de onde parou.
   */
  onFinish?: () => void;
};

const ML_PROFILE_URL = "https://www.mercadolivre.com.br/vender";

const StepDots = ({ step }: { step: 1 | 2 | 3 }) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3].map((n) => (
      <span
        key={n}
        className={`h-1.5 rounded-full transition-all ${
          n === step ? "w-6 bg-[#0A0A0A]" : "w-1.5 bg-[#E5E5E5]"
        }`}
      />
    ))}
    <span className="ml-2 text-[11px] font-medium text-[#737373]">{step}/3</span>
  </div>
);

const BrowserFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 rounded-xl border border-[#E5E5E5] bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)] overflow-hidden">
    <div className="flex items-center gap-1.5 border-b border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      <div className="ml-3 flex-1 rounded-md bg-white border border-[#EEE] px-2 py-1 text-[10px] text-[#999] truncate">
        mercadolivre.com.br/perfil
      </div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2 text-[13px] text-[#404040]">
    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#0A0A0A]" />
    <span>{children}</span>
  </li>
);

const MLAccountVerificationModal = ({ open, onClose, onFinish }: Props) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
      setStep(1);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open && !visible) return null;

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 160);
  };

  const openMLProfile = () => {
    window.open(ML_PROFILE_URL, "_blank", "noopener,noreferrer");
    setStep(3);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <div
        className={`relative w-full max-w-[520px] rounded-2xl bg-white shadow-2xl transition-all duration-150 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-3">
          <div className="flex-1 pr-4">
            <div className="mb-2"><StepDots step={step} /></div>
            <h2 className="text-[17px] font-semibold text-[#0A0A0A] leading-snug">
              {step === 1 && "Antes de publicar, verifique sua conta"}
              {step === 2 && "Acesse seu perfil no Mercado Livre"}
              {step === 3 && "Pronto! Você já pode continuar"}
            </h2>
          </div>
          <button
            onClick={close}
            className="text-[#737373] hover:text-[#0A0A0A] transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 max-h-[70vh] overflow-y-auto">
          {step === 1 && (
            <>
              <p className="text-[13.5px] leading-relaxed text-[#525252]">
                O Mercado Livre exige que sua conta esteja <strong>verificada</strong> e em{" "}
                <strong>modo vendedor</strong> para receber publicações feitas via integração.
                Sem isso, o anúncio pode falhar ou não aparecer para os compradores.
              </p>
              <ul className="mt-4 space-y-2.5">
                <Bullet>Evita falhas silenciosas ao publicar produtos.</Bullet>
                <Bullet>Garante que seus pedidos cheguem até você corretamente.</Bullet>
                <Bullet>Libera o repasse dos pagamentos das suas vendas.</Bullet>
                <Bullet>Deixa sua loja pronta para vender de forma profissional.</Bullet>
              </ul>
              <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-[#F5F5F5] p-3">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#0A0A0A]" />
                <p className="text-[12px] text-[#525252] leading-relaxed">
                  A verificação é feita <strong>uma única vez</strong>, direto no Mercado Livre.
                  Depois disso, você publica pela Velo normalmente.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-[13.5px] leading-relaxed text-[#525252]">
                Você será direcionado à página de <strong>perfil do Mercado Livre</strong> para
                completar sua verificação e ativar o modo vendedor. Confira abaixo onde
                encontrar as informações a preencher:
              </p>
              <BrowserFrame>
                <div className="flex items-center gap-3 pb-3 border-b border-[#F0F0F0]">
                  <div className="h-10 w-10 rounded-full bg-[#FFE600] flex items-center justify-center">
                    <UserCircle2 size={22} className="text-[#0A0A0A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2.5 w-24 rounded-full bg-[#EAEAEA] mb-1.5" />
                    <div className="h-2 w-32 rounded-full bg-[#F2F2F2]" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#0A0A0A] bg-[#FFE600] px-2 py-1 rounded-full">
                    Verificar conta
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-full rounded-full bg-[#F5F5F5]" />
                  <div className="h-3 w-4/5 rounded-full bg-[#F5F5F5]" />
                  <div className="h-3 w-2/3 rounded-full bg-[#F5F5F5]" />
                </div>
                <p className="mt-3 text-[11px] text-[#737373]">
                  Complete os dados pessoais, endereço e ative o modo vendedor.
                </p>
              </BrowserFrame>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-[13.5px] leading-relaxed text-[#525252]">
                Depois de completar a verificação e ativar o <strong>modo vendedor</strong> no
                Mercado Livre, você pode voltar aqui e publicar seus produtos normalmente,
                como já fazia antes.
              </p>
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#0A0A0A]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">Tudo certo!</p>
                  <p className="text-[12.5px] text-[#525252] mt-1 leading-relaxed">
                    Se ainda não concluiu a verificação, deixe a aba do Mercado Livre aberta e
                    volte quando terminar. O produto continua aqui esperando você publicar.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#F0F0F0] px-6 py-4">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="inline-flex items-center gap-1.5 rounded-[100px] border-[1.5px] border-[#E5E5E5] px-4 py-2 text-[12.5px] font-[400] text-[#0A0A0A] transition-all duration-[120ms] hover:border-[#0A0A0A] hover:bg-[#F5F5F5]"
              >
                <ArrowLeft size={13} /> Voltar
              </button>
            )}
          </div>
          <div>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="btn-primary btn-primary--md"
              >
                Continuar <ArrowRight size={13} />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={openMLProfile}
                className="btn-primary btn-primary--md"
              >
                Acessar página do Mercado Livre <ExternalLink size={13} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => {
                  close();
                  setTimeout(() => onFinish?.(), 180);
                }}
                className="btn-primary btn-primary--md"
              >
                Entendi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MLAccountVerificationModal;
