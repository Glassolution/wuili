import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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

const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("pt-BR") : "-");
const isMissingRpcError = (error: unknown) =>
  /could not find the function/i.test(String((error as any)?.message ?? error ?? ""));
const PUBLIC_APP_URL = ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? "https://velods.com.br").replace(/\/+$/, "");
const normalizeAffiliateCode = (value?: string | null) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
const buildAffiliateUrl = (code: string) => `${PUBLIC_APP_URL}/ref/${normalizeAffiliateCode(code)}`;
const canonicalizeAffiliateRow = (row: AffiliateRow): AffiliateRow => {
  const code = normalizeAffiliateCode(row.code);
  return { ...row, code, link: buildAffiliateUrl(code) };
};
const canonicalizeAffiliateDetails = (data: AffiliateDetails): AffiliateDetails => {
  if (!data?.affiliate) return data;
  const code = normalizeAffiliateCode(data.affiliate.code);
  return {
    ...data,
    affiliate: {
      ...data.affiliate,
      code,
      link: buildAffiliateUrl(code),
    },
  };
};

const AdminCommissionsPage = () => {
  const { user, loading: loadingAuth, role } = useAuth();
  const ADMIN_EMAILS = useMemo(() => new Set(["xavierluisfelipe12@gmail.com"]), []);
  const isAdmin = role === "admin" || (!!user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()));
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const { data: affiliates = [], isLoading, error } = useQuery({
    queryKey: ["admin-affiliate-commissions"],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any).rpc("rpc_admin_affiliates_summary");
        if (error) throw error;
        return ((data ?? []) as AffiliateRow[]).map(canonicalizeAffiliateRow);
      } catch (e) {
        if (!isMissingRpcError(e)) throw e;

        const [affRes, clicksRes, convRes, profRes] = await Promise.all([
          (supabase as any).from("affiliates").select("code, user_id, link, created_at").order("created_at", { ascending: false }),
          (supabase as any).from("affiliate_clicks").select("affiliate_code"),
          (supabase as any).from("affiliate_conversions").select("*"),
          (supabase as any).from("profiles").select("id,user_id,display_name,created_at"),
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
        const { data, error } = await (supabase as any).rpc("rpc_admin_affiliate_details", {
          p_affiliate_code: selectedCode,
        });
        if (error) throw error;
        return canonicalizeAffiliateDetails(data as AffiliateDetails);
      } catch (e) {
        if (!isMissingRpcError(e)) throw e;

        const code = normalizeAffiliateCode(selectedCode);
        const [affRes, clicksRes, convRes, profRes] = await Promise.all([
          (supabase as any).from("affiliates").select("user_id, code, link, commission_rate, created_at").eq("code", code).maybeSingle(),
          (supabase as any).from("affiliate_clicks").select("created_at, referrer, user_agent").eq("affiliate_code", code).order("created_at", { ascending: false }).limit(200),
          (supabase as any)
            .from("affiliate_conversions")
            .select("*")
            .eq("affiliate_code", code)
            .order("created_at", { ascending: false })
            .limit(200),
          (supabase as any).from("profiles").select("id,user_id,display_name"),
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

  const totals = useMemo(() => {
    const out = {
      totalAffiliates: affiliates.length,
      clicks: 0,
      signups: 0,
      reachedPayment: 0,
      payers: 0,
      commissionPending: 0,
      commissionPaid: 0,
    };
    for (const row of affiliates) {
      out.clicks += Number(row.clicks ?? 0);
      out.signups += Number(row.signups ?? 0);
      out.reachedPayment += Number(row.reached_payment ?? 0);
      out.payers += Number(row.payers ?? 0);
      out.commissionPending += Number(row.commission_pending ?? 0);
      out.commissionPaid += Number(row.commission_paid ?? 0);
    }
    return out;
  }, [affiliates]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AdminShell active="commissions" userId={user.id}>
      <div className="min-h-full bg-transparent text-white">
        <header className="flex flex-col gap-3 border-b border-white/[0.08] pb-6">
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-white">Comissões</h1>
          <p className="text-[13px] text-[#8A8A8E]">Rastreie o funil completo por afiliado (visitas, cadastros e pagamentos).</p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 border-b border-white/[0.08]">
          <MetricCard label="Total de afiliados" value={String(totals.totalAffiliates)} className="py-6 pr-4 pl-0" />
          <MetricCard label="Cliques" value={String(totals.clicks)} className="py-6 px-4 border-l border-white/[0.08]" />
          <MetricCard label="Cadastros" value={String(totals.signups)} className="py-6 px-4 border-l border-white/[0.08]" />
          <MetricCard label="No pagamento" value={String(totals.reachedPayment)} className="py-6 px-4 border-l border-white/[0.08]" />
          <MetricCard label="Pagantes" value={String(totals.payers)} className="py-6 px-4 border-l border-white/[0.08]" />
          <MetricCard label="Comissão pendente" value={money(totals.commissionPending)} highlight="amber" className="py-6 px-4 border-l border-white/[0.08]" />
          <MetricCard label="Comissão paga" value={money(totals.commissionPaid)} highlight="emerald" className="py-6 pl-4 pr-0 border-l border-white/[0.08]" />
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-[14px] text-[#8A8A8E] font-normal uppercase tracking-[0.10em]">Afiliados</h2>
            {error && <p className="text-[13px] text-red-400">Erro ao carregar: {String((error as any)?.message ?? error)}</p>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-white/60" />
            </div>
          ) : affiliates.length === 0 ? (
            <div className="py-10 text-[14px] text-[#8A8A8E]">Nenhum afiliado encontrado.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1220px] text-left text-[13px]">
                <thead className="border-b border-white/[0.08] text-[11px] font-medium uppercase tracking-[0.12em] text-[#8A8A8E]">
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
                <tbody className="divide-y divide-white/[0.08]">
                  {affiliates.map((row) => (
                    <tr key={row.code} className="hover:bg-white/[0.01]">
                      <Td className="font-medium text-white">{row.affiliate_name ?? row.affiliate_user_id}</Td>
                      <Td className="text-[#8A8A8E]">{row.affiliate_email ?? "-"}</Td>
                      <Td className="font-mono text-[12px] font-semibold text-white">{row.code}</Td>
                      <Td>
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-white/70 hover:text-white"
                        >
                          <span className="max-w-[260px] truncate">{row.link}</span>
                          <ExternalLink size={14} strokeWidth={1.5} />
                        </a>
                      </Td>
                      <Td className="text-right text-white">{row.clicks ?? 0}</Td>
                      <Td className="text-right text-white">{row.signups ?? 0}</Td>
                      <Td className="text-right text-white">{row.reached_payment ?? 0}</Td>
                      <Td className="text-right text-white">{row.payers ?? 0}</Td>
                      <Td className="text-right font-semibold text-amber-300">{money(Number(row.commission_pending ?? 0))}</Td>
                      <Td className="text-right font-semibold text-white">{money(Number(row.commission_paid ?? 0))}</Td>
                      <Td className="text-[#8A8A8E]">{date(row.created_at)}</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => setSelectedCode(row.code)}
                          className="rounded-lg border border-white/[0.08] bg-[#161617] px-3 py-2 text-[12px] font-semibold text-[#8A8A8E] hover:text-white transition"
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

        <Sheet open={!!selectedCode} onOpenChange={(open) => (!open ? setSelectedCode(null) : null)}>
          <SheetContent side="right" className="w-[min(540px,90vw)] border-white/[0.08] bg-[#161617] text-white">
            <SheetHeader>
              <SheetTitle className="text-white text-[16px] font-semibold">Detalhes do afiliado</SheetTitle>
            </SheetHeader>

            <div className="mt-5">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-white/60" />
                </div>
              ) : !details?.affiliate ? (
                <p className="text-[14px] text-[#8A8A8E]">Não foi possível carregar os detalhes.</p>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-[12px] text-[#8A8A8E]">Código</p>
                    <p className="mt-1 font-mono text-[16px] font-semibold text-white">{details.affiliate.code}</p>
                    <p className="mt-3 text-[12px] text-[#8A8A8E]">Link</p>
                    <a
                      href={details.affiliate.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-2 text-[13px] text-white/80 hover:text-white"
                    >
                      <span className="truncate">{details.affiliate.link}</span>
                      <ExternalLink size={14} strokeWidth={1.5} />
                    </a>
                    <p className="mt-3 text-[12px] text-[#8A8A8E]">Criado em</p>
                    <p className="mt-1 text-[13px] text-[#8A8A8E]">{date(details.affiliate.created_at)}</p>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-[14px] font-semibold text-white">Indicados</p>
                    <p className="mt-1 text-[12px] text-[#8A8A8E]">
                      {details.conversions.length} registro(s) — status do funil e comissão gerada.
                    </p>

                    <div className="mt-4 overflow-auto">
                      <table className="w-full min-w-[460px] text-left text-[12px]">
                        <thead>
                          <tr className="text-[#8A8A8E] border-b border-white/[0.08]">
                            <Th className="py-2 pl-0">Indicado</Th>
                            <Th className="py-2">Status</Th>
                            <Th className="py-2 text-right">Valor pago</Th>
                            <Th className="py-2 text-right">Comissão</Th>
                            <Th className="py-2 pr-0">Payout</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.08]">
                          {details.conversions.map((c) => (
                            <tr key={c.id} className="text-white hover:bg-white/[0.01]">
                              <Td className="py-3 pl-0">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-white">{c.subscriber_name ?? c.subscriber_email ?? c.subscriber_user_id}</p>
                                  <p className="truncate text-[11px] text-[#8A8A8E]">{c.subscriber_email ?? "-"}</p>
                                </div>
                              </Td>
                              <Td className="py-3">
                                <span
                                  className={cn(
                                    "inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold",
                                    c.status === "paid"
                                      ? "border-white/15 bg-white/[0.06] text-white"
                                      : c.status === "reached_payment"
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                        : "border-white/10 bg-white/[0.03] text-white/70",
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
                                      ? "border-white/15 bg-white/[0.06] text-white"
                                      : "border-amber-500/30 bg-amber-500/10 text-amber-300",
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

                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-[14px] font-semibold text-white">Visitas</p>
                    <p className="mt-1 text-[12px] text-[#8A8A8E]">{details.clicks.length} registro(s) (últimos 200).</p>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminShell>
  );
};

const MetricCard = ({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: "amber" | "emerald";
  className?: string;
}) => (
  <div className={cn("flex flex-col justify-between", className)}>
    <p className="text-[12px] font-normal uppercase tracking-[0.10em] text-[#8A8A8E]">{label}</p>
    <p
      className={cn(
        "mt-3 text-[26px] font-semibold tracking-[-0.02em] text-white leading-none",
        highlight === "amber" && "text-amber-300",
        highlight === "emerald" && "text-white",
      )}
    >
      {value}
    </p>
  </div>
);

const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>
);

const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3", className)}>{children}</td>
);

export default AdminCommissionsPage;
