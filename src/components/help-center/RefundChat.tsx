import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import { AlertCircle, ArrowUp, CheckCircle2, Loader2, LogIn, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { useSandboxMode } from "@/lib/sandboxMode";
import { fetchRefundStatus, type RefundStatus } from "@/lib/refundStatus";
import {
  CANCEL_PAGE_PATH,
  composeRefundChatDetails,
  formatRefundFeedback,
  PRAZO_REEMBOLSO,
  REFUND_REASONS,
  type RefundMode,
} from "@/lib/refundEligibility";
import { fetchLatestRefundRequest, fetchRefundEvents, refundStage, type RefundEvent, type RefundRequestRow } from "@/lib/refundRequestHistory";
import {
  Aviso,
  BotaoPrincipal,
  BotaoSecundario,
  ContaLogada,
  fmtValor,
  ResumoElegibilidade,
  SimNao,
  SituacaoDoPedido,
} from "@/components/help-center/RefundParts";

/*
  Atendimento de reembolso (/ajuda/reembolso), aberto pelo link discreto no
  artigo de reembolso. O cliente conversa com a IA (função refund-assistant),
  que confere a situação no servidor e, quando ele quer seguir, monta o pedido.

  A IA nunca envia: a proposta aparece como cartão de confirmação dentro do
  chat, e só o botão "Enviar pedido" chama a função request-refund, que confere
  de novo assinatura, prazo, pedidos anteriores e identidade.

  A conversa fica no sessionStorage da aba (por conta), para sobreviver a um
  recarregamento; o histórico oficial do pedido é o do banco.
*/

type Mensagem = { role: "user" | "assistant"; content: string };
type Proposta = { motivo: string; resumo: string; houve_erro: boolean; pode_contatar: boolean };
type Conversa = { mensagens: Mensagem[]; proposta: Proposta | null; propostaApos: number | null };

const MAX_CHARS = 1000;
const SUGESTOES = ["Não consegui vender", "Tive problemas técnicos", "Não entendi como usar", "Achei caro"];

const chaveConversa = (userId: string, sandbox: boolean) => `velo:atendimento-reembolso:${userId}${sandbox ? ":sandbox" : ""}`;

const lerConversa = (chave: string): Conversa | null => {
  try {
    const bruto = sessionStorage.getItem(chave);
    if (!bruto) return null;
    const c = JSON.parse(bruto) as Conversa;
    return Array.isArray(c?.mensagens) ? c : null;
  } catch {
    return null;
  }
};

const salvarConversa = (chave: string, conversa: Conversa) => {
  try {
    sessionStorage.setItem(chave, JSON.stringify(conversa));
  } catch {
    /* sem armazenamento (aba privada): a conversa só vive na tela */
  }
};

/** Lê o erro que a função devolveu (FunctionsHttpError traz a resposta em `context`). */
async function mensagemDeErro(error: unknown, data: unknown, padrao: string) {
  const doCorpo = (data as { error?: string } | null)?.error;
  if (doCorpo) return doCorpo;
  const ctx = (error as { context?: Response } | null)?.context;
  const corpo = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
  return (corpo as { error?: string } | null)?.error || padrao;
}

export default function RefundChat() {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const location = useLocation();

  const [sandboxEnabled] = useSandboxMode(user?.id ?? user?.email ?? null);
  const sandbox = sandboxEnabled && (role === "admin" || isAdminEmail(user?.email));

  const [status, setStatus] = useState<RefundStatus | null>(null);
  const [pedido, setPedido] = useState<RefundRequestRow | null>(null);
  const [historico, setHistorico] = useState<RefundEvent[]>([]);
  const [modo, setModo] = useState<RefundMode | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);

  const [conversa, setConversa] = useState<Conversa>({ mensagens: [], proposta: null, propostaApos: null });
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState(false);
  const [erroChat, setErroChat] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const chave = user ? chaveConversa(user.id, sandbox) : null;
  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const atualizar = useCallback(
    (mudar: (c: Conversa) => Conversa) =>
      setConversa((atual) => {
        const nova = mudar(atual);
        if (chave) salvarConversa(chave, nova);
        return nova;
      }),
    [chave],
  );

  const carregarPedido = useCallback(async () => {
    if (!user) return;
    const [situacao, ultimo] = await Promise.all([fetchRefundStatus(user.id, sandbox), fetchLatestRefundRequest(user.id)]);
    setStatus(situacao);
    setPedido(ultimo);
    setHistorico(ultimo ? await fetchRefundEvents([ultimo.id]) : []);
  }, [user, sandbox]);

  const iniciar = useCallback(async () => {
    if (!user || !chave) return;
    setErroCarga(false);
    setCarregando(true);
    try {
      const [inicio] = await Promise.all([
        supabase.functions.invoke("refund-assistant", { body: { action: "start", sandbox } }),
        carregarPedido(),
      ]);
      if (inicio.error || !inicio.data?.greeting) throw inicio.error ?? new Error("sem saudação");
      setModo(inicio.data.mode as RefundMode);
      const salva = lerConversa(chave);
      setConversa(
        salva && salva.mensagens.length
          ? salva
          : { mensagens: [{ role: "assistant", content: String(inicio.data.greeting) }], proposta: null, propostaApos: null },
      );
    } catch (e) {
      console.error("[atendimento-reembolso] início", e);
      setErroCarga(true);
    } finally {
      setCarregando(false);
    }
  }, [user, chave, sandbox, carregarPedido]);

  useEffect(() => {
    if (user) void iniciar();
    else setCarregando(false);
  }, [user, iniciar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversa.mensagens.length, conversa.proposta, respondendo, enviado]);

  const enviarMensagem = async (conteudo: string) => {
    const limpo = conteudo.trim().slice(0, MAX_CHARS);
    if (!limpo || respondendo) return;
    const mensagens: Mensagem[] = [...conversa.mensagens, { role: "user", content: limpo }];
    // Nova mensagem do cliente invalida o cartão anterior: a IA monta outro se for o caso.
    atualizar(() => ({ mensagens, proposta: null, propostaApos: null }));
    setTexto("");
    setErroChat(null);
    setRespondendo(true);
    try {
      const { data, error } = await supabase.functions.invoke("refund-assistant", {
        body: { action: "send", messages: mensagens, sandbox },
      });
      if (error || !data?.reply) {
        setErroChat(await mensagemDeErro(error, data, "Não consegui responder agora. Tente de novo em instantes."));
        return;
      }
      if (data.mode) setModo(data.mode as RefundMode);
      const resposta: Mensagem = { role: "assistant", content: String(data.reply) };
      atualizar((c) => ({
        mensagens: [...c.mensagens, resposta],
        proposta: data.proposal ?? null,
        propostaApos: data.proposal ? c.mensagens.length : null,
      }));
    } catch (e) {
      console.error("[atendimento-reembolso] mensagem", e);
      setErroChat("Não consegui responder agora. Tente de novo em instantes.");
    } finally {
      setRespondendo(false);
      campoRef.current?.focus();
    }
  };

  const aoEnviarPedido = async () => {
    setEnviado(true);
    atualizar((c) => ({
      ...c,
      proposta: null,
      propostaApos: null,
      mensagens: [
        ...c.mensagens,
        {
          role: "assistant",
          content: `Pedido enviado! A renovação da sua assinatura já foi cancelada e a equipe vai analisar o pedido. ${PRAZO_REEMBOLSO} Você é avisado nas notificações da Velo, e a situação aparece aqui no topo.`,
        },
      ],
    }));
    setModo("em_analise");
    try {
      await carregarPedido();
    } catch (e) {
      console.error("[atendimento-reembolso] recarregar", e);
    }
  };

  const recomecar = () => {
    if (!chave) return;
    try {
      sessionStorage.removeItem(chave);
    } catch {
      /* ignora */
    }
    setEnviado(false);
    void iniciar();
  };

  const sairDaConta = async () => {
    await signOut();
    setStatus(null);
    setPedido(null);
    setHistorico([]);
    setConversa({ mensagens: [], proposta: null, propostaApos: null });
  };

  /* ── Estados antes do chat ────────────────────────────────────────────────── */

  if (authLoading || (user && carregando)) {
    return (
      <Painel>
        <p role="status" className="flex items-center gap-2 px-6 py-10 text-[15px] text-[#52606D]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Abrindo o atendimento…
        </p>
      </Painel>
    );
  }

  if (!user) {
    const next = location.pathname;
    return (
      <Painel>
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <span className="grid size-12 place-items-center rounded-[12px] bg-[#EFF6FF] text-[#2563EB]">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-[22px] font-medium tracking-[-0.01em] text-[#0F172A]">Entre com a conta que foi cobrada</h2>
          <p className="mt-2 max-w-[560px] text-[16px] leading-[1.6] text-[#3F4652]">
            Para sua segurança, o atendimento de reembolso só abre para quem está logado na conta da assinatura. Depois de entrar, você
            volta direto para cá.
          </p>
          <Link
            to={`/login?next=${encodeURIComponent(next)}`}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#2563EB] px-6 text-[15.5px] font-medium text-white transition hover:bg-[#1E3A8A]"
          >
            <LogIn size={18} aria-hidden="true" /> Entrar para continuar
          </Link>
        </div>
      </Painel>
    );
  }

  if (erroCarga) {
    return (
      <Painel>
        <div className="px-6 py-8 sm:px-8">
          <p className="text-[16px] text-[#0F172A]">Não conseguimos abrir o atendimento agora.</p>
          <p className="mt-1 text-[14.5px] text-[#52606D]">Verifique sua conexão e tente de novo.</p>
          <BotaoSecundario onClick={() => void iniciar()} className="mt-5">
            <RefreshCw size={15} aria-hidden="true" /> Tentar de novo
          </BotaoSecundario>
        </div>
      </Painel>
    );
  }

  /* ── Atendimento ──────────────────────────────────────────────────────────── */

  const assinatura = status?.assinatura ?? null;
  const mostrarPedido = pedido && (pedido.subscription_id === assinatura?.id || refundStage(pedido.status) === "pendente");
  const semConversaDoCliente = !conversa.mensagens.some((m) => m.role === "user");

  return (
    <div className="space-y-6">
      <ContaLogada email={user.email ?? ""} onSair={sairDaConta} sandbox={sandbox} />

      {assinatura ? <ResumoElegibilidade assinatura={assinatura} modo={modo ?? status?.mode} /> : null}
      {mostrarPedido ? <SituacaoDoPedido pedido={pedido} historico={historico} /> : null}

      {modo === "cancelamento" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E4E7EB] px-4 py-3.5 sm:px-5">
          <p className="text-[14.5px] text-[#3F4652]">Quer parar as próximas cobranças? Cancelar a renovação vale na hora, sem análise.</p>
          <Link
            to={CANCEL_PAGE_PATH}
            className="inline-flex h-10 items-center rounded-full border border-[#D4D9E0] px-4 text-[14.5px] text-[#0F172A] transition hover:border-[#2563EB] hover:text-[#2563EB]"
          >
            Cancelar a renovação
          </Link>
        </div>
      ) : null}

      <Painel>
        <header className="flex items-center justify-between gap-3 border-b border-[#EEF0F3] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <AvatarAtendente />
            <div>
              <p className="text-[15.5px] font-medium text-[#0F172A]">Atendente de reembolso</p>
              <p className="flex items-center gap-1.5 text-[13px] text-[#52606D]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" /> IA da Velo · a equipe analisa cada pedido
              </p>
            </div>
          </div>
          {conversa.mensagens.length > 1 ? (
            <button type="button" onClick={recomecar} className="text-[13.5px] text-[#52606D] hover:text-[#2563EB]">
              Recomeçar
            </button>
          ) : null}
        </header>

        <div
          role="log"
          aria-live="polite"
          aria-label="Conversa com a atendente de reembolso"
          className="max-h-[min(62vh,640px)] min-h-[340px] space-y-5 overflow-y-auto px-5 py-6 sm:px-6"
        >
          {conversa.mensagens.map((m, i) => (
            <div key={i}>
              <Bolha mensagem={m} />
              {conversa.proposta && conversa.propostaApos === i ? (
                <CartaoConfirmacao
                  proposta={conversa.proposta}
                  assinatura={assinatura}
                  mensagens={conversa.mensagens}
                  sandbox={sandbox}
                  onEnviado={aoEnviarPedido}
                  onCorrigir={() => campoRef.current?.focus()}
                />
              ) : null}
            </div>
          ))}
          {respondendo ? <Digitando /> : null}
          {erroChat ? (
            <Aviso tom="erro" icone={<XCircle size={18} aria-hidden="true" />}>
              {erroChat}
            </Aviso>
          ) : null}
          <div ref={fimRef} />
        </div>

        {modo === "reembolso" && semConversaDoCliente && !respondendo ? (
          <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void enviarMensagem(s)}
                className="rounded-full border border-[#D4D9E0] px-3.5 py-1.5 text-[14px] text-[#0F172A] transition hover:border-[#2563EB] hover:bg-[#EFF6FF]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <CampoMensagem
          campoRef={campoRef}
          valor={texto}
          onChange={setTexto}
          onEnviar={() => void enviarMensagem(texto)}
          desabilitado={respondendo}
        />
      </Painel>

      <p className="text-[13.5px] leading-[1.6] text-[#6E6E80]">
        A atendente é uma IA: ela confere as regras e monta o pedido, mas quem aprova ou recusa é a equipe da Velo. Nada é enviado sem
        você tocar em <strong className="font-medium text-[#3F4652]">Enviar pedido</strong>.
      </p>
    </div>
  );
}

/* ── Peças do chat ──────────────────────────────────────────────────────────── */

function Painel({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#E4E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
      {children}
    </section>
  );
}

/** Mesma foto do chat de suporte Velo (SupportTab): bússola do Atlas num círculo branco. */
function AvatarAtendente({ pequeno = false }: { pequeno?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#DBEAFE] ${pequeno ? "size-9" : "size-11"}`}
    >
      <AtlasAvatarIcon size={pequeno ? 24 : 30} animated={false} />
    </span>
  );
}

/** Só links internos da Central viram link; o resto da resposta é texto simples. */
const markdownDaIA: Components = {
  p: ({ children }) => <p className="[&:not(:first-child)]:mt-2.5">{children}</p>,
  a: ({ href, children }) =>
    href && href.startsWith("/ajuda/") ? (
      <Link to={href} target="_blank" className="font-medium text-[#2563EB] underline underline-offset-2">
        {children}
      </Link>
    ) : (
      <>{children}</>
    ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
};

function Bolha({ mensagem }: { mensagem: Mensagem }) {
  if (mensagem.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-line break-words rounded-[18px] rounded-br-[6px] bg-[#2563EB] px-4 py-2.5 text-[15.5px] leading-[1.55] text-white">
          {mensagem.content}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <AvatarAtendente pequeno />
      <div className="max-w-[85%] break-words rounded-[18px] rounded-tl-[6px] bg-[#F4F6F9] px-4 py-2.5 text-[15.5px] leading-[1.6] text-[#0F172A]">
        <ReactMarkdown
          components={markdownDaIA}
          allowedElements={["p", "a", "strong", "em", "ul", "ol", "li", "br"]}
          unwrapDisallowed
        >
          {mensagem.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function Digitando() {
  return (
    <div className="flex items-center gap-3" role="status" aria-label="A atendente está escrevendo">
      <AvatarAtendente pequeno />
      <span className="flex gap-1 rounded-[18px] bg-[#F4F6F9] px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-bounce rounded-full bg-[#9AA5B4]" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </span>
    </div>
  );
}

function CampoMensagem({
  campoRef,
  valor,
  onChange,
  onEnviar,
  desabilitado,
}: {
  campoRef: React.RefObject<HTMLTextAreaElement>;
  valor: string;
  onChange: (v: string) => void;
  onEnviar: () => void;
  desabilitado: boolean;
}) {
  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnviar();
    }
  };
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onEnviar();
      }}
      className="border-t border-[#EEF0F3] p-3 sm:p-4"
    >
      <div className="flex items-end gap-2 rounded-[14px] border border-[#D4D9E0] bg-white px-3 py-2 transition focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/15">
        <label htmlFor="mensagem-reembolso" className="sr-only">
          Escreva sua mensagem
        </label>
        <textarea
          id="mensagem-reembolso"
          ref={campoRef}
          rows={1}
          maxLength={MAX_CHARS}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Escreva sua mensagem…"
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15.5px] leading-[1.5] text-[#0F172A] outline-none placeholder:text-[#8A94A3] [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={desabilitado || !valor.trim()}
          aria-label="Enviar mensagem"
          className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white transition hover:bg-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {desabilitado ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={19} aria-hidden="true" />}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[12px] text-[#8A94A3]">Enter envia · Shift + Enter quebra a linha</p>
    </form>
  );
}

function CartaoConfirmacao({
  proposta,
  assinatura,
  mensagens,
  sandbox,
  onEnviado,
  onCorrigir,
}: {
  proposta: Proposta;
  assinatura: RefundStatus["assinatura"];
  mensagens: Mensagem[];
  sandbox: boolean;
  onEnviado: () => void;
  onCorrigir: () => void;
}) {
  const [houveErro, setHouveErro] = useState<"sim" | "nao">(proposta.houve_erro ? "sim" : "nao");
  const [contato, setContato] = useState<"sim" | "nao">(proposta.pode_contatar ? "sim" : "nao");
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const motivoValido = (REFUND_REASONS as readonly string[]).includes(proposta.motivo);
  const detalhes = composeRefundChatDetails(
    proposta.resumo,
    mensagens.filter((m) => m.role === "user").map((m) => m.content),
  );
  const pronto = Boolean(assinatura) && motivoValido && ciente && formatRefundFeedback(detalhes, houveErro === "sim", contato === "sim") !== null;

  const enviar = async () => {
    if (!assinatura || !pronto || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("request-refund", {
        body: {
          subscription_id: assinatura.id,
          reason: proposta.motivo,
          reason_details: detalhes,
          had_error: houveErro === "sim",
          can_contact: contato === "sim",
          access_end_acknowledged: ciente,
          source: "refund_chat",
          sandbox,
        },
      });
      if (error || !(data as { success?: boolean } | null)?.success) {
        setErro(await mensagemDeErro(error, data, "Não foi possível enviar agora. Tente de novo em instantes."));
        return;
      }
      onEnviado();
    } catch (e) {
      console.error("[atendimento-reembolso] envio", e);
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ml-12 mt-3 max-w-[560px] rounded-[16px] border border-[#BFD3FB] bg-white p-4 shadow-[0_8px_24px_-14px_rgba(37,99,235,0.45)] sm:p-5">
      <p className="flex items-center gap-2 text-[15.5px] font-medium text-[#0F172A]">
        <CheckCircle2 size={18} className="text-[#2563EB]" aria-hidden="true" /> Confira o seu pedido de reembolso
      </p>
      <dl className="mt-3 divide-y divide-[#EEF0F3] rounded-[12px] border border-[#E4E7EB] text-[14.5px]">
        <ItemCartao rotulo="Motivo" valor={proposta.motivo} />
        <ItemCartao rotulo="O que aconteceu" valor={proposta.resumo} />
        <ItemCartao rotulo="Valor a devolver" valor={fmtValor(assinatura?.amount)} />
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SimNao legenda="Aconteceu algum erro na Velo?" nome="cartao-houve-erro" valor={houveErro} onChange={setHouveErro} />
        <SimNao legenda="Podemos falar com você?" nome="cartao-contato" valor={contato} onChange={setContato} />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[10px] border border-[#FCD34D] bg-[#FFFBEB] p-3.5 text-[14px] leading-[1.55] text-[#3F3A2E]">
        <input
          type="checkbox"
          checked={ciente}
          onChange={(e) => setCiente(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[#2563EB]"
        />
        <span>
          <strong className="font-semibold text-[#0F172A]">Entendo que, se o reembolso for aprovado, meu acesso será encerrado:</strong> o
          plano acaba na hora, os anúncios publicados pela Velo no Mercado Livre são encerrados e novas publicações ficam bloqueadas por 30
          dias. Também entendo que a renovação é cancelada assim que eu enviar o pedido.
        </span>
      </label>

      {!assinatura ? (
        <div className="mt-4">
          <Aviso tom="neutro" icone={<AlertCircle size={18} aria-hidden="true" />}>
            Não encontramos a assinatura desta conta na tela. Recarregue a página e tente de novo.
          </Aviso>
        </div>
      ) : null}
      {erro ? (
        <div className="mt-4">
          <Aviso tom="erro" icone={<XCircle size={18} aria-hidden="true" />}>
            {erro}
          </Aviso>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
        <BotaoSecundario onClick={onCorrigir} disabled={enviando}>
          Corrigir algo na conversa
        </BotaoSecundario>
        <BotaoPrincipal onClick={() => void enviar()} disabled={!pronto || enviando}>
          {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          Enviar pedido
        </BotaoPrincipal>
      </div>
      <p className="mt-2.5 text-[12.5px] text-[#6E6E80]">{PRAZO_REEMBOLSO}</p>
    </div>
  );
}

function ItemCartao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-0.5 px-3.5 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-3">
      <dt className="text-[#52606D]">{rotulo}</dt>
      <dd className="break-words text-[#0F172A]">{valor}</dd>
    </div>
  );
}
