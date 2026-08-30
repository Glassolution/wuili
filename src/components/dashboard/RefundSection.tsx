import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle, AlertTriangle, MessageCircle, Clock } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
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
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type Step = "reason" | "details" | "confirm" | "result";
type Mode = "refund" | "cancel";
type Result = { kind: "success" | "error"; message: string } | null;


const PLAN_LABEL: Record<string, string> = {
  gratis: "Free", go: "Go", plus: "Pro", pro: "Pro", business: "Business",
};

const REASONS = [
  "Não entendi como usar a plataforma",
  "Não era o que eu esperava",
  "Preço muito alto",
  "Tive problemas técnicos",
  "Vou pausar por agora",
  "Outro motivo",
];

const MIN_DETAILS = 30;

const RefundSection = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [hasAnyRefund, setHasAnyRefund] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Subscription | null>(null);
  const [mode, setMode] = useState<Mode>("refund");
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("id, plan, status, amount, mp_payment_id, payment_method, created_at, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSubs(data || []);
    const { data: allRefunds } = await supabase
      .from("refund_requests")
      .select("subscription_id, status")
      .eq("user_id", user.id);
    const list = allRefunds || [];
    const REJECTED = ["rejected", "denied", "cancelled", "canceled"];
    // Pedidos recusados não bloqueiam uma nova solicitação
    setHasAnyRefund(list.some((r: any) => !REJECTED.includes(String(r.status ?? "").toLowerCase())));
    setPendingIds(new Set(list.filter((r: any) => r.status === "pending").map((r: any) => r.subscription_id)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openFlow = (s: Subscription, m: Mode) => {
    setActive(s); setMode(m); setStep("reason"); setReason(""); setDetails("");
    setProcessing(false); setResult(null);
  };

  const closeModal = () => {
    setActive(null); setStep("reason"); setReason(""); setDetails("");
    setProcessing(false); setResult(null);
  };

  const submitRefund = async () => {
    if (!active || !session) return;
    setStep("result");
    setProcessing(true); setResult(null);
    try {
      const fn = mode === "cancel" ? "cancel-subscription" : "request-refund";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { subscription_id: active.id, reason, reason_details: details.trim() },
      });
      if (error || !data?.success) {
        setResult({ kind: "error", message: data?.error || data?.message || "Erro ao enviar solicitação." });
      } else {
        setResult({ kind: "success", message: data.message });
        veloToast.success(mode === "cancel" ? "Assinatura cancelada." : "Solicitação recebida!");
        load();
      }
    } catch (e) {
      setResult({ kind: "error", message: String(e) });
    } finally {

      setProcessing(false);
    }
  };

  const openSupportChat = async () => {
    if (!user || !active) return;
    try {
      // Cria ticket e envia primeira mensagem com contexto
      const { data: ticket, error: tErr } = await (supabase as any)
        .from("support_tickets")
        .insert({ user_id: user.id, status: "open", ai_active: false })
        .select("id")
        .single();
      if (tErr) throw tErr;
      const ctx = `Olá, estou pensando em cancelar minha assinatura.\n\nMotivo: ${reason}\n\nDetalhes: ${details.trim()}`;
      await (supabase as any).from("support_messages").insert({
        ticket_id: ticket.id, user_id: user.id, sender: "user", message: ctx,
      });
      veloToast.success("Conectando você ao suporte...");
      closeModal();
      navigate("/dashboard/configuracoes?tab=Suporte");
    } catch (e) {
      console.error(e);
      veloToast.error("Não foi possível abrir o chat de suporte.");
    }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");
  const fmtMoney = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  const isEligible = (s: Subscription) => {
    if (s.status !== "active") return false;
    const days = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  };

  const detailsOk = details.trim().length >= MIN_DETAILS;

  return (
    <div className="mt-8 pt-8 border-t border-[#F0F0F0] dark:border-white/10">
      <h3 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Cancelar assinatura / reembolso</h3>
      <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">
        Nos primeiros 7 dias após o pagamento você pode pedir reembolso — a assinatura é cancelada junto (análise em até 48h).
        Depois desse prazo é possível cancelar a renovação, mantendo o acesso até o fim do período já pago, sem devolução do valor.
      </p>


      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#737373] dark:text-zinc-400"><Loader2 size={14} className="animate-spin" /> Carregando...</div>
      ) : subs.length === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-5 text-[13px] text-[#737373] text-center dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Você ainda não possui pagamentos.
        </div>
      ) : (
        <div className="space-y-2.5">
          {hasAnyRefund && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Você já possui uma solicitação de reembolso em análise ou processada. Novas solicitações não são permitidas.
            </div>
          )}
          {subs.map((s) => {
            const eligible = isEligible(s) && !hasAnyRefund;
            const pending = pendingIds.has(s.id);
            const daysActive = Math.max(0, Math.floor((Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)));
            const statusLabel = s.status === "active" ? "Ativo" : s.status === "pending" ? "Pendente" : s.status === "cancelled" ? "Cancelado" : s.status;
            const statusCls =
              s.status === "active" ? "bg-black text-white dark:bg-white dark:text-black"
              : s.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
              : "bg-[#F0F0F0] text-[#737373] dark:bg-zinc-800 dark:text-zinc-300";
            return (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white">Plano {PLAN_LABEL[s.plan] || s.plan}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCls}`}>{statusLabel}</span>
                    {s.status === "active" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#F0F0F0] text-[#525252] dark:bg-zinc-800 dark:text-zinc-300">
                        {daysActive} {daysActive === 1 ? "dia ativo" : "dias ativo"}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#737373] dark:text-zinc-400 mt-0.5">{fmtDate(s.created_at)} • {fmtMoney(s.amount)}</p>
                </div>
                {pending ? (
                  <span className="text-[11px] inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                    <Clock size={12} /> Em análise
                  </span>
                ) : s.cancel_at_period_end ? (
                  <span className="text-[11px] text-[#A3A3A3] dark:text-zinc-500 text-right">
                    Cancelada{s.current_period_end ? ` — acesso até ${fmtDate(s.current_period_end)}` : ""}
                  </span>
                ) : eligible ? (
                  <button
                    onClick={() => openFlow(s, "refund")}
                    className="text-[12px] px-3.5 py-1.5 rounded-full border border-black text-black hover:bg-black hover:text-white transition-colors font-medium dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                  >
                    Cancelar e pedir reembolso
                  </button>
                ) : s.status === "active" ? (
                  <button
                    onClick={() => openFlow(s, "cancel")}
                    className="text-[12px] px-3.5 py-1.5 rounded-full border border-[#E5E5E5] text-[#525252] hover:border-black hover:text-black transition-colors font-medium dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white"
                  >
                    Cancelar assinatura
                  </button>
                ) : (
                  <span className="text-[11px] text-[#A3A3A3] dark:text-zinc-500">—</span>
                )}
              </div>

            );
          })}
        </div>

      )}

      {/* Modal */}
      {active && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 dark:border dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 mb-5">
              {(["reason", "details", "confirm", "result"] as const).map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full ${
                  step === s || (i < ["reason","details","confirm","result"].indexOf(step)) ? "bg-black dark:bg-white" : "bg-[#E5E5E5] dark:bg-zinc-700"
                }`} />
              ))}
            </div>

            {step === "reason" && (
              <>
                <h4 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Por que está cancelando?</h4>
                <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-4">Selecione a opção que melhor descreve seu motivo.</p>
                <div className="space-y-2 mb-4">
                  {REASONS.map((r) => (
                    <label key={r} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      reason === r ? "border-black bg-[#FAFAFA] dark:border-white dark:bg-zinc-800" : "border-[#E5E5E5] hover:bg-[#FAFAFA] dark:border-zinc-800 dark:hover:bg-zinc-800"
                    }`}>
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-black" />
                      <span className="text-[14px] text-[#0A0A0A] dark:text-white">{r}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={closeModal} className="px-5 py-2.5 rounded-full border border-[#E5E5E5] text-[14px] font-medium text-[#737373] dark:border-zinc-700 dark:text-zinc-300">Cancelar</button>
                  <button onClick={() => setStep("details")} disabled={!reason}
                    className="px-5 py-2.5 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 disabled:opacity-40 dark:bg-white dark:text-black">
                    Continuar
                  </button>
                </div>
              </>
            )}

            {step === "details" && (
              <>
                <h4 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Conte-nos mais sobre o motivo</h4>
                <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-4">Isso nos ajuda a melhorar. Mínimo {MIN_DETAILS} caracteres.</p>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Explique com suas palavras..."
                  rows={5}
                  className="w-full p-3 rounded-lg border border-[#E5E5E5] text-[14px] outline-none focus:border-black resize-none mb-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white"
                />
                <p className={`text-[11px] mb-4 ${detailsOk ? "text-emerald-600" : "text-[#A3A3A3]"}`}>
                  {details.trim().length}/{MIN_DETAILS} caracteres {detailsOk ? "✓" : ""}
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setStep("reason")} className="px-5 py-2.5 rounded-full border border-[#E5E5E5] text-[14px] font-medium text-[#737373] dark:border-zinc-700 dark:text-zinc-300">Voltar</button>
                  <button onClick={() => setStep("confirm")} disabled={!detailsOk}
                    className="px-5 py-2.5 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 disabled:opacity-40 dark:bg-white dark:text-black">
                    Continuar
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <h4 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Antes de confirmar...</h4>
                <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-4">
                  Talvez possamos ajudar. Que tal conversar com um humano antes de cancelar?
                </p>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-5 flex gap-3 dark:bg-amber-500/10 dark:border-amber-500/30">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[13px] text-amber-900 dark:text-amber-200">
                    {mode === "cancel" ? (
                      <>
                        O prazo de 7 dias para reembolso já expirou, então <strong>não haverá devolução</strong> do valor pago.
                        Ao confirmar, sua assinatura <strong>não será renovada</strong> e você mantém o acesso
                        {active.current_period_end ? <> até <strong>{fmtDate(active.current_period_end)}</strong></> : <> até o fim do período já pago</>}.
                      </>
                    ) : (
                      <>
                        Ao confirmar, sua assinatura é <strong>cancelada</strong> e o pedido de reembolso será analisado em até <strong>48 horas</strong>. Se aprovado, o valor de <strong>{fmtMoney(active.amount)}</strong> será estornado no cartão e pode levar até <strong>30 dias</strong> para aparecer na fatura (prazo do banco emissor). Suas publicações no Mercado Livre serão removidas.
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button onClick={openSupportChat}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-black text-white text-[14px] font-semibold hover:opacity-85 dark:bg-white dark:text-black">
                    <MessageCircle size={16} /> Falar com suporte antes
                  </button>
                  <button onClick={submitRefund}
                    className="w-full px-5 py-2.5 rounded-full border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10">
                    Confirmar cancelamento mesmo assim
                  </button>
                  <button onClick={() => setStep("details")} className="w-full text-[12px] text-[#737373] dark:text-zinc-400 mt-1">Voltar</button>
                </div>
              </>
            )}

            {step === "result" && (
              <div className="text-center py-4">
                {processing && (
                  <>
                    <Loader2 size={42} className="mx-auto animate-spin text-black dark:text-white mb-4" />
                    <p className="text-[14px] text-[#737373] dark:text-zinc-400">Enviando solicitação...</p>
                  </>
                )}
                {!processing && result?.kind === "success" && (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                      <Clock size={32} className="text-amber-600" />
                    </div>
                    <h4 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Solicitação recebida</h4>
                    <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">{result.message}</p>
                    <button onClick={closeModal} className="px-6 py-2.5 rounded-full bg-black text-white text-[14px] font-medium dark:bg-white dark:text-black">Fechar</button>
                  </>
                )}
                {!processing && result?.kind === "error" && (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                      <XCircle size={32} className="text-red-600" />
                    </div>
                    <h4 className="text-[18px] font-semibold text-red-700 mb-1">Não foi possível enviar</h4>
                    <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">{result.message}</p>
                    <button onClick={closeModal} className="px-6 py-2.5 rounded-full bg-black text-white text-[14px] font-medium dark:bg-white dark:text-black">Fechar</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundSection;
