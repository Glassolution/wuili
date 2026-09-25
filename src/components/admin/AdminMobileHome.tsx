import { useLayoutEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  ChevronDown,
  Moon,
  type LucideIcon,
  ShoppingBag,
  Sun,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  loading: boolean;
  approvedSales: number;
  grossRevenue: number;
  costs: number;
  churnRate: number;
  netRevenue: number;
  series: number[];
  comparison: number[];
  labels: string[];
  grouping: string;
  groupingChoice: string;
  groupingOptions: Array<{ value: string; label: string }>;
  onGroupingChange: (value: string) => void;
  days: number;
};

const brl = (value: number, cents = true) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);

const pct = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

/** Curva suave (Catmull-Rom convertida em Bézier) por pontos já em coordenadas do SVG. */
const curva = (pontos: Array<[number, number]>) => {
  if (pontos.length === 0) return "";
  if (pontos.length === 1) return `M${pontos[0][0]},${pontos[0][1]}`;
  let d = `M${pontos[0][0]},${pontos[0][1]}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const p0 = pontos[i - 1] ?? pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
};

const LARGURA = 340;
const ALTURA = 194;
const MARGEM = { topo: 10, direita: 7, base: 27, esquerda: 40 };
const LARGURA_PLOT = LARGURA - MARGEM.esquerda - MARGEM.direita;
const ALTURA_PLOT = ALTURA - MARGEM.topo - MARGEM.base;

const valorEixo = (value: number) => {
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1_000_000)} mi`;
  if (value >= 1_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1_000)}k`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
};

const maximoArredondado = (values: number[], comparison: number[]) => {
  const raw = Math.max(1, ...values, ...comparison);
  const aproximado = raw / 3;
  const magnitude = 10 ** Math.floor(Math.log10(aproximado));
  const fracao = aproximado / magnitude;
  const passoNormalizado = fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 5 ? 5 : 10;
  const passo = passoNormalizado * magnitude;
  return Math.ceil(raw / passo) * passo;
};

const rotuloEixoX = (raw: string, grouping: string) => {
  if (grouping === "hour") return `${raw.slice(-2)}h`;
  const date = new Date(`${raw.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 3);
  if (grouping === "month") {
    return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "");
  }
  if (grouping === "week") {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date).replace(".", "");
  }
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "");
};

const Grafico = ({
  values,
  comparison,
  labels,
  grouping,
}: {
  values: number[];
  comparison: number[];
  labels: string[];
  grouping: string;
}) => {
  const { atual, anterior, ultimo, ultimoAnterior, maximo, indicesX } = useMemo(() => {
    const max = maximoArredondado(values, comparison);
    const paraPontos = (serie: number[]) =>
      serie.map((v, i): [number, number] => [
        serie.length === 1
          ? MARGEM.esquerda + LARGURA_PLOT / 2
          : MARGEM.esquerda + (i / (serie.length - 1)) * LARGURA_PLOT,
        MARGEM.topo + ALTURA_PLOT - (v / max) * ALTURA_PLOT,
      ]);
    const pontos = paraPontos(values);
    const pontosAnteriores = paraPontos(comparison);
    const quantidade = Math.min(labels.length, values.length);
    const indices =
      quantidade <= 7
        ? Array.from({ length: quantidade }, (_, index) => index)
        : Array.from(new Set(Array.from({ length: 7 }, (_, index) => Math.round((index * (quantidade - 1)) / 6))));
    return {
      atual: pontos,
      anterior: pontosAnteriores,
      ultimo: pontos[pontos.length - 1],
      ultimoAnterior: pontosAnteriores[pontosAnteriores.length - 1],
      maximo: max,
      indicesX: indices,
    };
  }, [values, comparison, labels]);

  if (values.length === 0) {
    return <div className="grid h-[132px] place-items-center text-[13px] text-[#9AA0AA] dark:text-[#7F8795]">Sem movimento no período.</div>;
  }

  const linha = curva(atual);
  const area = `${linha} L${atual[atual.length - 1][0]},${MARGEM.topo + ALTURA_PLOT} L${atual[0][0]},${MARGEM.topo + ALTURA_PLOT} Z`;
  const marcadorX = ultimo?.[0];

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Resultado líquido por período"
    >
      <defs>
        <linearGradient id="resultado-liquido-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3F67D5" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#3F67D5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1 / 3, 2 / 3, 1].map((f) => {
        const y = MARGEM.topo + ALTURA_PLOT * f;
        const valor = maximo * (1 - f);
        return (
          <g key={f}>
            <line
              x1={MARGEM.esquerda}
              x2={LARGURA - MARGEM.direita}
              y1={y}
              y2={y}
              className="stroke-[#EEF1F5] dark:stroke-[#2A2F3A]"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x={MARGEM.esquerda - 7} y={y + 3.5} textAnchor="end" className="fill-[#7D8490] text-[9px] dark:fill-[#7F8795]">
              {valorEixo(valor)}
            </text>
          </g>
        );
      })}
      {indicesX.map((index) => (
        <text
          key={index}
          x={atual[index]?.[0] ?? MARGEM.esquerda}
          y={ALTURA - 5}
          textAnchor={index === 0 ? "start" : index === values.length - 1 ? "end" : "middle"}
          className="fill-[#7B818B] text-[9px] dark:fill-[#8F97A5]"
        >
          {rotuloEixoX(labels[index] ?? "", grouping)}
        </text>
      ))}
      {marcadorX != null ? (
        <line
          x1={marcadorX}
          x2={marcadorX}
          y1={MARGEM.topo}
          y2={MARGEM.topo + ALTURA_PLOT}
          stroke="#6B7280"
          strokeWidth="1"
          strokeDasharray="2.5 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path d={area} fill="url(#resultado-liquido-area)" />
      {anterior.length > 1 ? (
        <path
          d={curva(anterior)}
          fill="none"
          stroke="#16BED8"
          strokeWidth="2.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path d={linha} fill="none" stroke="#3F67D5" strokeWidth="2.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {ultimoAnterior ? (
        <circle
          cx={ultimoAnterior[0]}
          cy={ultimoAnterior[1]}
          r="5"
          className="fill-white dark:fill-[#171A21]"
          stroke="#16BED8"
          strokeWidth="2.8"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {ultimo ? (
        <circle
          cx={ultimo[0]}
          cy={ultimo[1]}
          r="5"
          className="fill-white dark:fill-[#171A21]"
          stroke="#3F67D5"
          strokeWidth="2.8"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  loading: boolean;
}) => (
  <div className="rounded-[9px] border border-[#F0F2F6] bg-white p-4 shadow-[0_2px_10px_rgba(30,42,70,0.025)] dark:border-[#282D37] dark:bg-[#171A21] dark:shadow-none">
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E4E8F0] bg-white text-[#315FD3] shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:border-[#343B48] dark:bg-[#1C2028] dark:text-[#76A3FF]">
        <Icon size={18} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 truncate text-[12.5px] font-normal text-[#454B57] dark:text-[#C0C6D1]">{label}</span>
    </div>
    {loading ? (
      <div className="mt-4 h-7 w-24 animate-pulse rounded-md bg-[#F1F3F6] dark:bg-[#222731]" />
    ) : (
      <p className="mt-4 truncate text-[27px] font-medium leading-none tracking-[-0.04em] text-[#111827] dark:text-[#F8FAFC]">{value}</p>
    )}
  </div>
);

export const AdminMobileHome = ({
  loading,
  approvedSales,
  grossRevenue,
  costs,
  churnRate,
  netRevenue,
  series,
  comparison,
  labels,
  grouping,
  groupingChoice,
  groupingOptions,
  onGroupingChange,
  days,
}: Props) => {
  const [darkTheme, setDarkTheme] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("velo-theme");
    if (stored) return stored === "dark";
    return document.documentElement.classList.contains("dark");
  });
  const { user } = useAuth();
  const nome =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "Admin");
  const primeiroNome = nome.split(" ")[0];
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const agrupamentoLabel =
    ({ hour: "Por hora", day: "Diário", week: "Semanal", month: "Mensal" } as Record<string, string>)[grouping] ??
    "Período";

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", darkTheme);
    document.documentElement.classList.toggle("light", !darkTheme);
    document.documentElement.style.colorScheme = darkTheme ? "dark" : "light";
    window.localStorage.setItem("velo-theme", darkTheme ? "dark" : "light");
  }, [darkTheme]);

  return (
    <div
      data-admin-native
      className="min-h-[calc(100dvh-76px-env(safe-area-inset-bottom))] bg-[#F7F8FC] px-8 pb-8 pt-6 transition-colors dark:bg-[#0F1218]"
    >
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] font-medium leading-[1.12] tracking-[-0.035em] text-[#111827] dark:text-[#F8FAFC]">Início</h1>
          <p className="mt-1.5 truncate text-[15px] font-normal leading-none text-[#747C8C] dark:text-[#A1A8B5]">Olá, {primeiroNome}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDarkTheme((current) => !current)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-white text-[#4F5969] shadow-[0_7px_18px_rgba(15,23,42,0.07)] transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.97] active:bg-[#F4F5F8] active:shadow-[0_3px_10px_rgba(15,23,42,0.06)] dark:bg-[#171A21] dark:text-[#DDE3EC] dark:shadow-[0_7px_18px_rgba(0,0,0,0.22)] dark:active:bg-[#222731]"
            aria-label={darkTheme ? "Ativar tema claro" : "Ativar tema escuro"}
            title={darkTheme ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {darkTheme ? <Sun size={21} strokeWidth={1.65} /> : <Moon size={21} strokeWidth={1.65} />}
          </button>
          {avatar ? (
            <img src={avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-[#303642]" />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#CCD8FA] text-[15px] font-medium text-[#17223C] ring-2 ring-white dark:bg-[#D8E1FA] dark:text-[#111827] dark:ring-[#303642]">
              {primeiroNome.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </header>

      <section className="mt-7 grid grid-cols-2 gap-4">
        <Stat icon={ShoppingBag} label="Vendas" value={String(approvedSales)} loading={loading} />
        <Stat icon={CircleDollarSign} label="Entradas" value={brl(grossRevenue, false)} loading={loading} />
        <Stat icon={WalletCards} label="Saídas" value={brl(costs, false)} loading={loading} />
        <Stat icon={UsersRound} label="Churn" value={pct(churnRate)} loading={loading} />
      </section>

      <section className="mt-4 rounded-[9px] border border-[#F0F2F6] bg-white p-4 shadow-[0_2px_10px_rgba(30,42,70,0.025)] dark:border-[#282D37] dark:bg-[#171A21] dark:shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-medium tracking-[-0.03em] text-[#111827] dark:text-[#F8FAFC]">Resultado líquido</h2>
          <label className="relative inline-flex h-8 items-center rounded-full border border-[#E3E6EB] bg-white pl-3 pr-7 text-[12px] font-medium text-[#1F2937] dark:border-[#303642] dark:bg-[#1C2028] dark:text-[#E8EDF5]">
            <span className="sr-only">Agrupamento do gráfico</span>
            {agrupamentoLabel}
            <select
              value={groupingChoice}
              onChange={(event) => onGroupingChange(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              style={{ fontSize: 16 }}
            >
              {groupingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-[#6B7280] dark:text-[#A1A8B5]" />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[8px] border border-[#EDF0F4] dark:border-[#303642]">
          <div className="min-w-0 px-4 py-3">
            {loading ? (
              <div className="h-7 w-28 animate-pulse rounded-md bg-[#F1F3F6] dark:bg-[#222731]" />
            ) : (
              <p className="truncate text-[clamp(18px,5.2vw,22px)] font-medium leading-none tracking-[-0.035em] text-[#111827] dark:text-[#F8FAFC]">{brl(netRevenue)}</p>
            )}
            <p className="mt-1.5 text-[11.5px] font-normal text-[#555D69] dark:text-[#A1A8B5]">Total</p>
          </div>
          <div className="min-w-0 border-l border-[#EDF0F4] px-4 py-3 dark:border-[#303642]">
            {loading ? (
              <div className="h-7 w-20 animate-pulse rounded-md bg-[#F1F3F6] dark:bg-[#222731]" />
            ) : (
              <p className="truncate text-[clamp(18px,5.2vw,22px)] font-medium leading-none tracking-[-0.035em] text-[#111827] dark:text-[#F8FAFC]">{brl(netRevenue / Math.max(days, 1))}</p>
            )}
            <p className="mt-1.5 text-[11.5px] font-normal text-[#555D69] dark:text-[#A1A8B5]">Média por dia</p>
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-[165px] animate-pulse rounded-lg bg-[#F6F7F9] dark:bg-[#222731]" />
          ) : (
            <Grafico values={series} comparison={comparison} labels={labels} grouping={grouping} />
          )}
        </div>
      </section>

    </div>
  );
};

export default AdminMobileHome;
