import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightOnRectangleIcon, EyeIcon, UserPlusIcon } from "@heroicons/react/20/solid";
import type { ComponentType, SVGProps } from "react";
import { AdminDateRangePicker, type DateRange } from "@/components/admin/AdminDateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/adminWalletFetch";

/*
 * Acessos e cadastros: quantas pessoas abriram o site, quantas entraram na
 * conta e quantas criaram conta, num período escolhido no calendário (hoje,
 * últimas 24 horas, ontem…). Sempre "pessoas diferentes", nunca cliques.
 * Tudo no fuso de Belém (UTC−3, sem horário de verão).
 */

type Preset =
  | "last24h"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last3m";

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "last24h", label: "Últimas 24 horas" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last3m", label: "Últimos 3 meses" },
];

const HOUR = 3_600_000;
const DAY = 86_400_000;

const belemKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const midnight = (key: string) => new Date(`${key}T00:00:00-03:00`).getTime();
const shiftKey = (key: string, days: number) => belemKey(new Date(midnight(key) + days * DAY + 12 * HOUR));
const daysBetween = (startKey: string, endKey: string) => Math.round((midnight(endKey) - midnight(startKey)) / DAY) + 1;

type Grouping = "hour" | "day";
type Window = {
  from: number;
  /** Fim exclusivo, nunca depois de agora. */
  to: number;
  /** Duração cheia do período, usada para achar a janela anterior. */
  span: number;
  grouping: Grouping;
  buckets: number[];
  /** "ontem até esta hora", "nos 7 dias anteriores"… */
  comparedTo: string;
  range: DateRange;
};

const buildWindow = (preset: Preset | "custom", custom: DateRange | null, now: number): Window => {
  const todayKey = belemKey(new Date(now));
  const weekdayFromMonday = (new Date(midnight(todayKey) + 12 * HOUR).getUTCDay() + 6) % 7;

  if (preset === "last24h") {
    const to = now;
    const from = now - DAY;
    const first = Math.floor(from / HOUR) * HOUR;
    const buckets = Array.from({ length: Math.ceil((to - first) / HOUR) }, (_, i) => first + i * HOUR);
    return {
      from,
      to,
      span: DAY,
      grouping: "hour",
      buckets,
      comparedTo: "nas 24 horas anteriores",
      range: { startKey: belemKey(new Date(from)), endKey: todayKey },
    };
  }

  let range: DateRange;
  switch (preset) {
    case "today":
      range = { startKey: todayKey, endKey: todayKey };
      break;
    case "yesterday":
      range = { startKey: shiftKey(todayKey, -1), endKey: shiftKey(todayKey, -1) };
      break;
    case "last7":
      range = { startKey: shiftKey(todayKey, -6), endKey: todayKey };
      break;
    case "last30":
      range = { startKey: shiftKey(todayKey, -29), endKey: todayKey };
      break;
    case "this_week":
      range = { startKey: shiftKey(todayKey, -weekdayFromMonday), endKey: todayKey };
      break;
    case "this_month":
      range = { startKey: `${todayKey.slice(0, 7)}-01`, endKey: todayKey };
      break;
    case "last_month": {
      const lastOfPrev = shiftKey(`${todayKey.slice(0, 7)}-01`, -1);
      range = { startKey: `${lastOfPrev.slice(0, 7)}-01`, endKey: lastOfPrev };
      break;
    }
    case "last3m":
      range = { startKey: shiftKey(todayKey, -89), endKey: todayKey };
      break;
    default:
      range = custom ?? { startKey: todayKey, endKey: todayKey };
  }

  const days = daysBetween(range.startKey, range.endKey);
  const from = midnight(range.startKey);
  const fullEnd = midnight(shiftKey(range.endKey, 1));
  const to = Math.min(fullEnd, now);
  const grouping: Grouping = days <= 2 ? "hour" : "day";
  const step = grouping === "hour" ? HOUR : DAY;
  const buckets = Array.from({ length: Math.max(1, Math.ceil((to - from) / step)) }, (_, i) => from + i * step);
  const endsToday = range.endKey === todayKey;

  const comparedTo =
    days === 1
      ? range.startKey === todayKey
        ? "ontem até esta hora"
        : "no dia anterior"
      : endsToday
        ? `nos ${days} dias anteriores (até esta hora)`
        : `nos ${days} dias anteriores`;

  return { from, to, span: fullEnd - from, grouping, buckets, comparedTo, range };
};

/* ------------------------------------------------------------------------ */
/* Dados                                                                    */
/* ------------------------------------------------------------------------ */

type VisitRow = { visitor_id: string | null; device: string | null; created_at: string };
type SessionRow = { user_id: string; started_at: string; last_seen_at: string };
type SignupRow = { user_id: string | null; created_at: string };

type Totals = { visitantes: number; entraram: number; contas: number; celularPct: number | null };
type Point = { start: number; visitantes: number; entraram: number; contas: number };

const fetchAccessData = async (from: number, to: number) => {
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();
  const [visits, sessions, signups] = await Promise.all([
    fetchAllPages<VisitRow>((a, b) =>
      supabase
        .from("landing_events")
        .select("visitor_id,device,created_at")
        .eq("event", "landing_view")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    // quem estava usando a Velo na janela: sessão começou antes do fim e ainda
    // estava ativa depois do início
    fetchAllPages<SessionRow>((a, b) =>
      supabase
        .from("user_sessions")
        .select("user_id,started_at,last_seen_at")
        .gte("last_seen_at", fromIso)
        .lt("started_at", toIso)
        .order("started_at")
        .order("id")
        .range(a, b),
    ),
    fetchAllPages<SignupRow>((a, b) =>
      supabase
        .from("profiles")
        .select("user_id,created_at")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .order("created_at")
        .order("user_id")
        .range(a, b),
    ),
  ]);
  return { visits, sessions, signups };
};

type AccessData = Awaited<ReturnType<typeof fetchAccessData>>;

const summarize = (data: AccessData, from: number, to: number): Totals => {
  const inside = (iso: string) => {
    const t = Date.parse(iso);
    return t >= from && t < to;
  };
  const visitors = new Map<string, string | null>();
  for (const v of data.visits) {
    if (!v.visitor_id || !inside(v.created_at)) continue;
    if (!visitors.has(v.visitor_id)) visitors.set(v.visitor_id, v.device);
  }
  const users = new Set<string>();
  for (const s of data.sessions) {
    if (Date.parse(s.last_seen_at) >= from && Date.parse(s.started_at) < to) users.add(s.user_id);
  }
  const contas = data.signups.filter((p) => p.user_id && inside(p.created_at)).length;
  const comDevice = [...visitors.values()].filter(Boolean);
  const celular = comDevice.filter((d) => d === "mobile" || d === "tablet").length;
  return {
    visitantes: visitors.size,
    entraram: users.size,
    contas,
    celularPct: comDevice.length >= 10 ? Math.round((celular / comDevice.length) * 100) : null,
  };
};

const toSeries = (data: AccessData, win: Window): Point[] => {
  const step = win.grouping === "hour" ? HOUR : DAY;
  const first = win.buckets[0];
  const indexOf = (t: number) => Math.min(Math.max(Math.floor((t - first) / step), 0), win.buckets.length - 1);
  const visitantes = win.buckets.map(() => new Set<string>());
  const entraram = win.buckets.map(() => new Set<string>());
  const contas = win.buckets.map(() => 0);

  for (const v of data.visits) {
    const t = Date.parse(v.created_at);
    if (!v.visitor_id || t < win.from || t >= win.to) continue;
    visitantes[indexOf(t)].add(v.visitor_id);
  }
  for (const s of data.sessions) {
    const start = Date.parse(s.started_at);
    const end = Date.parse(s.last_seen_at);
    if (end < win.from || start >= win.to) continue;
    // a sessão conta em todos os baldes em que a pessoa estava ativa
    const a = indexOf(Math.max(start, win.from));
    const b = indexOf(Math.min(end, win.to - 1));
    for (let i = a; i <= b; i += 1) entraram[i].add(s.user_id);
  }
  for (const p of data.signups) {
    const t = Date.parse(p.created_at);
    if (!p.user_id || t < win.from || t >= win.to) continue;
    contas[indexOf(t)] += 1;
  }
  return win.buckets.map((start, i) => ({
    start,
    visitantes: visitantes[i].size,
    entraram: entraram[i].size,
    contas: contas[i],
  }));
};

/* ------------------------------------------------------------------------ */
/* Apresentação                                                             */
/* ------------------------------------------------------------------------ */

const int = (n: number) => n.toLocaleString("pt-BR");

const hourLabel = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", hour: "2-digit" }).format(new Date(t)) + "h";
const dayLabel = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit" }).format(new Date(t));
const weekdayLabel = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", weekday: "short" }).format(new Date(t)).replace(".", "");

const bucketTitle = (t: number, grouping: Grouping) =>
  grouping === "hour"
    ? `${dayLabel(t)}, das ${hourLabel(t)} às ${hourLabel(t + HOUR)}`
    : `${weekdayLabel(t)}, ${dayLabel(t)}`;

const SERIES = [
  { key: "visitantes", label: "Visitantes no site", color: "var(--trk-visit)" },
  { key: "entraram", label: "Usuários que entraram", color: "var(--trk-login)" },
  { key: "contas", label: "Contas criadas", color: "var(--trk-signup)" },
] as const;

const Shimmer = ({ className }: { className: string }) => (
  <span className={`block animate-pulse rounded-md bg-[color:var(--ov-shimmer)] ${className}`} />
);

const Delta = ({ now, before, comparedTo }: { now: number; before: number; comparedTo: string }) => {
  const diff = now - before;
  if (diff === 0) return <span>o mesmo que {comparedTo}</span>;
  const up = diff > 0;
  const pct = before > 0 ? `${Math.round((Math.abs(diff) / before) * 100)}%` : null;
  return (
    <span title={`Agora: ${int(now)} · Antes (${comparedTo}): ${int(before)}`}>
      <span className="tabular-nums" style={{ color: up ? "var(--ov-accent-text)" : "var(--ov-negative)" }}>
        {up ? "↑" : "↓"} {pct ?? int(Math.abs(diff))}
      </span>
      <span aria-hidden="true" className="mx-2 text-[color:var(--ov-text-5)]">•</span>
      {int(before)} {comparedTo}
    </span>
  );
};

const StatCard = ({
  icon: Icon,
  color,
  label,
  value,
  before,
  comparedTo,
  explain,
  loading,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  label: string;
  value: number;
  before: number | null;
  comparedTo: string;
  explain: string;
  loading: boolean;
}) => (
  <article className="ov-stat flex flex-col">
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      <p className="text-[14.5px] leading-5 text-[color:var(--ov-text-2)]">{label}</p>
      <Icon aria-hidden="true" className="ml-auto h-5 w-5 text-[color:var(--ov-text-4)]" />
    </div>
    <div className="mt-3 text-[40px] font-medium leading-none tracking-[-0.035em] text-[color:var(--ov-text)] tabular-nums">
      {loading ? <Shimmer className="h-10 w-28" /> : int(value)}
    </div>
    <div className="mt-2 min-h-5 text-[13.5px] leading-5 text-[color:var(--ov-text-3)]">
      {loading ? <Shimmer className="h-3.5 w-40" /> : before !== null ? <Delta now={value} before={before} comparedTo={comparedTo} /> : null}
    </div>
    <p className="mt-3 border-t border-[color:var(--ov-divider)] pt-3 text-[12.5px] leading-[18px] text-[color:var(--ov-text-4)]">
      {explain}
    </p>
  </article>
);

/** Topo do eixo Y: quatro faixas iguais de número redondo (1, 2, 5, 10, 20…). */
const niceTop = (value: number) => {
  const step = Math.max(1, value / 4);
  const exponent = 10 ** Math.floor(Math.log10(step));
  const fraction = step / exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * exponent * 4;
};

const AccessChart = ({ points, grouping, loading }: { points: Point[]; grouping: Grouping; loading: boolean }) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = 260;
  const n = points.length;
  const top = niceTop(Math.max(0, ...points.flatMap((p) => [p.visitantes, p.entraram, p.contas])));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((r) => Math.round(top * r));
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const y = (v: number) => H - (v / top) * H;
  const active = Math.min(hover ?? n - 1, n - 1);
  const leftPct = (x(active) / W) * 100;

  const axisStep = Math.max(1, Math.ceil(n / 8));
  const label = (t: number) => (grouping === "hour" ? hourLabel(t) : dayLabel(t));

  const indexFromClientX = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || n < 2) return 0;
    return Math.round(Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * (n - 1));
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    setHover(Math.min(Math.max(active + (event.key === "ArrowRight" ? 1 : -1), 0), n - 1));
  };

  const point = points[active];

  return (
    <div className="flex gap-2">
      <div className="relative h-[260px] w-[40px] shrink-0 text-[12px] text-[color:var(--ov-text-4)] tabular-nums" aria-hidden="true">
        {ticks.map((tick, i) => (
          <span key={i} className="absolute right-2 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
            {int(tick)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={plotRef}
          role="img"
          tabIndex={0}
          aria-label={
            point
              ? `${bucketTitle(point.start, grouping)}: ${point.visitantes} visitantes, ${point.entraram} entraram, ${point.contas} contas criadas. Use as setas para percorrer.`
              : "Gráfico vazio"
          }
          onKeyDown={onKeyDown}
          onPointerMove={(e) => setHover(indexFromClientX(e.clientX))}
          onPointerLeave={() => setHover(null)}
          className="relative h-[260px] cursor-crosshair outline-none"
        >
          {loading ? (
            <Shimmer className="h-full w-full opacity-50" />
          ) : (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                {ticks.map((_, i) => (
                  <line
                    key={i}
                    x1={0}
                    x2={W}
                    y1={(i / (ticks.length - 1)) * H}
                    y2={(i / (ticks.length - 1)) * H}
                    style={{ stroke: "var(--ov-divider)" }}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={0}
                  y2={H}
                  style={{ stroke: "var(--ov-text-5)" }}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                {SERIES.map((s) => (
                  <path
                    key={s.key}
                    d={points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[s.key])}`).join(" ")}
                    fill="none"
                    style={{ stroke: s.color }}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {point
                  ? SERIES.map((s) => (
                      <span
                        key={s.key}
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                        style={{
                          left: `${leftPct}%`,
                          top: `${(y(point[s.key]) / H) * 100}%`,
                          background: s.color,
                          borderColor: "var(--ov-panel)",
                        }}
                      />
                    ))
                  : null}
                {point ? (
                  <div
                    className="absolute top-0 min-w-[230px] whitespace-nowrap rounded-xl border px-3 py-2.5 text-[13px] shadow-lg"
                    style={{
                      left: `${leftPct}%`,
                      transform: `translateX(${leftPct > 70 ? "calc(-100% - 12px)" : "12px"})`,
                      background: "var(--ov-menu)",
                      borderColor: "var(--ov-menu-border)",
                      color: "var(--ov-text)",
                    }}
                  >
                    <p className="mb-1.5 font-medium">{bucketTitle(point.start, grouping)}</p>
                    {SERIES.map((s) => (
                      <p key={s.key} className="flex items-center gap-2 text-[color:var(--ov-text-2)]">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <span className="flex-1">{s.label}</span>
                        <span className="font-medium tabular-nums text-[color:var(--ov-text)]">{int(point[s.key])}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
        <div className="relative mt-3 h-4 text-[12px] text-[color:var(--ov-text-4)]" aria-hidden="true">
          {points.map((p, i) =>
            i % axisStep === 0 ? (
              <span
                key={p.start}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${(x(i) / W) * 100}%`,
                  transform: `translateX(${x(i) / W > 0.95 ? "-100%" : x(i) / W < 0.05 ? "0%" : "-50%"})`,
                }}
              >
                {label(p.start)}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */

const AdminAccessPanel = () => {
  const [preset, setPreset] = useState<Preset | "custom">("today");
  const [custom, setCustom] = useState<DateRange | null>(null);
  // relógio de minuto em minuto: "hoje" e "24 horas" andam sozinhos
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 60_000) * 60_000), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const win = useMemo(() => buildWindow(preset, custom, now), [preset, custom, now]);
  const prevFrom = win.from - win.span;
  const prevTo = win.to - win.span;

  // uma busca só cobre o período atual e o anterior
  const query = useQuery({
    queryKey: ["admin-acessos", prevFrom, win.to],
    queryFn: () => fetchAccessData(prevFrom, win.to),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const loading = query.isLoading;
  const atual = useMemo(() => (query.data ? summarize(query.data, win.from, win.to) : null), [query.data, win.from, win.to]);
  const anterior = useMemo(() => (query.data ? summarize(query.data, prevFrom, prevTo) : null), [query.data, prevFrom, prevTo]);
  const points = useMemo(() => (query.data ? toSeries(query.data, win) : []), [query.data, win]);

  const taxa =
    atual && atual.visitantes > 0 ? `${((atual.contas / atual.visitantes) * 100).toFixed(1).replace(".", ",")}%` : null;
  const todayKey = belemKey(new Date(now));
  const ateAgora = win.to >= now - 60_000;
  const atualizado = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit" }).format(
    new Date(query.dataUpdatedAt || now),
  );

  return (
    // data-admin-native: fica fora da normalização das páginas legadas, como o Painel
    <div className="space-y-4" data-admin-native>
      <section className="ov-card px-5 pb-5 pt-5 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-[-0.015em] text-[color:var(--ov-text)]">Acessos e cadastros</h2>
            <p className="mt-1 text-[13.5px] text-[color:var(--ov-text-3)]">
              Pessoas diferentes em cada etapa — não são cliques nem visualizações repetidas.
              {ateAgora ? ` Atualizado às ${atualizado}, atualiza sozinho a cada minuto.` : null}
            </p>
          </div>
          {/* o calendário abre para a esquerda: o botão fica sempre à direita */}
          <div className="ml-auto">
          <AdminDateRangePicker
            presets={PRESETS}
            value={preset}
            range={win.range}
            todayKey={todayKey}
            onPreset={(value) => setPreset(value as Preset)}
            onCustom={(range) => {
              setCustom(range);
              setPreset("custom");
            }}
          />
          </div>
        </header>

        {query.isError ? (
          <p className="mt-4 rounded-xl bg-[color:var(--ov-danger-bg)] px-4 py-3 text-[13.5px] text-[color:var(--ov-danger)]">
            Não foi possível carregar os acessos. Tente de novo em instantes.
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <StatCard
            icon={EyeIcon}
            color={SERIES[0].color}
            label="Visitantes no site"
            value={atual?.visitantes ?? 0}
            before={anterior?.visitantes ?? null}
            comparedTo={win.comparedTo}
            loading={loading}
            explain={`Pessoas que abriram a página inicial da Velo, com ou sem conta.${
              atual?.celularPct != null ? ` ${atual.celularPct}% pelo celular.` : ""
            }`}
          />
          <StatCard
            icon={ArrowRightOnRectangleIcon}
            color={SERIES[1].color}
            label="Usuários que entraram"
            value={atual?.entraram ?? 0}
            before={anterior?.entraram ?? null}
            comparedTo={win.comparedTo}
            loading={loading}
            explain="Pessoas com conta que usaram a plataforma (logadas) no período, novas ou antigas."
          />
          <StatCard
            icon={UserPlusIcon}
            color={SERIES[2].color}
            label="Contas criadas"
            value={atual?.contas ?? 0}
            before={anterior?.contas ?? null}
            comparedTo={win.comparedTo}
            loading={loading}
            explain={
              taxa
                ? `Cadastros novos no período. Equivale a ${taxa} dos visitantes (inclui quem foi direto para o cadastro).`
                : "Cadastros novos no período."
            }
          />
        </div>
      </section>

      <section className="ov-card px-5 pb-5 pt-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-[color:var(--ov-text)]">
            {win.grouping === "hour" ? "Hora a hora" : "Dia a dia"}
          </h3>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[color:var(--ov-text-2)]">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        </header>

        <AccessChart points={points} grouping={win.grouping} loading={loading} />

        <details className="group mt-5 border-t border-[color:var(--ov-divider)] pt-4">
          <summary className="cursor-pointer select-none text-[13.5px] font-medium text-[color:var(--ov-accent-text)]">
            Ver os números {win.grouping === "hour" ? "de cada hora" : "de cada dia"}
          </summary>
          <div className="mt-3 max-h-[360px] overflow-auto">
            <table className="w-full text-[13.5px] tabular-nums">
              <thead className="sticky top-0 bg-[color:var(--ov-panel)] text-left text-[12.5px] text-[color:var(--ov-text-4)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">{win.grouping === "hour" ? "Hora" : "Dia"}</th>
                  {SERIES.map((s) => (
                    <th key={s.key} className="py-2 pl-3 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.start} className="border-t border-[color:var(--ov-divider)] text-[color:var(--ov-text)]">
                      <td className="py-2 pr-3 text-[color:var(--ov-text-2)]">{bucketTitle(p.start, win.grouping)}</td>
                      <td className="py-2 pl-3 text-right">{int(p.visitantes)}</td>
                      <td className="py-2 pl-3 text-right">{int(p.entraram)}</td>
                      <td className="py-2 pl-3 text-right">{int(p.contas)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
};

export default AdminAccessPanel;
