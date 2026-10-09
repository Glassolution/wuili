import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type SVGProps } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion";

/*
 * Peças do painel "Visão geral" do admin, no desenho de relatório (cards com
 * ícone, gráfico com eixos e grade de pontos), em branco e azul. Tudo aqui é
 * apresentação: os números chegam prontos da página.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export type OverviewFormat = "currency" | "integer" | "percent";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const plainNumber = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatValue = (value: number, format: OverviewFormat) => {
  if (format === "currency") return brl.format(value);
  if (format === "percent") {
    return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
  }
  return Math.round(value).toLocaleString("pt-BR");
};

const formatPct = (value: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.abs(value) * 100)}%`;

/**
 * Comparação com o período anterior de mesmo tamanho.
 * `previous` é o valor da janela anterior; `diff` = atual − anterior.
 */
export type OverviewDelta = { diff: number; pct: number | null; previous: number };

/** Como contar a coisa medida, para escrever "10 vendas" em vez de só "10". */
export type OverviewUnit = { singular: string; plural: string };

const amountText = (value: number, format: OverviewFormat, unit?: OverviewUnit) => {
  const text = formatValue(value, format);
  if (format !== "integer" || !unit) return text;
  return `${text} ${Math.round(value) === 1 ? unit.singular : unit.plural}`;
};

/**
 * Linha embaixo do valor, no formato da referência — parte colorida, "•",
 * parte cinza — mas escrita como frase:
 *   "↓ 64,7%  •  R$ 438,90 a menos que ontem"
 */
const DeltaLine = ({
  delta,
  format,
  unit,
  invert,
  comparedTo,
  current,
}: {
  delta: OverviewDelta;
  format: OverviewFormat;
  unit?: OverviewUnit;
  invert?: boolean;
  /** "ontem", "na semana anterior", "nos 30 dias anteriores"… */
  comparedTo: string;
  current: number;
}) => {
  const up = delta.diff > 0;
  const good = invert ? !up : up;
  const color = delta.diff === 0 ? "var(--ov-text-3)" : good ? "var(--ov-accent-text)" : "var(--ov-negative)";
  const arrow = delta.diff === 0 ? "" : up ? "↑ " : "↓ ";
  const abs = amountText(Math.abs(delta.diff), format, unit);

  const highlight = delta.diff === 0 ? "0%" : delta.pct !== null ? `${arrow}${formatPct(delta.pct)}` : `${arrow}${abs}`;
  const sentence =
    delta.diff === 0
      ? `o mesmo que ${comparedTo}`
      : delta.pct === null
        ? `nada registrado ${comparedTo}`
        : `${abs} a ${up ? "mais" : "menos"} que ${comparedTo}`;

  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-2"
      title={`Agora: ${amountText(current, format, unit)} · Antes (${comparedTo}): ${amountText(delta.previous, format, unit)}`}
    >
      <span className="tabular-nums" style={{ color }}>{highlight}</span>
      <span>
        <span aria-hidden="true" className="mr-2 text-[color:var(--ov-text-5)]">•</span>
        {sentence}
      </span>
    </span>
  );
};

/* ------------------------------------------------------------------------ */

const useCountUp = (value: number, duration = 0.8) => {
  const reduceMotion = useReducedMotion();
  const previous = useRef(0);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(previous.current, value, { duration, ease: EASE, onUpdate: setDisplay });
    previous.current = value;
    return () => controls.stop();
  }, [duration, reduceMotion, value]);

  return display;
};

const CountUp = ({ value, format }: { value: number; format: OverviewFormat }) => {
  const display = useCountUp(value);
  return <>{formatValue(display, format)}</>;
};

/** Valor grande com "R$" sobrescrito, como o "$" do relatório. */
const HeroCurrency = ({ value }: { value: number }) => {
  const display = useCountUp(value, 0.9);
  return (
    <span className="inline-flex items-start">
      <span className="mr-[3px] mt-[3px] text-[18px] font-normal text-[color:var(--ov-text)]">{display < 0 ? "−R$" : "R$"}</span>
      {plainNumber.format(Math.abs(display))}
    </span>
  );
};

const Shimmer = ({ className }: { className: string }) => (
  <span className={`block animate-pulse rounded-md bg-[color:var(--ov-shimmer)] ${className}`} />
);

/** Menu de "três pontinhos" com conteúdo livre. */
export const OverviewMenu = ({ trigger, label, children }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className="ov-icon-button"
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            className="ov-menu right-0 w-[220px]"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Card de KPI: ícone, rótulo, valor e variação                             */
/* ------------------------------------------------------------------------ */

export const OverviewStatCard = ({
  icon: Icon,
  label,
  value,
  format,
  delta,
  invertDelta,
  unit,
  note,
  comparedTo,
  loading,
}: {
  /** Ícone sólido de 20px (Heroicons), o mesmo desenho da referência. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number | null;
  format: OverviewFormat;
  delta?: OverviewDelta | null;
  invertDelta?: boolean;
  unit?: OverviewUnit;
  /** Frase no lugar da comparação (ex.: "Nenhum cancelamento hoje"). */
  note?: string;
  comparedTo: string;
  loading: boolean;
}) => (
  <article className="ov-stat">
    <Icon aria-hidden="true" className="h-5 w-5 text-[color:var(--ov-text)]" />
    <p className="mt-4 text-[14.5px] leading-5 text-[color:var(--ov-text-2)]">{label}</p>
    <div className="mt-1 text-[28px] font-medium leading-9 tracking-[-0.025em] text-[color:var(--ov-text)] tabular-nums">
      {loading ? <Shimmer className="my-1 h-7 w-32" /> : value === null ? "—" : <CountUp value={value} format={format} />}
    </div>
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[14px] leading-5 text-[color:var(--ov-text-3)]">
      {loading ? (
        <Shimmer className="h-3.5 w-40" />
      ) : (
        delta && value !== null ? (
          <DeltaLine delta={delta} format={format} unit={unit} invert={invertDelta} comparedTo={comparedTo} current={value} />
        ) : (
          <span>{note ?? "Sem movimento no período"}</span>
        )
      )}
    </div>
  </article>
);

/* ------------------------------------------------------------------------ */
/* Card de receita com gráfico de linha, eixos e grade de pontos            */
/* ------------------------------------------------------------------------ */

const niceCeil = (value: number) => {
  if (value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
};

const compactBRL = (value: number) =>
  value === 0
    ? "R$ 0"
    : `R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;

export const OverviewRevenueCard = ({
  label,
  value,
  delta,
  comparedTo,
  values,
  tooltipLabels,
  axisLabels,
  seriesName,
  loading,
  periodSelect,
}: {
  label: string;
  value: number | null;
  delta: OverviewDelta | null;
  comparedTo: string;
  values: number[];
  tooltipLabels: string[];
  axisLabels: string[];
  seriesName: string;
  loading: boolean;
  periodSelect: ReactNode;
}) => {
  const gradientId = useId();
  const clipId = useId();
  const reduceMotion = useReducedMotion();
  const plotRef = useRef<HTMLDivElement>(null);
  const W = 1000;
  const H = 300;

  const series = useMemo(() => (values.length === 1 ? [values[0], values[0]] : values.length ? values : [0, 0]), [values]);
  const top = niceCeil(Math.max(...series, 0) * 1.05);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => top * ratio);

  const points = useMemo(
    () =>
      series.map((v, index) => ({
        x: series.length > 1 ? (index / (series.length - 1)) * W : 0,
        y: H - (Math.max(v, 0) / top) * H,
      })),
    [series, top],
  );
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const peakIndex = series.reduce((best, v, index) => (v > (series[best] ?? 0) ? index : best), 0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activeIndex = Math.min(hoverIndex ?? peakIndex, series.length - 1);
  const active = points[activeIndex];
  const leftPct = (active.x / W) * 100;
  const topPct = (active.y / H) * 100;

  // até 12 rótulos no eixo X, espalhados por igual
  const axisStep = Math.max(1, Math.ceil(axisLabels.length / 12));
  const shownAxis = axisLabels
    .map((text, index) => ({ text, index }))
    .filter(({ index }) => index % axisStep === 0);

  const indexFromClientX = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || series.length < 2) return 0;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return Math.round(ratio * (series.length - 1));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = activeIndex + (event.key === "ArrowRight" ? 1 : -1);
    setHoverIndex(Math.min(Math.max(next, 0), series.length - 1));
  };

  return (
    <article className="ov-card px-6 pb-5 pt-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14.5px] text-[color:var(--ov-text-2)]">{label}</p>
          <div className="mt-2 text-[38px] font-medium leading-none tracking-[-0.035em] text-[color:var(--ov-text)] tabular-nums">
            {loading ? <Shimmer className="h-9 w-56" /> : value === null ? "—" : <HeroCurrency value={value} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 text-[14px] text-[color:var(--ov-text-3)]">
            {loading ? (
              <Shimmer className="h-3.5 w-48" />
            ) : (
              delta && value !== null ? (
                <DeltaLine delta={delta} format="currency" comparedTo={comparedTo} current={value} />
              ) : (
                <span>Sem movimento no período</span>
              )
            )}
          </div>
        </div>
        <div className="shrink-0">{periodSelect}</div>
      </header>

      <div className="mt-8 flex gap-2">
        {/* eixo Y */}
        <div className="relative h-[300px] w-[60px] shrink-0 text-[13px] text-[color:var(--ov-text-4)] tabular-nums" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span key={index} className="absolute left-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}>
              {compactBRL(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            ref={plotRef}
            role="img"
            tabIndex={0}
            aria-label={`${seriesName}. ${tooltipLabels[activeIndex] ?? ""}: ${brl.format(series[activeIndex] ?? 0)}. Use as setas para percorrer.`}
            onKeyDown={onKeyDown}
            onPointerMove={(event) => setHoverIndex(indexFromClientX(event.clientX))}
            onPointerLeave={() => setHoverIndex(null)}
            className="ov-plot relative h-[300px] cursor-crosshair outline-none"
          >
            {loading ? (
              <Shimmer className="h-full w-full opacity-50" />
            ) : (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" style={{ stopColor: "var(--ov-accent)", stopOpacity: "var(--ov-area-opacity)" }} />
                      <stop offset="100%" style={{ stopColor: "var(--ov-accent)", stopOpacity: 0 }} />
                    </linearGradient>
                    <clipPath id={clipId}>
                      <motion.rect
                        x={0}
                        y={-20}
                        height={H + 40}
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: W }}
                        transition={{ duration: 1.1, ease: EASE }}
                      />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    <path d={area} fill={`url(#${gradientId})`} />
                    <path
                      d={line}
                      fill="none"
                      style={{ stroke: "var(--ov-accent)" }}
                      strokeWidth={2.25}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                </svg>

                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  {/* linha vertical do ponto até o eixo */}
                  <span className="ov-guide" style={{ left: `${leftPct}%`, top: `calc(${topPct}% - 18px)` }} />
                  <span className="ov-dot" style={{ left: `${leftPct}%`, top: `${topPct}%` }} />
                  <span
                    className="ov-tooltip"
                    style={{
                      left: `${leftPct}%`,
                      top: `calc(${topPct}% - 18px)`,
                      transform: `translate(${leftPct > 82 ? "-100%" : leftPct < 18 ? "0%" : "-50%"}, -100%)`,
                    }}
                  >
                    <span className="block text-center text-[14px] font-medium text-white">{tooltipLabels[activeIndex]}</span>
                    <span className="mt-1.5 block text-center text-[13px] text-[color:var(--ov-text-3)]">
                      {seriesName}: <span className="text-white tabular-nums">{brl.format(series[activeIndex] ?? 0)}</span>
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* eixo X */}
          <div className="relative mt-4 h-4 text-[13px] text-[color:var(--ov-text-4)]" aria-hidden="true">
            {shownAxis.map(({ text, index }) => {
              const pct = axisLabels.length > 1 ? (index / (axisLabels.length - 1)) * 100 : 0;
              return (
                <span
                  key={index}
                  className="absolute whitespace-nowrap"
                  style={{ left: `${pct}%`, transform: `translateX(${pct > 96 ? "-100%" : pct < 4 ? "0%" : "-50%"})` }}
                >
                  {text}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
};
