import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = { userId: string | null; onClose: () => void };

type Profile = {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    name: string | null;
    avatar_url: string | null;
  };
  subscriptions: Array<{ plan: string | null; status: string | null; amount: number | null; is_trial: boolean | null; updated_at: string | null }>;
  integrations: Array<{ platform: string; created_at: string; ml_user_id?: string | null; expires_at?: string | null }>;
  orders: Array<{ id: string; sale_price: number | null; product_title: string | null; platform: string | null; created_at: string; status: string | null }>;
  orders_summary: { count: number; revenue: number };
  activity: {
    total_online_seconds: number;
    sessions_count: number;
    last_seen_at: string | null;
    is_online: boolean;
    sessions: Array<{ started_at: string; last_seen_at: string; user_agent: string | null }>;
  };
  page_views: Array<{ path: string; title: string | null; product_id: string | null; product_title: string | null; viewed_at: string }>;
  last_page: { path: string; title: string | null; viewed_at: string } | null;
  product_clicks: Array<{ product_id: string; product_title: string | null; count: number; last_at: string }>;
  product_clicks_total: number;
};

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 1) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const formatWhen = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(".", "");
};

const relative = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
};

export const AdminUserDetailModal = ({ userId, onClose }: Props) => {
  const open = !!userId;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-user-profile", userId],
    enabled: !!userId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.functions.invoke("admin-user-profile", {
        body: { user_id: userId },
      });
      if (error) throw error;
      return data as Profile;
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        ref={scrollRef}
        className="h-full w-full max-w-[720px] overflow-y-auto border-l border-white/[0.06] bg-[#0A0A0A] text-white shadow-[0_0_60px_rgba(0,0,0,0.6)]"
        style={{ fontFamily: '"Inter", ui-sans-serif, system-ui' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0A0A]/95 px-6 py-4 backdrop-blur">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-[12px] text-white/60 hover:text-white"
          >
            <X size={14} /> Fechar
          </button>
          {data?.activity.is_online && (
            <span className="flex items-center gap-2 rounded-full border border-[#22C55E]/25 bg-[#22C55E]/10 px-3 py-1 text-[11px] font-medium text-[#4ADE80]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
              </span>
              Online agora
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-[13px] text-white/60">
            Não foi possível carregar o perfil. {error instanceof Error ? error.message : ""}
          </div>
        ) : data ? (
          <div className="space-y-6 px-6 py-6">
            {/* Identity */}
            <section className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08] text-[18px] font-semibold">
                {data.user.avatar_url ? (
                  <img src={data.user.avatar_url} alt={data.user.name ?? ""} className="h-full w-full object-cover" />
                ) : (
                  (data.user.name ?? data.user.email ?? "?")
                    .split(/[\s._@-]+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[22px] font-semibold tracking-[-0.02em]">
                  {data.user.name || "Usuário sem nome"}
                </h2>
                <p className="mt-1 text-[13px] text-white/50">
                  Cadastrado em {formatWhen(data.user.created_at)} · Último login {relative(data.user.last_sign_in_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                  <InfoChip icon={Mail} value={data.user.email ?? "Sem email"} />
                  <InfoChip icon={Phone} value={data.user.phone ?? "Sem telefone"} />
                </div>
              </div>
            </section>

            {/* Overview cards */}
            <section className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Tempo online" value={formatDuration(data.activity.total_online_seconds)} hint={`${data.activity.sessions_count} sessões`} />
              <StatCard label="Produtos clicados" value={String(data.product_clicks_total)} hint={`${data.product_clicks.length} únicos`} />
              <StatCard label="Receita" value={formatBRL(data.orders_summary.revenue)} hint={`${data.orders_summary.count} pedidos`} />
            </section>

            {/* Integrations & subscription */}
            <section className="grid gap-3 lg:grid-cols-2">
              <Panel title="Mercado Livre" icon={Store}>
                {data.integrations.find((i) => i.platform === "mercadolivre") ? (
                  <div className="space-y-2 text-[13px]">
                    <Row label="Status" value={<span className="text-[#4ADE80]">Conectado</span>} />
                    <Row label="ID ML" value={data.integrations.find((i) => i.platform === "mercadolivre")?.ml_user_id ?? "—"} />
                    <Row
                      label="Desde"
                      value={formatWhen(data.integrations.find((i) => i.platform === "mercadolivre")?.created_at ?? null)}
                    />
                  </div>
                ) : (
                  <p className="text-[13px] text-white/50">Não conectado ao Mercado Livre.</p>
                )}
              </Panel>

              <Panel title="Assinatura" icon={ShoppingCart}>
                {data.subscriptions[0] ? (
                  <div className="space-y-2 text-[13px]">
                    <Row label="Plano" value={data.subscriptions[0].plan ?? "—"} />
                    <Row label="Status" value={data.subscriptions[0].status ?? "—"} />
                    <Row
                      label="Valor"
                      value={data.subscriptions[0].amount ? formatBRL(Number(data.subscriptions[0].amount)) : "—"}
                    />
                    <Row label="Atualizado" value={formatWhen(data.subscriptions[0].updated_at ?? null)} />
                  </div>
                ) : (
                  <p className="text-[13px] text-white/50">Sem assinatura.</p>
                )}
              </Panel>
            </section>

            {/* Last page */}
            <Panel title="Última página visitada" icon={MapPin}>
              {data.last_page ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{data.last_page.title || data.last_page.path}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-white/45">{data.last_page.path}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-white/45">{relative(data.last_page.viewed_at)}</span>
                </div>
              ) : (
                <p className="text-[13px] text-white/50">Sem histórico ainda.</p>
              )}
            </Panel>

            {/* Product clicks */}
            <Panel title="Produtos que ele clicou" icon={Package}>
              {data.product_clicks.length === 0 ? (
                <p className="text-[13px] text-white/50">Nenhum produto clicado.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {data.product_clicks.map((p) => (
                    <li key={p.product_id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px]">{p.product_title || p.product_id}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-white/40">{p.product_id}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[11px] text-white/45">{relative(p.last_at)}</span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium">
                          {p.count}×
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Recent activity */}
            <Panel title="Histórico de navegação" icon={Activity}>
              {data.page_views.length === 0 ? (
                <p className="text-[13px] text-white/50">Sem histórico registrado.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {data.page_views.map((v, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px]">{v.title || v.path}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-white/40">{v.path}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-white/45">{formatWhen(v.viewed_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Sessions */}
            <Panel title="Sessões" icon={Clock}>
              {data.activity.sessions.length === 0 ? (
                <p className="text-[13px] text-white/50">Nenhuma sessão registrada ainda.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {data.activity.sessions.map((s, i) => {
                    const dur = Math.max(
                      0,
                      Math.floor((new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime()) / 1000)
                    );
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                        <span className="text-white/70">{formatWhen(s.started_at)}</span>
                        <span className="text-white/40">→ {formatWhen(s.last_seen_at)}</span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">
                          {formatDuration(dur)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {/* Orders */}
            {data.orders.length > 0 && (
              <Panel title="Pedidos recentes" icon={ShoppingCart}>
                <ul className="divide-y divide-white/[0.05]">
                  {data.orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                      <span className="truncate">{o.product_title || o.id.slice(0, 8)}</span>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-white/50">{formatWhen(o.created_at)}</span>
                        <span className="font-medium">{formatBRL(Number(o.sale_price ?? 0))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-[#0F0F0F] p-4">
    <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</p>
    <p className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-white/45">{hint}</p>}
  </div>
);

const Panel = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-white/[0.06] bg-[#0B0B0B] p-5">
    <header className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">
      <Icon size={13} className="text-white/40" />
      {title}
    </header>
    {children}
  </section>
);

const InfoChip = ({ icon: Icon, value }: { icon: any; value: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0F0F0F] px-2.5 py-1 text-white/70">
    <Icon size={12} className="text-white/40" />
    {value}
  </span>
);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-white/45">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

export default AdminUserDetailModal;
