import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CreditCard, LogOut, Monitor, Smartphone, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";

type TrafficRow = {
  dia: string;
  sessoes: number;
  usuarios: number;
  mobile_usuarios: number;
  desktop_usuarios: number;
  page_views: number;
};
type PayingRow = {
  dia: string;
  novos_pagantes: number;
  cancelamentos: number;
  reembolsos: number;
  ativos_no_dia: number;
  receita: number;
};
type PageRow = { path: string; views: number; usuarios: number };
type ExitRow = { path: string; saidas: number; percentual: number };
type ReasonRow = { motivo: string; total: number; ultima_pagina: string | null };

const PERIODS = [7, 14, 30, 90];

const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const Card = ({
  title,
  children,
  icon: Icon,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
}) => (
  <section className="rounded-2xl border border-[#ececE6] bg-white p-4 sm:p-5">
    <header className="mb-3 flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-[#8c8c87]" /> : null}
      <h2 className="text-[14px] font-semibold text-[#171715]">{title}</h2>
    </header>
    {hint ? <p className="mb-3 text-[12px] text-[#8c8c87]">{hint}</p> : null}
    {children}
  </section>
);

const Kpi = ({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) => (
  <div className="rounded-2xl border border-[#ececE6] bg-white p-4">
    <div className="flex items-center gap-2 text-[12px] text-[#8c8c87]">
      <Icon className="h-4 w-4" />
      {label}
    </div>
    <p className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#171715]">{value}</p>
    {sub ? <p className="text-[12px] text-[#8c8c87]">{sub}</p> : null}
  </div>
);

const ROTULO_FUNIL: Record<string, string> = {
  signup_view: "Viu a tela de cadastro",
  signup_start: "Começou a preencher",
  signup_submit: "Enviou o cadastro",
  signup_success: "Conta criada",
  signup_error: "Erro no cadastro",
  signup_google_click: "Clicou em entrar com Google",
  signup_inapp_browser: "Abriu dentro de app (Instagram/TikTok)",
  login_submit: "Tentou entrar",
  login_success: "Entrou",
  login_error: "Erro ao entrar",
};

const AdminTrackingPage = () => {
  const [days, setDays] = useState(30);

  const traffic = useQuery({
    queryKey: ["admin-traffic", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPCs novas ainda não tipadas
      const { data, error } = await (supabase as any).rpc("rpc_admin_traffic_daily", { p_days: days });
      if (error) throw error;
      return (data ?? []) as TrafficRow[];
    },
  });
  const paying = useQuery({
    queryKey: ["admin-paying", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_paying_daily", { p_days: days });
      if (error) throw error;
      return (data ?? []) as PayingRow[];
    },
  });
  const topPages = useQuery({
    queryKey: ["admin-top-pages", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_top_pages", { p_days: days, p_limit: 20 });
      if (error) throw error;
      return (data ?? []) as PageRow[];
    },
  });
  const exits = useQuery({
    queryKey: ["admin-exits", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_exit_pages", { p_days: days, p_limit: 20 });
      if (error) throw error;
      return (data ?? []) as ExitRow[];
    },
  });
  const signupFunnel = useQuery({
    queryKey: ["admin-signup-funnel", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC nova ainda não tipada
      const { data, error } = await (supabase as any).rpc("rpc_admin_signup_funnel", { p_days: days });
      if (error) throw error;
      return (data ?? []) as { evento: string; detalhe: string | null; total: number; visitantes: number }[];
    },
  });
  const reasons = useQuery({
    queryKey: ["admin-refund-reasons", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_refund_reasons", { p_days: Math.max(days, 90) });
      if (error) throw error;
      return (data ?? []) as ReasonRow[];
    },
  });

  const trafficData = useMemo(
    () => (traffic.data ?? []).map((r) => ({ ...r, label: fmtDay(r.dia) })),
    [traffic.data],
  );
  const payingData = useMemo(() => (paying.data ?? []).map((r) => ({ ...r, label: fmtDay(r.dia) })), [paying.data]);

  const last = trafficData[trafficData.length - 1];
  const lastPaying = payingData[payingData.length - 1];
  const totalMobile = trafficData.reduce((acc, r) => acc + Number(r.mobile_usuarios || 0), 0);
  const totalDesktop = trafficData.reduce((acc, r) => acc + Number(r.desktop_usuarios || 0), 0);
  const totalDevices = totalMobile + totalDesktop;
  const pct = (n: number) => (totalDevices ? `${Math.round((n / totalDevices) * 100)}%` : "—");

  const semDados = !traffic.isLoading && trafficData.length === 0;

  return (
    <AdminShell
      active="tracking"
      userId="admin"
      title="Rastreio"
      subtitle="Acessos por dia, celular x computador, assinantes pagantes e por onde os usuários abandonam a Velo."
      actions={
        <div className="flex items-center gap-1 rounded-full border border-[#ececE6] bg-white p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                days === p ? "bg-[#171715] text-white" : "text-[#77776f] hover:bg-[#f6f6f3]"
              }`}
            >
              {p} dias
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Users} label="Acessos hoje" value={String(last?.usuarios ?? 0)} sub={`${last?.sessoes ?? 0} sessões`} />
          <Kpi
            icon={CreditCard}
            label="Assinantes pagantes"
            value={String(lastPaying?.ativos_no_dia ?? 0)}
            sub={`${lastPaying?.novos_pagantes ?? 0} novos hoje`}
          />
          <Kpi icon={Smartphone} label="Celular" value={pct(totalMobile)} sub={`${totalMobile} acessos no período`} />
          <Kpi icon={Monitor} label="Computador" value={pct(totalDesktop)} sub={`${totalDesktop} acessos no período`} />
        </div>

        {semDados ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
            Ainda não há dados no período. O registro de navegação acabou de ser corrigido — os números começam a
            aparecer conforme os usuários acessarem a Velo.
          </div>
        ) : null}

        <Card title="Usuários por dia" icon={Activity} hint="Pessoas diferentes que entraram na Velo em cada dia.">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1ee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="usuarios" name="Usuários" stroke="#2563EB" fill="#dbeafe" />
                <Area type="monotone" dataKey="sessoes" name="Sessões" stroke="#0f766e" fill="#ccfbf1" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Celular x Computador por dia" icon={Smartphone}>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1ee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mobile_usuarios" name="Celular" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="desktop_usuarios" name="Computador" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Pagantes, cancelamentos e reembolsos" icon={CreditCard}>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={payingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1ee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ativos_no_dia" name="Pagantes ativos" stroke="#0f766e" dot={false} />
                  <Line type="monotone" dataKey="novos_pagantes" name="Novos" stroke="#2563EB" dot={false} />
                  <Line type="monotone" dataKey="reembolsos" name="Reembolsos" stroke="#e11d48" dot={false} />
                  <Line type="monotone" dataKey="cancelamentos" name="Cancelamentos" stroke="#f59e0b" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Páginas mais acessadas" icon={Activity}>
            {topPages.data?.length ? (
              <div className="space-y-1">
                {topPages.data.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-3 border-b border-[#f1f1ee] py-2 text-[13px] last:border-0">
                    <span className="truncate text-[#171715]">{p.path}</span>
                    <span className="shrink-0 text-[12px] text-[#8c8c87]">
                      {p.views} visitas · {p.usuarios} pessoas
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#77776f]">Sem dados ainda.</p>
            )}
          </Card>

          <Card title="Onde os usuários saem da Velo" icon={LogOut} hint="Última página vista antes de fechar.">
            {exits.data?.length ? (
              <div className="space-y-1">
                {exits.data.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-3 border-b border-[#f1f1ee] py-2 text-[13px] last:border-0">
                    <span className="truncate text-[#171715]">{p.path}</span>
                    <span className="shrink-0 text-[12px] text-rose-600">
                      {p.saidas} saídas · {p.percentual}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#77776f]">Sem dados ainda.</p>
            )}
          </Card>
        </div>

        <Card
          title="Funil de cadastro e login"
          icon={Activity}
          hint="Quem viu a tela, começou a preencher, enviou, concluiu e onde deu erro."
        >
          {signupFunnel.data?.length ? (
            <div className="space-y-1">
              {signupFunnel.data.map((r) => (
                <div
                  key={`${r.evento}-${r.detalhe ?? ""}`}
                  className="flex items-center justify-between gap-3 border-b border-[#f1f1ee] py-2 text-[13px] last:border-0"
                >
                  <span className="truncate text-[#171715]">
                    {ROTULO_FUNIL[r.evento] ?? r.evento}
                    {r.detalhe ? ` — ${r.detalhe}` : ""}
                  </span>
                  <span className="shrink-0 text-[12px] text-[#8c8c87]">
                    {r.total} · {r.visitantes} pessoas
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#77776f]">Sem dados ainda.</p>
          )}
        </Card>

        <Card
          title="Motivos de reembolso"
          icon={CreditCard}
          hint="Motivo informado pelo cliente e a última página que ele viu antes de pedir o dinheiro de volta."
        >
          {reasons.data?.length ? (
            <div className="space-y-1">
              {reasons.data.map((r) => (
                <div key={r.motivo} className="flex items-center justify-between gap-3 border-b border-[#f1f1ee] py-2 text-[13px] last:border-0">
                  <span className="truncate text-[#171715]">{r.motivo}</span>
                  <span className="shrink-0 text-[12px] text-[#8c8c87]">
                    {r.total} pedidos · {r.ultima_pagina ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#77776f]">Nenhum pedido de reembolso no período.</p>
          )}
        </Card>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminTrackingPage;
