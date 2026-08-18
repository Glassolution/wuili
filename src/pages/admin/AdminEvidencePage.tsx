import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Printer,
  User as UserIcon,
  CreditCard,
  Plug,
  Clock,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast as toast } from "@/components/ui/velo-toast";

type Timeline = { at: string; kind: string; label: string; detail?: string | null };

type Evidence = {
  found: boolean;
  matched_by?: string;
  generated_at?: string;
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    tax_id: string | null;
    provider: string | null;
    created_at: string | null;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
    plano: string | null;
  };
  subscription?: Record<string, unknown> | null;
  subscriptions?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  refunds?: Array<Record<string, unknown>>;
  integrations?: Array<{ platform: string; connected_at: string; expires_at: string | null; external_account_id: string | null }>;
  publications?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  own_products?: Array<Record<string, unknown>>;
  sessions?: Array<{ started_at: string; last_seen_at: string; user_agent: string | null }>;
  page_views?: Array<Record<string, unknown>>;
  usage?: Record<string, number>;
  timeline?: Timeline[];
};

const fmt = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
};

const brl = (value: unknown) =>
  `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const duration = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

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

const AdminEvidencePage = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Evidence | null>(null);

  const search = useMutation({
    mutationFn: async (q: string) => {
      const { data: result, error } = await supabase.functions.invoke("admin-user-evidence", { body: { query: q } });
      if (error) throw error;
      return result as Evidence;
    },
    onSuccess: (result) => {
      setData(result);
      if (!result?.found) toast.error("Nenhum usuário encontrado para essa busca.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Erro ao buscar evidências");
    },
  });

  const sub = data?.subscription as Record<string, unknown> | null | undefined;
  const timeline = useMemo(() => data?.timeline ?? [], [data]);

  return (
    <AdminShell
      active="evidence"
      userId={user?.id ?? ""}
      title="Evidências"
      subtitle="Dossiê do usuário para disputas MED/chargeback: criação da conta, logins, assinatura e ações realizadas."
      actions={
        data?.found ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-[#e3e3df] bg-white px-4 py-2 text-[13px] font-medium text-[#171715] transition hover:bg-[#f6f6f4] print:hidden"
          >
            <Printer size={15} strokeWidth={1.5} /> Exportar PDF
          </button>
        ) : null
      }
    >
      <form
        className="mb-6 flex flex-col gap-2 sm:flex-row print:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) search.mutate(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search size={16} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a1a19c]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="E-mail, CPF ou ID do usuário"
            className="h-11 w-full rounded-full border border-[#e3e3df] bg-white pl-11 pr-4 text-[14px] text-[#171715] placeholder:text-[#a1a19c] outline-none focus:border-[#171715]"
          />
        </div>
        <button
          type="submit"
          disabled={search.isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#171715] px-6 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {search.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} strokeWidth={1.5} />}
          Gerar dossiê
        </button>
      </form>

      {data?.found && data.user ? (
        <div className="space-y-4 print:space-y-3">
          <p className="text-[11px] text-[#a1a19c] print:text-neutral-500">
            Dossiê gerado em {fmt(data.generated_at)} (horário de Brasília) · Velo · ID interno {data.user.id}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card icon={UserIcon} title="Identificação da conta">
              <Row label="Nome" value={data.user.name} />
              <Row label="E-mail" value={data.user.email} />
              <Row label="CPF (pagamento)" value={data.user.tax_id} />
              <Row label="Telefone" value={data.user.phone} />
              <Row label="Método de cadastro" value={data.user.provider} />
              <Row label="Conta criada em" value={fmt(data.user.created_at)} />
              <Row label="E-mail confirmado em" value={fmt(data.user.email_confirmed_at)} />
              <Row label="Último login" value={fmt(data.user.last_sign_in_at)} />
            </Card>

            <Card icon={CreditCard} title="Assinatura">
              <Row label="Status" value={sub ? String(sub.status).toUpperCase() : "Sem assinatura"} />
              <Row label="Produto contratado" value={sub ? `Velo ${String(sub.plan).charAt(0).toUpperCase()}${String(sub.plan).slice(1)}` : "—"} />
              <Row label="Valor" value={sub ? brl(sub.amount) : "—"} />
              <Row label="Pagamento" value={sub ? String(sub.payment_method ?? "—") : "—"} />
              <Row label="Contratada em" value={fmt(sub?.created_at as string)} />
              <Row label="Vigência" value={sub ? `${fmt(sub.current_period_start as string)} → ${fmt(sub.current_period_end as string)}` : "—"} />
              <Row label="ID da cobrança" value={(sub?.validapay_charge_id as string) ?? "—"} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card icon={Clock} title="Uso da plataforma">
              <Row label="Sessões registradas" value={data.usage?.sessions_count ?? 0} />
              <Row label="Tempo total logado" value={duration(data.usage?.total_online_seconds ?? 0)} />
              <Row label="Páginas visitadas" value={data.usage?.page_views_count ?? 0} />
              <Row label="Produtos publicados" value={data.usage?.publications_count ?? 0} />
              <Row label="Integrações conectadas" value={data.usage?.integrations_count ?? 0} />
              <Row label="Projetos/lojas criados" value={data.projects?.length ?? 0} />
            </Card>

            <Card icon={Plug} title="Integrações conectadas">
              {data.integrations?.length ? (
                data.integrations.map((integration) => (
                  <Row
                    key={`${integration.platform}-${integration.connected_at}`}
                    label={integration.platform}
                    value={`${fmt(integration.connected_at)}${integration.external_account_id ? ` · conta ${integration.external_account_id}` : ""}`}
                  />
                ))
              ) : (
                <p className="text-[13px] text-[#777772]">Nenhuma integração conectada.</p>
              )}
            </Card>
          </div>

          <Card icon={FileText} title="Histórico de logins (sessões)">
            {data.sessions?.length ? (
              <div className="overflow-hidden rounded-xl border border-[#eeeeeb]">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-[#f7f7f5] text-[#777772]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Início</th>
                      <th className="px-3 py-2 font-medium">Última atividade</th>
                      <th className="px-3 py-2 font-medium">Dispositivo</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#3a3a37]">
                    {data.sessions.map((session) => (
                      <tr key={session.started_at} className="border-t border-[#f1f1ee]">
                        <td className="px-3 py-2">{fmt(session.started_at)}</td>
                        <td className="px-3 py-2">{fmt(session.last_seen_at)}</td>
                        <td className="max-w-[380px] truncate px-3 py-2 text-[#8c8c87]">{session.user_agent ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-[#777772]">Sem sessões registradas.</p>
            )}
          </Card>

          <Card icon={Clock} title="Linha do tempo da conta">
            {timeline.length ? (
              <ol className="space-y-3">
                {timeline.map((item, index) => (
                  <li key={`${item.at}-${index}`} className="flex gap-3 text-[13px]">
                    <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c9c9c4]" />
                    <div className="min-w-0">
                      <p className="text-[#171715]">
                        <span className="text-[#8c8c87]">{fmt(item.at)}</span> · {item.label}
                      </p>
                      {item.detail ? <p className="truncate text-[12px] text-[#8c8c87]">{item.detail}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-[#777772]">Sem eventos registrados.</p>
            )}
          </Card>

          {data.payments?.length ? (
            <Card icon={CreditCard} title="Eventos de pagamento">
              <div className="overflow-hidden rounded-xl border border-[#eeeeeb]">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-[#f7f7f5] text-[#777772]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Evento</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="px-3 py-2 font-medium">Cobrança</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#3a3a37]">
                    {data.payments.map((payment) => (
                      <tr key={String(payment.id)} className="border-t border-[#f1f1ee]">
                        <td className="px-3 py-2">{fmt(payment.created_at as string)}</td>
                        <td className="px-3 py-2">{String(payment.event ?? "—")}</td>
                        <td className="px-3 py-2">{String(payment.status ?? "—")}</td>
                        <td className="px-3 py-2">{payment.amount ? brl(payment.amount) : "—"}</td>
                        <td className="px-3 py-2 text-[#8c8c87]">{String(payment.charge_id ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] text-[#777772] print:hidden">
          Busque por e-mail, CPF ou ID para montar o dossiê de evidências.
        </p>
      )}
    </AdminShell>
  );
};

export default AdminEvidencePage;
