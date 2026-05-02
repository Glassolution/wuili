import { usePlan, type PlanName } from "@/hooks/usePlan";

const LABELS: Record<PlanName, string> = {
  gratis: "Plano Gratuito",
  go: "Plano Go",
  pro: "Plano Pro",
  business: "Plano Business",
};

type Props = {
  size?: "sm" | "md";
  className?: string;
};

const PlanBadge = ({ size = "sm", className = "" }: Props) => {
  const { plan, loading } = usePlan();
  if (loading) return null;

  const isPaid = plan === "pro" || plan === "business" || plan === "go";
  const colors = isPaid
    ? "bg-emerald-500/12 text-emerald-700 border-emerald-500/25"
    : "bg-black/[0.05] text-black/60 border-black/10";

  const sizing =
    size === "md"
      ? "text-[12px] px-3 py-[6px]"
      : "text-[11px] px-2.5 py-[4px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-['Manrope'] font-semibold ${colors} ${sizing} ${className}`}
    >
      {isPaid && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {LABELS[plan]}
    </span>
  );
};

export default PlanBadge;
