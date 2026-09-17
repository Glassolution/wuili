import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plug,
  Search,
  Stethoscope,
  Ticket as TicketIcon,
  TriangleAlert,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast as toast } from "@/components/ui/velo-toast";

type CheckStatus = "ok" | "warn" | "fail";
type Check = { key: string; label: string; status: CheckStatus; detail: string };

type Diagnostics = {
  found: boolean;
  matched_by?: string;
  generated_at?: string;
  overall?: CheckStatus;
  summary?: string;
  checks?: Check[];
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    whatsapp: string | null;
    plano: string | null;
    nicho: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    onboarding_completed: boolean;
  };
  subscription?: Record<string, unknown> | null;
  ml?: Record<string, unknown>;
  publications?: Array<Record<string, unknown>>;
  publish_errors?: Array<Record<string, unknown>>;
  refunds?: Array<Record<string, unknown>>;
  tickets?: Array<Record<string, unknown>>;
  ticket?: Record<string, unknown> | null;
};

const fmt = (value?: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
};

const brl = (value: unknown) =>
  `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Card = ({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-[#eeeeeb] bg-white p-5">
    <header className="mb-4 flex items-center gap-2 text-[#777772]">
      <Icon size={16} strokeWidth={1.5} />
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em]">{title}</h2>
    </header>
    {children}
  </section>
);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[#f1f1ee] py-2 text-[13px] last:border-0">
    <span className="text-[#8c8c87]">{label}</span>
    <span className="text-right font-medium text-[#171715]">{value ?? "—"}</span>
  </div>
);

const statusStyles: Record<CheckStatus, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", label: "Tudo certo" },
  warn: { icon: TriangleAlert, color: "text-amber-600", bg: "bg-amber-50 border-amber-100", label: "Atenção" },
  fail: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50 border-rose-100", label: "Bloqueado" },
};

const AdminDiagnosticsPage = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Diagnostics | null>(null);

  const search = useMutation({
    mutationFn: async (q: string) => {
      const { data: result, error } = await supabase.functions.invoke("admin-user-diagnostics", { body: { query: q } });
      if (error) throw error;
      return result as Diagnostics;
    },
    onSuccess: (result) => {
      setData(result);
      if (!result?.found) toast.error("Nenhum usuário encontrado para essa busca.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Erro ao consultar a conta");
    },
  });

  const overall = data?.overall ?? "ok";
  const OverallIcon = statusStyles[overall].icon;
  const ml = data?.ml ?? {};

  return (
    <AdminShell
      active="diagnostics"
      userId={user?.id ?? ""}
      title="Consulta"
      subtitle="Digite o e-mail ou o número do ticket para ver o estado real da conta e o que está impedindo o usuário de publicar."
    >
      <form
        className="mb-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) search.mutate(query.trim());
        }}
      >
        <label className="admin-control flex flex-1 items-center gap-2">
          <Search size={15} strokeWidth={1.7} className="shrink-0 text-[#8c8f93]" />
          <span className="sr-only">Consultar usuário</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="E-mail do usuário ou número do ticket (ex.: d80b375b)"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1a1a1a] outline-none placeholder:text-[#8c8f93]"
          />
        </label>
        <button type="submit" disabled={search.isPending} className="admin-btn-primary justify-center px-4 disabled:opacity-60">
          {search.isPending ? <Loader2 size={15} className="animate-spin" /> : <Stethoscope size={15} strokeWidth={1.5} />}
          Consultar
        </button>
      </form>

      {data?.found && data.user ? (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 ${statusStyles[overall].bg}`}>
            <div className="flex items-start gap-3">
              <OverallIcon size={22} className={statusStyles[overall].color} strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#171715]">
                  {data.user.name ?? "Usuário"} · {data.user.email ?? "sem e-mail"}
                </p>
                <p className="mt-1 text-[13px] text-[#4b4b47]">{data.summary}</p>
                <p className="mt-2 text-[11px] text-[#8c8c87]">
                  Encontrado por {data.matched_by} · consulta feita em {fmt(data.generated_at)}
                </p>
              </div>
            </div>
          </div>

          <Card icon={CheckCircle2} title="Checklist da conta">
            <div className="space-y-2">
              {(data.checks ?? []).map((check) => {
                const style = statusStyles[check.status];
                const Icon = style.icon;
                return (
                  <div key={check.key} className="flex items-start gap-3 rounded-xl border border-[#f1f1ee] p-3">
                    <Icon size={16} className={`mt-0.5 shrink-0 ${style.color}`} strokeWidth={1.8} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#171715]">{check.label}</p>
                      <p className="text-[12px] text-[#77776f]">{check.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card icon={UserIcon} title="Usuário">
              <Row label="Nome" value={data.user.name} />
              <Row label="E-mail" value={data.user.email} />
              <Row label="WhatsApp" value={data.user.whatsapp} />
              <Row label="Plano no perfil" value={data.user.plano} />
              <Row label="Conta criada em" value={fmt(data.user.created_at)} />
              <Row label="Último login" value={fmt(data.user.last_sign_in_at)} />
              <Row label="Onboarding" value={data.user.onboarding_completed ? "Concluído" : "Não concluído"} />
            </Card>

            <Card icon={CreditCard} title="Assinatura">
              <Row label="Status" value={data.subscription ? String(data.subscription.status).toUpperCase() : "Sem assinatura ativa"} />
              <Row label="Plano" value={(data.subscription?.plan as string) ?? "—"} />
              <Row label="Valor" value={data.subscription ? brl(data.subscription.amount) : "—"} />
              <Row label="Pagamento" value={(data.subscription?.payment_method as string) ?? "—"} />
              <Row label="Vigência" value={data.subscription ? `${fmt(data.subscription.current_period_start)} → ${fmt(data.subscription.current_period_end)}` : "—"} />
              <Row label="Renovação cancelada" value={data.subscription?.cancel_at_period_end ? "Sim" : "Não"} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card icon={Plug} title="Mercado Livre">
              <Row label="Conectado" value={ml.connected ? "Sim" : "Não"} />
              <Row label="Conta" value={(ml.nickname as string) ?? (ml.ml_user_id ? String(ml.ml_user_id) : "—")} />
              <Row label="Pode anunciar" value={ml.can_list === true ? "Sim" : ml.can_list === false ? "Não" : "—"} />
              <Row label="Motivos de bloqueio" value={Array.isArray(ml.list_codes) && ml.list_codes.length ? (ml.list_codes as string[]).join(", ") : "Nenhum"} />
              <Row label="Situação no ML" value={(ml.site_status as string) ?? "—"} />
              <Row label="Mercado Envios" value={(ml.mercadoenvios as string) ?? "—"} />
              <Row label="Endereço de retirada" value={ml.address_city ? `${String(ml.address_city)}/${String(ml.address_state ?? "")}` : "—"} />
              {ml.connected && !ml.token_ok ? <Row label="Erro" value={String(ml.error ?? "")} /> : null}
            </Card>

            <Card icon={TicketIcon} title="Atendimentos e reembolsos">
              <Row label="Tickets abertos" value={(data.tickets ?? []).filter((t) => String(t.status) === "open").length} />
              <Row label="Total de tickets" value={(data.tickets ?? []).length} />
              <Row label="Pedidos de reembolso" value={(data.refunds ?? []).length} />
              <Row label="Último reembolso" value={data.refunds?.[0] ? `${String(data.refunds[0].status)} · ${fmt(data.refunds[0].created_at)}` : "—"} />
              {data.ticket ? <Row label="Ticket consultado" value={String(data.ticket.subject ?? "")} /> : null}
            </Card>
          </div>

          <Card icon={AlertTriangle} title="Últimos erros de publicação">
            {data.publish_errors?.length ? (
              <div className="space-y-2">
                {data.publish_errors.map((err) => (
                  <div key={String(err.id)} className="rounded-xl border border-[#f1f1ee] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[13px] font-medium text-[#171715]">{String(err.product_title ?? "—")}</p>
                      <span className="shrink-0 text-[11px] text-[#8c8c87]">{fmt(err.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-rose-600">{String(err.real_cause ?? err.mapped_message ?? "")}</p>
                    <p className="text-[11px] text-[#a1a19c]">
                      {String(err.mapped_code ?? "")} · categoria {String(err.category_id ?? "—")} · HTTP {String(err.http_status ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#77776f]">Nenhum erro de publicação registrado.</p>
            )}
          </Card>

          <Card icon={CheckCircle2} title="Publicações recentes">
            {data.publications?.length ? (
              <div className="space-y-1">
                {data.publications.slice(0, 15).map((pub) => (
                  <div key={String(pub.id)} className="flex items-center justify-between gap-3 border-b border-[#f1f1ee] py-2 text-[13px] last:border-0">
                    <span className="truncate text-[#171715]">{String(pub.title ?? "—")}</span>
                    <span className="shrink-0 text-[12px] text-[#8c8c87]">
                      {String(pub.status ?? "—")} · {String(pub.ml_item_id ?? "—")} · {fmt(pub.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#77776f]">Nenhum produto publicado ainda.</p>
            )}
          </Card>
        </div>
      ) : null}
    </AdminShell>
  );
};

export default AdminDiagnosticsPage;
