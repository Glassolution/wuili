import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, Trash2, UsersRound, X } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminKPIStat } from "@/components/admin/AdminPrimitives";
import { AdminAffiliateApplicationsPanel } from "@/components/admin/AdminAffiliateApplicationsPanel";
import { AdminWithdrawalsPanel } from "@/components/admin/AdminWithdrawalsPanel";
import AffiliateApplicationCard from "@/components/admin/AffiliateApplicationCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";


type AffiliateRow = {
  affiliate_user_id: string;
  affiliate_name: string | null;
  affiliate_email: string | null;
  code: string;
  link: string;
  created_at: string;
  clicks: number;
  signups: number;
  reached_payment: number;
  payers: number;
  commission_pending: number;
  commission_paid: number;
  /** Afiliado aprovado porém pausado. Removido do programa some da lista. */
  is_active?: boolean;
  /** Status do cadastro (affiliate_applications). "pending" só aparece na aba de aprovação. */
  application_status?: string | null;

};


type AffiliateDetails = {
  affiliate: {
    user_id: string;
    code: string;
    link: string;
    commission_rate: number | null;
    created_at: string;
  } | null;
  clicks: Array<{ created_at: string; referrer: string | null; user_agent: string | null }>;
  conversions: Array<{
    id: string;
    subscriber_user_id: string;
    subscriber_email: string | null;
    subscriber_name: string | null;
    status: string;
    plan_value: number;
    commission_rate: number;
    commission_value: number;
    payout_status: "pending" | "paid" | string;
    created_at: string;
    reached_payment_at: string | null;
    paid_at: string | null;
  }>;
};

type AffiliateAdminTab = "applications" | "withdrawals" | "approved";

const AFFILIATE_TABS: Array<{
  key: AffiliateAdminTab;
  label: string;
  description: string;
}> = [
  {
    key: "applications",
    label: "Solicitações de afiliados",
    description: "Aprove ou recuse novos cadastros.",
  },
  {
    key: "withdrawals",
    label: "Solicitações de saque",
    description: "Acompanhe aprovações e pagamentos Pix.",
  },
  {
    key: "approved",
    label: "Afiliados aprovados",
    description: "Veja funil, links e comissões por afiliado.",
  },
];

const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("pt-BR") : "-");
const isMissingRpcError = (error: unknown) =>
  /could not find the function/i.test(String((error as any)?.message ?? error ?? ""));
const PUBLIC_APP_URL = ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? "https://velods.com.br").replace(/\/+$/, "");
const normalizeAffiliateCode = (value?: string | null) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
const buildAffiliateUrl = (code: string) => `${PUBLIC_APP_URL}/ref/${normalizeAffiliateCode(code)}`;
const asAffiliateRows = (value: unknown): AffiliateRow[] => {
  const normalizeRow = (raw: any): AffiliateRow => ({
    affiliate_user_id: String(raw?.affiliate_user_id ?? raw?.user_id ?? ""),
    affiliate_name: raw?.affiliate_name ?? raw?.display_name ?? null,
    affiliate_email: raw?.affiliate_email ?? raw?.email ?? null,
    code: String(raw?.code ?? raw?.affiliate_code ?? ""),
    link: String(raw?.link ?? ""),
    created_at: String(raw?.created_at ?? new Date().toISOString()),
    clicks: Number(raw?.clicks ?? 0),
    signups: Number(raw?.signups ?? 0),
    reached_payment: Number(raw?.reached_payment ?? 0),
    payers: Number(raw?.payers ?? 0),
    commission_pending: Number(raw?.commission_pending ?? 0),
    commission_paid: Number(raw?.commission_paid ?? 0),
    is_active: raw?.is_active !== false,
    application_status: raw?.application_status ?? null,

  });

  if (Array.isArray(value)) return value.map(normalizeRow);
  if (!value || typeof value !== "object") return [];
  const data = value as { affiliates?: unknown; ranking?: unknown; rows?: unknown; data?: unknown };
  // A RPC devolve { from, to, funnel, commissions, ranking, affiliates }.
  for (const candidate of [data.affiliates, data.ranking, data.rows, data.data]) {
    if (Array.isArray(candidate)) return candidate.map(normalizeRow);
  }
  return [];
};

const canonicalizeAffiliateRow = (row: AffiliateRow): AffiliateRow => {
  const code = normalizeAffiliateCode(row.code);
  return { ...row, code, link: buildAffiliateUrl(code) };
};
const canonicalizeAffiliateDetails = (data: AffiliateDetails | null | undefined): AffiliateDetails => {
  const empty: AffiliateDetails = { affiliate: null, clicks: [], conversions: [] };
  if (!data || typeof data !== "object") return empty;
  if (!data.affiliate) {
    return {
      affiliate: null,
      clicks: Array.isArray(data.clicks) ? data.clicks : [],
      conversions: Array.isArray(data.conversions) ? data.conversions : [],
    };
  }
  const code = normalizeAffiliateCode(data.affiliate.code);
  return {
    ...data,
    affiliate: {
      ...data.affiliate,
      code,
      link: buildAffiliateUrl(code),
    },
    clicks: Array.isArray(data.clicks) ? data.clicks : [],
    conversions: Array.isArray(data.conversions) ? data.conversions : [],
  };
};

const AdminCommissionsPage = () => {
  const { user, loading: loadingAuth, role } = useAuth();
  const ADMIN_EMAILS = useMemo(() => new Set(["xavierluisfelipe12@gmail.com"]), []);
  const isAdmin = role === "admin" || (!!user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()));
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AffiliateAdminTab>("approved");
  const [rowToRemove, setRowToRemove] = useState<AffiliateRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const queryClient = useQueryClient();

  const handleRemoveAffiliate = async () => {
    if (!rowToRemove) return;
    setRemoving(true);
    try {
      const { error } = await supabase.rpc("rpc_admin_remove_affiliate", {
        p_user_id: rowToRemove.affiliate_user_id || null,
        p_code: rowToRemove.code,
      });
      if (error) throw error;
      toast.success(`${rowToRemove.affiliate_name ?? rowToRemove.code} foi removido do programa de afiliados.`);
      setRowToRemove(null);
      setSelectedCode(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-affiliate-commissions"] });
    } catch (e) {
      toast.error(`Não foi possível remover: ${String((e as any)?.message ?? e)}`);
    } finally {
      setRemoving(false);
    }
  };


  const { data: affiliates = [], isLoading, error } = useQuery({
    queryKey: ["admin-affiliate-commissions"],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("rpc_admin_affiliates_summary");
        if (error) throw error;
        return asAffiliateRows(data).map(canonicalizeAffiliateRow);
      } catch (e) {
        if (!isMissingRpcError(e)) throw e;

        const [affRes, clicksRes, convRes, profRes] = await Promise.all([
          supabase.from("affiliates").select("code, user_id, link, created_at").order("created_at", { ascending: false }),
          supabase.from("affiliate_clicks").select("affiliate_code"),
          supabase.from("affiliate_conversions").select("*"),
          supabase.from("profiles").select("id,user_id,display_name,created_at"),
        ]);
        if (affRes.error) throw affRes.error;
        if (clicksRes.error) throw clicksRes.error;
        if (convRes.error) throw convRes.error;
        if (profRes.error) throw profRes.error;

        const profiles = (profRes.data ?? []) as Array<any>;
        const profileByUser = new Map<string, any>();
        for (const p of profiles) profileByUser.set(String(p.user_id ?? p.id), p);

        const clicksByCode = new Map<string, number>();
        for (const click of (clicksRes.data ?? []) as Array<{ affiliate_code: string }>) {
          const code = String(click.affiliate_code ?? "").toUpperCase();
          if (!code) continue;
          clicksByCode.set(code, (clicksByCode.get(code) ?? 0) + 1);
        }

        const signupsByCode = new Map<string, Set<string>>();
        const reachedByCode = new Map<string, Set<string>>();
        const payersByCode = new Map<string, Set<string>>();
        const pendingByCode = new Map<string, number>();
        const paidByCode = new Map<string, number>();

        for (const conv of (convRes.data ?? []) as Array<any>) {
          const code = String(conv.affiliate_code ?? "").toUpperCase();
          const subscriber = String(conv.subscriber_user_id ?? "");
          if (!code || !subscriber) continue;

          const status = String(conv.status ?? "").toLowerCase();
          const payoutStatus = String((conv as any).payout_status ?? "pending").toLowerCase();
          const commissionValue = Number(conv.commission_value ?? 0);

          const signups = signupsByCode.get(code) ?? new Set<string>();
          signups.add(subscriber);
          signupsByCode.set(code, signups);

          if (["reached_payment", "paid", "active", "approved", "authorized"].includes(status)) {
            const reached = reachedByCode.get(code) ?? new Set<string>();
            reached.add(subscriber);
            reachedByCode.set(code, reached);
          }

          if (["paid", "active", "approved", "authorized"].includes(status)) {
            const payers = payersByCode.get(code) ?? new Set<string>();
            payers.add(subscriber);
            payersByCode.set(code, payers);

            if (payoutStatus === "paid") {
              paidByCode.set(code, (paidByCode.get(code) ?? 0) + commissionValue);
            } else {
              pendingByCode.set(code, (pendingByCode.get(code) ?? 0) + commissionValue);
            }
          }
        }

        return ((affRes.data ?? []) as Array<any>).map((a) => {
          const code = normalizeAffiliateCode(a.code);
          const p = profileByUser.get(String(a.user_id));
          return {
            affiliate_user_id: String(a.user_id),
            affiliate_name: p?.full_name ?? p?.display_name ?? p?.name ?? p?.email ?? code ?? "Afiliado sem nome",
            affiliate_email: p?.email ?? null,
            code,
            link: buildAffiliateUrl(code),
            created_at: String(a.created_at ?? new Date().toISOString()),
            clicks: clicksByCode.get(code) ?? 0,
            signups: signupsByCode.get(code)?.size ?? 0,
            reached_payment: reachedByCode.get(code)?.size ?? 0,
            payers: payersByCode.get(code)?.size ?? 0,
            commission_pending: pendingByCode.get(code) ?? 0,
            commission_paid: paidByCode.get(code) ?? 0,
            is_active: true,
            application_status: null,

          } satisfies AffiliateRow;
        });
      }
    },
  });

  const { data: details, isLoading: loadingDetails } = useQuery({
    queryKey: ["admin-affiliate-commission-details", selectedCode],
    enabled: !!selectedCode,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("rpc_admin_affiliate_details", {
          p_query: selectedCode ?? "",
        });
        if (error) throw error;
        return canonicalizeAffiliateDetails(data as AffiliateDetails | null | undefined);
      } catch (e) {
        if (!isMissingRpcError(e)) throw e;

        const code = normalizeAffiliateCode(selectedCode);
        const [affRes, clicksRes, convRes, profRes] = await Promise.all([
          supabase.from("affiliates").select("user_id, code, link, commission_rate, created_at").eq("code", code).maybeSingle(),
          supabase.from("affiliate_clicks").select("created_at, referrer, user_agent").eq("affiliate_code", code).order("created_at", { ascending: false }).limit(200),
          supabase
            .from("affiliate_conversions")
            .select("*")
            .eq("affiliate_code", code)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase.from("profiles").select("id,user_id,display_name"),
        ]);
        if (affRes.error) throw affRes.error;
        if (clicksRes.error) throw clicksRes.error;
        if (convRes.error) throw convRes.error;
        if (profRes.error) throw profRes.error;

        const profileByUser = new Map<string, any>();
        for (const p of (profRes.data ?? []) as any[]) profileByUser.set(String(p.user_id ?? p.id), p);

        const conversions = ((convRes.data ?? []) as any[]).map((c) => {
          const sp = profileByUser.get(String(c.subscriber_user_id));
          return {
            ...c,
            subscriber_email: sp?.email ?? null,
            subscriber_name: sp?.full_name ?? sp?.display_name ?? sp?.name ?? sp?.email ?? "Usuário sem nome",
            payout_status: (c as any).payout_status ?? "pending",
          };
        });

        return {
          affiliate: affRes.data
            ? {
                user_id: String(affRes.data.user_id),
                code: normalizeAffiliateCode(affRes.data.code ?? code),
                link: buildAffiliateUrl(affRes.data.code ?? code),
                commission_rate: affRes.data.commission_rate ?? null,
                created_at: String(affRes.data.created_at ?? new Date().toISOString()),
              }
            : null,
          clicks: (clicksRes.data ?? []) as any,
          conversions: conversions as any,
        } satisfies AffiliateDetails;
      }
    },
  });

  // A lista principal mostra SÓ quem foi de fato aprovado pelo admin:
  // cadastro com status "approved" OU afiliado ativado manualmente (legado, sem formulário).
  // Quem nunca foi avaliado (status null/pending) ou foi rejeitado fica só na aba de aprovação.
  const approvedAffiliates = useMemo(
    () =>
      affiliates.filter((row) => {
        const status = String(row.application_status ?? "").toLowerCase();
        if (status === "approved") return true;
        if (status === "pending" || status === "rejected") return false;
        return row.is_active === true;
      }),
    [affiliates],
  );

  const selectedRow = useMemo(
    () => approvedAffiliates.find((row) => row.code === selectedCode) ?? null,
    [approvedAffiliates, selectedCode],
  );

  const totals = useMemo(() => {
    const out = {
      totalAffiliates: approvedAffiliates.length,
      clicks: 0,
      signups: 0,
      reachedPayment: 0,
      payers: 0,
      commissionPending: 0,
      commissionPaid: 0,
    };
    for (const row of approvedAffiliates) {
      out.clicks += Number(row.clicks ?? 0);
      out.signups += Number(row.signups ?? 0);
      out.reachedPayment += Number(row.reached_payment ?? 0);
      out.payers += Number(row.payers ?? 0);
      out.commissionPending += Number(row.commission_pending ?? 0);
      out.commissionPaid += Number(row.commission_paid ?? 0);
    }
    return out;
  }, [approvedAffiliates]);


  if (loadingAuth) {
    return <VeloLoadingScreen message="Carregando afiliados..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AdminShell
      active="commissions"
      userId={user.id}
      title="Afiliados"
      subtitle="Rastreie cliques, cadastros, pagamentos e comissões de cada afiliado."
    >
      <div className="space-y-5 text-[#171715]">
        <nav className="grid gap-2 rounded-[18px] border border-[#E6EAF2] bg-white p-2 shadow-[0_14px_35px_rgba(15,23,42,0.04)] lg:grid-cols-3">
          {AFFILIATE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              data-active={activeTab === tab.key}
              className="admin-metric-card px-4 py-3 text-left transition"
            >
              <span className="text-[13px] font-semibold text-[#1a1a1a]">{tab.label}</span>
              <span className="admin-kpi-subtitle mt-1 block leading-5">{tab.description}</span>
            </button>
          ))}
        </nav>

        {activeTab === "applications" ? <AdminAffiliateApplicationsPanel /> : null}
        {activeTab === "withdrawals" ? <AdminWithdrawalsPanel /> : null}
        {activeTab === "approved" ? (
          <>
            <section className="overflow-hidden rounded-[18px] border border-[#E3E8F4] bg-[#F7FAFF] shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 border-b border-[#E3E8F4] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="admin-metric-icon"><UsersRound /></span>
                  <div>
                    <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#171715]">Afiliados aprovados</h2>
                    <p className="mt-1 text-[12px] text-[#777772]">Resumo do funil e repasses pendentes por código.</p>
                  </div>
                </div>
                <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EFF6FF] px-3 text-[11px] font-semibold text-[#2563EB]">
                  <CheckCircle2 size={13} />
                  Links canônicos da Velo
                </span>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
                <MetricCard label="Afiliados" value={String(totals.totalAffiliates)} />
                <MetricCard label="Cliques" value={String(totals.clicks)} />
                <MetricCard label="Cadastros" value={String(totals.signups)} />
                <MetricCard label="No pagamento" value={String(totals.reachedPayment)} />
                <MetricCard label="Pagantes" value={String(totals.payers)} />
                <MetricCard label="Pendente" value={money(totals.commissionPending)} highlight="amber" />
                <MetricCard label="Pago" value={money(totals.commissionPaid)} highlight="emerald" />
              </div>
            </section>

            <section className="overflow-hidden rounded-[18px] border border-[#E6EAF2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2 border-b border-[#EEF1F6] bg-[#F8FAFC] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#171715]">Afiliados</h2>
              <p className="mt-1 text-[11px] text-[#8A8F9B]">
                {approvedAffiliates.length} afiliado(s) aprovados
              </p>
            </div>
            {error ? (
              <p className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600">
                Erro ao carregar: {String((error as any)?.message ?? error)}
              </p>
            ) : null}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-[#2563EB]" />
            </div>
          ) : approvedAffiliates.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                <UsersRound size={20} />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-[#171715]">Nenhum afiliado encontrado</p>
              <p className="mt-1 text-[12px] text-[#777772]">Quando alguém ativar um link de indicação, o funil aparecerá aqui.</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1220px] text-left text-[13px]">
                <thead className="bg-white text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8F9B]">
                  <tr>
                    <Th>Afiliado</Th>
                    <Th>Email</Th>
                    <Th>Código</Th>
                    <Th>Link</Th>
                    <Th className="text-right">Cliques</Th>
                    <Th className="text-right">Cadastros</Th>
                    <Th className="text-right">No pagamento</Th>
                    <Th className="text-right">Pagantes</Th>
                    <Th className="text-right">Comissão pendente</Th>
                    <Th className="text-right">Comissão paga</Th>
                    <Th>Criado em</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF1F6]">
                  {approvedAffiliates.map((row) => (
                    <tr
                      key={row.code}
                      onClick={() => setSelectedCode(row.code)}
                      className="cursor-pointer transition hover:bg-[#F8FAFC]"
                    >
                      <Td className="font-semibold text-[#171715]">
                        <span>{row.affiliate_name ?? row.affiliate_user_id}</span>
                        {row.is_active === false ? (
                          <span className="ml-2 rounded-full border border-[#FDE7B2] bg-[#FFF7E6] px-2 py-0.5 text-[10px] font-semibold text-[#B7791F]">
                            Inativo
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-[#64748B]">{row.affiliate_email ?? "-"}</Td>

                      <Td>
                        <span className="rounded-[8px] border border-[#DDE7FF] bg-[#EFF6FF] px-2 py-1 font-mono text-[11px] font-semibold text-[#2563EB]">
                          {row.code}
                        </span>
                      </Td>
                      <Td>
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#2563EB] transition hover:text-[#1D4ED8]"
                        >
                          <span className="max-w-[260px] truncate">{row.link}</span>
                          <ExternalLink size={14} strokeWidth={1.5} />
                        </a>
                      </Td>
                      <Td className="text-right font-medium text-[#171715]">{row.clicks ?? 0}</Td>
                      <Td className="text-right font-medium text-[#171715]">{row.signups ?? 0}</Td>
                      <Td className="text-right font-medium text-[#171715]">{row.reached_payment ?? 0}</Td>
                      <Td className="text-right font-medium text-[#171715]">{row.payers ?? 0}</Td>
                      <Td className="text-right font-semibold text-[#B7791F]">{money(Number(row.commission_pending ?? 0))}</Td>
                      <Td className="text-right font-semibold text-[#087443]">{money(Number(row.commission_paid ?? 0))}</Td>
                      <Td className="text-[#64748B]">{date(row.created_at)}</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCode(row.code);
                          }}
                          className="rounded-[10px] border border-[#DDE3EE] bg-white px-3 py-2 text-[12px] font-semibold text-[#64748B] transition hover:border-[#C7D7FE] hover:text-[#2563EB]"
                        >
                          Ver detalhes
                        </button>
                      </Td>


                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </section>
          </>
        ) : null}

        <AlertDialog open={!!rowToRemove} onOpenChange={(open) => (!open && !removing ? setRowToRemove(null) : null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Tem certeza que deseja remover {rowToRemove?.affiliate_name ?? rowToRemove?.code} como afiliado?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O link <strong>{rowToRemove?.code}</strong> para de registrar novos cliques, cadastros e comissões
                imediatamente. As conversões e comissões já geradas continuam no histórico e nos relatórios.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={removing}
                onClick={(e) => {
                  e.preventDefault();
                  void handleRemoveAffiliate();
                }}
                className="bg-[#B42318] hover:bg-[#912018]"
              >
                {removing ? "Removendo..." : "Remover afiliado"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>



        {selectedCode ? (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setSelectedCode(null)}
          >
            <aside
              onClick={(event) => event.stopPropagation()}
              className="h-full w-full max-w-[720px] overflow-y-auto border-l border-[#E6EAF2] bg-white text-[#171715] shadow-[0_0_70px_rgba(15,23,42,0.18)]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EEF1F6] bg-white/95 px-6 py-4 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setSelectedCode(null)}
                  className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] transition hover:text-[#171715]"
                >
                  <X size={14} /> Fechar
                </button>
                <span className="text-[13px] font-semibold text-[#171715]">Detalhes do afiliado</span>
              </div>

            <div className="px-6 py-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
                </div>
              ) : !details?.affiliate ? (
                <p className="text-[14px] text-[#777772]">Não foi possível carregar os detalhes.</p>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-[16px] border border-[#E6EAF2] bg-[#F8FAFC] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A8F9B]">Código</p>
                    <p className="mt-1 font-mono text-[16px] font-semibold text-[#171715]">{details.affiliate.code}</p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A8F9B]">Link</p>
                    <a
                      href={details.affiliate.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-2 text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                    >
                      <span className="truncate">{details.affiliate.link}</span>
                      <ExternalLink size={14} strokeWidth={1.5} />
                    </a>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A8F9B]">Criado em</p>
                    <p className="mt-1 text-[13px] text-[#64748B]">{date(details.affiliate.created_at)}</p>
                  </div>

                  {/* Performance do afiliado — mesmos números dos cards do topo, só deste código. */}
                  <div className="rounded-[16px] border border-[#E6EAF2] bg-white p-4">
                    <p className="text-[14px] font-semibold text-[#171715]">Performance</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <MetricCard label="Cliques" value={String(selectedRow?.clicks ?? 0)} />
                      <MetricCard label="Cadastros" value={String(selectedRow?.signups ?? 0)} />
                      <MetricCard
                        label="Comissão pendente"
                        value={money(Number(selectedRow?.commission_pending ?? 0))}
                        highlight="amber"
                      />
                      <MetricCard
                        label="Comissão paga"
                        value={money(Number(selectedRow?.commission_paid ?? 0))}
                        highlight="emerald"
                      />
                    </div>
                  </div>

                  {/* Mesmo formulário mostrado na aba de aprovação de cadastros. */}
                  <div className="rounded-[16px] border border-[#E6EAF2] bg-white p-4">
                    <p className="mb-3 text-[14px] font-semibold text-[#171715]">Cadastro enviado</p>
                    <AffiliateApplicationCard
                      userId={selectedRow?.affiliate_user_id || details.affiliate.user_id || null}
                      code={details.affiliate.code}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => selectedRow && setRowToRemove(selectedRow)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#FBD5D5] bg-white px-4 py-3 text-[13px] font-semibold text-[#B42318] transition hover:bg-[#FEF3F2]"
                  >
                    <Trash2 size={15} /> Remover afiliado
                  </button>


                  <div className="rounded-[16px] border border-[#E6EAF2] bg-white p-4">
                    <p className="text-[14px] font-semibold text-[#171715]">Indicados</p>
                    <p className="mt-1 text-[12px] text-[#777772]">
                      {details.conversions.length} registro(s) — status do funil e comissão gerada.
                    </p>

                    <div className="mt-4 overflow-auto">
                      <table className="w-full min-w-[460px] text-left text-[12px]">
                        <thead>
                          <tr className="border-b border-[#EEF1F6] text-[#8A8F9B]">
                            <Th className="py-2 pl-0">Indicado</Th>
                            <Th className="py-2">Status</Th>
                            <Th className="py-2 text-right">Valor pago</Th>
                            <Th className="py-2 text-right">Comissão</Th>
                            <Th className="py-2 pr-0">Payout</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEF1F6]">
                          {details.conversions.map((c) => (
                            <tr key={c.id} className="text-[#171715] hover:bg-[#F8FAFC]">
                              <Td className="py-3 pl-0">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#171715]">{c.subscriber_name ?? c.subscriber_email ?? c.subscriber_user_id}</p>
                                  <p className="truncate text-[11px] text-[#8A8F9B]">{c.subscriber_email ?? "-"}</p>
                                </div>
                              </Td>
                              <Td className="py-3">
                                <span
                                  className={cn(
                                    "inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold",
                                    c.status === "paid"
                                      ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#087443]"
                                      : c.status === "reached_payment"
                                        ? "border-[#FDE7B2] bg-[#FFF7E6] text-[#B7791F]"
                                        : "border-[#DDE3EE] bg-[#F8FAFC] text-[#64748B]",
                                  )}
                                >
                                  {c.status}
                                </span>
                              </Td>
                              <Td className="py-3 text-right">{money(Number(c.plan_value ?? 0))}</Td>
                              <Td className="py-3 text-right font-semibold">{money(Number(c.commission_value ?? 0))}</Td>
                              <Td className="py-3 pr-0">
                                <span
                                  className={cn(
                                    "inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold",
                                    String(c.payout_status) === "paid"
                                      ? "border-[#BBF7D0] bg-[#ECFDF3] text-[#087443]"
                                      : "border-[#FDE7B2] bg-[#FFF7E6] text-[#B7791F]",
                                  )}
                                >
                                  {c.payout_status}
                                </span>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[#E6EAF2] bg-[#F8FAFC] p-4">
                    <p className="text-[14px] font-semibold text-[#171715]">Visitas</p>
                    <p className="mt-1 text-[12px] text-[#777772]">{details.clicks.length} registro(s) (últimos 200).</p>
                  </div>
                </div>
              )}
            </div>
            </aside>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
};

const MetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string;
  highlight?: "amber" | "emerald";
}) => (
  <AdminKPIStat
    label={label}
    value={<span className="admin-kpi-value">{value}</span>}
  />
);

const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>
);

const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3", className)}>{children}</td>
);

export default AdminCommissionsPage;
