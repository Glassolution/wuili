import type { ReactNode } from "react";
import { Box, CheckCircle2, Sparkles } from "lucide-react";

type OnboardingQuizLayoutProps = {
  step: number;
  totalSteps: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
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
}: OnboardingQuizLayoutProps) {
  const progress = Math.min(100, Math.max(0, (step / totalSteps) * 100));

  return (
    <main className="min-h-screen bg-[#fbfcff] text-slate-950">
      <header className="relative flex h-[72px] items-center justify-center border-b border-slate-100 bg-white/90 px-5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-blue-100 bg-white text-blue-600 shadow-sm">
            <Box size={17} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Velo</span>
        </div>

        <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 items-center gap-3 sm:flex">
          <span className="text-xs font-medium text-slate-400">Passo {step} de {totalSteps}</span>
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <section className={`mx-auto flex w-full max-w-6xl flex-col items-center px-5 ${compact ? "py-8 md:py-10" : "py-10 md:py-14"}`}>
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">
            <Sparkles size={12} />
            {eyebrow}
          </div>
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 md:text-base">{subtitle}</p>
        </div>

        {children}

        {footer && <div className="mt-8 w-full max-w-md">{footer}</div>}

        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-400 sm:hidden">
          <CheckCircle2 size={14} className="text-blue-500" />
          Passo {step} de {totalSteps}
        </div>
      </section>
    </main>
  );
}

export function VeloOnboardingIllustration() {
  return (
    <div className="relative mx-auto mt-8 h-[250px] w-full max-w-[620px] overflow-hidden rounded-[28px] bg-gradient-to-b from-white to-blue-50/60 md:h-[300px]">
      <div className="absolute inset-x-12 bottom-10 h-10 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full border border-blue-200/70" />
      <div className="absolute left-1/2 top-14 h-28 w-28 -translate-x-1/2 rounded-full bg-blue-500/10 blur-xl" />

      <div className="absolute left-1/2 top-12 grid h-[118px] w-[118px] -translate-x-1/2 place-items-center rounded-[34px] border border-blue-100 bg-white shadow-[0_24px_70px_rgba(37,99,235,0.18)]">
        <div className="grid h-[76px] w-[76px] place-items-center rounded-[24px] bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-500/20">
          <Box size={34} strokeWidth={1.9} />
        </div>
      </div>

      <div className="absolute left-[16%] top-[44%] h-20 w-20 rounded-[24px] bg-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="absolute left-4 top-4 h-8 w-8 rounded-xl border border-cyan-300/50" />
      </div>
      <div className="absolute right-[18%] top-[42%] h-24 w-24 rounded-[28px] bg-gradient-to-br from-slate-950 to-blue-950 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="absolute right-4 top-5 h-9 w-9 rounded-2xl bg-blue-400/30" />
      </div>
      <div className="absolute left-[29%] bottom-12 h-14 w-14 rounded-[18px] bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.16)]" />
      <div className="absolute right-[31%] bottom-11 h-16 w-16 rounded-[20px] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.12)] ring-1 ring-blue-100" />

      <div className="absolute left-1/2 top-[59%] h-2 w-44 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
      <div className="absolute left-1/2 top-[61%] h-16 w-64 -translate-x-1/2 rounded-[50%] border border-blue-200/70" />
    </div>
  );
}
