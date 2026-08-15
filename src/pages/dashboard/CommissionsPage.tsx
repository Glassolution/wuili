import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";
import { useTheme } from "next-themes";
import AffiliateFinanceDashboard from "@/components/dashboard/AffiliateFinanceDashboard";
import { AffiliateQuizModal } from "@/pages/dashboard/AffiliateQuizPage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Commission {
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

interface AffiliateLinkResponse {
  code: string | null;
  link: string | null;
  commissionRate?: number;
  isActive?: boolean;
}

// Situação do cadastro enviado pelo candidato a afiliado.
// `null` = nunca enviou; a aprovação em si mora em `affiliates.is_active`.
type AffiliateApplicationState = {
  status: "pending" | "approved" | "rejected" | null;
  agreedTerms: boolean;
};

type AffiliateSourceRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
// A comissão é paga uma única vez, sobre a primeira venda do cliente indicado.
const COMMISSION_RATE = 0.3;
const PLAN_PRICE = 147.9;
const PUBLIC_APP_URL = ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? "https://velods.com.br").replace(/\/+$/, "");
const REFERRAL_BASE_URL = `${PUBLIC_APP_URL}/ref`;
const EMPTY_COMMISSIONS: Commission[] = [];

const statusLabel: Record<Commission["status"], string> = {
  paid: "Pago",
  pending: "Pendente",
};

function formatDate(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString("pt-BR");
}

const normalizeAffiliateCode = (value?: string | null) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

const buildAffiliateUrl = (code: string) => `${REFERRAL_BASE_URL}/${normalizeAffiliateCode(code)}`;

const buildAffiliateCode = (currentUser: { id: string; email?: string | null }) => {
  const emailPrefix = normalizeAffiliateCode(currentUser.email?.split("@")[0] ?? "").slice(0, 4);
  const userSuffix = normalizeAffiliateCode(currentUser.id.replace(/-/g, "")).slice(0, 4);
  return `${emailPrefix || "VELO"}${userSuffix || "0000"}`.slice(0, 8).padEnd(8, "X");
};

const isDuplicateAffiliateCodeError = (error: unknown) => {
  const err = error as { code?: string; message?: string };
  return err?.code === "23505" || String(err?.message ?? "").toLowerCase().includes("duplicate");
};

const mapAffiliateConversionToCommission = (row: AffiliateSourceRow): Commission => {
  const planPrice = Number(row.plan_value ?? row.sale_amount ?? PLAN_PRICE) || PLAN_PRICE;
  const rate = Number(row.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE;
  const commissionValue = Number(row.commission_value ?? planPrice * rate) || planPrice * rate;
  const customerEmail = row.subscriber_email ?? row.referred_email ?? null;
  const customerName = row.subscriber_name || row.referred_name || customerEmail || "Cliente indicado";
  const customerKey = String(row.subscriber_user_id ?? row.referred_user_id ?? customerEmail ?? row.id);
  const rawDate = row.paid_at || row.reached_payment_at || row.signup_at || row.created_at || new Date().toISOString();

  return {
    id: String(row.id),
    order_id: String(row.payment_id ?? row.id),
    value: Number(commissionValue.toFixed(2)),
    percentage: Number((rate * 100).toFixed(0)),
    status: row.commission_status === "paid" || row.payout_status === "paid" || row.status === "paid" ? "paid" : "pending",
    date: formatDate(rawDate),
    rawDate,
    customerName,
    customerEmail,
    customerKey,
    planName: String(row.plan_name ?? row.plan ?? "Pro"),
    saleAmount: Number(planPrice.toFixed(2)),
  };
};

const mapAffiliateSaleToCommission = (row: AffiliateSourceRow): Commission => {
  const planPrice = Number(row.plan_price ?? row.plan_value ?? PLAN_PRICE) || PLAN_PRICE;
  const rate = Number(row.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE;
  const commissionValue = Number(row.commission_amount ?? row.commission_value ?? planPrice * rate) || planPrice * rate;
  const customerName = row.customer_name || row.referred_name || row.customer_email || "Cliente indicado";
  const customerEmail = row.customer_email ?? row.referred_email ?? null;
  const customerKey = String(row.customer_user_id ?? row.referred_user_id ?? customerEmail ?? row.id);
  const rawDate = row.created_at || row.paid_at || new Date().toISOString();
  const planRaw = String(row.plan_name ?? row.plan ?? "Pro");

  return {
    id: String(row.id),
    order_id: String(row.mp_payment_id ?? row.payment_id ?? row.id),
    value: Number(commissionValue.toFixed(2)),
    percentage: Number((rate * 100).toFixed(0)),
    status: row.commission_status === "paid" || row.status === "paid" ? "paid" : "pending",
    date: formatDate(rawDate),
    rawDate,
    customerName,
    customerEmail,
    customerKey,
    planName: planRaw === "mensal" ? "Mensal" : planRaw,
    saleAmount: Number(planPrice.toFixed(2)),
  };
};

const CommissionsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [localCommissions, setLocalCommissions] = useState<Commission[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const queryClient = useQueryClient();
  // As tabelas de afiliados ainda não constam nos tipos gerados do Supabase.
  // Este adaptador concentra o escape temporário até a próxima geração do schema.
  const affiliateDb = supabase as any;

  // -- Influencer affiliate link ------------------------------------------------
  const { data: affiliateLink, isLoading: loadingRef, error: affiliateLinkError } = useQuery({
    queryKey: ["affiliate-link", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return { code: null, link: null };

      const { data: existing, error: readError } = await affiliateDb
        .from("affiliates")
        .select("code, ref, link, commission_rate, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (readError) {
        console.error("[CommissionsPage] affiliates query failed", readError);
        throw new Error("Nao foi possivel buscar seu link de afiliado.");
      }

      if (existing?.code) {
        const code = normalizeAffiliateCode(existing.code);
        const canonicalLink = buildAffiliateUrl(code);
        if (existing.ref !== code || existing.link !== canonicalLink || Number(existing.commission_rate) !== COMMISSION_RATE) {
          const { error: syncError } = await affiliateDb
            .from("affiliates")
            .update({ ref: code, link: canonicalLink, commission_rate: COMMISSION_RATE })
            .eq("user_id", user.id);

          if (syncError) {
            console.warn("[CommissionsPage] nao foi possivel sincronizar link canonico", syncError);
          }
        }
        return {
          code,
          link: canonicalLink,
          commissionRate: COMMISSION_RATE,
          isActive: existing.is_active === true,
        } satisfies AffiliateLinkResponse;
      }

      return {
        code: null,
        link: null,
        commissionRate: COMMISSION_RATE,
        isActive: false,
      } satisfies AffiliateLinkResponse;
    },
    retry: 1,
    // Enquanto a aprovação não sai, revalida sozinho para o painel abrir sem F5.
    refetchInterval: (query) => {
      const current = query.state.data as AffiliateLinkResponse | undefined;
      return current?.isActive === true ? false : 15000;
    },
  });

  // -- Cadastro do afiliado (formulário + aprovação) ----------------------------
  const { data: application, isLoading: loadingApplication } = useQuery<AffiliateApplicationState>({
    queryKey: ["affiliate-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return { status: null, agreedTerms: false };

      const { data: row, error } = await affiliateDb
        .from("affiliate_applications")
        .select("status, agreed_terms")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("[CommissionsPage] nao foi possivel buscar o cadastro de afiliado", error);
        return { status: null, agreedTerms: false };
      }

      const data = row as { status?: string | null; agreed_terms?: boolean | null } | null;
      const agreedTerms = data?.agreed_terms === true;
      const status = (typeof data?.status === "string" ? data.status : agreedTerms ? "pending" : null) as
        AffiliateApplicationState["status"];

      return { status, agreedTerms };
    },
    retry: 1,
  });

  // O painel só abre depois que o admin ativa a conta (affiliates.is_active).
  const isApproved = affiliateLink?.isActive === true;
  const isPendingApproval = !isApproved && application?.agreedTerms === true && application.status !== "rejected";
  const needsApplication = !loadingApplication && !isApproved && !isPendingApproval;
  const checkingAccess = loadingApplication || loadingRef;

  const createAffiliateLink = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Entre na sua conta para criar o link.");
      if (!isApproved) throw new Error("Seu cadastro de afiliado ainda não foi aprovado.");

      const { data: existing, error: readError } = await affiliateDb
        .from("affiliates")
        .select("code, link, commission_rate, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (readError) throw readError;

      if (existing?.code) {
        const existingCode = normalizeAffiliateCode(existing.code);
        return {
          code: existingCode,
          link: buildAffiliateUrl(existingCode),
          commissionRate: Number(existing.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE,
          isActive: existing.is_active === true,
        } satisfies AffiliateLinkResponse;
      }

      const code = buildAffiliateCode({ id: user.id, email: user.email });
      const payload = {
        user_id: user.id,
        code,
        ref: code,
        link: buildAffiliateUrl(code),
        commission_rate: COMMISSION_RATE,
      };

      const { data: inserted, error: insertError } = await affiliateDb
        .from("affiliates")
        .insert(payload)
        .select("code, link, commission_rate, is_active")
        .maybeSingle();

      if (insertError && isDuplicateAffiliateCodeError(insertError)) {
        const fallbackCode = normalizeAffiliateCode(`${code}${user.id.replace(/-/g, "").slice(-4)}`).slice(0, 10);
        const { data: fallbackInserted, error: fallbackError } = await affiliateDb
          .from("affiliates")
          .insert({
            ...payload,
            code: fallbackCode,
            ref: fallbackCode,
            link: buildAffiliateUrl(fallbackCode),
          })
          .select("code, link, commission_rate, is_active")
          .maybeSingle();

        if (fallbackError) {
          console.error("[CommissionsPage] affiliates fallback insert failed", fallbackError);
          throw new Error("Nao foi possivel criar seu link de afiliado.");
        }

        return {
          code: normalizeAffiliateCode(fallbackInserted?.code ?? fallbackCode),
          link: buildAffiliateUrl(fallbackInserted?.code ?? fallbackCode),
          commissionRate: Number(fallbackInserted?.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE,
          isActive: fallbackInserted?.is_active === true,
        } satisfies AffiliateLinkResponse;
      }

      if (insertError) {
        console.error("[CommissionsPage] affiliates insert failed", insertError);
        throw new Error("Nao foi possivel criar seu link de afiliado.");
      }

      return {
        code: normalizeAffiliateCode(inserted?.code ?? code),
        link: buildAffiliateUrl(inserted?.code ?? code),
        commissionRate: Number(inserted?.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE,
        isActive: inserted?.is_active === true,
      } satisfies AffiliateLinkResponse;
    },
    onSuccess: (createdLink) => {
      queryClient.setQueryData(["affiliate-link", user?.id], createdLink);
      veloToast.success("Seu link de afiliado foi criado!");
    },
    onError: (error) => {
      console.error("[CommissionsPage] affiliate link creation failed", error);
      veloToast.error(error instanceof Error ? error.message : "Não foi possível criar seu link.");
    },
  });

  // Fetch affiliate sales for the logged-in influencer
  const { data: initialCommissions = EMPTY_COMMISSIONS, isLoading } = useQuery({
    queryKey: ["affiliate-sales", user?.id, affiliateLink?.code],
    enabled: !!user?.id && !loadingRef && isApproved,
    queryFn: async () => {
      if (!user?.id) return [] as Commission[];

      if (affiliateLink?.code) {
        const { data: conversionData, error: conversionError } = await affiliateDb
          .from("affiliate_conversions")
          .select("*")
          .eq("affiliate_code", affiliateLink.code)
          .order("created_at", { ascending: false });

        if (!conversionError && Array.isArray(conversionData) && conversionData.length > 0) {
          return conversionData.map(mapAffiliateConversionToCommission);
        }

        if (conversionError) {
          console.warn("[CommissionsPage] affiliate_conversions query failed", conversionError);
        }
      }

      const { data, error } = await affiliateDb
        .from("affiliate_sales")
        .select("*")
        .eq("affiliate_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[CommissionsPage] affiliate_sales query failed", error);
        return [] as Commission[];
      }

      return (data || []).map(mapAffiliateSaleToCommission);
    },
  });

  // Sync local state with initial data
  useEffect(() => {
    setLocalCommissions(initialCommissions);
  }, [initialCommissions]);

  // Quem ainda não enviou o cadastro cai direto no formulário.
  useEffect(() => {
    if (needsApplication) setQuizOpen(true);
  }, [needsApplication]);

  const handleQuizClose = () => {
    setQuizOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["affiliate-application", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["affiliate-link", user?.id] });
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    veloToast.success("Link copiado!");
  };

  const handleExport = () => {
    if (localCommissions.length === 0) {
      veloToast.info("Ainda não há comissões para exportar.");
      return;
    }

    const header = ["Data", "Pedido", "Cliente", "E-mail", "Plano", "Valor da venda", "Comissão", "Status"];
    const rows = localCommissions.map((commission) => [
      commission.date,
      commission.order_id,
      commission.customerName,
      commission.customerEmail ?? "",
      commission.planName,
      commission.saleAmount.toFixed(2),
      commission.value.toFixed(2),
      statusLabel[commission.status],
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `comissoes-velo-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    veloToast.success("Relatório exportado com sucesso!");
  };

  const displayName = String(
    user?.user_metadata?.full_name
      ?? user?.user_metadata?.name
      ?? user?.email?.split("@")[0]
      ?? "Afiliado Velo",
  );
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  if (checkingAccess) {
    return <VeloLoadingScreen message="Verificando seu acesso de afiliado..." />;
  }

  if (!isApproved) {
    const rejected = application?.status === "rejected";

    return (
      <>
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
          </header>

          <section className="overflow-hidden rounded-[28px] border border-black/[0.09] bg-white shadow-[0_16px_55px_rgba(35,32,28,0.07)] dark:border-white/10 dark:bg-zinc-950">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#3B7BFF] via-[#2563EB] to-[#1E3A8A] px-7 py-10 text-white sm:px-10">
              <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute -right-28 -top-4 h-64 w-64 rounded-full border border-white/10" />
              <div className="relative max-w-[650px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/85">
                  <Sparkles size={13} /> Programa Velo
                </span>
                <h2 className="mt-5 text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[38px]">
                  {isPendingApproval
                    ? "Seu cadastro está em análise."
                    : rejected
                      ? "Seu cadastro precisa ser reenviado."
                      : "Complete seu cadastro para entrar no programa."}
                </h2>
                <p className="mt-4 max-w-[560px] text-[14px] leading-6 text-white/65">
                  {isPendingApproval
                    ? "Nosso time revisa suas informações e avisa por e-mail assim que o perfil for aprovado. Depois da aprovação, o painel e a criação do seu link de afiliado ficam liberados aqui."
                    : "O painel de afiliado e a criação de links são liberados após a aprovação do seu cadastro pelo time da Velo."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 px-7 py-8 sm:px-10">
              <div className="flex flex-col gap-4 rounded-[22px] border border-black/[0.08] bg-[#FAFAF9] px-6 py-6 dark:border-white/10 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E8EFFF] text-[#2563EB]">
                    {isPendingApproval ? <Clock3 size={20} /> : <Lock size={20} />}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-[#11110F] dark:text-white">
                      {isPendingApproval ? "Solicitação enviada, aguardando aprovação" : "Cadastro de afiliado obrigatório"}
                    </p>
                    <p className="mt-1 text-[13px] text-[#777771] dark:text-zinc-400">
                      {isPendingApproval
                        ? "Você já pode fechar esta página — avisamos por e-mail quando o acesso for liberado."
                        : "Preencha o formulário com seus dados, canais de divulgação e chave Pix."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setQuizOpen(true)}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#0F1117] px-6 text-[13px] font-black text-white transition hover:bg-black/85 dark:bg-white dark:text-black"
                >
                  {isPendingApproval ? "Ver meu cadastro" : rejected ? "Reenviar cadastro" : "Preencher cadastro"}
                </button>
              </div>
            </div>
          </section>
        </div>

        <AffiliateQuizModal open={quizOpen} onClose={handleQuizClose} />
      </>
    );
  }

  return (
    <AffiliateFinanceDashboard
      commissions={localCommissions}
      isLoading={isLoading}
      isDark={isDark}
      affiliateLink={affiliateLink}
      affiliateLoading={loadingRef}
      affiliateError={affiliateLinkError}
      displayName={displayName}
      avatarUrl={avatarUrl}
      onCopyLink={handleCopyLink}
      onCreateLink={() => createAffiliateLink.mutate()}
      creatingLink={createAffiliateLink.isPending}
      onExport={handleExport}
    />
  );

};

export default CommissionsPage;
