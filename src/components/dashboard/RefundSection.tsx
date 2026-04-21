import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { CheckCircle2, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Subscription = {
  id: string;
  plan: string;
  status: string;
  amount: number;
  mp_payment_id: string | null;
  payment_method: string | null;
  created_at: string;
};

type Step = "reason" | "confirm" | "result";
type Result = { kind: "success" | "error"; message: string } | null;

export type RefundSectionHandle = {
  /** Open the refund modal for the most recent eligible subscription. Returns true if opened. */
  openForLatestEligible: () => boolean;
};

const PLAN_LABEL: Record<string, string> = { gratis: "Free", go: "Go", plus: "Plus", pro: "Pro" };
const REASONS = [
  "Não atendeu minhas expectativas",
  "Encontrei outra solução",
  "Está caro para mim",
  "Tive problemas técnicos",
  "Outro",
];

const isEligibleSub = (s: Subscription) => {
  if (s.status !== "active") return false;
  const days = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 7;
};

const RefundSection = forwardRef<RefundSectionHandle>((_, ref) => {
  const { user, session } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Subscription | null>(null);
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("id, plan, status, amount, mp_payment_id, payment_method, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSubs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useImperativeHandle(ref, () => ({
    openForLatestEligible: () => {
      setTimeout(() => {
        document.getElementById("refund-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      const eligible = subs.find(isEligibleSub);
      if (!eligible) return false;
      setActive(eligible);
      setStep("reason");
      setReason(REASONS[0]);
      setDetails("");
      setConfirmed(false);
      setResult(null);
      return true;
    },
  }), [subs]);

  const closeModal = () => {
    setActive(null);
    setStep("reason");
    setReason(REASONS[0]);
    setDetails("");
    setConfirmed(false);
    setProcessing(false);
    setResult(null);
  };

  const submitRefund = async () => {
    if (!active || !session) return;
    setStep("result");
    setProcessing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-refund", {
        body: {
          subscription_id: active.id,
          reason,
          reason_details: reason === "Outro" ? details : null,
        },
      });
      if (error || !data?.success) {
        setResult({ kind: "error", message: data?.error || data?.message || "Erro ao processar." });
      } else {
        setResult({ kind: "success", message: data.message });
        toast.success("Reembolso processado!");
        load();
      }
    } catch (e) {
      setResult({ kind: "error", message: String(e) });
    } finally {
      setProcessing(false);
    }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");
  const fmtMoney = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  const isEligible = isEligibleSub;

  return (
    <div id="refund-section" className="mt-8 pt-8 border-t border-[#F0F0F0]">
      <h3 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Solicitar reembolso</h3>
      <p className="text-[13px] text-[#737373] mb-5">
        Reembolso disponível em até 7 dias após o pagamento.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#737373]"><Loader2 size={14} className="animate-spin" /> Carregando...</div>
      ) : subs.length === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-5 text-[13px] text-[#737373] text-center">
          Você ainda não possui pagamentos.
        </div>
      ) : (
        <div className="space-y-2.5">
          {subs.map((s) => {
            const eligible = isEligible(s);
            const statusLabel =
              s.status === "active" ? "Ativo" :
              s.status === "pending" ? "Pendente" :
              s.status === "cancelled" ? "Cancelado" : s.status;
            const statusCls =
              s.status === "active" ? "bg-black text-white" :
              s.status === "pending" ? "bg-amber-100 text-amber-800" :
              "bg-[#F0F0F0] text-[#737373]";
            return (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E5E5]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#0A0A0A]">Plano {PLAN_LABEL[s.plan] || s.plan}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCls}`}>{statusLabel}</span>
                  </div>
                  <p className="text-[12px] text-[#737373] mt-0.5">{fmtDate(s.created_at)} • {fmtMoney(s.amount)}</p>
                </div>
                {eligible ? (
                  <button
                    onClick={() => setActive(s)}
                    className="text-[12px] px-3.5 py-1.5 rounded-full border border-black text-black hover:bg-black hover:text-white transition-colors font-medium"
                  >
                    Solicitar reembolso
                  </button>
                ) : (
                  <span className="text-[11px] text-[#A3A3A3]">
                    {s.status === "active" ? "Prazo expirado" : "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {active && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mb-5">
              {(["reason", "confirm", "result"] as const).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${
                    step === s || (i < ["reason", "confirm", "result"].indexOf(step)) ? "bg-black" : "bg-[#E5E5E5]"
                  }`}
                />
              ))}
            </div>

            {step === "reason" && (
              <>
                <h4 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Motivo do reembolso</h4>
                <p className="text-[13px] text-[#737373] mb-4">Conte por que está solicitando.</p>
                <div className="space-y-2 mb-4">
                  {REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E5E5] cursor-pointer hover:bg-[#FAFAFA]">
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-black" />
                      <span className="text-[14px] text-[#0A0A0A]">{r}</span>
                    </label>
                  ))}
                </div>
                {reason === "Outro" && (
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Conte mais sobre o motivo..."
                    rows={3}
                    className="w-full p-3 rounded-lg border border-[#E5E5E5] text-[14px] outline-none focus:border-black resize-none mb-4"
                  />
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={closeModal} className="px-5 py-2.5 rounded-full border border-[#E5E5E5] text-[14px] font-medium text-[#737373]">Cancelar</button>
                  <button
                    onClick={() => setStep("confirm")}
                    disabled={reason === "Outro" && !details.trim()}
                    className="px-5 py-2.5 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 disabled:opacity-40"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <h4 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Confirmar reembolso</h4>
                <p className="text-[13px] text-[#737373] mb-4">Última etapa antes de processar.</p>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4 flex gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[13px] text-amber-900">
                    Ao confirmar, seu acesso ao plano será encerrado imediatamente e você voltará ao plano gratuito.
                    O valor de <strong>{fmtMoney(active.amount)}</strong> será creditado em até 7 dias úteis.
                  </div>
                </div>
                <label className="flex items-start gap-3 mb-5 cursor-pointer">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-black" />
                  <span className="text-[13px] text-[#0A0A0A]">Entendo que perderei o acesso ao plano e quero prosseguir.</span>
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setStep("reason")} className="px-5 py-2.5 rounded-full border border-[#E5E5E5] text-[14px] font-medium text-[#737373]">Voltar</button>
                  <button
                    onClick={submitRefund}
                    disabled={!confirmed}
                    className="px-5 py-2.5 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 disabled:opacity-40"
                  >
                    Confirmar reembolso
                  </button>
                </div>
              </>
            )}

            {step === "result" && (
              <div className="text-center py-4">
                {processing && (
                  <>
                    <Loader2 size={42} className="mx-auto animate-spin text-black mb-4" />
                    <p className="text-[14px] text-[#737373]">Processando reembolso...</p>
                  </>
                )}
                {!processing && result?.kind === "success" && (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 size={32} className="text-emerald-600" />
                    </div>
                    <h4 className="text-[18px] font-bold text-emerald-700 mb-1">Reembolso aprovado</h4>
                    <p className="text-[13px] text-[#737373] mb-5">{result.message}</p>
                    <button onClick={closeModal} className="px-6 py-2.5 rounded-full bg-black text-white text-[14px] font-medium">Fechar</button>
                  </>
                )}
                {!processing && result?.kind === "error" && (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                      <XCircle size={32} className="text-red-600" />
                    </div>
                    <h4 className="text-[18px] font-bold text-red-700 mb-1">Não foi possível processar</h4>
                    <p className="text-[13px] text-[#737373] mb-2">{result.message}</p>
                    <p className="text-[12px] text-[#737373] mb-5">
                      Entre em contato: <a href="mailto:contato@velo.com.br" className="underline text-black">contato@velo.com.br</a>
                    </p>
                    <button onClick={closeModal} className="px-6 py-2.5 rounded-full bg-black text-white text-[14px] font-medium">Fechar</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

RefundSection.displayName = "RefundSection";

export default RefundSection;
