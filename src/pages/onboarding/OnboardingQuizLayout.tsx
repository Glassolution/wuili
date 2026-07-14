import type { ReactNode } from "react";
import { Box } from "lucide-react";

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
}: OnboardingQuizLayoutProps) {
  const progress = Math.min(100, Math.max(0, (step / totalSteps) * 100));

  return (
    <main className="grid min-h-screen bg-white text-slate-950 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <section className="flex min-h-screen flex-col border-slate-200 bg-white lg:border-r">
        <header className="flex h-14 items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-950">
              <Box size={15} />
            </span>
            <span className="text-sm font-semibold tracking-tight">Velo</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">Passo {step} de {totalSteps}</span>
            <div className="h-1 w-28 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-950 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        <div className={`mx-auto flex w-full max-w-[640px] flex-1 flex-col px-5 md:px-8 ${compact ? "py-6" : "py-8"}`}>
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div>
            <h1 className="max-w-xl text-2xl font-semibold tracking-tight text-slate-950 md:text-[32px] md:leading-[1.08]">{title}</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="mt-auto w-full pt-7">{footer}</div>}
        </div>
      </section>

      <aside
        className="hidden min-h-screen items-center justify-center bg-[#fbfbfb] px-10 lg:flex"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(15,23,42,0.12) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <div className="w-full max-w-[340px] rounded-[18px] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-dashed border-slate-300 bg-slate-50">
            <Box size={25} className="text-slate-950" />
          </div>
          <div className="mt-3 text-xs font-semibold tracking-[0.22em] text-slate-500">{previewBadge}</div>
          <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{previewTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{previewSubtitle}</p>
        </div>
      </aside>
    </main>
  );
}
