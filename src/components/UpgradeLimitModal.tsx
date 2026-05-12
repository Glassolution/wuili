import { ArrowUpRight, CheckCircle2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

type UpgradeLimitModalProps = {
  open: boolean;
  title?: string;
  eyebrow?: string;
  message: string;
  cta?: string;
  targetPlan?: "pro" | "business";
  benefits?: string[];
  benefitsLabel?: string;
  onClose: () => void;
};

const UpgradeLimitModal = ({
  open,
  eyebrow = "Upgrade",
  title = "Limite do plano atingido",
  message,
  cta = "Ver planos",
  targetPlan,
  benefits,
  benefitsLabel,
  onClose,
}: UpgradeLimitModalProps) => {
  const navigate = useNavigate();

  if (!open) return null;

  const goToPlans = () => {
    onClose();
    navigate(targetPlan ? `/checkout?plan=${targetPlan}` : "/dashboard/planos");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-zinc-950 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-500/10" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
          aria-label="Fechar modal"
        >
          <X size={16} />
        </button>

        <div className="mb-5 inline-flex rounded-full border border-black/[0.06] bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white dark:bg-white dark:text-black">
          {eyebrow}
        </div>
        <h2 className="pr-8 text-[22px] font-semibold tracking-[-0.03em] text-zinc-950 dark:text-white">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-zinc-600 dark:text-zinc-400">
          {message}
        </p>

        {!!benefits?.length && (
          <div className="mt-5 rounded-2xl border border-black/[0.05] bg-[#F7F7F5] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {benefitsLabel ?? (targetPlan === "business" ? "Business libera" : "Plano Pro libera")}
            </p>
            <div className="space-y-2.5">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2.5 text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={goToPlans}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
          >
            {cta}
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeLimitModal;
