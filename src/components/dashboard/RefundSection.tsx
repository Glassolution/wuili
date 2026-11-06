import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, FileText, Loader2, RefreshCw } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { useSandboxMode } from "@/lib/sandboxMode";
import {
  createLocalSandboxRefund,
  getLocalSandboxRefunds,
  getLocalSandboxSubscriptions,
  listenLocalSandboxData,
} from "@/lib/localSandbox";
import { fetchRefundStatus, type RefundAssinatura, type RefundStatus } from "@/lib/refundStatus";
import {
  formatRefundFeedback,
  getRefundMode,
  PRAZO_DEVOLUCAO,
  PRAZO_REEMBOLSO,
  REFUND_FEEDBACK_MAX_LENGTH,
  REFUND_WINDOW_DAYS,
  refundDaysUsed,
} from "@/lib/refundEligibility";

/*
 * A página da Gerenciar assinatura recebe os pedidos de reembolso e cancelamento.
 * Em Perfil e Plano, o componente mostra apenas a entrada para essa página.
 *
 * Regra (supabase/functions/_shared/refundPolicy.ts, a mesma do servidor):
 * - até 7 dias do pagamento: pedido de reembolso, analisado pela equipe em /admin/reembolsos;
 * - depois disso: o próprio cliente cancela a renovação, sem passar pela equipe.
 *
 * A Gerenciar assinatura mostra a conta e abre o formulário antes do envio para análise.
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

type Passo = "visao" | "motivo" | "reembolso" | "cancelar" | "enviado";
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

export const SUBSCRIPTION_CENTER_PATH = "/dashboard/configuracoes/central-da-assinatura";

const RefundSection = ({ local = "perfil" }: { local?: Local | "central" }) => {
  const paginaCentral = local === "central";
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
  const [passo, setPasso] = useState<Passo>("visao");
  const [acao, setAcao] = useState<Acao>("reembolso");
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [houveErro, setHouveErro] = useState("");
  const [autorizaContato, setAutorizaContato] = useState("");
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
    if (!paginaCentral || uso || !user) return;
    carregarUso(user.id)
      .then(setUso)
      .catch(() => setUso({ publicados: null, ativos: null, vendas: null }));
  }, [paginaCentral, uso, user]);

  // Links antigos com âncora continuam levando à entrada da página de assinatura.
  useEffect(() => {
    if (local === "central" || loading || location.hash !== ANCORA[local]) return;
    // Espera o restante do Perfil carregar; senão a página cresce depois e a rolagem se perde.
    const t = window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 600);
    return () => window.clearTimeout(t);
  }, [loading, location.hash, location.key, local]);

  useEffect(() => {
    if (paginaCentral) sectionRef.current?.scrollIntoView({ block: "start" });
  }, [paginaCentral, passo]);

  const assinatura = status?.assinatura ?? null;
  // No sandbox o admin testa o reembolso mesmo fora dos 7 dias (o servidor também libera).
  const modo = sandbox && status?.mode === "cancelamento" ? "reembolso" : status?.mode;
  const dentroDaGarantia = modo === "reembolso";
  const motivoFinal = motivo === "Outro motivo" ? `Outro: ${outro.trim()}` : motivo;
  const motivoOk = Boolean(motivo) && (motivo !== "Outro motivo" || outro.trim().length >= 3);
  const hadError = houveErro === "" ? null : houveErro === "sim";
  const canContact = autorizaContato === "" ? null : autorizaContato === "sim";
  const respostas = formatRefundFeedback(detalhes, hadError, canContact);

  const comecar = (nova: Acao) => {
    setAcao(nova);
    setMotivo("");
    setOutro("");
    setDetalhes("");
    setHouveErro("");
    setAutorizaContato("");
    setErro(null);
    setPasso(nova === "reembolso" ? "motivo" : "cancelar");
  };

  const voltar = () => {
    setErro(null);
    setPasso(passo === "reembolso" && dentroDaGarantia ? "motivo" : "visao");
  };

  const confirmar = async () => {
    if (!assinatura || enviando) return;
    if (acao === "cancelamento" && !motivo.trim()) return;
    if (acao === "reembolso" && (!dentroDaGarantia || !motivoOk || !respostas)) return;
    setEnviando(true);
    setErro(null);
    try {
      if (acao === "reembolso" && sandboxLocal && respostas) {
        createLocalSandboxRefund(sandboxKey, assinatura.id, motivoFinal, respostas);
        setMensagemFinal("");
        setPasso("enviado");
        return;
      }
      const fn = acao === "reembolso" ? "request-refund" : "cancel-subscription";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: {
          subscription_id: assinatura.id,
          reason: acao === "reembolso" ? motivoFinal : motivo.trim(),
          reason_details: detalhes.trim(),
          ...(acao === "reembolso" && { had_error: hadError, can_contact: canContact, sandbox }),
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
    setLoading(true);
    setPasso("visao");
    void carregar();
  };

  const prazoAte = assinatura ? fimDoPrazo(assinatura.created_at) : null;
  const acessoAte = fmtAcessoAte(assinatura?.current_period_end);
  const descricao = dentroDaGarantia
    ? `Consulte as opções da sua assinatura. A garantia de ${REFUND_WINDOW_DAYS} dias vai até ${prazoAte}.`
    : status?.mode === "em_analise"
      ? "Você tem um pedido em análise pela nossa equipe."
      : "Consulte a situação e as opções da sua assinatura.";

  if (!paginaCentral) {
    const visivel = !loading && (loadError ? local === "perfil" : Boolean(modo && MODOS_VISIVEIS[local].includes(modo)));
    if (!visivel) return null;

    return (
      <div ref={sectionRef} className="mt-8 border-t border-[#EDEDED] dark:border-white/10">
        <div className="flex flex-col gap-2.5 py-5 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="md:max-w-[330px]">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold tracking-[-0.005em] text-[#111113] dark:text-white">Gerenciar assinatura</p>
              {sandbox && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  Sandbox
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-[1.45] text-[#9A9A9A] dark:text-zinc-400">{descricao}</p>
          </div>
          <div className="w-full md:w-[300px] md:shrink-0">
            <Link
              to={SUBSCRIPTION_CENTER_PATH}
              state={{ origem: local }}
              className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-4 text-[13px] font-medium text-[#111113] transition hover:border-[#2563EB] hover:text-[#2563EB] dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:text-blue-300"
            >
              Ver opções
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Carregando sua assinatura…</p>;
  }

  return (
    <div ref={sectionRef} className="scroll-mt-6 pb-6">
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
      ) : passo === "visao" || (!dentroDaGarantia && (passo === "motivo" || passo === "reembolso")) ? (
        <div className="space-y-5">
          <section aria-labelledby="reembolso-titulo" className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/25 dark:bg-blue-500/10 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                <FileText size={19} aria-hidden="true" />
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
                {dentroDaGarantia ? "Disponível para esta assinatura" : "Fora da garantia"}
              </span>
            </div>
            <h2 id="reembolso-titulo" className="mt-4 text-xl font-semibold text-[#111113] dark:text-white">Reembolso da assinatura</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {dentroDaGarantia
                ? `Envie seu pedido para análise até ${prazoAte}. Você responde às perguntas nesta página.`
                : `O prazo de ${REFUND_WINDOW_DAYS} dias para pedir reembolso terminou em ${prazoAte}.`}
            </p>
            {dentroDaGarantia && (
              <button type="button" onClick={() => comecar("reembolso")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8]">
                Solicitar reembolso <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {erro && <Erro texto={erro} />}
          </section>
          {assinatura.purchase_kind !== "lifetime" && (
            <section aria-labelledby="renovacao-titulo" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-zinc-200/80 px-1 pb-5 dark:border-white/10">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  <RefreshCw size={16} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="renovacao-titulo" className="text-sm font-semibold text-zinc-950 dark:text-white">Renovação do plano</h2>
                  <p className="mt-1 max-w-sm text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">
                    Você pode interromper as próximas cobranças e manter o acesso até {acessoAte ?? "o fim do período já pago"}.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => comecar("cancelamento")} className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white">
                Cancelar renovação <ArrowRight size={14} aria-hidden="true" />
              </button>
            </section>
          )}
          <VisaoDaConta assinatura={assinatura} uso={uso} garantia={dentroDaGarantia} />
        </div>
      ) : passo === "motivo" ? (
        <form onSubmit={(event) => { event.preventDefault(); if (motivoOk) setPasso("reembolso"); }}>
          <Caixa>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Etapa 1 de 2</p>
            <h2 className="mt-1 text-lg font-semibold text-[#111113] dark:text-white">Motivo do reembolso</h2>
            <p className="mt-4 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Qual é o motivo principal do pedido?</p>
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
                  <input type="radio" name="motivo-reembolso" required checked={motivo === m} onChange={() => setMotivo(m)} className="accent-black" />
                  <span className="text-[14px] text-[#0A0A0A] dark:text-white">{m}</span>
                </label>
              ))}
            </div>
            {motivo === "Outro motivo" && (
              <input
                autoFocus
                aria-label="Informe o outro motivo"
                required
                maxLength={200}
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="Qual foi o motivo?"
                className="mt-2 h-11 w-full rounded-lg border border-[#E5E5E5] px-3 text-[14px] outline-none focus:border-black dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white"
              />
            )}
            <Rodape>
              <BotaoSecundario onClick={voltar}>Voltar às opções</BotaoSecundario>
              <BotaoPrincipal type="submit" disabled={!motivoOk}>Continuar</BotaoPrincipal>
            </Rodape>
          </Caixa>
        </form>
      ) : passo === "reembolso" ? (
        <form onSubmit={(event) => { event.preventDefault(); void confirmar(); }}>
          <Caixa>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Etapa 2 de 2</p>
            <h2 className="mt-1 text-lg font-semibold text-[#111113] dark:text-white">Detalhes do pedido</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Preencha todos os campos. A equipe vai analisar suas respostas junto com o pedido.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white">
                Aconteceu algum erro na Velo?
                <select required value={houveErro} onChange={(e) => setHouveErro(e.target.value)}
                  className="mt-1.5 block h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <option value="" disabled>Selecione</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </label>
              <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white">
                Podemos entrar em contato para ajudar?
                <select required value={autorizaContato} onChange={(e) => setAutorizaContato(e.target.value)}
                  className="mt-1.5 block h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <option value="" disabled>Selecione</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block text-[13px] font-medium text-[#0A0A0A] dark:text-white" htmlFor="detalhes-reembolso">
              {houveErro === "sim" ? "Descreva o erro e explique por que você quer o reembolso." : "Explique por que você quer o reembolso."}
            </label>
            <textarea
              id="detalhes-reembolso"
              required
              maxLength={REFUND_FEEDBACK_MAX_LENGTH}
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
              <BotaoPrincipal type="submit" disabled={!motivoOk || !respostas || enviando}>
                {enviando && <Loader2 size={15} className="animate-spin" />}
                Enviar pedido para análise
              </BotaoPrincipal>
            </Rodape>
          </Caixa>
        </form>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void confirmar(); }}>
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
            {erro && <Erro texto={erro} />}
            <Rodape>
              <BotaoSecundario onClick={voltar} disabled={enviando}>Voltar</BotaoSecundario>
              <BotaoPrincipal type="submit" disabled={enviando || !motivo.trim()}>
                {enviando && <Loader2 size={15} className="animate-spin" />}
                Confirmar cancelamento
              </BotaoPrincipal>
            </Rodape>
          </Caixa>
        </form>
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
    <section aria-labelledby="conta-titulo" className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-white/10">
      <div className="px-4 py-4 sm:px-5">
        <h2 id="conta-titulo" className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">Sua conta na Velo</h2>
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-zinc-200/80 bg-zinc-200/80 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
        {itens.map(({ rotulo, valor, detalhe }) => (
          <div key={rotulo} className="min-w-0 bg-[#FAFAFB] px-4 py-3.5 dark:bg-[#18181B] sm:px-5">
            <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{rotulo}</dt>
            <dd className="mt-1 text-base font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">
              {valor}
              {detalhe && <span className="mt-0.5 block text-xs font-normal tracking-normal text-zinc-600 dark:text-zinc-400">{detalhe}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

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
        Acompanhe a situação nesta página e nas suas notificações.
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
      ? { icone: <Clock size={32} className="text-amber-600" />, titulo: "Seu pedido de reembolso está em análise", corpo: `${PRAZO_REEMBOLSO} Acompanhe a situação nesta página e nas suas notificações.` }
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

const Caixa = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-[#E5E5E5] p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">{children}</div>
);

const Rodape = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
);

const BotaoPrincipal = ({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-40"
  >
    {children}
  </button>
);

const BotaoSecundario = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/10"
  >
    {children}
  </button>
);

export default RefundSection;
