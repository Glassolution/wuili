import { Grid2X2, Sparkles, type LucideIcon } from "lucide-react";

type WinningProductsPlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const WinningProductsPlaceholder = ({
  title,
  description,
  icon: Icon,
}: WinningProductsPlaceholderProps) => (
  <section className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-10">
    <div className="relative w-full max-w-[640px] overflow-hidden rounded-[28px] border border-black/[0.06] bg-white px-7 py-12 text-center shadow-[0_18px_50px_rgba(31,36,48,0.08)] sm:px-12 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#2563EB]/[0.07] blur-2xl"
      />

      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#2563EB] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]">
        <Icon size={27} strokeWidth={1.8} aria-hidden="true" />
      </div>

      <div className="relative mt-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF3FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D4ED8]">
          <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
          Em construção
        </span>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-[#1F2430] sm:text-[32px]">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[460px] text-sm font-medium leading-6 text-[#697181]">
          {description}
        </p>
      </div>
    </div>
  </section>
);

export const TemplatesPage = () => (
  <WinningProductsPlaceholder
    title="Modelos"
    description="Em breve, você encontrará modelos prontos para apresentar seus produtos e começar a vender mais rápido."
    icon={Grid2X2}
  />
);
