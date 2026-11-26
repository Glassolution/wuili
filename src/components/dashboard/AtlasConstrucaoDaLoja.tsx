import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, ChevronRight, PanelsTopLeft, X } from "lucide-react";

import AtlasEditorAoVivo, { medirOrigemDoEditor, type OrigemDoEditor } from "@/components/dashboard/AtlasEditorAoVivo";
import AtlasThinkingText from "@/components/dashboard/AtlasThinkingText";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import type { PedidoDeLoja } from "@/lib/briefingDaLoja";
import {
  assinarConstrucoes,
  editorJaVisto,
  iniciarConstrucao,
  lerConstrucao,
  marcarEditorVisto,
  type FonteDoPasso,
  type PassoDaConstrucao,
} from "@/lib/construcaoDaLoja";

/**
 * Construção da loja dentro do chat do Atlas, no estilo "IA trabalhando":
 * pílula com cronômetro e o que está fazendo agora; linha do tempo em que o
 * passo atual mostra as fontes sendo abertas uma a uma; passos prontos viram
 * uma linha discreta ("Abriu 4 fontes ›", com a miniatura das imagens), que
 * abre de novo num clique; o próximo passo aparece apagado e desfocado.
 */

const SUAVE = [0.22, 1, 0.36, 1] as const;

const cronometro = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/* Ícone de arquivo com a "orelha" dobrada, colorido pelo tipo da fonte. */
const COR_DO_ARQUIVO: Record<FonteDoPasso["tipo"], string> = {
  dados: "#22A355",
  documento: "#64748B",
  imagem: "#2563EB",
  catalogo: "#EA7A1A",
  modelo: "#7C3AED",
  cor: "#64748B",
};
const MARCA_DO_ARQUIVO: Record<FonteDoPasso["tipo"], string> = {
  dados: "{ }",
  documento: "≡",
  imagem: "▲",
  catalogo: "▦",
  modelo: "▤",
  cor: "●",
};

const IconeDeArquivo = ({ fonte }: { fonte: FonteDoPasso }) => {
  if (fonte.tipo === "cor" && fonte.cor)
    return <span aria-hidden className="block h-[15px] w-[15px] rounded-full ring-1 ring-black/10" style={{ background: fonte.cor }} />;
  return (
    <svg aria-hidden viewBox="0 0 14 17" className="h-[17px] w-[14px] shrink-0">
      <path d="M2 0h7l5 5v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z" fill={COR_DO_ARQUIVO[fonte.tipo]} />
      <path d="M9 0v3.2A1.8 1.8 0 0 0 10.8 5H14" fill="white" fillOpacity="0.45" />
      <text x="7" y="13" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="white" fontFamily="ui-sans-serif, system-ui">
        {MARCA_DO_ARQUIVO[fonte.tipo]}
      </text>
    </svg>
  );
};

const Miniatura = ({ src, alt, onAbrir }: { src: string; alt: string; onAbrir: (src: string) => void }) => (
  <button
    type="button"
    onClick={() => onAbrir(src)}
    className="h-[30px] w-[40px] shrink-0 overflow-hidden rounded-[6px] border border-black/[0.08] bg-[#F3F3F1] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-transform hover:scale-[1.04]"
    aria-label={`Ampliar ${alt}`}
  >
    <img src={src} alt={alt} className="h-full w-full object-cover" />
  </button>
);

const ListaDeFontes = ({ fontes, onAbrirImagem }: { fontes: FonteDoPasso[]; onAbrirImagem: (src: string) => void }) => {
  const reduzir = useReducedMotion();
  return (
    <ul className="space-y-1.5">
      <AnimatePresence initial={false}>
        {fontes.map((fonte, i) => (
          <motion.li
            key={`${fonte.nome}-${i}`}
            initial={reduzir ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: SUAVE }}
            className="flex min-w-0 items-center gap-2 text-[13px] text-[#4A4A4A]"
          >
            <IconeDeArquivo fonte={fonte} />
            <span className="truncate">{fonte.nome}</span>
            {fonte.imagem && <Miniatura src={fonte.imagem} alt={fonte.nome} onAbrir={onAbrirImagem} />}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
};

const PontoDoPasso = ({ status }: { status: PassoDaConstrucao["status"] }) => {
  if (status === "fazendo")
    return (
      <span className="relative grid h-[18px] w-[18px] place-items-center">
        <span className="absolute h-[14px] w-[14px] animate-ping rounded-full bg-[#2563EB]/25" />
        <span className="h-[8px] w-[8px] rounded-full bg-[#2563EB] shadow-[0_0_0_3px_rgba(37,99,235,0.16)]" />
      </span>
    );
  if (status === "aviso")
    return (
      <span className="grid h-[18px] w-[18px] place-items-center">
        <span className="h-[8px] w-[8px] rounded-full bg-[#D97706]" />
      </span>
    );
  return (
    <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ECECEA] text-[#555]">
      <Check className="h-[11px] w-[11px]" strokeWidth={2.6} />
    </span>
  );
};

const LinhaDoPasso = ({
  passo,
  onAbrirImagem,
}: {
  passo: PassoDaConstrucao;
  onAbrirImagem: (src: string) => void;
}) => {
  const [aberto, setAberto] = useState(false);
  const reduzir = useReducedMotion();
  const fazendo = passo.status === "fazendo";
  const imagens = passo.fontes.filter((f) => f.imagem);

  return (
    <motion.li
      layout={!reduzir}
      initial={reduzir ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: SUAVE }}
      className="relative"
    >
      <div className="flex items-start gap-3">
        <span className="mt-[3px] shrink-0">
          <PontoDoPasso status={passo.status} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-medium leading-6 tracking-[-0.01em] text-[#141414]">{passo.titulo}</p>
          {passo.detalhe && <p className="text-[13px] leading-5 text-[#7A7A7A]">{passo.detalhe}</p>}

          {/* Passo atual: as fontes abrindo, com a linha vertical à esquerda. */}
          {fazendo && (
            <div className="mt-2.5 border-l border-black/[0.09] pl-4">
              <AtlasThinkingText className="mb-2 text-[12.5px] text-[#A3A3A3]" text={`${passo.leitura ?? "Trabalhando"}...`} />
              <ListaDeFontes fontes={passo.fontes} onAbrirImagem={onAbrirImagem} />
            </div>
          )}

          {/* Passo pronto: uma linha discreta que abre de novo. */}
          {!fazendo && passo.fontes.length > 0 && (
            <>
              <div className="mt-1.5 flex max-w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAberto((v) => !v)}
                  aria-expanded={aberto}
                  className="flex min-w-0 items-center gap-2 rounded-[6px] py-0.5 text-left text-[12.5px] text-[#9A9A9A] transition-colors hover:text-[#4A4A4A]"
                >
                  <span className="truncate">
                    Abriu {passo.fontes.length} {passo.fontes.length === 1 ? "fonte" : "fontes"}
                  </span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${aberto ? "rotate-90" : ""}`}
                    strokeWidth={2}
                  />
                </button>
                {imagens.map((f) => (
                  <Miniatura key={f.nome} src={f.imagem!} alt={f.nome} onAbrir={onAbrirImagem} />
                ))}
              </div>
              <AnimatePresence initial={false}>
                {aberto && (
                  <motion.div
                    initial={reduzir ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduzir ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: SUAVE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 border-l border-black/[0.09] pl-4">
                      <ListaDeFontes fontes={passo.fontes} onAbrirImagem={onAbrirImagem} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.li>
  );
};

const AtlasConstrucaoDaLoja = ({ id, pedido }: { id: string; pedido: PedidoDeLoja }) => {
  const navigate = useNavigate();
  const { fechar } = useAtlasChat();
  const reduzirMovimento = useReducedMotion();
  const [agora, setAgora] = useState(() => Date.now());
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [editor, setEditor] = useState<OrigemDoEditor | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    iniciarConstrucao(id, pedido);
  }, [id, pedido]);

  const estado = useSyncExternalStore(assinarConstrucoes, () => lerConstrucao(id));
  const temPalco = !!estado?.palco;

  // Chegou a hora de montar: a tela vira o editor (uma vez; depois, pelo botão).
  useEffect(() => {
    if (!temPalco || editorJaVisto(id)) return;
    marcarEditorVisto(id);
    setEditor(medirOrigemDoEditor());
  }, [temPalco, id]);

  // Cronômetro da pílula: anda de segundo em segundo até terminar.
  useEffect(() => {
    if (!estado || estado.terminou) return;
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(relogio);
  }, [estado]);

  const visiveis = estado?.passos.filter((p) => p.status !== "esperando") ?? [];
  const proximo = estado?.passos.find((p) => p.status === "esperando") ?? null;
  const fontesAbertas = estado?.passos.reduce((n, p) => n + p.fontes.length, 0) ?? 0;

  // Cada passo e cada fonte nova rolam o chat para mostrar o que acabou de acontecer.
  useEffect(() => {
    const rolar = () => fimRef.current?.scrollIntoView({ behavior: reduzirMovimento ? "auto" : "smooth", block: "end" });
    rolar();
    // O palco só ganha altura depois de medir a largura: rola de novo em seguida.
    const depois = window.setTimeout(rolar, 260);
    return () => window.clearTimeout(depois);
  }, [visiveis.length, fontesAbertas, estado?.terminou, estado?.palco, reduzirMovimento]);

  if (!estado) return null;

  const atual = estado.passos.find((p) => p.status === "fazendo");
  const decorrido = (estado.terminouEm ?? agora) - estado.iniciouEm;

  return (
    <div className="min-w-0">
      {/* Pílula: cronômetro + o que está fazendo agora. */}
      <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-black/[0.07] bg-white py-1.5 pl-2.5 pr-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_14px_-6px_rgba(16,24,40,0.12)]">
        {estado.terminou ? (
          <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#16A34A] text-white">
            <Check className="h-[11px] w-[11px]" strokeWidth={3} />
          </span>
        ) : (
          <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px] animate-spin text-[#2563EB]">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.2" />
            <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        )}
        <span className="text-[13.5px] font-medium tabular-nums text-[#2563EB]">{cronometro(decorrido)}</span>
        <span className="truncate text-[13.5px] text-[#1F1F1F]">
          {estado.terminou
            ? estado.erro
              ? "Parou antes do fim"
              : `A ${pedido.nome} está pronta`
            : atual?.titulo ?? `Preparando a ${pedido.nome}`}
        </span>
      </div>

      <ol className="space-y-5">
        {visiveis.map((passo) => (
          <LinhaDoPasso key={passo.id} passo={passo} onAbrirImagem={setAmpliada} />
        ))}

        {/* Próximo passo: aparece apagado e desfocado, como quem ainda vai chegar lá. */}
        {proximo && !estado.terminou && (
          <li aria-hidden className="pointer-events-none flex select-none items-start gap-3 opacity-35 blur-[1.5px]">
            <svg viewBox="0 0 18 18" className="mt-[3px] h-[18px] w-[18px] animate-spin text-[#2563EB] [animation-duration:2.4s]">
              <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.2 3.2" strokeLinecap="round" />
            </svg>
            <p className="text-[14.5px] font-medium leading-6 text-[#141414]">{proximo.titulo}</p>
          </li>
        )}
      </ol>

      {/* Último passo: a loja é montada na tela do editor; daqui dá para voltar a ela. */}
      {estado.palco && (
        <motion.div
          initial={reduzirMovimento ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: SUAVE }}
          className="mt-5"
        >
          <button
            type="button"
            onClick={() => setEditor(medirOrigemDoEditor())}
            className="flex w-full max-w-[420px] items-center gap-3 rounded-[12px] border border-black/[0.08] bg-white px-3.5 py-3 text-left transition-colors hover:border-black/[0.16] hover:bg-[#FAFAF9]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#F3F3F1] text-[#3A3A3A]">
              <PanelsTopLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-[#141414]">Editor da {pedido.nome}</span>
              <span className="block truncate text-[12.5px] text-[#8A8A8A]">
                {estado.terminou ? "Abrir a tela de montagem" : "Montando a loja nesta tela"}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={1.8} />
          </button>
        </motion.div>
      )}

      <AtlasEditorAoVivo
        aberto={!!editor}
        origem={editor ?? { painel: null, composer: null }}
        nome={pedido.nome}
        palco={estado.palco}
        onFechar={() => setEditor(null)}
      />

      {estado.terminou && (
        <motion.div
          initial={reduzirMovimento ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: SUAVE }}
          className="mt-6"
        >
          <p className="text-[14px] leading-[1.7] text-[#1F1F1F]">
            {estado.erro
              ? "Deu um problema na hora de gravar. Tente de novo daqui a pouco; o que você escolheu continua aqui na conversa."
              : estado.demo
                ? "Assim fica a construção. Quando o Atlas de verdade estiver ligado, este botão leva direto para o editor da sua loja."
                : "Agora é com você: troque textos, fotos e preços no editor e publique quando quiser."}
          </p>
          <button
            type="button"
            disabled={!estado.projetoId}
            onClick={() => {
              if (!estado.projetoId) return;
              fechar();
              navigate(`/minha-loja/editor/${estado.projetoId}`);
            }}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[#0A0A0A] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#EDEDEB] disabled:text-black/35"
          >
            Abrir o editor da loja
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </motion.div>
      )}
      <div ref={fimRef} />

      {/* Imagem ampliada ao clicar na miniatura. */}
      <DialogPrimitive.Root open={!!ampliada} onOpenChange={(v) => !v && setAmpliada(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
            <DialogPrimitive.Title className="sr-only">Imagem criada para a {pedido.nome}</DialogPrimitive.Title>
            {ampliada && (
              <img src={ampliada} alt={`Imagem criada para a ${pedido.nome}`} className="max-h-[80svh] w-full rounded-[14px] object-contain shadow-2xl" />
            )}
            <DialogPrimitive.Close
              className="absolute -top-11 right-0 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#1F1F1F] transition-colors hover:bg-white"
              aria-label="Fechar imagem"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
};

export default AtlasConstrucaoDaLoja;
