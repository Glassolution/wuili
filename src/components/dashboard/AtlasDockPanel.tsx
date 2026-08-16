import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Copy, Maximize2, PackageSearch, SquarePen, ThumbsDown, ThumbsUp, X as CloseIcon } from "lucide-react";

import AtlasHistoryMenu from "@/components/dashboard/AtlasHistoryMenu";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import AtlasMessageText from "@/components/dashboard/AtlasMessageText";
import AtlasThinkingText from "@/components/dashboard/AtlasThinkingText";
import { useAuth } from "@/contexts/AuthContext";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import { veloToast } from "@/components/ui/velo-toast";
import {
  getMessageActions,
  useAtlasChat,
  useAtlasNavegacao,
  type AtlasMessage,
  type AtlasAction,
  type AtlasNavigationAction,
  type AtlasQuickReplyAction,
} from "@/contexts/AtlasChatContext";

/**
 * Painel do Atlas ancorado à direita.
 *
 * Fica montado no layout, e não dentro de uma página, para que a conversa
 * sobreviva à navegação: o usuário clica num atalho, a rota muda, e o painel
 * continua exatamente onde estava.
 */

export const LARGURA_PAINEL_ATLAS = 400;

const AssistantAvatar = () => (
  <AtlasAvatarIcon className="block" style={{ width: "100%", height: "100%" }} />
);

const formatMargin = (margin?: number | null) =>
  typeof margin === "number" && Number.isFinite(margin) ? `${Math.round(margin)}% de margem` : "Margem a verificar";

const formatPrice = (price?: number | null) =>
  typeof price === "number" && Number.isFinite(price)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
    : null;

const AtlasDockPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduzirMovimento = useReducedMotion();
  const {
    aberto, modo, mensagens, enviando, carregandoConversa, erro, threadId, quota,
    fechar, novaConversa, enviar, abrirConversa, aoApagarConversa, abrirVitrine,
  } = useAtlasChat();
  const navegarPeloAtlas = useAtlasNavegacao();

  const [texto, setTexto] = useState("");
  const [conectandoMl, setConectandoMl] = useState(false);
  const fimDaListaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: reduzirMovimento ? "auto" : "smooth", block: "end" });
  }, [mensagens.length, enviando, reduzirMovimento]);

  useEffect(() => {
    if (aberto && !enviando) campoRef.current?.focus();
  }, [aberto, enviando]);

  const conectarMercadoLivre = async () => {
    if (conectandoMl) return;
    setConectandoMl(true);
    try {
      // Nova aba: o guia do Atlas continua aberto enquanto o usuário conecta.
      await startMercadoLivreOAuth({ novaAba: true });
      setConectandoMl(false);
    } catch (e) {
      setConectandoMl(false);
      veloToast.error(e instanceof Error ? e.message : "Não foi possível abrir a conexão com o Mercado Livre");
    }
  };

  const submeter = (evento: FormEvent) => {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setTexto("");
    void enviar(conteudo);
  };

  const titulo = mensagens.find((m) => m.role === "user")?.content ?? "Conversa com o Atlas";

  const renderAcoes = (mensagem: AtlasMessage) => {
    const acoes = getMessageActions(mensagem);
    if (acoes.length === 0) return null;

    const atalhos = acoes.filter(
      (a): a is AtlasNavigationAction => a.type === "navigation" && a.variant === "primary",
    );
    const sugestoes = acoes.filter((a): a is AtlasQuickReplyAction => a.type === "quick_reply");
    const demais = acoes.filter(
      (a): a is Exclude<AtlasAction, AtlasQuickReplyAction> =>
        a.type !== "quick_reply" && !(a.type === "navigation" && a.variant === "primary"),
    );

    return (
      <div className="mt-3 flex flex-col gap-2">
        {demais.map((acao, i) => {
          if (acao.type === "navigation") {
            return (
              <button
                key={`nav-${acao.route}-${i}`}
                type="button"
                onClick={() => void navegarPeloAtlas(acao.route)}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border !border-[#E4E7EC] bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-[#353535] transition-colors hover:bg-[#F7F8FA]"
              >
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" strokeWidth={2.2} />
                <span className="truncate">{acao.label}</span>
              </button>
            );
          }

          if (acao.type === "connect_ml") {
            return (
              <button
                key={`ml-${i}`}
                type="button"
                onClick={() => void conectarMercadoLivre()}
                disabled={conectandoMl}
                className="inline-flex w-fit max-w-full items-center rounded-full bg-[#2563EB] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
              >
                {conectandoMl ? "Abrindo o Mercado Livre…" : acao.label}
              </button>
            );
          }

          // Reabre a vitrine do guia (ela também abre sozinha ao chegar a
          // resposta, mas o botão fica para quem fechou o modal sem escolher).
          if (acao.type === "open_showcase") {
            return (
              <button
                key={`vitrine-${i}`}
                type="button"
                onClick={() => abrirVitrine(acao.niche ?? null)}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-[#2563EB] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                <PackageSearch className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                <span className="truncate">{acao.label}</span>
              </button>
            );
          }

          const produto = acao.product;

          const rota = produto?.route ?? `/dashboard/catalogo/${acao.product_id}`;
          const preco = formatPrice(produto?.suggested_price);

          return (
            <div
              key={`prod-${acao.product_id}-${i}`}
              className="flex w-full items-center gap-2.5 rounded-xl border !border-[#E4E7EC] bg-white p-2.5"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#F5F5F3]">
                {produto?.image_url ? (
                  <img src={produto.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <PackageSearch className="h-5 w-5 text-[#8A8A8A]" strokeWidth={1.8} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-[#303030]">
                  {produto?.title ?? "Produto do catálogo Velo"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                    {formatMargin(produto?.margin_percent)}
                  </span>
                  {preco ? <span className="text-[#858585]">{preco}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(rota)}
                className="shrink-0 rounded-full bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                Ver
              </button>
            </div>
          );
        })}

        {atalhos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {atalhos.map((acao, i) => (
              <button
                key={`atalho-${acao.route}-${i}`}
                type="button"
                onClick={() => void navegarPeloAtlas(acao.route)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border !border-[#D8E4FB] bg-[#F0F5FF] px-2.5 py-[6px] text-[12px] font-medium tracking-[-0.01em] text-[#1D4ED8] transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:!border-[#B9CFF8] hover:bg-[#E4EDFF]"
              >
                <ArrowUpRight className="h-3 w-3 shrink-0 text-[#2563EB]/70" strokeWidth={2.2} aria-hidden />
                <span className="truncate">{acao.label}</span>
              </button>
            ))}
          </div>
        )}

        {sugestoes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {sugestoes.map((acao, i) => (
              <button
                key={`sug-${acao.message}-${i}`}
                type="button"
                onClick={() => void enviar(acao.message)}
                disabled={enviando}
                className="inline-flex max-w-full items-center rounded-full border !border-[#DCE3F0] bg-white px-2.5 py-[6px] text-[12px] font-medium tracking-[-0.01em] text-[#1E3A8A] transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:!border-[#93B4F5] hover:bg-[#F5F8FF] disabled:cursor-wait disabled:opacity-45"
              >
                <span className="truncate">{acao.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const lateral = modo === "lateral";
  const painelInicial = reduzirMovimento
    ? false
    : lateral
      ? { opacity: 0, x: 32, clipPath: "inset(0 0 0 100%)", filter: "blur(4px)" }
      : { opacity: 0, scale: 0.992, filter: "blur(6px)" };
  const painelAnimado = lateral
    ? { opacity: 1, x: 0, clipPath: "inset(0 0 0 0%)", filter: "blur(0px)" }
    : { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" };
  const painelSaida = reduzirMovimento
    ? { opacity: 0, transition: { duration: 0 } }
    : lateral
      ? { opacity: 0, x: 22, clipPath: "inset(0 0 0 100%)", filter: "blur(4px)" }
      : { opacity: 0, scale: 0.994, filter: "blur(5px)" };

  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <motion.aside
          key={lateral ? "atlas-lateral" : "atlas-centralizado"}
          aria-label="Assistente Atlas"
          initial={painelInicial}
          animate={painelAnimado}
          exit={painelSaida}
          transition={{
            duration: reduzirMovimento ? 0 : lateral ? 0.46 : 0.34,
            ease: [0.22, 1, 0.36, 1],
            clipPath: { duration: reduzirMovimento ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: reduzirMovimento ? 0 : 0.24, ease: "easeOut" },
          }}
          style={
            lateral
              ? {
                  width: `min(${LARGURA_PAINEL_ATLAS}px, calc(100vw - 24px))`,
                  minWidth: `min(${LARGURA_PAINEL_ATLAS}px, calc(100vw - 24px))`,
                  maxWidth: `min(${LARGURA_PAINEL_ATLAS}px, calc(100vw - 24px))`,
                }
              : undefined
          }
          className={
            lateral
              // Lateral é irmão do <main> no flex: ocupa a própria coluna e
                // encolhe o conteúdo em vez de cobrir os produtos.
                ? "relative z-[55] flex h-full shrink-0 flex-col overflow-hidden border-l border-black/[0.07] bg-white shadow-[-18px_0_48px_rgba(15,23,42,0.04)]"
              : // Centralizado cobre a área de conteúdo, como era antes de existir o
                // painel lateral. Sobrepõe em vez de empurrar para não redimensionar a
                // página que está atrás.
                "absolute inset-0 z-[60] flex flex-col bg-[#FBFBFA]"
          }
        >
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.05] px-4 sm:px-6">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.015em] text-[#0A0A0A]">
          {titulo}
        </span>
        <div className="flex shrink-0 items-center gap-0.5 text-[#555]">
          <AtlasHistoryMenu
            userId={user?.id}
            activeThreadId={threadId}
            onSelectThread={abrirConversa}
            onThreadDeleted={aoApagarConversa}
          />
          <button
            type="button"
            onClick={novaConversa}
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-black/[0.045]"
            aria-label="Nova conversa"
          >
            <SquarePen className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard/atlas")}
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-black/[0.045]"
            aria-label="Abrir em tela cheia"
          >
            <Maximize2 className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={fechar}
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-black/[0.045]"
            aria-label="Fechar o Atlas"
          >
            <CloseIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        <div className={`flex flex-col gap-5 ${lateral ? "" : "mx-auto w-full max-w-[760px]"}`}>
          {mensagens.map((mensagem) => (
            <article key={mensagem.id} className={mensagem.role === "user" ? "flex justify-end" : "block"}>
              {mensagem.role === "user" ? (
                <div className={`break-words rounded-[16px] bg-[#F1F1EF] px-3 py-2 text-[#303030] ${lateral ? "max-w-[85%] text-[13px] leading-5" : "max-w-[70%] text-[14px] leading-6"}`}>
                  {mensagem.content}
                </div>
              ) : (
                <motion.div
                  initial={reduzirMovimento ? false : { opacity: 0, filter: "blur(5px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: reduzirMovimento ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0"
                >
                  <AtlasMessageText
                    content={mensagem.content}
                    className={`prose prose-sm max-w-none break-words text-[#303030] prose-p:my-1.5 prose-li:my-0.5 ${lateral ? "text-[13px] leading-6" : "text-[14.5px] leading-7"}`}
                  />
                  {renderAcoes(mensagem)}
                  <div className="mt-2 flex items-center gap-0.5 text-[#A3A3A3]">
                    {[
                      { label: "Copiar resposta", icon: Copy },
                      { label: "Gostei da resposta", icon: ThumbsUp },
                      { label: "Não gostei da resposta", icon: ThumbsDown },
                    ].map(({ label, icon: Icone }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={
                          label === "Copiar resposta"
                            ? () => void navigator.clipboard.writeText(mensagem.content)
                            : undefined
                        }
                        className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-black/[0.04] hover:text-[#555]"
                        aria-label={label}
                      >
                        <Icone className="h-3.5 w-3.5" strokeWidth={1.7} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </article>
          ))}

          {(enviando || carregandoConversa) && (
            <AtlasThinkingText
              className="text-[15px]"
              text={carregandoConversa ? "Carregando conversa..." : "Pensando..."}
            />
          )}

          {erro && !enviando && (
            <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-[12px] text-rose-700" role="alert">
              {erro}
            </p>
          )}

          <div ref={fimDaListaRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.05] p-3 sm:px-6 sm:pb-5">
        <form
          onSubmit={submeter}
          className={`flex items-center gap-2 rounded-full border border-black/[0.09] bg-white px-3 py-1.5 transition-colors focus-within:border-[#2563EB]/35 ${lateral ? "" : "mx-auto w-full max-w-[760px] px-4 py-2.5"}`}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center">
            <AssistantAvatar />
          </span>
          <input
            ref={campoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte qualquer coisa..."
            aria-label="Mensagem para o Atlas"
            autoComplete="off"
            disabled={enviando}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#343434] outline-none placeholder:text-[#8A8A8A] disabled:cursor-wait"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white transition-colors hover:bg-[#1D4ED8] disabled:bg-[#EFEFEF] disabled:text-black/20"
            aria-label="Enviar"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
              <path d="M12 19V5M6.7 10.3 12 5l5.3 5.3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        {/* Saldo do dia. Só aparece quando existe teto e já sabemos o número —
            avisar "restam N" antes da primeira resposta seria ruído. */}
        {quota && quota.limite !== null && quota.restantes !== null && (
          <p
            className={`mt-2 text-center text-[11px] ${quota.restantes === 0 ? "text-rose-600" : "text-[#8A8A8A]"}`}
            aria-live="polite"
          >
            {quota.restantes === 0
              ? "Você usou todas as mensagens de hoje."
              : `Restam ${quota.restantes} de ${quota.limite} mensagens hoje.`}
            {quota.plano === "gratis" && (
              <button
                type="button"
                onClick={() => navigate("/dashboard/planos")}
                className="ml-1 font-medium text-[#2563EB] hover:underline"
              >
                Ver planos
              </button>
            )}
          </p>
        )}
      </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default AtlasDockPanel;
