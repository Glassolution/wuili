import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronDown, Clock, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { useSandboxMode } from "@/lib/sandboxMode";
import { openSupportChat } from "@/lib/support";
import {
  createLocalSandboxRefund,
  getLocalSandboxRefunds,
  getLocalSandboxSubscriptions,
  listenLocalSandboxData,
} from "@/lib/localSandbox";
import { fetchRefundStatus, type RefundAssinatura, type RefundStatus } from "@/lib/refundStatus";
import {
  getRefundMode,
  PRAZO_DEVOLUCAO,
  PRAZO_REEMBOLSO,
  REFUND_WINDOW_DAYS,
  refundDaysUsed,
} from "@/lib/refundEligibility";

/*
 * Único lugar onde o cliente pede reembolso ou cancela a renovação da assinatura
 * (Configurações → Perfil, âncora #velo-reembolso). A IA do chat só aponta para cá.
 *
 * Regra (supabase/functions/_shared/refundPolicy.ts, a mesma do servidor):
 * - até 7 dias do pagamento: pedido de reembolso, analisado pela equipe em /admin/reembolsos;
 * - depois disso: o próprio cliente cancela a renovação, sem passar pela equipe.
 *
 * Fluxo: linha "Garantia de 7 dias" → visão da conta (uso, produtos, vendas) →
 * "Solicitar reembolso" (motivo + oferta de ajuda) → enviado.
 * Nenhum campo de texto é obrigatório e a ajuda é só oferecida, nunca exigida.
 */

const PLAN_LABEL: Record<string, string> = {
  gratis: "Free", go: "Go", base: "Base", plus: "Pro", pro: "Pro", business: "Business",
};

const MOTIVOS = [
  "Não consegui vender",
  "Não entendi como usar a plataforma",
  "Tive problemas técnicos",
  "Achei caro",
  "Estou sem tempo",
  "Não era o que eu esperava",
  "Outro motivo",
];

/** Sugestão de ajuda conforme o motivo. Só sugere: o botão de enviar continua liberado. */
const AJUDA_POR_MOTIVO: Record<string, string> = {
  "Não consegui vender": "Vender costuma levar alguns dias de anúncio no ar. Os tutoriais mostram como deixar o anúncio mais atraente.",
  "Não entendi como usar a plataforma": "A Central de Ajuda tem o passo a passo de cada parte, e o suporte pode te guiar pelo chat.",
  "Tive problemas técnicos": "Conte o que aconteceu para o suporte pelo chat. Muitas vezes dá para resolver na hora.",
};

type Passo = "visao" | "reembolso" | "cancelar" | "enviado";
type Acao = "reembolso" | "cancelamento";
type UsoDaConta = { publicados: number | null; ativos: number | null; vendas: number | null };

const fmtData = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : null);
const fmtValor = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Data de fim do acesso, só se ainda estiver no futuro (há assinaturas com período vencido e status ativo). */
const fmtAcessoAte = (iso: string | null | undefined) =>
  iso && new Date(iso).getTime() > Date.now() ? fmtData(iso) : null;
const nomePlano = (plan: string | null) => (plan ? PLAN_LABEL[plan.toLowerCase()] ?? plan : "Velo");
const fimDoPrazo = (createdAt: string) =>
  fmtData(new Date(new Date(createdAt).getTime() + REFUND_WINDOW_DAYS * 86_400_000).toISOString());
const fmtNumero = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const carregarUso = async (userId: string): Promise<UsoDaConta> => {
  const [publicados, ativos, vendas] = await Promise.all([
    supabase.from("user_publications").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_publications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return {
    publicados: publicados.error ? null : publicados.count ?? 0,
    ativos: ativos.error ? null : ativos.count ?? 0,
    vendas: vendas.error ? null : vendas.count ?? 0,
  };
};

/**
 * `perfil`: só dentro da garantia de 7 dias (ou com pedido em análise/aprovado).
 * `plano`: só depois dos 7 dias, para cancelar a renovação.
 */
type Local = "perfil" | "plano";
const MODOS_VISIVEIS: Record<Local, string[]> = {
  perfil: ["reembolso", "em_analise", "aprovado"],
  plano: ["cancelamento", "cancelado"],
};
const ANCORA: Record<Local, string> = { perfil: "#velo-reembolso", plano: "#velo-cancelar-renovacao" };

const RefundSection = ({ local = "perfil" }: { local?: Local }) => {
  const { user, role } = useAuth();
  const location = useLocation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [sandboxEnabled] = useSandboxMode(user?.id ?? user?.email ?? null);
  const sandbox = sandboxEnabled && (role === "admin" || isAdminEmail(user?.email));
  const sandboxLocal = sandbox && import.meta.env.DEV;
  const sandboxKey = user?.id ?? user?.email ?? null;

  const [status, setStatus] = useState<RefundStatus | null>(null);
  const [uso, setUso] = useState<UsoDaConta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<Passo>("visao");
  const [acao, setAcao] = useState<Acao>("reembolso");
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemFinal, setMensagemFinal] = useState("");

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      if (sandboxLocal) {
        const subs = getLocalSandboxSubscriptions(sandboxKey);
        const ativa = subs.find((s) => s.status === "active") ?? null;
        const assinatura: RefundAssinatura | null = ativa ? { ...ativa, purchase_kind: null } : null;
        setStatus({ mode: getRefundMode(assinatura, getLocalSandboxRefunds(sandboxKey)), assinatura });
      } else {
        setStatus(await fetchRefundStatus(user.id, sandbox));
      }
    } catch (e) {
      console.error("refund status", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user, sandbox, sandboxLocal, sandboxKey]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!sandboxLocal) return;
    return listenLocalSandboxData(() => void carregar());
  }, [sandboxLocal, carregar]);

  // Os números da conta só são buscados quando o cliente abre a garantia.
  useEffect(() => {
    if (!aberto || uso || !user) return;
    carregarUso(user.id)
      .then(setUso)
      .catch(() => setUso({ publicados: null, ativos: null, vendas: null }));
  }, [aberto, uso, user]);

  // Links do chat e da Central de Ajuda chegam com #velo-reembolso: já abre a visão da conta.
  useEffect(() => {
    if (loading || location.hash !== ANCORA[local]) return;
    setAberto(true);
    // Espera o restante do Perfil carregar; senão a página cresce depois e a rolagem se perde.
    const t = window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 600);
    return () => window.clearTimeout(t);
  }, [loading, location.hash, location.key, local]);

  const assinatura = status?.assinatura ?? null;
  // No sandbox o admin testa o reembolso mesmo fora dos 7 dias (o servidor também libera).
  const modo = sandbox && status?.mode === "cancelamento" ? "reembolso" : status?.mode;
  const dentroDaGarantia = modo === "reembolso";
  const motivoFinal = motivo === "Outro motivo" ? `Outro: ${outro.trim()}` : motivo;
  const motivoOk = Boolean(motivo) && (motivo !== "Outro motivo" || outro.trim().length >= 3);

  const comecar = (nova: Acao) => {
    setAcao(nova);
    setMotivo("");
    setOutro("");
    setDetalhes("");
    setErro(null);
    setPasso(nova === "reembolso" ? "reembolso" : "cancelar");
  };

  const voltar = () => {
    setErro(null);
    setPasso("visao");
  };

  const confirmar = async () => {
    if (!assinatura) return;
    setEnviando(true);
    setErro(null);
    try {
      if (acao === "reembolso" && sandboxLocal) {
        createLocalSandboxRefund(sandboxKey, assinatura.id, motivoFinal, detalhes.trim());
        setMensagemFinal("");
        setPasso("enviado");
        return;
      }
      const fn = acao === "reembolso" ? "request-refund" : "cancel-subscription";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: {
          subscription_id: assinatura.id,
          reason: motivoFinal || "Cancelamento da renovação",
          reason_details: detalhes.trim(),
          sandbox: acao === "reembolso" && sandbox,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta simples da função
      const resposta = data as any;
      if (error || !resposta?.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FunctionsHttpError carrega a Response
        const ctx = (error as any)?.context;
        const corpo = ctx?.json ? await ctx.json().catch(() => null) : null;
        setErro(resposta?.error || corpo?.error || "Não foi possível enviar agora. Tente de novo em instantes.");
        // A situação pode ter mudado (ex.: o prazo venceu): recarrega para mostrar o caminho certo.
        void carregar();
        return;
      }
      setMensagemFinal(acao === "cancelamento" ? String(resposta.message ?? "") : "");
      setPasso("enviado");
      veloToast.success(acao === "reembolso" ? "Pedido de reembolso enviado." : "Renovação cancelada.");
    } catch (e) {
      console.error(e);
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  const concluir = () => {
    setPasso("visao");
    void carregar();
  };

  const prazoAte = assinatura ? fimDoPrazo(assinatura.created_at) : null;
  const acessoAte = fmtAcessoAte(assinatura?.current_period_end);
  const titulo = dentroDaGarantia ? "Garantia de 7 dias" : "Encerrar assinatura";
  const descricao = loading
    ? "Carregando sua assinatura..."
    : dentroDaGarantia
      ? `Não ficou satisfeito com a Velo? Veja como está sua conta e as opções até ${prazoAte}.`
      : status?.mode === "em_analise"
        ? "Você tem um pedido em análise pela nossa equipe."
        : "Veja como está sua conta e cancele a renovação quando quiser.";

  // Enquanto carrega, ou se esta aba não é a da situação atual, a seção não aparece.
  // A tela de "enviado" continua visível mesmo que a situação mude depois do envio.
  const visivel =
    passo === "enviado" ||
    (!loading && (loadError ? local === "perfil" : Boolean(modo && MODOS_VISIVEIS[local].includes(modo))));
  if (!visivel) return null;

  return (
    <div ref={sectionRef} className="mt-8 border-t border-[#EDEDED] dark:border-white/10">
      <div className="flex flex-col gap-2.5 py-5 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="md:max-w-[330px]">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold tracking-[-0.005em] text-[#111113] dark:text-white">{titulo}</p>
            {sandbox && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                Sandbox
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-[#9A9A9A] dark:text-zinc-400">{descricao}</p>
        </div>
        <div className="w-full md:w-[300px] md:shrink-0">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            disabled={loading}
            aria-expanded={aberto}
            aria-controls="velo-garantia-painel"
            className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-full border border-[#E6E6E6] bg-white px-4 text-[13px] font-medium text-[#111113] transition hover:border-[#111113] disabled:opacity-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:border-white"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {aberto ? "Fechar" : "Ver minha conta"}
            {!loading && <ChevronDown size={15} className={`transition ${aberto ? "rotate-180" : ""}`} />}
          </button>
        </div>
      </div>

      {aberto && !loading && (
        <div id="velo-garantia-painel" className="pb-6">
          {sandbox && (
            <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              Sandbox ligado: aqui aparecem só assinaturas de teste, e o reembolso é aceito mesmo fora dos 7 dias.
            </div>
          )}

          {loadError ? (
            <Caixa>
              <p className="text-[14px] text-[#0A0A0A] dark:text-white">Não conseguimos carregar sua assinatura agora.</p>
              <div className="mt-3">
                <BotaoSecundario onClick={() => { setLoading(true); void carregar(); }}>
                  <RefreshCw size={14} /> Tentar de novo
                </BotaoSecundario>
              </div>
            </Caixa>
          ) : passo === "enviado" ? (
            <Enviado acao={acao} mensagem={mensagemFinal} onFechar={concluir} />
          ) : !assinatura || !modo || !["reembolso", "cancelamento"].includes(modo) ? (
            <div className="space-y-3">
              {assinatura && <VisaoDaConta assinatura={assinatura} uso={uso} garantia={dentroDaGarantia} />}
              <SituacaoAtual status={status} />
            </div>
          ) : passo === "visao" ? (
            <div className="space-y-3">
              <VisaoDaConta assinatura={assinatura} uso={uso} garantia={dentroDaGarantia} />
              <Caixa semPadding>
                {dentroDaGarantia && (
                  <OpcaoLinha
                    titulo="Solicitar reembolso"
                    descricao={`Disponível até ${prazoAte}. O valor volta pelo mesmo meio de pagamento, depois da análise da equipe.`}
                  >
                    <BotaoPrincipal onClick={() => comecar("reembolso")} largo>Solicitar reembolso</BotaoPrincipal>
                  </OpcaoLinha>
                )}
                {assinatura.purchase_kind !== "lifetime" && (
                  <OpcaoLinha
                    titulo="Cancelar renovação"
                    descricao={`Sem novas cobranças. Você usa a Velo até ${acessoAte ?? "o fim do período já pago"}${dentroDaGarantia ? ", sem reembolso" : ". O prazo de reembolso terminou em " + prazoAte}.`}
                    divisor={dentroDaGarantia}
                  >
                    <BotaoSecundario onClick={() => comecar("cancelamento")} largo perigoHover>Cancelar renovação</BotaoSecundario>
                  </OpcaoLinha>
                )}
              </Caixa>
            </div>
          ) : passo === "reembolso" ? (
            <Caixa>
              <h4 className="text-[16px] font-semibold text-[#0A0A0A] dark:text-white">Solicitar reembolso</h4>

              <div className="mt-3 rounded-lg bg-[#F7F7F7] p-3.5 dark:bg-white/5">
                <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Podemos ajudar antes?</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-[#525252] dark:text-zinc-300">
                  Se algo não funcionou, os tutoriais e o suporte podem resolver. Pedir ajuda não impede o reembolso.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Link
                    to="/dashboard/ajuda"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E6E6] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#111113] hover:border-[#111113] dark:border-white/15 dark:bg-transparent dark:text-white"
                  >
                    <BookOpen size={13} /> Ver tutoriais
                  </Link>
                  <button
                    type="button"
                    onClick={openSupportChat}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E6E6] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#111113] hover:border-[#111113] dark:border-white/15 dark:bg-transparent dark:text-white"
                  >
                    <MessageCircle size={13} /> Falar com o suporte
                  </button>
                </div>
              </div>

              <p className="mt-4 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Qual o motivo?</p>
              <div className="mt-2 space-y-2" role="radiogroup" aria-label="Motivo">
                {MOTIVOS.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      motivo === m
                        ? "border-black bg-[#FAFAFA] dark:border-white dark:bg-zinc-800"
                        : "border-[#E5E5E5] hover:bg-[#FAFAFA] dark:border-zinc-800 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <input type="radio" name="motivo-reembolso" checked={motivo === m} onChange={() => setMotivo(m)} className="accent-black" />
                    <span className="text-[14px] text-[#0A0A0A] dark:text-white">{m}</span>
                  </label>
                ))}
              </div>
              {motivo === "Outro motivo" && (
                <input
                  autoFocus
                  value={outro}
                  onChange={(e) => setOutro(e.target.value)}
                  placeholder="Qual foi o motivo?"
                  className="mt-2 h-11 w-full rounded-lg border border-[#E5E5E5] px-3 text-[14px] outline-none focus:border-black dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white"
                />
              )}
              {AJUDA_POR_MOTIVO[motivo] && (
                <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-[12.5px] leading-5 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                  {AJUDA_POR_MOTIVO[motivo]} Se mesmo assim preferir, é só continuar.
                </p>
              )}

              <label className="mt-4 block text-[13px] font-medium text-[#0A0A0A] dark:text-white" htmlFor="detalhes-reembolso">
                Quer contar mais? <span className="font-normal text-[#A3A3A3]">(opcional)</span>
              </label>
              <textarea
                id="detalhes-reembolso"
                value={detalhes}
                onChange={(e) => setDetalhes(e.target.value)}
                rows={3}
                placeholder="Sua resposta ajuda a equipe a melhorar a Velo."
                className="mt-1.5 w-full resize-none rounded-lg border border-[#E5E5E5] p-3 text-[14px] outline-none focus:border-black dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white"
              />

              <p className="mt-4 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Ao solicitar:</p>
              <Lista
                itens={[
                  `Valor do reembolso: ${fmtValor(assinatura.amount)}.`,
                  "A renovação é cancelada na hora e você continua usando a Velo durante a análise.",
                  "Se o reembolso for aprovado, o plano é encerrado e os anúncios publicados pela Velo no Mercado Livre são encerrados.",
                  assinatura.purchase_kind === "lifetime"
                    ? "Se o pedido for recusado, você continua com o seu plano."
                    : `Se o pedido for recusado, você continua com acesso até ${acessoAte ?? "o fim do período já pago"}.`,
                  PRAZO_REEMBOLSO,
                ]}
              />

              {erro && <Erro texto={erro} />}
              <Rodape>
                <BotaoSecundario onClick={voltar} disabled={enviando}>Voltar</BotaoSecundario>
                <BotaoPrincipal onClick={confirmar} disabled={!motivoOk || enviando} perigo>
                  {enviando && <Loader2 size={15} className="animate-spin" />}
                  Solicitar reembolso
                </BotaoPrincipal>
              </Rodape>
            </Caixa>
          ) : (
            <Caixa>
              <h4 className="text-[16px] font-semibold text-[#0A0A0A] dark:text-white">Cancelar renovação</h4>
              <Lista
                itens={[
                  "Não haverá novas cobranças.",
                  `Você continua usando a Velo até ${acessoAte ?? "o fim do período já pago"}.`,
                  "Os anúncios que você já publicou continuam no Mercado Livre.",
                  "Vale na hora, sem análise. Não há reembolso do valor já pago.",
                ]}
              />
              <label className="mt-4 block text-[13px] font-medium text-[#0A0A0A] dark:text-white" htmlFor="motivo-cancelamento">
                Por que está cancelando? <span className="font-normal text-[#A3A3A3]">(opcional)</span>
              </label>
              <select
                id="motivo-cancelamento"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-[14px] outline-none focus:border-black dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              >
                <option value="">Prefiro não dizer</option>
                {MOTIVOS.filter((m) => m !== "Outro motivo").map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {erro && <Erro texto={erro} />}
              <Rodape>
                <BotaoSecundario onClick={voltar} disabled={enviando}>Voltar</BotaoSecundario>
                <BotaoPrincipal onClick={confirmar} disabled={enviando}>
                  {enviando && <Loader2 size={15} className="animate-spin" />}
                  Confirmar cancelamento
                </BotaoPrincipal>
              </Rodape>
            </Caixa>
          )}
        </div>
      )}
    </div>
  );
};

/** O que o cliente já fez na Velo: tempo de uso, produtos publicados, vendas. */
const VisaoDaConta = ({ assinatura, uso, garantia }: { assinatura: RefundAssinatura; uso: UsoDaConta | null; garantia: boolean }) => {
  const dias = refundDaysUsed(assinatura.created_at);
  const vitalicio = assinatura.purchase_kind === "lifetime";
  const itens: Array<{ rotulo: string; valor: string; detalhe?: string }> = [
    { rotulo: "Plano", valor: `${nomePlano(assinatura.plan)}${vitalicio ? " vitalício" : ""}`, detalhe: fmtValor(assinatura.amount) },
    { rotulo: "Tempo de uso", valor: plural(dias, "dia", "dias"), detalhe: `desde ${fmtData(assinatura.created_at)}` },
    { rotulo: "Produtos publicados", valor: uso ? fmtNumero(uso.publicados) : "…" },
    { rotulo: "Anúncios ativos", valor: uso ? fmtNumero(uso.ativos) : "…", detalhe: "no Mercado Livre" },
    { rotulo: "Vendas", valor: uso ? fmtNumero(uso.vendas) : "…" },
    { rotulo: "Garantia de 7 dias", valor: garantia ? `até ${fimDoPrazo(assinatura.created_at)}` : "encerrada", detalhe: garantia ? undefined : `em ${fimDoPrazo(assinatura.created_at)}` },
  ];
  return (
    <Caixa>
      <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Sua conta na Velo</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {itens.map((i) => (
          <div key={i.rotulo} className="rounded-lg border border-[#EDEDED] p-3 dark:border-white/10">
            <dt className="text-[11.5px] text-[#8A8A8A] dark:text-zinc-400">{i.rotulo}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-[#0A0A0A] dark:text-white">{i.valor}</dd>
            {i.detalhe && <dd className="text-[11.5px] text-[#8A8A8A] dark:text-zinc-500">{i.detalhe}</dd>}
          </div>
        ))}
      </dl>
    </Caixa>
  );
};

const OpcaoLinha = ({
  titulo,
  descricao,
  divisor,
  children,
}: {
  titulo: string;
  descricao: string;
  divisor?: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={`flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center md:justify-between md:gap-8 ${
      divisor ? "border-t border-[#EDEDED] dark:border-white/10" : ""
    }`}
  >
    <div className="md:max-w-[340px]">
      <p className="text-[13px] font-semibold text-[#111113] dark:text-white">{titulo}</p>
      <p className="mt-0.5 text-[12px] leading-[1.45] text-[#9A9A9A] dark:text-zinc-400">{descricao}</p>
    </div>
    <div className="w-full md:w-[220px] md:shrink-0">{children}</div>
  </div>
);

const Enviado = ({ acao, mensagem, onFechar }: { acao: Acao; mensagem: string; onFechar: () => void }) => (
  <Caixa>
    <CheckCircle2 size={36} strokeWidth={1.8} className="text-emerald-600" />
    <h4 className="mt-3 text-[16px] font-semibold text-[#0A0A0A] dark:text-white">
      {acao === "reembolso" ? "Pedido de reembolso enviado" : "Renovação cancelada"}
    </h4>
    <p className="mt-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">
      {acao === "reembolso"
        ? `Seu pedido foi para a nossa equipe. ${PRAZO_REEMBOLSO}`
        : mensagem || "Não haverá novas cobranças e você mantém o acesso até o fim do período já pago."}
    </p>
    {acao === "reembolso" && (
      <p className="mt-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">
        A resposta chega nas suas notificações e no chat de suporte.
      </p>
    )}
    <div className="mt-4">
      <BotaoPrincipal onClick={onFechar}>Fechar</BotaoPrincipal>
    </div>
  </Caixa>
);

const SituacaoAtual = ({ status }: { status: RefundStatus | null }) => {
  const a = status?.assinatura;
  const acessoAte = fmtAcessoAte(a?.current_period_end);
  const conteudo =
    status?.mode === "em_analise"
      ? { icone: <Clock size={32} className="text-amber-600" />, titulo: "Seu pedido de reembolso está em análise", corpo: `${PRAZO_REEMBOLSO} A resposta chega nas suas notificações e no chat de suporte.` }
      : status?.mode === "aprovado"
        ? { icone: <CheckCircle2 size={32} className="text-emerald-600" />, titulo: "Seu reembolso foi aprovado", corpo: PRAZO_DEVOLUCAO }
        : status?.mode === "cancelado"
          ? { icone: <CheckCircle2 size={32} className="text-[#A3A3A3]" />, titulo: "Sua renovação já está cancelada", corpo: `Não haverá novas cobranças. Você mantém o acesso até ${acessoAte ?? "o fim do período já pago"}.` }
          : status?.mode === "vitalicio"
            ? { icone: <CheckCircle2 size={32} className="text-[#A3A3A3]" />, titulo: "Seu plano é vitalício", corpo: "Não há renovação nem cobranças futuras para cancelar. O prazo de 7 dias para reembolso já passou." }
            : { icone: <CheckCircle2 size={32} className="text-[#A3A3A3]" />, titulo: "Você não tem uma assinatura ativa", corpo: "Se você foi cobrado e não vê seu plano aqui, fale com o suporte pelo chat no canto da tela que a equipe verifica para você." };
  return (
    <Caixa>
      {conteudo.icone}
      <h4 className="mt-3 text-[16px] font-semibold text-[#0A0A0A] dark:text-white">{conteudo.titulo}</h4>
      <p className="mt-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">{conteudo.corpo}</p>
    </Caixa>
  );
};

const Lista = ({ itens }: { itens: string[] }) => (
  <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-[#525252] dark:text-zinc-300">
    {itens.map((item) => (
      <li key={item} className="flex gap-2">
        <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A3A3A3]" />
        {item}
      </li>
    ))}
  </ul>
);

const Erro = ({ texto }: { texto: string }) => (
  <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{texto}</p>
);

const Caixa = ({ children, semPadding }: { children: React.ReactNode; semPadding?: boolean }) => (
  <div className={`rounded-xl border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950 ${semPadding ? "" : "p-4 sm:p-5"}`}>{children}</div>
);

const Rodape = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
);

const BotaoPrincipal = ({
  children,
  onClick,
  disabled,
  perigo,
  largo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  perigo?: boolean;
  largo?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium text-white transition disabled:opacity-40 ${
      largo ? "w-full" : ""
    } ${perigo ? "bg-red-600 hover:bg-red-700" : "bg-black hover:opacity-85 dark:bg-white dark:text-black"}`}
  >
    {children}
  </button>
);

const BotaoSecundario = ({
  children,
  onClick,
  disabled,
  largo,
  perigoHover,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  largo?: boolean;
  /** Fica vermelho ao passar o mouse (ação que encerra algo). */
  perigoHover?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#E5E5E5] px-5 py-2.5 text-[14px] font-medium text-[#525252] transition disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 ${
      perigoHover
        ? "hover:border-red-600 hover:bg-red-600 hover:text-white dark:hover:border-red-600 dark:hover:bg-red-600 dark:hover:text-white"
        : "hover:border-black hover:text-black dark:hover:border-white dark:hover:text-white"
    } ${largo ? "w-full" : ""}`}
  >
    {children}
  </button>
);

export default RefundSection;
