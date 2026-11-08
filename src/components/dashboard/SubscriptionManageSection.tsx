import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { useSandboxMode } from "@/lib/sandboxMode";
import { fetchRefundStatus, type RefundAssinatura, type RefundStatus } from "@/lib/refundStatus";
import { PRAZO_DEVOLUCAO, PRAZO_REEMBOLSO } from "@/lib/refundEligibility";

/*
  Página Gerenciar assinatura (/dashboard/configuracoes/central-da-assinatura).

  Aqui ficam só o plano e o cancelamento da renovação. Como a Central de Ajuda,
  ela não tem botão nem link em lugar nenhum do app: só se chega pelo
  endereço, que o suporte envia quando a pessoa pede para cancelar. O pedido de
  reembolso é feito no artigo da Central de Ajuda, por isso esta tela só o
  explica em texto, sem link.
*/

export const SUBSCRIPTION_CENTER_PATH = "/dashboard/configuracoes/central-da-assinatura";

const PLAN_LABEL: Record<string, string> = { go: "Go", base: "Base", plus: "Pro", pro: "Pro", business: "Business" };
const fmtData = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : null);
const fmtValor = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Data de fim do acesso, só se ainda estiver no futuro. */
const fmtAcessoAte = (iso: string | null | undefined) => (iso && new Date(iso).getTime() > Date.now() ? fmtData(iso) : null);
const nomePlano = (a: RefundAssinatura) =>
  `${a.plan ? PLAN_LABEL[a.plan.toLowerCase()] ?? a.plan : "Velo"}${a.purchase_kind === "lifetime" ? " vitalício" : ""}`;

/** Texto fixo que orienta o reembolso pela Central de Ajuda (sem link, de propósito). */
export const RefundHelpNote = ({ className = "" }: { className?: string }) => (
  <p className={`text-[12.5px] leading-[1.55] text-[#71717A] dark:text-zinc-400 ${className}`}>
    Pedidos de reembolso são feitos pela Central de Ajuda. Para receber o link do formulário, fale com o suporte.
  </p>
);

const useSubscriptionStatus = () => {
  const { user, role } = useAuth();
  const [sandboxEnabled] = useSandboxMode(user?.id ?? user?.email ?? null);
  const sandbox = sandboxEnabled && (role === "admin" || isAdminEmail(user?.email));
  const [status, setStatus] = useState<RefundStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      setStatus(await fetchRefundStatus(user.id, sandbox));
    } catch (e) {
      console.error("assinatura", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user, sandbox]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { status, loading, loadError, carregar, setLoading, sandbox };
};

type Passo = "visao" | "cancelar" | "cancelado";

/** Conteúdo da página Gerenciar assinatura. */
const SubscriptionManageSection = () => {
  const { status, loading, loadError, carregar, setLoading, sandbox } = useSubscriptionStatus();
  const [passo, setPasso] = useState<Passo>("visao");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemFinal, setMensagemFinal] = useState("");

  const assinatura = status?.assinatura ?? null;
  const acessoAte = fmtAcessoAte(assinatura?.current_period_end);
  const podeCancelar =
    Boolean(assinatura) && assinatura?.purchase_kind !== "lifetime" && !assinatura?.cancel_at_period_end && status?.mode !== "em_analise";

  const cancelar = async (event: FormEvent) => {
    event.preventDefault();
    if (!assinatura || !motivo.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { subscription_id: assinatura.id, reason: motivo.trim(), reason_details: "" },
      });
      const resposta = data as { success?: boolean; error?: string; message?: string } | null;
      if (error || !resposta?.success) {
        const ctx = (error as { context?: Response } | null)?.context;
        const corpo = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
        setErro(resposta?.error || corpo?.error || "Não foi possível cancelar agora. Tente de novo em instantes.");
        void carregar();
        return;
      }
      setMensagemFinal(String(resposta.message ?? ""));
      setPasso("cancelado");
      veloToast.success("Renovação cancelada.");
      void carregar();
    } catch (e) {
      console.error(e);
      setErro("Não foi possível cancelar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Carregando sua assinatura…</p>;

  if (loadError) {
    return (
      <Caixa>
        <p className="text-[14px] text-[#0A0A0A] dark:text-white">Não conseguimos carregar sua assinatura agora.</p>
        <button
          type="button"
          onClick={() => { setLoading(true); void carregar(); }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          <RefreshCw size={14} aria-hidden="true" /> Tentar de novo
        </button>
      </Caixa>
    );
  }

  if (passo === "cancelado") {
    return (
      <Caixa>
        <CheckCircle2 size={34} strokeWidth={1.8} className="text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-[16px] font-semibold text-[#0A0A0A] dark:text-white">Renovação cancelada</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">
          {mensagemFinal || "Não haverá novas cobranças e você mantém o acesso até o fim do período já pago."}
        </p>
        <button
          type="button"
          onClick={() => setPasso("visao")}
          className="mt-4 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
        >
          Fechar
        </button>
      </Caixa>
    );
  }

  if (passo === "cancelar" && assinatura) {
    return (
      <form onSubmit={cancelar}>
        <Caixa>
          <h2 className="text-[16px] font-semibold text-[#0A0A0A] dark:text-white">Cancelar renovação</h2>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">
            <li>• Não haverá novas cobranças.</li>
            <li>• Você continua usando a Velo até {acessoAte ?? "o fim do período já pago"}.</li>
            <li>• Os anúncios que você já publicou continuam no Mercado Livre.</li>
            <li>• Vale na hora, sem análise. Não há devolução do valor já pago.</li>
          </ul>
          <label className="mt-4 block text-[13px] font-medium text-[#0A0A0A] dark:text-white" htmlFor="motivo-cancelamento">
            Por que você quer cancelar a renovação? <span className="font-normal text-zinc-600 dark:text-zinc-400">(obrigatório)</span>
          </label>
          <textarea
            id="motivo-cancelamento"
            required
            maxLength={2000}
            rows={4}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Escreva o motivo do cancelamento."
            className="mt-1.5 w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-blue-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
          <RefundHelpNote className="mt-3" />
          {erro ? <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{erro}</p> : null}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => { setErro(null); setPasso("visao"); }}
              disabled={enviando}
              className="rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={enviando || !motivo.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-40"
            >
              {enviando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              Confirmar cancelamento
            </button>
          </div>
        </Caixa>
      </form>
    );
  }

  if (!assinatura) {
    return (
      <Caixa>
        <h2 className="text-[16px] font-semibold text-[#0A0A0A] dark:text-white">Você não tem uma assinatura ativa</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">
          Se você foi cobrado e não vê seu plano aqui, fale com o suporte que a equipe verifica para você.
        </p>
        <RefundHelpNote className="mt-3" />
      </Caixa>
    );
  }

  const situacaoReembolso =
    status?.mode === "em_analise"
      ? { icone: <Clock size={18} className="text-amber-600" aria-hidden="true" />, texto: `Você tem um pedido de reembolso em análise. ${PRAZO_REEMBOLSO}` }
      : status?.mode === "aprovado"
        ? { icone: <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />, texto: `Seu reembolso foi aprovado. ${PRAZO_DEVOLUCAO}` }
        : null;

  return (
    <div className="space-y-5">
      {sandbox ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          Sandbox ligado: aqui aparecem só assinaturas de teste.
        </div>
      ) : null}

      <section aria-labelledby="plano-titulo" className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-white/10">
        <h2 id="plano-titulo" className="px-5 py-4 text-sm font-semibold text-zinc-950 dark:text-white">Seu plano</h2>
        <dl className="grid grid-cols-2 gap-px border-t border-zinc-200/80 bg-zinc-200/80 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
          <Item rotulo="Plano" valor={nomePlano(assinatura)} detalhe={fmtValor(assinatura.amount)} />
          <Item rotulo="Contratado em" valor={fmtData(assinatura.created_at) ?? "—"} />
          <Item
            rotulo={assinatura.purchase_kind === "lifetime" ? "Validade" : assinatura.cancel_at_period_end ? "Acesso até" : "Próxima renovação"}
            valor={assinatura.purchase_kind === "lifetime" ? "Sem vencimento" : acessoAte ?? "—"}
          />
        </dl>
      </section>

      {situacaoReembolso ? (
        <div className="flex gap-3 rounded-xl border border-zinc-200 p-4 text-[13px] leading-5 text-[#3F3F46] dark:border-zinc-800 dark:text-zinc-300">
          <span className="mt-0.5 shrink-0">{situacaoReembolso.icone}</span>
          <p>{situacaoReembolso.texto} Você é avisado pelas notificações.</p>
        </div>
      ) : null}

      <section aria-labelledby="renovacao-titulo" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-zinc-200/80 p-5 dark:border-white/10">
        <div className="min-w-0 max-w-md">
          <h2 id="renovacao-titulo" className="text-sm font-semibold text-zinc-950 dark:text-white">Renovação do plano</h2>
          <p className="mt-1 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">
            {assinatura.purchase_kind === "lifetime"
              ? "Seu plano é vitalício: não há renovação nem cobranças futuras."
              : assinatura.cancel_at_period_end
                ? `A renovação já está cancelada. Você mantém o acesso até ${acessoAte ?? "o fim do período já pago"}.`
                : `Você pode interromper as próximas cobranças e manter o acesso até ${acessoAte ?? "o fim do período já pago"}.`}
          </p>
        </div>
        {podeCancelar ? (
          <button
            type="button"
            onClick={() => { setMotivo(""); setErro(null); setPasso("cancelar"); }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 px-4 text-[13px] font-medium text-zinc-800 transition hover:border-[#2563EB] hover:text-[#2563EB] dark:border-zinc-700 dark:text-zinc-200"
          >
            Cancelar renovação <ArrowRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </section>

      <RefundHelpNote />
    </div>
  );
};

const Item = ({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) => (
  <div className="min-w-0 bg-[#FAFAFB] px-5 py-3.5 dark:bg-[#18181B]">
    <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{rotulo}</dt>
    <dd className="mt-1 text-base font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">
      {valor}
      {detalhe ? <span className="mt-0.5 block text-xs font-normal tracking-normal text-zinc-600 dark:text-zinc-400">{detalhe}</span> : null}
    </dd>
  </div>
);

const Caixa = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-[#E5E5E5] p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">{children}</div>
);

export default SubscriptionManageSection;
