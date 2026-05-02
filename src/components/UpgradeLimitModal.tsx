import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

type UpgradeLimitModalProps = {
  open: boolean;
  title?: string;
  message: string;
  cta?: string;
  onClose: () => void;
};

const UpgradeLimitModal = ({
  open,
  title = "Limite do plano atingido",
  message,
  cta = "Ver planos",
  onClose,
}: UpgradeLimitModalProps) => {
  const navigate = useNavigate();

  if (!open) return null;

  const goToPlans = () => {
    onClose();
    navigate("/dashboard/planos");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
          aria-label="Fechar modal"
        >
          <X size={16} />
        </button>

        <div className="mb-5 inline-flex rounded-full bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white dark:bg-white dark:text-black">
          Upgrade
        </div>
        <h2 className="pr-8 text-[20px] font-bold tracking-[-0.02em] text-zinc-950 dark:text-white">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-zinc-600 dark:text-zinc-400">
          {message}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={goToPlans}
            className="flex-1 rounded-xl bg-black px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeLimitModal;
