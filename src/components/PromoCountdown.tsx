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

type Variant = "light" | "dark" | "clean";

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

  const isClean = variant === "clean";

  const wrapCls =
    variant === "dark"
      ? "border-white/10 bg-gradient-to-r from-[#1a0f0f] via-[#2a1414] to-[#1a0f0f] text-white"
      : isClean
        ? "border-[#F2D9CF] bg-[#FFF7F3] text-[#9A3412]"
        : "border-red-200 bg-gradient-to-r from-red-50 via-orange-50 to-red-50 text-red-900";

  const chipCls =
    variant === "dark"
      ? "bg-white/10 text-white"
      : isClean
        ? "bg-white text-[#9A3412] ring-1 ring-[#F2DDD4]"
        : "bg-white text-red-700 shadow-sm ring-1 ring-red-200";

  // A variante "clean" acompanha o modal compacto: paddings/tipografia menores,
  // paleta mais suave e chips do contador mais discretos.
  const wrapPad = isClean ? "gap-2.5 rounded-[12px] px-3.5 py-2.5" : "gap-3 rounded-[14px] px-4 py-3";
  const chipMin = isClean ? "min-w-[40px] px-1.5 py-0.5" : "min-w-[46px] px-2 py-1";
  const numSize = isClean ? "text-[13px]" : "text-[15px]";

  return (
    <div
      className={`flex flex-col items-center justify-between border sm:flex-row ${wrapPad} ${wrapCls} ${className}`}
    >
      <div className="flex items-center gap-2.5 text-center sm:text-left">
        <Flame size={isClean ? 16 : 18} className="shrink-0 text-[#EF4444]" strokeWidth={2.4} />
        <div>
          <p className={`font-bold leading-tight ${isClean ? "text-[12.5px]" : "text-[13px] sm:text-[14px]"}`}>
            Promoção relâmpago — Plano Base por R$ 29,90
          </p>
          <p className={`opacity-70 ${isClean ? "text-[11px]" : "text-[11px] sm:text-[12px]"}`}>
            Oferta válida por apenas 19 horas. Depois volta pra R$ 39,90.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock size={isClean ? 13 : 14} className="opacity-60" />
        {[
          { label: "h", value: hours },
          { label: "m", value: minutes },
          { label: "s", value: seconds },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex flex-col items-center rounded-md ${chipMin} ${chipCls}`}
          >
            <span className={`font-mono font-bold leading-none tabular-nums ${numSize}`}>
              {pad(item.value)}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-60">
              {item.label === "h" ? "horas" : item.label === "m" ? "min" : "seg"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromoCountdown;
