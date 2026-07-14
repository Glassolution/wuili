import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type OnboardingQuizLayoutProps = {
  step: number;
  totalSteps: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  previewTitle?: string;
  previewSubtitle?: string;
  previewBadge?: string;
  previewIcon?: string;
  backTo?: string;
};

export function OnboardingQuizLayout({
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  compact = false,
  previewTitle = "Vitrine personalizada",
  previewSubtitle = "Suas escolhas aparecem aqui enquanto a loja ganha forma.",
  previewBadge = "PT",
  previewIcon = "🙋",
  backTo,
}: OnboardingQuizLayoutProps) {
  const navigate = useNavigate();
  const progress = Math.min(100, Math.max(0, (step / totalSteps) * 100));

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0d0d] px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <header className="relative z-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => backTo ? navigate(backTo) : navigate(-1)}
              className="inline-flex items-center gap-2 text-[12px] font-medium text-white/45 transition hover:text-white"
              aria-label="Voltar"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09]">
                <div className="h-full rounded-full bg-white/50 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </header>

          <div className={`relative z-10 mx-auto flex w-full max-w-[580px] flex-1 flex-col ${compact ? "pt-9 lg:pt-10" : "pt-12 lg:pt-12"}`}>
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">{eyebrow}</div>
              <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[27px]">{title}</h1>
              <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-white/58">{subtitle}</p>
            </div>

            {children}

            {footer && <div className="mt-auto pb-2 pt-8">{footer}</div>}
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[420px] flex-col items-center justify-center rounded-[18px] bg-[#1a1a1a] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-white/[0.06] text-[42px]">
              {previewIcon}
              <span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-white/90">{previewBadge}</span>
            </span>
            <p className="mt-9 text-[20px] font-semibold tracking-[-0.025em] text-white/92">{previewTitle}</p>
            <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-white/24">{previewSubtitle}</p>
            <p className="mt-8 text-[11px] text-white/18">Passo {step} de {totalSteps}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
