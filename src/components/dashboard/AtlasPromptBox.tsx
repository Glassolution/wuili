import { useEffect, useRef, useState, type ElementType, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Globe, History, Lightbulb, Loader2, Telescope, Wand2 } from "lucide-react";
import { useAtlasChat } from "@/contexts/AtlasChatContext";

// Atalhos da barra de baixo: preenchem a caixa com uma pergunta pronta (não enviam).
const ATALHOS: { id: string; rotulo: string; icone: ElementType; texto: string }[] = [
  {
    id: "ideias",
    rotulo: "Ideias de produto",
    icone: Lightbulb,
    texto: "Me sugira 5 produtos para eu começar a vender na minha loja.",
  },
  {
    id: "tendencias",
    rotulo: "Pesquisar tendências",
    icone: Telescope,
    texto: "Quais produtos estão em alta agora no Mercado Livre?",
  },
  {
    id: "site",
    rotulo: "Melhorar meu site",
    icone: Globe,
    texto: "Como posso deixar o site da minha loja mais atraente para vender mais?",
  },
];

// Perguntas que giram no placeholder e que a varinha coloca na caixa.
const PERGUNTAS = [
  "Pergunte ao Atlas sobre a sua loja",
  "Como publico meu primeiro produto?",
  "Escreva a descrição de um produto para mim",
  "Qual preço devo cobrar por este produto?",
  "Como conecto minha conta do Mercado Livre?",
];

const ALTURA_MAXIMA = 140;

const BOX_CSS = `
.velo-atlas-box { transition: border-color 180ms ease-out, box-shadow 180ms ease-out; }
.velo-atlas-box:focus-within { border-color: #CACACA; box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.06); }
.velo-atlas-icone { transition: background-color 150ms ease-out, color 150ms ease-out, transform 150ms ease-out; }
.velo-atlas-icone:hover:not(:disabled) { background: #F1F1F1; color: #000000; }
.velo-atlas-icone:active:not(:disabled) { transform: scale(0.94); }
.velo-atlas-varinha:hover { background: #F3F0FF; color: #6A48F0; }
.velo-atlas-enviar { transition: background-color 150ms ease-out, transform 150ms ease-out, box-shadow 150ms ease-out; }
.velo-atlas-enviar:hover:not(:disabled) { background: #2A2A2A; }
.velo-atlas-enviar:disabled { cursor: default; }
.velo-atlas-enviar:active:not(:disabled) { transform: scale(0.96); }
.velo-atlas-dica { opacity: 0; transform: translate(-50%, 4px); transition: opacity 140ms ease-out, transform 140ms ease-out; }
.velo-atlas-com-dica:hover .velo-atlas-dica, .velo-atlas-com-dica:focus-visible .velo-atlas-dica { opacity: 1; transform: translate(-50%, 0); }
.velo-atlas-icone:focus-visible, .velo-atlas-enviar:focus-visible {
  outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(124,92,250,0.45);
}
.velo-atlas-texto::placeholder { color: transparent; }
@media (prefers-reduced-motion: reduce) {
  .velo-atlas-icone, .velo-atlas-enviar, .velo-atlas-dica { transition: none; }
}
`;

// Botão redondo com dica (tooltip) acima, no estilo da barra da referência.
const BotaoIcone = ({
  rotulo,
  icone: Icone,
  onClick,
  className = "",
  tamanhoIcone = 18,
}: {
  rotulo: string;
  icone: ElementType;
  onClick: () => void;
  className?: string;
  tamanhoIcone?: number;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={rotulo}
    className={`velo-atlas-icone velo-atlas-com-dica relative flex h-8 w-8 items-center justify-center rounded-[8px] text-[#303030] ${className}`}
  >
    <Icone size={tamanhoIcone} strokeWidth={2} aria-hidden="true" />
    <span
      aria-hidden="true"
      className="velo-atlas-dica pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 whitespace-nowrap rounded-[8px] bg-[#0B0D12] px-2 py-1 text-[12px] font-medium text-white"
    >
      {rotulo}
    </span>
  </button>
);

/**
 * Caixa do Atlas da Início. Só dispara a primeira mensagem: a conversa vive no
 * AtlasChatProvider e é desenhada pelo AtlasDockPanel (lógica do Atlas intocada).
 */
const AtlasPromptBox = () => {
  const navigate = useNavigate();
  const { enviar, enviando } = useAtlasChat();
  const reduceMotion = useReducedMotion();
  const [mensagem, setMensagem] = useState("");
  const [focada, setFocada] = useState(false);
  const [indicePergunta, setIndicePergunta] = useState(0);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const podeEnviar = mensagem.trim().length > 0 && !enviando;

  // Placeholder que alterna entre perguntas enquanto a caixa está vazia e sem foco.
  useEffect(() => {
    if (reduceMotion || focada || mensagem) return;
    const timer = window.setInterval(() => setIndicePergunta((i) => (i + 1) % PERGUNTAS.length), 3500);
    return () => window.clearInterval(timer);
  }, [reduceMotion, focada, mensagem]);

  // A caixa cresce com o texto, até um limite; depois rola.
  useEffect(() => {
    const el = textoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, ALTURA_MAXIMA)}px`;
  }, [mensagem]);

  const preencher = (texto: string) => {
    setMensagem(texto);
    window.requestAnimationFrame(() => {
      const el = textoRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(texto.length, texto.length);
    });
  };

  const sugerirPergunta = () => {
    // Pula a primeira (é só o convite genérico) e avança a cada clique.
    const proximo = indicePergunta + 1 >= PERGUNTAS.length ? 1 : indicePergunta + 1;
    setIndicePergunta(proximo);
    preencher(PERGUNTAS[proximo]);
  };

  const enviarMensagem = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const texto = mensagem.trim();
    if (!texto || enviando) return;
    setMensagem("");
    void enviar(texto);
  };

  const aoTeclar = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra a linha.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <style>{BOX_CSS}</style>

      <form
        onSubmit={enviarMensagem}
        className="velo-atlas-box relative rounded-[16px] border border-[#E3E3E3] bg-white px-4 pb-3 pt-3.5"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <button
          type="button"
          onClick={sugerirPergunta}
          aria-label="Sugerir uma pergunta"
          className="velo-atlas-icone velo-atlas-varinha velo-atlas-com-dica absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7C5CFA]"
        >
          <Wand2 size={16} strokeWidth={1.7} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="velo-atlas-dica pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 whitespace-nowrap rounded-[8px] bg-[#0B0D12] px-2 py-1 text-[12px] font-medium text-white"
          >
            Sugerir uma pergunta
          </span>
        </button>

        <div className="relative pr-9">
          <label htmlFor="inicio-atlas" className="sr-only">
            Mensagem para o Atlas
          </label>
          <textarea
            id="inicio-atlas"
            ref={textoRef}
            rows={2}
            value={mensagem}
            onChange={(event) => setMensagem(event.target.value)}
            onKeyDown={aoTeclar}
            onFocus={() => setFocada(true)}
            onBlur={() => setFocada(false)}
            placeholder={PERGUNTAS[indicePergunta]}
            className="velo-atlas-texto block w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-[1.5] text-[#0B0D12] outline-none"
            style={{ minHeight: 44, maxHeight: ALTURA_MAXIMA }}
          />
          {/* Placeholder animado (o nativo fica transparente para não piscar). */}
          {!mensagem && (
            <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 text-[15px] leading-[1.5] text-[#8A8A8A]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={indicePergunta}
                  className="block"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {PERGUNTAS[indicePergunta]}
                </motion.span>
              </AnimatePresence>
            </span>
          )}
        </div>

        {/* Barra de baixo no estilo da referência: tudo à direita, ícones escuros e traço firme. */}
        <div className="mt-2 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate("/dashboard/atlas")}
            className="velo-atlas-icone flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[14px] font-medium text-[#303030]"
          >
            <History size={17} strokeWidth={2} aria-hidden="true" />
            Conversas
          </button>
          <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-[#E3E3E3]" />
          {ATALHOS.map((atalho) => (
            <BotaoIcone key={atalho.id} rotulo={atalho.rotulo} icone={atalho.icone} onClick={() => preencher(atalho.texto)} />
          ))}
          <button
            type="submit"
            disabled={!podeEnviar}
            aria-label={enviando ? "Enviando para o Atlas" : "Enviar para o Atlas"}
            className="velo-atlas-enviar ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#000000] text-white"
          >
            {enviando ? (
              <Loader2 size={16} strokeWidth={2.4} aria-hidden="true" className="animate-spin" />
            ) : (
              <ArrowUp size={18} strokeWidth={2.6} aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AtlasPromptBox;
