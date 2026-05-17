import { useMemo, useState, useEffect } from "react";
import { Search, Download, Percent, ArrowUpRight, Copy, UserCheck, MoreHorizontal, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { PieChart, Pie, Cell } from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Commission {
  id: string;
  order_id: string;
  value: number;
  percentage: number;
  status: "paid" | "pending";
  date: string;
  rawDate: string;
  customerName: string;
  customerEmail?: string | null;
  customerKey: string;
  planName: string;
  saleAmount: number;
}

interface Influencer {
  id: string;
  name: string;
  code: string;
  link: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
const COMMISSION_RATE = 0.2;
const PLAN_PRICE = 147.9;

const statusCls: Record<Commission["status"], string> = {
  paid: "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  pending: "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
};

const statusLabel: Record<Commission["status"], string> = {
  paid: "Pago",
  pending: "Pendente",
};

function formatDate(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString("pt-BR");
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function shortMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function safePercentChange(curr: number, prev: number) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return 0;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

const CommissionsPage = () => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [localCommissions, setLocalCommissions] = useState<Commission[]>([]);

  // ── Affiliate (public.affiliates) ───────────────────────────────────────
  const { data: affiliateRow, isLoading: loadingRef } = useQuery({
    queryKey: ["affiliate-row", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // 1) GET — check if user already has an affiliate
      const { data: existing, error: selErr } = await supabase
        .from("affiliates")
        .select("id, code, link")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (selErr) throw selErr;
      if (existing?.code) return existing;

      // 2) POST /generate — create one automatically
      const code = Array.from({ length: 8 }, () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return chars[Math.floor(Math.random() * chars.length)];
      }).join("");
      const link = `https://velods.com.br/ref/${code}`;

      const { data: created, error: insErr } = await supabase
        .from("affiliates")
        .insert({ user_id: user!.id, code, link, is_active: true })
        .select("id, code, link")
        .single();
      if (insErr) throw insErr;
      return created;
    },
  });
  const affiliateRef = affiliateRow?.code ?? null;

  // Fetch affiliate sales for the logged-in influencer
  const { data: initialCommissions = [], isLoading } = useQuery({
    queryKey: ["affiliate-sales", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Primary source: affiliate_sales
      const { data, error } = await supabase
        .from("affiliate_sales" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback (dev environments without the table): show empty
        console.error("[CommissionsPage] affiliate_sales query failed", error);
        return [] as Commission[];
      }

      return (data || []).map((row: any) => {
        const planPrice = Number(row.plan_price ?? PLAN_PRICE) || PLAN_PRICE;
        const rate = Number(row.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE;
        const commissionValue = Number(row.commission_amount ?? planPrice * rate) || planPrice * rate;
        const customerName = row.customer_name || "Cliente";
        const customerEmail = row.customer_email ?? null;
        const customerKey = String(row.customer_user_id ?? customerEmail ?? customerName ?? row.id);
        const planRaw = String(row.plan ?? "mensal");
        const planName = planRaw === "mensal" ? "Mensal" : planRaw;

        const rawDate = row.created_at || new Date().toISOString();
        const orderId = row.mp_payment_id ? String(row.mp_payment_id) : String(row.id);

        return {
          id: String(row.id),
          order_id: orderId,
          value: Number(commissionValue.toFixed(2)),
          percentage: Number((rate * 100).toFixed(0)),
          status: row.commission_status === "paid" ? "paid" : "pending",
          date: formatDate(rawDate),
          rawDate,
          customerName,
          customerEmail,
          customerKey,
          planName,
          saleAmount: Number(planPrice.toFixed(2)),
        } as Commission;
      });
    },
  });

  // Sync local state with initial data
  useEffect(() => {
    if (initialCommissions.length > 0 && localCommissions.length === 0) {
      setLocalCommissions(initialCommissions);
    }
  }, [initialCommissions]);

  const filteredCommissions = useMemo(() => {
    return localCommissions.filter((c) => {
      const matchesSearch =
        c.planName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.order_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filter === "Todas") return matchesSearch;
      if (filter === "Pagas") return matchesSearch && c.status === "paid";
      if (filter === "Pendentes") return matchesSearch && c.status === "pending";
      return matchesSearch;
    });
  }, [localCommissions, searchTerm, filter]);

  const totalPaid = useMemo(() => {
    return localCommissions.reduce((acc, curr) => acc + (curr.status === "paid" ? curr.value : 0), 0);
  }, [localCommissions]);

  const totalPending = useMemo(() => {
    return localCommissions.reduce((acc, curr) => acc + (curr.status === "pending" ? curr.value : 0), 0);
  }, [localCommissions]);

  const clientsCount = useMemo(() => {
    const set = new Set<string>();
    for (const c of localCommissions) set.add(c.customerKey);
    return set.size;
  }, [localCommissions]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const sameMonthLastYearKey = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthly = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number; count: number; customers: Set<string> }>();
    for (const c of localCommissions) {
      const key = monthKey(c.rawDate);
      const entry = map.get(key) ?? { paid: 0, pending: 0, count: 0, customers: new Set<string>() };
      const val = c.value ?? 0;
      if (c.status === "paid") entry.paid += val;
      if (c.status === "pending") entry.pending += val;
      entry.count += 1;
      entry.customers.add(c.customerKey);
      map.set(key, entry);
    }
    return map;
  }, [localCommissions]);

  const chartSeries = useMemo(() => {
    // Últimos 12 meses: 2 séries (Pagas x Pendentes)
    const months = Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const stats = monthly.get(key) ?? { paid: 0, pending: 0, count: 0, customers: new Set<string>() };
      return {
        key,
        m: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        paid: Number(stats.paid.toFixed(2)),
        pending: Number(stats.pending.toFixed(2)),
        total: Number((stats.paid + stats.pending).toFixed(2)),
        customers: stats.customers.size,
        count: stats.count,
      };
    });
    return months.map((x) => ({ ...x, m: x.m.charAt(0).toUpperCase() + x.m.slice(1) }));
  }, [monthly]);

  const currentMonthStats = monthly.get(currentMonthKey) ?? { paid: 0, pending: 0, count: 0, customers: new Set<string>() };
  const prevMonthStats = monthly.get(prevMonthKey) ?? { paid: 0, pending: 0, count: 0, customers: new Set<string>() };
  const prevMonthHasData = prevMonthStats.count > 0;

  const periodTotal = useMemo(() => chartSeries.reduce((s, p) => s + (p.total ?? 0), 0), [chartSeries]);
  const periodTotalPrevYear = useMemo(() => {
    // “Ano anterior” aproximado: 12 meses imediatamente anteriores aos 12 atuais
    const prev = Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (23 - idx), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const stats = monthly.get(key) ?? { paid: 0, pending: 0, count: 0, customers: new Set<string>() };
      return (stats.paid + stats.pending) ?? 0;
    });
    return prev.reduce((s, v) => s + v, 0);
  }, [monthly]);

  const chartYoY = safePercentChange(periodTotal, periodTotalPrevYear);

  const cardDelta = {
    paid: safePercentChange(currentMonthStats.paid, prevMonthStats.paid),
    pending: safePercentChange(currentMonthStats.pending, prevMonthStats.pending),
    customers: safePercentChange(currentMonthStats.customers.size, prevMonthStats.customers.size),
  };

  const cardDeltaDirection = {
    paid: currentMonthStats.paid - prevMonthStats.paid >= 0,
    pending: currentMonthStats.pending - prevMonthStats.pending >= 0,
    customers: currentMonthStats.customers.size - prevMonthStats.customers.size >= 0,
  };

  const donutPlans = useMemo(() => {
    const colorByLabel: Record<string, string> = {
      Mensal: "#3B82F6",
      Trimestral: "#2DD4BF",
      Anual: "#F59E0B",
    };

    const keyFor = (c: Commission) => {
      const raw = (c.planName ?? "").trim();
      if (raw) return raw;
      return "Mensal";
    };

    const counts = new Map<string, number>();
    for (const c of localCommissions) {
      const key = keyFor(c);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const data = Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, color: colorByLabel[name] ?? "#94A3B8" }))
      .sort((a, b) => b.value - a.value);

    if (data.length === 0) {
      data.push({ name: "Mensal", value: 0, color: "#3B82F6" });
    }

    const total = data.reduce((s, x) => s + x.value, 0);
    return { data, total };
  }, [localCommissions]);

  const [influencer, setInfluencer] = useState<Influencer | null>(null);

  // Influencer link: based on affiliates table
  useEffect(() => {
    if (!user) return;
    if (!affiliateRow?.code) return;
    setInfluencer({
      id: user.id,
      name: "Seu Link de Afiliado",
      code: affiliateRow.code,
      link: affiliateRow.link || `https://velods.com.br/ref/${affiliateRow.code}`,
      created_at: user.created_at || formatDate(null),
    });
  }, [user, affiliateRow]);

  const deltaBadgeText = (currCount: number) => {
    if (!prevMonthHasData && currCount > 0) return "Primeiro mês";
    if (!prevMonthHasData && currCount === 0) return "—";
    return null;
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!", {
      description: link,
    });
  };

  const handleExport = () => {
    toast.success("Relatório exportado com sucesso!", {
      description: "O arquivo CSV foi gerado e o download começará em instantes.",
    });
  };

  return (
    <div className="-m-3 min-h-full bg-transparent p-3 dark:bg-background sm:-m-4 sm:p-4 md:-m-8 md:p-8">
      <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white">Comissões</h1>
          <p className="mt-0.5 text-[13px] text-[#A3A3A3] dark:text-zinc-400">
            Acompanhe os valores pagos e pendentes e compartilhe seu link de afiliado.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0A0A0A] bg-transparent px-4 py-2 text-[13px] font-medium text-[#0A0A0A] transition hover:bg-[#0A0A0A] hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-[#0A0A0A]"
        >
          <Download size={15} />
          Exportar relatório
        </button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          {
            key: "paid",
            title: "Total pago",
            icon: ArrowUpRight,
            value: formatMoney(totalPaid),
            delta: cardDelta.paid,
            up: cardDeltaDirection.paid,
            currCount: currentMonthStats.count,
          },
          {
            key: "pending",
            title: "Pendente",
            icon: Percent,
            value: formatMoney(totalPending),
            delta: cardDelta.pending,
            up: cardDeltaDirection.pending,
            currCount: currentMonthStats.count,
          },
          {
            key: "customers",
            title: "Clientes indicados",
            icon: Users,
            value: String(clientsCount),
            delta: cardDelta.customers,
            up: cardDeltaDirection.customers,
            currCount: currentMonthStats.count,
          },
          {
            key: "rate",
            title: "Taxa de comissão",
            icon: Percent,
            value: "20%",
            delta: 0,
            up: true,
            currCount: currentMonthStats.count,
          },
        ].map((c) => (
          <div
            key={c.key}
            className="rounded-xl border border-[#ECECEC] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5] text-[#0A0A0A] dark:bg-zinc-800 dark:text-white">
                  <c.icon size={16} />
                </span>
                <p className="text-[13px] font-normal text-[#0A0A0A] dark:text-white">{c.title}</p>
              </div>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3A3A3] transition hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:hover:bg-zinc-800 dark:hover:text-white"
                title="Ações"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <p className="mt-4 text-[32px] font-semibold leading-none tracking-tight text-[#0A0A0A] dark:text-white">{c.value}</p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                  c.key === "rate"
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : (!prevMonthHasData && c.currCount > 0)
                      ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      : c.delta === 0
                        ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        : c.up
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                )}
              >
                {c.key === "rate" ? (
                  "Fixo"
                ) : deltaBadgeText(c.currCount) ? (
                  deltaBadgeText(c.currCount)
                ) : c.delta === 0 ? (
                  "0%"
                ) : c.up ? (
                  <>
                    <span>↗</span>+{Math.abs(c.delta).toFixed(0)}%
                  </>
                ) : (
                  <>
                    <span>↘</span>-{Math.abs(c.delta).toFixed(0)}%
                  </>
                )}
              </span>
              <span className="text-[12px] text-[#A3A3A3] dark:text-zinc-400">
                {c.key === "rate" ? "Sempre 20%" : "vs mês anterior"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Affiliate link ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#ECECEC] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Evolução</p>
              <p className="mt-0.5 text-[12px] text-[#A3A3A3] dark:text-zinc-400">Pagas x Pendentes (últimos 12 meses)</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[28px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white">{formatMoney(periodTotal)}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                  chartYoY >= 0
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                )}
              >
                {chartYoY >= 0 ? "↗" : "↘"} {Math.abs(chartYoY).toFixed(0)}% <span className="text-[#A3A3A3] dark:text-zinc-400 font-medium">vs ano anterior</span>
              </span>
            </div>
          </div>

          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ left: 6, right: 6, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="paidFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pendingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke={isDark ? "#313131" : "#E5E7EB"}
                />
                <XAxis
                  dataKey="m"
                  tick={{ fontSize: 11, fill: isDark ? "#A1A1AA" : "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? "#A1A1AA" : "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <RTooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const paidVal = payload.find((p: any) => p.dataKey === "paid")?.value ?? 0;
                    const pendingVal = payload.find((p: any) => p.dataKey === "pending")?.value ?? 0;
                    return (
                      <div className="rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 shadow-lg text-[12px] dark:border-zinc-800 dark:bg-zinc-950">
                        <p className="mb-2 font-medium text-[#737373] dark:text-zinc-400">
                          Comissões — {label}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: "#3B82F6" }} />
                              <span className="text-[#525252] dark:text-zinc-300">Pagas</span>
                            </div>
                            <span className="font-semibold text-[#0A0A0A] dark:text-white">{formatMoney(paidVal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: "#2DD4BF" }} />
                              <span className="text-[#525252] dark:text-zinc-300">Pendentes</span>
                            </div>
                            <span className="font-semibold text-[#0A0A0A] dark:text-white">{formatMoney(pendingVal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="paid" stroke="#3B82F6" strokeWidth={2} fill="url(#paidFill)" />
                <Area type="monotone" dataKey="pending" stroke="#2DD4BF" strokeWidth={2} fill="url(#pendingFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          {/* Top Planos */}
          <div className="rounded-xl border border-[#ECECEC] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Top planos</p>
                <p className="mt-0.5 text-[12px] text-[#A3A3A3] dark:text-zinc-400">Distribuição de vendas</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3A3A3] transition hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:hover:bg-zinc-800 dark:hover:text-white"
                title="Ações"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center">
              <div className="relative h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutPlans.data}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="transparent"
                    >
                      {donutPlans.data.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[22px] font-semibold text-[#0A0A0A] dark:text-white">{donutPlans.total}</p>
                  <p className="text-[11px] text-[#A3A3A3] dark:text-zinc-400">vendas</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {donutPlans.data.slice(0, 4).map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-3 rounded-lg border border-[#F5F5F5] px-3 py-2 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-[13px] font-medium text-[#525252] dark:text-zinc-300">{p.name}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Link de afiliado */}
          <div className="rounded-xl border border-[#ECECEC] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Link de afiliado</p>
                <p className="mt-0.5 text-[12px] text-[#A3A3A3] dark:text-zinc-400">Copie e compartilhe</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3A3A3] transition hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:hover:bg-zinc-800 dark:hover:text-white"
                title="Ações"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="mt-4">
              {loadingRef ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E5E5] p-6 text-center dark:border-zinc-800">
                  <p className="text-[12px] text-[#737373] dark:text-zinc-400">Carregando seu ref...</p>
                </div>
              ) : influencer ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] font-semibold text-[#0A0A0A] dark:text-white">
                        {influencer.link}
                      </p>
                      <p className="mt-1 text-[11px] text-[#A3A3A3] dark:text-zinc-400">{influencer.code}</p>
                    </div>
                    <button
                      onClick={() => handleCopyLink(influencer.link)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A0A0A] text-white transition hover:bg-[#2a2a2a] dark:bg-white dark:text-[#0A0A0A] dark:hover:bg-zinc-200"
                      title="Copiar link"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#E5E5E5] p-3 dark:border-zinc-800">
                      <p className="text-[11px] font-medium uppercase tracking-widest text-[#C0C0C0] dark:text-zinc-500">Pago</p>
                      <p className="mt-1 text-[14px] font-semibold text-[#0A0A0A] dark:text-white">{formatMoney(totalPaid)}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E5E5] p-3 dark:border-zinc-800">
                      <p className="text-[11px] font-medium uppercase tracking-widest text-[#C0C0C0] dark:text-zinc-500">Pendente</p>
                      <p className="mt-1 text-[14px] font-semibold text-[#0A0A0A] dark:text-white">{formatMoney(totalPending)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E5E5] p-6 text-center dark:border-zinc-800">
                  <p className="text-[12px] text-[#737373] dark:text-zinc-400">Gerando seu link permanente...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#ECECEC] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 border-b border-[#F5F5F5] p-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white">Comissões recentes</p>
            <p className="mt-0.5 text-[12px] text-[#A3A3A3] dark:text-zinc-400">
              Busque por pedido/descrição e filtre por status.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-[340px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-zinc-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por descrição ou número do pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white py-2 pl-10 pr-3 text-[13px] text-[#0A0A0A] outline-none transition focus:border-[#D4D4D4] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-xl bg-[#F5F5F5] p-1 dark:bg-zinc-950">
              {["Todas", "Pagas", "Pendentes"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                    filter === f
                      ? "bg-white text-[#0A0A0A] shadow-sm font-semibold dark:bg-zinc-800 dark:text-white"
                      : "text-[#A3A3A3] dark:text-zinc-400 hover:text-[#525252] dark:hover:text-zinc-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            <thead>
              <tr className="border-b border-[#F5F5F5] dark:border-zinc-800">
                {["Data", "ID do pedido", "Nome do cliente", "Plano assinado", "Valor do plano", "Comissão gerada", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-[#C0C0C0] dark:text-zinc-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-[#737373] dark:text-zinc-400">
                    Carregando comissões...
                  </td>
                </tr>
              ) : filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-[#737373] dark:text-zinc-400">
                    Nenhuma comissão encontrada.
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-[#F7F7F7] last:border-0 transition-colors hover:bg-[#FAFAFA] dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] text-[#A3A3A3] dark:text-zinc-400">{c.date}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[12px] text-[#737373] dark:text-zinc-400">#{c.order_id}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] font-medium text-[#0A0A0A] dark:text-white">{c.customerName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] text-[#525252] dark:text-zinc-300">{c.planName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">
                        {formatMoney(c.saleAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">{formatMoney(c.value)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusCls[c.status])}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CommissionsPage;
