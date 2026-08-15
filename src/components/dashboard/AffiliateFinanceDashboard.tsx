import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Commission } from "@/pages/dashboard/CommissionsPage";
import { cn } from "@/lib/utils";

type AffiliateLinkView = {
  code: string | null;
  link: string | null;
  commissionRate?: number;
} | undefined;

type AffiliateFinanceDashboardProps = {
  commissions: Commission[];
  isLoading: boolean;
  isDark: boolean;
  affiliateLink: AffiliateLinkView;
  affiliateLoading: boolean;
  affiliateError: unknown;
  displayName: string;
  avatarUrl: string | null;
  onCopyLink: (link: string) => void;
  onCreateLink: () => void;
  creatingLink: boolean;
  onExport: () => void;
};

type ChartMetric = "commissions" | "referrals";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const statusStyle: Record<Commission["status"], string> = {
  paid: "bg-[#EAF8F0] text-[#287D54]",
  pending: "bg-[#FFF4DE] text-[#9C6815]",
};

const AffiliateFinanceDashboard = ({
  commissions,
  isLoading,
  isDark,
  affiliateLink,
  affiliateLoading,
  affiliateError,
  displayName,
  avatarUrl,
  onCopyLink,
  onCreateLink,
  creatingLink,
  onExport,
}: AffiliateFinanceDashboardProps) => {
  const navigate = useNavigate();
  const [chartMetric, setChartMetric] = useState<ChartMetric>("commissions");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todas" | "Pagas" | "Pendentes">("Todas");

  const analytics = useMemo(() => {
    const paid = commissions.reduce((total, item) => total + (item.status === "paid" ? item.value : 0), 0);
    const pending = commissions.reduce((total, item) => total + (item.status === "pending" ? item.value : 0), 0);
    const clients = new Set(commissions.map((item) => item.customerKey)).size;
    const totalSales = commissions.reduce((total, item) => total + item.saleAmount, 0);
    const monthMap = new Map<string, { paid: number; pending: number; clients: Set<string> }>();
    const planMap = new Map<string, number>();

    commissions.forEach((item) => {
      const date = new Date(item.rawDate);
      if (!Number.isNaN(date.getTime())) {
        const key = monthKey(date);
        const current = monthMap.get(key) ?? { paid: 0, pending: 0, clients: new Set<string>() };
        if (item.status === "paid") current.paid += item.value;
        if (item.status === "pending") current.pending += item.value;
        current.clients.add(item.customerKey);
        monthMap.set(key, current);
      }

      const plan = item.planName.trim() || "Não informado";
      planMap.set(plan, (planMap.get(plan) ?? 0) + 1);
    });

    const chart = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(new Date().getFullYear(), new Date().getMonth() - (11 - index), 1);
      const month = monthMap.get(monthKey(date)) ?? { paid: 0, pending: 0, clients: new Set<string>() };
      const label = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      return {
        month: label.charAt(0).toUpperCase() + label.slice(1),
        paid: Number(month.paid.toFixed(2)),
        pending: Number(month.pending.toFixed(2)),
        total: Number((month.paid + month.pending).toFixed(2)),
        referrals: month.clients.size,
      };
    });

    const plans = Array.from(planMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((first, second) => second.value - first.value);

    return { paid, pending, clients, totalSales, chart, plans };
  }, [commissions]);

  const filteredCommissions = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return commissions.filter((commission) => {
      const matchesStatus = statusFilter === "Todas"
        || (statusFilter === "Pagas" && commission.status === "paid")
        || (statusFilter === "Pendentes" && commission.status === "pending");
      const matchesSearch = !normalized
        || commission.customerName.toLocaleLowerCase("pt-BR").includes(normalized)
        || commission.order_id.toLocaleLowerCase("pt-BR").includes(normalized)
        || commission.planName.toLocaleLowerCase("pt-BR").includes(normalized);
      return matchesStatus && matchesSearch;
    });
  }, [commissions, search, statusFilter]);

  const hasActivity = commissions.length > 0;
  const hasLink = Boolean(affiliateLink?.link);
  const planTotal = analytics.plans.reduce((total, item) => total + item.value, 0);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "AV";

  const metricCards = [
    {
      title: "Comissões recebidas",
      description: "Valores já liberados para você",
      value: formatMoney(analytics.paid),
      icon: Check,
      accent: "bg-[#EAF8F0] text-[#287D54]",
      footer: analytics.paid > 0 ? `${commissions.filter((item) => item.status === "paid").length} pagamentos concluídos` : "Nenhum pagamento recebido",
    },
    {
      title: "A receber",
      description: "Comissões aguardando liberação",
      value: formatMoney(analytics.pending),
      icon: WalletCards,
      accent: "bg-[#FFF4DE] text-[#9C6815]",
      footer: analytics.pending > 0 ? `${commissions.filter((item) => item.status === "pending").length} pagamentos pendentes` : "Nenhum valor pendente",
    },
    {
      title: "Clientes indicados",
      description: "Assinaturas atribuídas ao seu link",
      value: String(analytics.clients),
      icon: Users,
      accent: "bg-[#EBF1FF] text-[#3158B5]",
      footer: analytics.clients === 1 ? "1 cliente convertido" : `${analytics.clients} clientes convertidos`,
    },
    {
      title: "Sua comissão",
      description: "Sobre o primeiro pagamento",
      value: "30%",
      icon: TrendingUp,
      accent: "bg-[#F1ECFF] text-[#6841C6]",
      footer: "Regra fixa do programa Velo",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1560px] pb-12">
      <header className="mb-7 flex flex-col gap-4 px-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#0F1117] transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25 dark:text-white dark:hover:bg-white/[0.06]"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} strokeWidth={2.35} aria-hidden="true" />
          </button>
          <h1 className="min-w-0 text-[28px] font-black leading-[1.25] tracking-[-0.05em] text-[#090B10] dark:text-white">
            Programa de afiliados
          </h1>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-[8px] border border-black/[0.14] bg-white px-3.5 text-[13px] font-black tracking-[-0.015em] text-[#0F1117] shadow-[0_1px_3px_rgba(15,17,23,0.11)] transition duration-150 hover:border-black/[0.22] hover:bg-[#FAFAFA] hover:shadow-[0_2px_5px_rgba(15,17,23,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25 dark:border-white/10 dark:bg-zinc-900 dark:text-white sm:self-auto"
        >
          <Download size={17} strokeWidth={2.1} aria-hidden="true" /> Exportar relatório
        </button>
      </header>

      <div className="overflow-hidden rounded-[28px] border border-black/[0.09] bg-white shadow-[0_16px_55px_rgba(35,32,28,0.07)] dark:border-white/10 dark:bg-zinc-950">
        <section className="grid border-b border-black/[0.07] dark:border-white/10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#3B7BFF] via-[#2563EB] to-[#1E3A8A] px-7 py-8 text-white sm:px-9 sm:py-10">
            <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -right-24 -top-10 h-64 w-64 rounded-full border border-white/10" />
            <div className="relative max-w-[650px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/85">
                <Sparkles size={13} /> Programa Velo
              </span>
              <h2 className="mt-5 max-w-[520px] text-[27px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[34px]">
                Seu próximo cliente pode começar com um único link.
              </h2>
              <p className="mt-4 max-w-[520px] text-[13px] leading-6 text-white/72">
                Compartilhe sua indicação. Quando o cliente fizer o primeiro pagamento, 30% da venda é registrado como sua comissão.
              </p>
              <div className="mt-7 flex flex-wrap gap-5 text-[11px] text-white/80">
                <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#76D7A5]" /> Link exclusivo</span>
                <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#76D7A5]" /> Resultado rastreado</span>
                <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#76D7A5]" /> Dados reais</span>
              </div>
            </div>
          </div>

          <div className="flex min-h-[300px] flex-col justify-center bg-[#F7F6F2] px-7 py-8 dark:bg-zinc-900 sm:px-9">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#4D4D48] shadow-sm dark:bg-zinc-800 dark:text-white">{initials}</span>
              )}
              <div>
                <p className="text-[11px] font-medium text-[#8A8A84]">Link pessoal de {displayName}</p>
                <p className="mt-0.5 text-[14px] font-semibold text-[#20201D] dark:text-white">{hasLink ? "Pronto para compartilhar" : "Ative sua área de afiliado"}</p>
              </div>
            </div>

            {affiliateLoading ? (
              <div className="mt-7 flex h-[92px] items-center justify-center rounded-[18px] border border-black/[0.07] bg-white dark:border-white/10 dark:bg-zinc-950">
                <Loader2 className="animate-spin text-[#777771]" size={20} />
              </div>
            ) : hasLink ? (
              <div className="mt-7">
                <div className="rounded-[18px] border border-black/[0.08] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#95958E]">Seu link de indicação</p>
                  <div className="mt-2 flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#252522] dark:text-white">{affiliateLink?.link}</p>
                    <button
                      type="button"
                      onClick={() => affiliateLink?.link && onCopyLink(affiliateLink.link)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#171714] text-white transition hover:scale-105 dark:bg-white dark:text-black"
                      aria-label="Copiar link de afiliado"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-[#9A9A94]">Código {affiliateLink?.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => affiliateLink?.link && onCopyLink(affiliateLink.link)}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#171714] px-5 text-[12px] font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black"
                >
                  <Copy size={14} /> Copiar meu link
                </button>
              </div>
            ) : (
              <div className="mt-7">
                <div className="rounded-[18px] border border-dashed border-black/15 bg-white/70 p-5 dark:border-white/15 dark:bg-zinc-950/70">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEEAFB] text-[#6841C6]"><Link2 size={18} /></span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#242421] dark:text-white">Você ainda não criou seu link</p>
                      <p className="mt-1 text-[11px] text-[#85857E]">A criação é gratuita e leva apenas um instante.</p>
                    </div>
                  </div>
                  {affiliateError && <p className="mt-3 text-[11px] text-[#B44B46]">Não foi possível consultar o link. Você pode tentar criá-lo novamente.</p>}
                </div>
                <button
                  type="button"
                  onClick={onCreateLink}
                  disabled={creatingLink}
                  className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#171714] px-5 text-[13px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {creatingLink ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                  {creatingLink ? "Criando seu link..." : "Criar meu link de afiliado"}
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#989890]">Resumo</p>
                <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#1A1A18] dark:text-white">O que seu link gerou</h2>
              </div>
              <p className="hidden text-[11px] text-[#95958E] sm:block">Atualizado com suas conversões reais</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => (
                <article key={metric.title} className="group rounded-[20px] border border-black/[0.08] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(30,28,24,0.07)] dark:border-white/10 dark:bg-zinc-950">
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-[13px]", metric.accent)}><metric.icon size={18} /></span>
                    <span className="h-2 w-2 rounded-full bg-[#D8D8D2] transition group-hover:bg-[#807F78]" />
                  </div>
                  <p className="mt-5 text-[12px] font-semibold text-[#5E5E58] dark:text-zinc-300">{metric.title}</p>
                  <p className="mt-1 text-[27px] font-semibold tracking-[-0.045em] text-[#171714] dark:text-white">{metric.value}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#9A9A94]">{metric.description}</p>
                  <div className="mt-4 border-t border-black/[0.06] pt-3 text-[10px] font-medium text-[#74746E] dark:border-white/10">{metric.footer}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.75fr)]">
            <article className="rounded-[22px] border border-black/[0.08] bg-white p-5 dark:border-white/10 dark:bg-zinc-950 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#989890]">Últimos 12 meses</p>
                  <h3 className="mt-1 text-[19px] font-semibold text-[#1C1C19] dark:text-white">Evolução do programa</h3>
                  <p className="mt-1 text-[11px] text-[#91918A]">Somente movimentações registradas no seu link.</p>
                </div>
                <div className="inline-flex self-start rounded-full bg-[#F2F1ED] p-1 dark:bg-zinc-900">
                  <button type="button" onClick={() => setChartMetric("commissions")} className={cn("rounded-full px-4 py-2 text-[10px] font-semibold transition", chartMetric === "commissions" ? "bg-white text-[#22221F] shadow-sm dark:bg-zinc-800 dark:text-white" : "text-[#8C8C85]")}>Comissões</button>
                  <button type="button" onClick={() => setChartMetric("referrals")} className={cn("rounded-full px-4 py-2 text-[10px] font-semibold transition", chartMetric === "referrals" ? "bg-white text-[#22221F] shadow-sm dark:bg-zinc-800 dark:text-white" : "text-[#8C8C85]")}>Indicações</button>
                </div>
              </div>

              {isLoading ? (
                <div className="mt-6 flex h-[310px] items-center justify-center rounded-[18px] bg-[#F8F8F5] dark:bg-zinc-900"><Loader2 size={22} className="animate-spin text-[#888881]" /></div>
              ) : hasActivity ? (
                <div className="mt-5 h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.chart} margin={{ left: chartMetric === "commissions" ? 8 : -20, right: 8, top: 15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="affiliatePaidArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B61CE" stopOpacity={0.2} /><stop offset="100%" stopColor="#5B61CE" stopOpacity={0} /></linearGradient>
                        <linearGradient id="affiliateReferralArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2C9C68" stopOpacity={0.18} /><stop offset="100%" stopColor="#2C9C68" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={isDark ? "#27272A" : "#ECECE8"} strokeDasharray="4 5" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? "#A1A1AA" : "#92928B" }} dy={9} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? "#A1A1AA" : "#92928B" }} width={58} allowDecimals={false} tickFormatter={(value) => chartMetric === "commissions" ? `R$ ${Number(value).toLocaleString("pt-BR", { notation: "compact" })}` : String(value)} />
                      <Tooltip formatter={(value) => chartMetric === "commissions" ? formatMoney(Number(value)) : `${Number(value)} indicação(ões)`} contentStyle={{ borderRadius: 14, borderColor: "#E2E2DD", boxShadow: "0 12px 28px rgba(25,25,20,.08)", fontSize: 11 }} />
                      {chartMetric === "commissions" ? (
                        <>
                          <Area type="monotone" dataKey="pending" name="Pendentes" stroke="#C6A25A" strokeWidth={1.7} fill="transparent" dot={false} />
                          <Area type="monotone" dataKey="paid" name="Recebidas" stroke="#5B61CE" strokeWidth={2.2} fill="url(#affiliatePaidArea)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
                        </>
                      ) : (
                        <Area type="monotone" dataKey="referrals" name="Indicações" stroke="#2C9C68" strokeWidth={2.2} fill="url(#affiliateReferralArea)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-6 flex min-h-[310px] flex-col justify-center rounded-[18px] border border-dashed border-black/10 bg-[#FAFAF7] p-6 dark:border-white/10 dark:bg-zinc-900">
                  <p className="text-[13px] font-semibold text-[#242421] dark:text-white">Seu gráfico começa na primeira indicação</p>
                  <p className="mt-1 max-w-[520px] text-[11px] leading-5 text-[#898982]">Não exibimos projeções ou valores fictícios. Quando uma assinatura for atribuída ao seu link, ela aparecerá aqui.</p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[{ number: "01", title: "Crie", text: "Ative seu link pessoal" }, { number: "02", title: "Compartilhe", text: "Envie para sua audiência" }, { number: "03", title: "Receba", text: "Ganhe na primeira venda" }].map((step, index) => (
                      <div key={step.number} className="relative rounded-[16px] border border-black/[0.07] bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
                        <span className="font-mono text-[9px] font-bold text-[#8C8C85]">{step.number}</span>
                        <p className="mt-4 text-[12px] font-semibold text-[#20201D] dark:text-white">{step.title}</p>
                        <p className="mt-1 text-[10px] text-[#96968F]">{step.text}</p>
                        {index < 2 && <ArrowRight size={14} className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-[#9A9A94] sm:block" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-[22px] border border-black/[0.08] bg-[#F7F6F2] p-5 dark:border-white/10 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#989890]">Conversões</p>
                    <h3 className="mt-1 text-[17px] font-semibold text-[#1D1D1A] dark:text-white">Vendas por plano</h3>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#54544E] shadow-sm dark:bg-zinc-800 dark:text-zinc-200"><UserRoundCheck size={17} /></span>
                </div>
                {analytics.plans.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {analytics.plans.slice(0, 5).map((plan) => {
                      const ratio = planTotal > 0 ? (plan.value / planTotal) * 100 : 0;
                      return (
                        <div key={plan.name}>
                          <div className="flex items-center justify-between text-[11px]"><span className="font-medium text-[#5D5D57] dark:text-zinc-300">{plan.name}</span><span className="font-semibold text-[#232320] dark:text-white">{plan.value}</span></div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10"><div className="h-full rounded-full bg-[#5B61CE] transition-[width] duration-700" style={{ width: `${ratio}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[15px] border border-dashed border-black/10 bg-white/70 px-4 py-7 text-center dark:border-white/10 dark:bg-zinc-950/50">
                    <p className="text-[12px] font-semibold text-[#55554F] dark:text-zinc-200">Nenhum plano convertido</p>
                    <p className="mt-1 text-[10px] text-[#999992]">A distribuição aparecerá após a primeira venda.</p>
                  </div>
                )}
              </article>

              <article className="rounded-[22px] border border-black/[0.08] bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#989890]">Regra da comissão</p>
                <div className="mt-4 flex items-end gap-2"><span className="text-[43px] font-semibold leading-none tracking-[-0.055em] text-[#171714] dark:text-white">30%</span><span className="pb-1 text-[10px] font-medium text-[#85857E]">na primeira venda</span></div>
                <p className="mt-4 text-[11px] leading-5 text-[#85857E]">O cliente é identificado pelo seu link e a comissão é calculada sobre o primeiro pagamento confirmado.</p>
                <div className="mt-4 rounded-[14px] bg-[#F1ECFF] px-4 py-3 text-[10px] font-medium text-[#6841C6]">Volume de vendas atribuído: {formatMoney(analytics.totalSales)}</div>
              </article>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#989890]">Histórico</p>
                <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#1A1A18] dark:text-white">Indicações e comissões</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A94]" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente ou pedido" className="h-10 w-full rounded-full border border-black/10 bg-white pl-10 pr-4 text-[11px] text-[#2D2D29] outline-none transition focus:border-[#8B8B84] dark:border-white/10 dark:bg-zinc-950 dark:text-white sm:w-[240px]" />
                </label>
                <div className="flex items-center rounded-full bg-[#F2F1ED] p-1 dark:bg-zinc-900">
                  {(["Todas", "Pagas", "Pendentes"] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setStatusFilter(item)} className={cn("rounded-full px-3 py-2 text-[10px] font-semibold transition", statusFilter === item ? "bg-white text-[#22221F] shadow-sm dark:bg-zinc-800 dark:text-white" : "text-[#8D8D86]")}>{item}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.08] dark:border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="bg-[#F7F6F2] dark:bg-zinc-900"><tr>{["Cliente indicado", "Plano", "Status", "Pedido", "Data", "Sua comissão"].map((heading) => <th key={heading} className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8E87]">{heading}</th>)}</tr></thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-[11px] text-[#8B8B84]">Carregando indicações...</td></tr>
                    ) : filteredCommissions.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-14 text-center"><p className="text-[12px] font-semibold text-[#55554F] dark:text-zinc-200">Nenhuma indicação encontrada</p><p className="mt-1 text-[10px] text-[#999992]">As conversões reais do seu link serão exibidas aqui.</p></td></tr>
                    ) : filteredCommissions.slice(0, 10).map((commission) => (
                      <tr key={commission.id} className="border-t border-black/[0.06] transition hover:bg-[#FAFAF7] dark:border-white/10 dark:hover:bg-zinc-900/70">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF0FA] text-[10px] font-bold text-[#5057B5] dark:bg-zinc-800">{commission.customerName.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="max-w-[190px] truncate text-[11px] font-semibold text-[#292925] dark:text-white">{commission.customerName}</p>{commission.customerEmail && <p className="max-w-[190px] truncate text-[9px] text-[#9B9B94]">{commission.customerEmail}</p>}</div></div></td>
                        <td className="px-5 py-4 text-[11px] text-[#65655F] dark:text-zinc-300">{commission.planName}</td>
                        <td className="px-5 py-4"><span className={cn("rounded-full px-2.5 py-1.5 text-[9px] font-semibold", statusStyle[commission.status])}>{commission.status === "paid" ? "Paga" : "Pendente"}</span></td>
                        <td className="px-5 py-4 font-mono text-[10px] text-[#777770]">#{commission.order_id.slice(-10)}</td>
                        <td className="px-5 py-4 text-[10px] text-[#777770]">{commission.date}</td>
                        <td className="px-5 py-4 text-[11px] font-semibold text-[#242420] dark:text-white">{formatMoney(commission.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AffiliateFinanceDashboard;
