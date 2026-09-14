import { useEffect, useState } from "react";
import { Clock, Flame } from "lucide-react";

const STORAGE_KEY = "velo:base_promo_deadline";
const PROMO_MS = 19 * 60 * 60 * 1000; // 19 horas

const getDeadline = () => {
  if (typeof window === "undefined") return Date.now() + PROMO_MS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > Date.now()) return parsed;
  const next = Date.now() + PROMO_MS;
  window.localStorage.setItem(STORAGE_KEY, String(next));
  return next;
};

const pad = (n: number) => n.toString().padStart(2, "0");

type Variant = "light" | "dark";

export const PromoCountdown = ({
  variant = "light",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) => {
  const [deadline] = useState<number>(() => getDeadline());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, deadline - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const wrapCls =
    variant === "dark"
      ? "border-white/10 bg-gradient-to-r from-[#1a0f0f] via-[#2a1414] to-[#1a0f0f] text-white"
      : "border-red-200 bg-gradient-to-r from-red-50 via-orange-50 to-red-50 text-red-900";

  const chipCls =
    variant === "dark"
      ? "bg-white/10 text-white"
      : "bg-white text-red-700 shadow-sm ring-1 ring-red-200";

  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 rounded-[14px] border px-4 py-3 sm:flex-row ${wrapCls} ${className}`}
    >
      <div className="flex items-center gap-2.5 text-center sm:text-left">
        <Flame size={18} className="shrink-0 text-red-500" strokeWidth={2.4} />
        <div>
          <p className="text-[13px] font-bold leading-tight sm:text-[14px]">
            Promoção relâmpago — Plano Base por R$ 29,90
          </p>
          <p className="text-[11px] opacity-70 sm:text-[12px]">
            Oferta válida por apenas 19 horas. Depois volta pra R$ 39,90.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock size={14} className="opacity-70" />
        {[
          { label: "h", value: hours },
          { label: "m", value: minutes },
          { label: "s", value: seconds },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex min-w-[46px] flex-col items-center rounded-md px-2 py-1 ${chipCls}`}
          >
            <span className="font-mono text-[15px] font-bold leading-none tabular-nums">
              {pad(item.value)}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-70">
              {item.label === "h" ? "horas" : item.label === "m" ? "min" : "seg"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromoCountdown;
