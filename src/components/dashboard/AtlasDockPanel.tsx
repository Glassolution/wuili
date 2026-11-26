import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Brain, Check, Copy, MoreHorizontal, Mic, Plus, Send, Maximize2, PackageSearch, PlayCircle, SquarePen, ThumbsDown, ThumbsUp, X as CloseIcon } from "lucide-react";

import AtlasHistoryMenu from "@/components/dashboard/AtlasHistoryMenu";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import AtlasMessageText from "@/components/dashboard/AtlasMessageText";
import AtlasThinkingText from "@/components/dashboard/AtlasThinkingText";
import { useAuth } from "@/contexts/AuthContext";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import { salvarRetornoMl } from "@/lib/mlOauthRetorno";
import { veloToast } from "@/components/ui/velo-toast";
import AtlasPublishComposer from "@/components/dashboard/AtlasPublishComposer";
import AtlasProductCarousel from "@/components/dashboard/AtlasProductCarousel";
import AtlasCriarLojaModal from "@/components/dashboard/AtlasCriarLojaModal";
import AtlasBotaoCriarSite from "@/components/dashboard/AtlasBotaoCriarSite";
import AtlasEscolherCores from "@/components/dashboard/AtlasEscolherCores";
import AtlasConstrucaoDaLoja from "@/components/dashboard/AtlasConstrucaoDaLoja";
import type { BriefingDaLoja } from "@/lib/briefingDaLoja";
import VideoTutorialModal from "@/components/dashboard/VideoTutorialModal";
import { TUTORIAL_CONTA_VENDEDOR } from "@/lib/tutorialMercadoLivre";
import {
  getMessageActions,
  useAtlasChat,
  useAtlasNavegacao,
  type AtlasMessage,
  type AtlasAction,
  type AtlasCreateStoreAction,
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

/*
  Texto das respostas. O plugin de tipografia do Tailwind não está ligado, então
  `prose` não fazia nada e as listas saíam sem marcador: o estilo vai aqui direto.
*/
const ESTILO_DA_RESPOSTA = [
  "max-w-none break-words text-[#1F1F1F]",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_strong]:font-semibold [&_strong]:text-[#0A0A0A] [&_em]:italic",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-1 [&_li]:pl-0.5 [&_li::marker]:text-[#A3A3A3]",
  "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-[1.15em] [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[1.08em] [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:font-semibold",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[#E2E2DF] [&_blockquote]:pl-3 [&_blockquote]:text-[#5C5C5C]",
  "[&_code]:rounded-[5px] [&_code]:bg-[#F0F0EE] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]",
  "[&_hr]:my-4 [&_hr]:border-black/[0.08]",
].join(" ");

/** Tempo entre a pergunta e a resposta, pelos horários das próprias mensagens. */
const segundosPensando = (lista: AtlasMessage[], indice: number): number | null => {
  const resposta = lista[indice];
  for (let i = indice - 1; i >= 0; i -= 1) {
    if (lista[i].role !== "user") continue;
    const diferenca = (Date.parse(resposta.created_at) - Date.parse(lista[i].created_at)) / 1000;
    // Fora dessa faixa o número não diz nada (relógios diferentes, conversa retomada).
    if (!Number.isFinite(diferenca) || diferenca < 0 || diferenca > 300) return null;
    return Math.max(1, Math.round(diferenca));
  }
  return null;
};

const IconePensando = ({ className = "" }: { className?: string }) => (
  <Brain aria-hidden className={className} strokeWidth={1.6} />
);

const RotuloPensou = ({ segundos }: { segundos: number | null }) => (
  <div className="mb-2 flex items-center gap-2 text-[13px] text-[#8A8A8A]">
    <IconePensando className="h-4 w-4 shrink-0" />
    <span>{segundos ? `Pensou por ${segundos}s` : "Atlas"}</span>
  </div>
);

const quandoFoi = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  if (Date.now() - data.getTime() < 60_000) return "agora há pouco";
  return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
};

const BotaoDaResposta = ({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick?: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={rotulo}
    aria-label={rotulo}
    className="grid h-7 w-7 place-items-center rounded-[7px] text-[#9A9A9A] transition-colors hover:bg-black/[0.05] hover:text-[#3A3A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
  >
    {children}
  </button>
);

const IconeHexagono = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M8 1.6 13.5 4.8v6.4L8 14.4 2.5 11.2V4.8L8 1.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const BotaoDaBarra = ({
  rotulo,
  onClick,
  ativo = false,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  ativo?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={rotulo}
    aria-label={rotulo}
    aria-pressed={ativo}
    className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-black/[0.05] hover:text-[#1F1F1F] ${ativo ? "bg-black/[0.05] text-[#1F1F1F]" : "text-[#5C5C5C]"}`}
  >
    {children}
  </button>
);

const ItemDoMenu = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13px] text-[#1F1F1F] transition-colors hover:bg-black/[0.045]"
  >
    {children}
  </button>
);

/** Atalhos do "+": só preenchem a caixa, a pessoa completa e envia. */
const COMECOS = [
  { rotulo: "Criar uma loja", texto: "Quero criar uma loja de " },
  { rotulo: "Achar um produto para vender", texto: "Me ajuda a achar um produto para vender de " },
  { rotulo: "Criar uma página de vendas", texto: "Quero uma página de vendas para " },
  { rotulo: "Vender no Mercado Livre", texto: "Quero começar a vender no Mercado Livre" },
];

/* Ditado pelo navegador (Chrome, Edge, Safari). Sem suporte, o microfone não aparece. */
type ResultadoDeVoz = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
type ReconhecimentoDeVoz = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((evento: ResultadoDeVoz) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type ConstrutorDeVoz = new () => ReconhecimentoDeVoz;
const ReconhecedorDeVoz: ConstrutorDeVoz | undefined =
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { SpeechRecognition?: ConstrutorDeVoz; webkitSpeechRecognition?: ConstrutorDeVoz })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: ConstrutorDeVoz }).webkitSpeechRecognition;

const formatMargin = (margin?: number | null) =>
  typeof margin === "number" && Number.isFinite(margin) ? `${Math.round(margin)}% de margem` : "Margem a verificar";

const formatPrice = (price?: number | null) =>
  typeof price === "number" && Number.isFinite(price)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
    : null;

const AtlasDockPanel = () => {
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();
  const { user } = useAuth();
  const reduzirMovimento = useReducedMotion();
  const {
    aberto, modo, mensagens, enviando, carregandoConversa, erro, threadId, quota,
    fechar, novaConversa, enviar, abrirConversa, aoApagarConversa, construcao, criarLoja,
  } = useAtlasChat();
  // Briefing do "Criar meu site" clicado: abre o modal da loja.
  const [briefingDoModal, setBriefingDoModal] = useState<BriefingDaLoja | null>(null);
  const navegarPeloAtlas = useAtlasNavegacao();

  const [texto, setTexto] = useState("");
  const [conectandoMl, setConectandoMl] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<"iniciar" | "mais" | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const barraRef = useRef<HTMLDivElement>(null);
  const ditadoRef = useRef<ReconhecimentoDeVoz | null>(null);
  const ditadoDisponivel = Boolean(ReconhecedorDeVoz);

  // Fecha o menu ao clicar fora dele ou apertar Esc.
  useEffect(() => {
    if (!menuAberto) return;
    const fora = (e: MouseEvent) => {
      if (!barraRef.current?.contains(e.target as Node)) setMenuAberto(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAberto(null);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuAberto]);

  // Para de ouvir se o painel fechar.
  useEffect(() => {
    if (!aberto) ditadoRef.current?.stop();
  }, [aberto]);
  useEffect(() => () => ditadoRef.current?.stop(), []);

  const preencher = (inicio: string) => {
    setMenuAberto(null);
    setTexto(inicio);
    window.requestAnimationFrame(() => {
      const campo = campoRef.current;
      if (!campo) return;
      campo.focus();
      campo.setSelectionRange(inicio.length, inicio.length);
    });
  };

  const alternarDitado = () => {
    if (ouvindo) {
      ditadoRef.current?.stop();
      return;
    }
    if (!ReconhecedorDeVoz) return;
    const base = texto.trim();
    const voz = new ReconhecedorDeVoz();
    voz.lang = "pt-BR";
    voz.interimResults = true;
    voz.continuous = true;
    voz.onresult = (evento) => {
      const falado = Array.from(evento.results)
        .map((r) => r[0]?.transcript ?? "")
        .join("")
        .trim();
      setTexto(base ? `${base} ${falado}` : falado);
    };
    voz.onend = () => {
      setOuvindo(false);
      ditadoRef.current = null;
      campoRef.current?.focus();
    };
    voz.onerror = () => {
      setOuvindo(false);
      veloToast.error("Não consegui usar o microfone. Confira a permissão do navegador.");
    };
    ditadoRef.current = voz;
    try {
      voz.start();
      setOuvindo(true);
    } catch {
      setOuvindo(false);
    }
  };

  const copiarConversa = async () => {
    const tudo = mensagens
      .map((m) => `${m.role === "user" ? "Você" : "Atlas"}: ${m.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(tudo);
      veloToast.success("Conversa copiada");
    } catch {
      veloToast.error("Não foi possível copiar");
    }
  };
  const fimDaListaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const nomeDoUsuario =
    (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    user?.email ||
    "";
  const inicialDoUsuario = (nomeDoUsuario.trim()[0] ?? "V").toUpperCase();

  const copiar = async (mensagem: AtlasMessage) => {
    try {
      await navigator.clipboard.writeText(mensagem.content);
      setCopiadoId(mensagem.id);
      window.setTimeout(() => setCopiadoId((atual) => (atual === mensagem.id ? null : atual)), 1600);
    } catch {
      veloToast.error("Não foi possível copiar");
    }
  };

  // A caixa cresce com o texto até o limite (max-h no CSS) e depois rola.
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, 200)}px`;
  }, [texto, aberto]);

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
      // Mesma aba: ao voltar, o Atlas reabre a conversa exatamente onde parou.
      salvarRetornoMl({
        origem: "atlas",
        rota: `${window.location.pathname}${window.location.search}`,
        threadId,
      });
      await startMercadoLivreOAuth({ novaAba: false });
      setConectandoMl(false);
    } catch (e) {
      setConectandoMl(false);
      veloToast.error(e instanceof Error ? e.message : "Não foi possível abrir a conexão com o Mercado Livre");
    }
  };

  const submeter = (evento: Pick<FormEvent, "preventDefault">) => {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setTexto("");
    void enviar(conteudo);
  };

  const titulo = mensagens.find((m) => m.role === "user")?.content ?? "Conversa com o Atlas";
  // Declarado antes de `renderAcoes` porque o carrossel de produtos usa a
  // largura do painel para decidir o tamanho dos cards.
  const lateral = modo === "lateral";
  const [tutorialAberto, setTutorialAberto] = useState(false);

  const renderAcoes = (mensagem: AtlasMessage) => {
    const acoes = getMessageActions(mensagem);
    if (acoes.length === 0) return null;

    const atalhos = acoes.filter(
      (a): a is AtlasNavigationAction => a.type === "navigation" && a.variant === "primary",
    );
    const sugestoes = acoes.filter((a): a is AtlasQuickReplyAction => a.type === "quick_reply");
    const pedidoDeLoja = acoes.find((a): a is AtlasCreateStoreAction => a.type === "create_store");
    const demais = acoes.filter(
      (a): a is Exclude<AtlasAction, AtlasQuickReplyAction | AtlasCreateStoreAction> =>
        a.type !== "quick_reply" &&
        a.type !== "create_store" &&
        !(a.type === "navigation" && a.variant === "primary"),
    );

    return (
      <div className="mt-4 flex flex-col gap-2">
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

          // Publicação conduzida dentro da conversa: título, lucro, descrição e
          // o botão que publica, tudo na própria mensagem.
          if (acao.type === "publish_ml") {
            return (
              <AtlasPublishComposer
                key={`pub-${acao.product_id}-${i}`}
                produtoId={acao.product_id}
                label={acao.label}
                compacto={lateral}
              />
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

          // Quando o Mercado Livre recusa por conta inativa, o vídeo do passo a
          // passo fica ao lado da explicação — sem mandar a pessoa procurar.
          if (acao.type === "watch_tutorial") {
            return (
              <button
                key={`tutorial-${i}`}
                type="button"
                onClick={() => setTutorialAberto(true)}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border !border-[#E4E7EC] bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-[#353535] transition-colors hover:bg-[#F7F8FA]"
              >
                <PlayCircle className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" strokeWidth={2.2} />
                <span className="truncate">{acao.label}</span>
              </button>
            );
          }

          // A vitrine do guia é parte da mensagem: o carrossel entra aqui
          // mesmo, em vez de um botão que abria um modal por cima da conversa.
          if (acao.type === "open_showcase") {
            return <AtlasProductCarousel key={`vitrine-${i}`} nicho={acao.niche ?? null} compacto={lateral} />;
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

        {pedidoDeLoja && (
          <AtlasBotaoCriarSite rotulo={pedidoDeLoja.label} onClick={() => setBriefingDoModal(pedidoDeLoja.briefing)} />
        )}

        {atalhos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {atalhos.map((acao, i) => (
              <button
                key={`atalho-${acao.route}-${i}`}
                type="button"
                onClick={() => void navegarPeloAtlas(acao.route)}
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-[8px] border !border-black/[0.1] bg-white px-3 text-[12.5px] font-medium text-[#1F1F1F] transition-colors duration-150 hover:!border-black/[0.18] hover:bg-[#F7F7F5]"
              >
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#8A8A8A]" strokeWidth={2} aria-hidden />
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
                className="inline-flex h-8 max-w-full items-center rounded-[8px] border !border-black/[0.1] bg-white px-3 text-[12.5px] font-medium text-[#1F1F1F] transition-colors duration-150 hover:!border-black/[0.18] hover:bg-[#F7F7F5] disabled:cursor-wait disabled:opacity-45"
              >
                <span className="truncate">{acao.label}</span>
              </button>
            ))}
          </div>
        )}

        {mensagem.product_data?.briefing?.etapa === "cores" && mensagens[mensagens.length - 1]?.id === mensagem.id && (
          <AtlasEscolherCores desativado={enviando} onEscolher={(texto) => void enviar(texto)} />
        )}
      </div>
    );
  };

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
          data-atlas-chat
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
      <header className="flex h-[56px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.06] px-4 sm:px-5">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium tracking-[-0.01em] text-[#1F1F1F]">
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
            className="grid h-8 w-8 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-black/[0.05] hover:text-[#1F1F1F]"
            aria-label="Nova conversa"
          >
            <SquarePen className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
          {/* Leva a conversa junto. Sem o id, a tela cheia abre sem thread,
              cria uma "Nova conversa" vazia e a pessoa acha que perdeu tudo —
              a conversa continuava no histórico, mas fora da tela. */}
          <button
            type="button"
            onClick={() => navigate(threadId ? `/dashboard/atlas/${threadId}` : "/dashboard/atlas")}
            className="grid h-8 w-8 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-black/[0.05] hover:text-[#1F1F1F]"
            aria-label="Abrir em tela cheia"
          >
            <Maximize2 className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={fechar}
            className="grid h-8 w-8 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-black/[0.05] hover:text-[#1F1F1F]"
            aria-label="Fechar o Atlas"
          >
            <CloseIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
        <div className={`flex flex-col gap-7 ${lateral ? "" : "mx-auto w-full max-w-[640px] pt-2"}`}>
          {mensagens.map((mensagem, indice) => (
            <Fragment key={mensagem.id}>
            <article className={mensagem.role === "user" ? "flex flex-col items-end gap-2" : "block"}>
              {mensagem.role === "user" ? (
                <>
                  <span
                    aria-hidden
                    className="grid h-6 w-6 place-items-center rounded-full bg-[#5B63D3] text-[11px] font-semibold text-white"
                  >
                    {inicialDoUsuario}
                  </span>
                  <div
                    className={`whitespace-pre-wrap break-words rounded-[10px] bg-[#F0F0EE] px-3.5 py-2.5 text-[#1F1F1F] ${lateral ? "max-w-[88%] text-[13px] leading-[1.55]" : "max-w-[75%] text-[14px] leading-[1.6]"}`}
                  >
                    {mensagem.content}
                  </div>
                </>
              ) : (
                <motion.div
                  initial={reduzirMovimento ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduzirMovimento ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="group/resposta min-w-0"
                >
                  <RotuloPensou segundos={segundosPensando(mensagens, indice)} />
                  <AtlasMessageText
                    content={mensagem.content}
                    className={`${ESTILO_DA_RESPOSTA} ${lateral ? "text-[13.5px] leading-[1.65]" : "text-[14.5px] leading-[1.75]"}`}
                  />
                  {renderAcoes(mensagem)}
                  <div className="mt-2.5 flex items-center gap-1 text-[12px] text-[#9A9A9A]">
                    <time dateTime={mensagem.created_at} className="mr-1 tabular-nums">
                      {quandoFoi(mensagem.created_at)}
                    </time>
                    <BotaoDaResposta
                      rotulo={copiadoId === mensagem.id ? "Copiado" : "Copiar resposta"}
                      onClick={() => void copiar(mensagem)}
                    >
                      {copiadoId === mensagem.id ? (
                        <Check className="h-3.5 w-3.5 text-[#16A34A]" strokeWidth={2} />
                      ) : (
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.7} />
                      )}
                    </BotaoDaResposta>
                    <BotaoDaResposta rotulo="Gostei da resposta">
                      <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </BotaoDaResposta>
                    <BotaoDaResposta rotulo="Não gostei da resposta">
                      <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </BotaoDaResposta>
                  </div>
                </motion.div>
              )}
            </article>
            {construcao && construcao.depoisDe === indice + 1 && (
              <article key={construcao.id}>
                <AtlasConstrucaoDaLoja id={construcao.id} pedido={construcao.pedido} />
              </article>
            )}
            </Fragment>
          ))}

          {(enviando || carregandoConversa) && (
            <div className="flex items-center gap-2 text-[13.5px] text-[#8A8A8A]">
              <IconePensando className="h-4 w-4 shrink-0" />
              <AtlasThinkingText text={carregandoConversa ? "Carregando conversa..." : "Pensando..."} />
            </div>
          )}

          {erro && !enviando && (
            <p className="rounded-[10px] border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-[12.5px] text-rose-700" role="alert">
              {erro}
            </p>
          )}

          <div ref={fimDaListaRef} />
        </div>
      </div>

      {/* Sem borda superior: a barra do chat encosta na conversa sem risco separando. */}
      <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-5">
        <form
          data-atlas-composer
          onSubmit={submeter}
          className={`rounded-[14px] border border-black/[0.1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] transition-[border-color,box-shadow] focus-within:border-black/[0.18] focus-within:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_10px_28px_-12px_rgba(16,24,40,0.18)] ${lateral ? "" : "mx-auto w-full max-w-[640px]"}`}
        >
          <textarea
            ref={campoRef}
            value={texto}
            rows={lateral ? 2 : 3}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submeter(e);
              }
            }}
            placeholder={enviando ? "Quer pedir mais alguma coisa enquanto isso?" : "Pergunte qualquer coisa..."}
            aria-label="Mensagem para o Atlas"
            autoComplete="off"
            className="block max-h-[200px] w-full resize-none border-0 bg-transparent px-4 pt-3.5 text-[14px] leading-[1.55] text-[#1F1F1F] outline-none placeholder:text-[#9A9A9A]"
          />
          <div ref={barraRef} className="relative flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <BotaoDaBarra
                rotulo="Por onde começar"
                ativo={menuAberto === "iniciar"}
                onClick={() => setMenuAberto((m) => (m === "iniciar" ? null : "iniciar"))}
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </BotaoDaBarra>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-black/[0.1] px-2.5 text-[12.5px] font-medium text-[#2A2A2A]">
                <IconeHexagono className="h-4 w-4 text-[#3A3A3A]" />
                Atlas
              </span>
              <button
                type="button"
                onClick={() => preencher("Quero criar uma loja de ")}
                className="inline-flex h-8 items-center rounded-[8px] border border-black/[0.1] px-2.5 text-[12.5px] font-medium text-[#2A2A2A] transition-colors hover:border-black/[0.18] hover:bg-[#F7F7F5]"
              >
                Criar
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <BotaoDaBarra
                rotulo="Mais opções"
                ativo={menuAberto === "mais"}
                onClick={() => setMenuAberto((m) => (m === "mais" ? null : "mais"))}
              >
                <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </BotaoDaBarra>
              {ditadoDisponivel && (
                <BotaoDaBarra
                  rotulo={ouvindo ? "Parar de ouvir" : "Falar em vez de digitar"}
                  ativo={ouvindo}
                  onClick={alternarDitado}
                >
                  <Mic className={`h-[17px] w-[17px] ${ouvindo ? "text-rose-600" : ""}`} strokeWidth={1.7} />
                  {ouvindo && <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
                </BotaoDaBarra>
              )}
              <button
                type="submit"
                disabled={!texto.trim() || enviando}
                className="ml-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#0A0A0A] text-white transition-[background-color,transform] hover:bg-[#262626] active:scale-95 disabled:bg-[#EDEDEB] disabled:text-black/30"
                aria-label={enviando ? "O Atlas está respondendo" : "Enviar"}
              >
                {enviando ? (
                  <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-current" />
                ) : (
                  <Send className="h-[15px] w-[15px] -translate-x-px translate-y-px" strokeWidth={1.8} />
                )}
              </button>
            </div>

            {menuAberto && (
              <div
                role="menu"
                className={`absolute bottom-full z-10 mb-2 w-[260px] rounded-[12px] border border-black/[0.08] bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)] ${menuAberto === "iniciar" ? "left-2" : "right-2"}`}
              >
                {menuAberto === "iniciar" ? (
                  <>
                    <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-medium text-[#8A8A8A]">Por onde começar</p>
                    {COMECOS.map((c) => (
                      <ItemDoMenu key={c.rotulo} onClick={() => preencher(c.texto)}>
                        {c.rotulo}
                      </ItemDoMenu>
                    ))}
                  </>
                ) : (
                  <>
                    <ItemDoMenu
                      onClick={() => {
                        setMenuAberto(null);
                        novaConversa();
                      }}
                    >
                      Nova conversa
                    </ItemDoMenu>
                    <ItemDoMenu
                      onClick={() => {
                        setMenuAberto(null);
                        void copiarConversa();
                      }}
                    >
                      Copiar a conversa
                    </ItemDoMenu>
                    <ItemDoMenu
                      onClick={() => {
                        setMenuAberto(null);
                        navigate(threadId ? `/dashboard/atlas/${threadId}` : "/dashboard/atlas");
                      }}
                    >
                      Abrir em tela cheia
                    </ItemDoMenu>
                  </>
                )}
              </div>
            )}
          </div>
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
                onClick={() => upgradeModal.open({ origin: "atlas_quota" })}
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

      <AtlasCriarLojaModal
        key="atlas-modal-criar-loja"
        briefing={briefingDoModal}
        onFechar={() => setBriefingDoModal(null)}
        onCriar={(pedido) => {
          setBriefingDoModal(null);
          criarLoja(pedido);
        }}
      />

      <VideoTutorialModal
        key="atlas-video-tutorial"
        open={tutorialAberto}
        onClose={() => setTutorialAberto(false)}
        title={TUTORIAL_CONTA_VENDEDOR.title}
        description={TUTORIAL_CONTA_VENDEDOR.description}
        src={TUTORIAL_CONTA_VENDEDOR.src}
        aspectPadding={TUTORIAL_CONTA_VENDEDOR.aspectPadding}
      />
    </AnimatePresence>
  );
};

export default AtlasDockPanel;
