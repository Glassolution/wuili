import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Gift,
  Link2,
  Mail,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Trophy,
  Truck,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import agenteLua from "@/assets/agentes/lua.png";
import agenteFolha from "@/assets/agentes/folha.png";

/*
  Cards no pé da sidebar (25/11/2026), no modelo clean da referência "Convide seu
  time": em cima uma grade de linhas finas com uma coluna hachurada e três
  quadradinhos de ícone (o do meio em azul da Velo), um filete, e embaixo título
  e texto. Atrás do card aparece a aba do próximo (efeito de pilha); clicar nela
  passa o card. Passa sozinho a cada 7 s (para no hover e com "reduzir
  movimento"). O "x" esconde os cards só nesta visita. Cada card leva a uma
  função real da Velo.
*/

type Icone = { tipo: "imagem"; src: string; ajuste?: number } | { tipo: "icone"; Icone: LucideIcon };

export type CardDaSidebar = {
  id: string;
  titulo: string;
  texto: string;
  acao: () => void;
  /** Esquerda em cima, meio (em azul) e direita embaixo. */
  icones: [Icone, Icone, Icone];
};

const CELULA = 38;
const ALTURA_DESENHO = CELULA * 3;
const DURACAO_MS = 7000;

// Centro de cada quadradinho, em células a partir do centro da grade.
const POSICOES = [
  { col: -2, lin: -1, tamanho: 32, atraso: 0 },
  { col: 0, lin: 0, tamanho: 40, atraso: 0.6 },
  { col: 2, lin: 1, tamanho: 32, atraso: 1.2 },
];

const CSS = `
@keyframes velo-card-flutua { 0%, 100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, calc(-50% - 2px)); } }
.velo-card-icone { animation: velo-card-flutua 4.4s ease-in-out infinite; }
.velo-card-pausado .velo-card-icone { animation-play-state: paused; }
.velo-card-corpo { transition: background-color 150ms ease-out; }
.velo-card-corpo:hover { background-color: #FCFCFD !important; }
.velo-card-corpo .velo-card-seta { transition: color 150ms ease-out, transform 150ms ease-out; }
.velo-card-corpo:hover .velo-card-seta { color: #2563EB; transform: translate(1px, -1px); }
.velo-card-fechar, .velo-card-aba { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-card-fechar:hover { background-color: #F4F4F5 !important; color: #18181B !important; }
.velo-card-aba:hover { color: #3F3F46 !important; background-color: #F4F4F5 !important; }
.velo-card-corpo:focus-visible, .velo-card-fechar:focus-visible, .velo-card-aba:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.4) !important; }
@media (prefers-reduced-motion: reduce) {
  .velo-card-icone { animation: none; }
}
`;

const Quadradinho = ({ icone, tamanho, destaque }: { icone: Icone; tamanho: number; destaque: boolean }) => {
  const estilo: CSSProperties = destaque
    ? {
        background: "linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)",
        color: "#FFFFFF",
        boxShadow: "0 6px 14px -4px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
      }
    : {
        background: "#FFFFFF",
        color: "#3F3F46",
        boxShadow: "0 1px 2px rgba(16,24,40,0.06), 0 0 0 1px #E4E4E7",
      };
  return (
    <span className="grid h-full w-full place-items-center overflow-hidden" style={{ ...estilo, borderRadius: Math.round(tamanho * 0.3) }}>
      {icone.tipo === "imagem" ? (
        <img
          src={icone.src}
          alt=""
          draggable={false}
          className="select-none object-contain"
          style={{ width: `${icone.ajuste ?? 70}%`, height: `${icone.ajuste ?? 70}%` }}
        />
      ) : (
        <icone.Icone aria-hidden="true" style={{ width: tamanho * 0.46, height: tamanho * 0.46 }} strokeWidth={2} />
      )}
    </span>
  );
};

type Props = {
  /** Card do plano (teste ativo ou sem plano), quando faz sentido mostrar. */
  cardDoPlano?: { titulo: string; texto: string; acao: () => void } | null;
};

const CardsDaSidebar = ({ cardDoPlano }: Props) => {
  const navigate = useNavigate();
  const reduzir = !!useReducedMotion();
  const [atual, setAtual] = useState(0);
  const [mouseEmCima, setMouseEmCima] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [convidarAberto, setConvidarAberto] = useState(false);

  const cards: CardDaSidebar[] = [
    ...(cardDoPlano
      ? [
          {
            id: "plano",
            titulo: cardDoPlano.titulo,
            texto: cardDoPlano.texto,
            acao: cardDoPlano.acao,
            icones: [
              { tipo: "icone", Icone: Star },
              { tipo: "icone", Icone: Trophy },
              { tipo: "icone", Icone: TrendingUp },
            ],
          } satisfies CardDaSidebar,
        ]
      : []),
    {
      id: "integracoes",
      titulo: "Conecte o Mercado Livre",
      texto: "Publique produtos e receba seus pedidos direto na Velo.",
      acao: () => navigate("/dashboard/configuracoes?tab=Integrações"),
      icones: [
        { tipo: "imagem", src: "/logo.png", ajuste: 68 },
        { tipo: "icone", Icone: Link2 },
        { tipo: "imagem", src: "/brand/mercado-livre.png", ajuste: 116 },
      ],
    },
    {
      id: "agentes",
      titulo: "Conheça os agentes",
      texto: "Eles criam, editam e publicam o site da sua loja.",
      acao: () => navigate("/dashboard/projetos"),
      icones: [
        { tipo: "imagem", src: agenteLua, ajuste: 78 },
        { tipo: "icone", Icone: Sparkles },
        { tipo: "imagem", src: agenteFolha, ajuste: 78 },
      ],
    },
    {
      id: "catalogo",
      titulo: "Explore o catálogo",
      texto: "Produtos de fornecedores brasileiros, prontos para importar e publicar.",
      acao: () => navigate("/dashboard/catalogo"),
      icones: [
        { tipo: "icone", Icone: Tag },
        { tipo: "icone", Icone: ShoppingBag },
        { tipo: "icone", Icone: Truck },
      ],
    },
    {
      id: "indique",
      titulo: "Indique e ganhe",
      texto: "Quando seu amigo assinar um plano, vocês dois ganham 15% de desconto.",
      acao: () => setConvidarAberto(true),
      icones: [
        { tipo: "icone", Icone: Mail },
        { tipo: "icone", Icone: UserPlus },
        { tipo: "icone", Icone: Gift },
      ],
    },
  ];

  const total = cards.length;
  const indice = atual % total;
  const card = cards[indice];
  const proximo = cards[(indice + 1) % total];
  const parado = mouseEmCima || reduzir || fechado;

  // Passa para o próximo card; o tempo recomeça a cada troca (manual ou automática).
  useEffect(() => {
    if (parado) return;
    const id = window.setTimeout(() => setAtual((n) => (n + 1) % total), DURACAO_MS);
    return () => window.clearTimeout(id);
  }, [indice, parado, total]);

  // No body: dentro da sidebar (que anima com transform) o modal fixo ficaria preso.
  const modal = createPortal(<InviteFriendModal open={convidarAberto} onClose={() => setConvidarAberto(false)} />, document.body);
  if (fechado) return modal;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Novidades da Velo"
      className={`relative pt-[22px] ${parado ? "velo-card-pausado" : ""}`}
      onMouseEnter={() => setMouseEmCima(true)}
      onMouseLeave={() => setMouseEmCima(false)}
    >
      <style>{CSS}</style>

      {/* Aba do próximo card, atrás (efeito de pilha). Clicar passa o card. */}
      <button
        type="button"
        onClick={() => setAtual((n) => (n + 1) % total)}
        aria-label={`Próximo: ${proximo.titulo}`}
        className="velo-card-aba absolute inset-x-3 top-0 flex h-[34px] items-start justify-center rounded-t-[12px] border border-b-0 border-[#E4E4E7] pt-[5px] text-[12px] font-medium text-[#71717A]"
        style={{ background: "#FAFAFA", boxShadow: "none" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={proximo.id}
            className="max-w-full truncate px-3"
            initial={reduzir ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduzir ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={{ duration: reduzir ? 0 : 0.2 }}
          >
            {proximo.titulo}
          </motion.span>
        </AnimatePresence>
      </button>

      <div
        className="relative overflow-hidden rounded-[14px] border border-[#E4E4E7] bg-white"
        style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 10px 24px -12px rgba(16,24,40,0.12)" }}
      >
        <button
          type="button"
          onClick={card.acao}
          className="velo-card-corpo block w-full p-0 text-left"
          style={{ background: "transparent", boxShadow: "none" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={card.id}
              className="block"
              initial={reduzir ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduzir ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Desenho: grade de linhas finas, uma coluna hachurada e os três quadradinhos. */}
              <span aria-hidden="true" className="relative block overflow-hidden" style={{ height: ALTURA_DESENHO }}>
                <span
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "linear-gradient(#EEEEF0 1px, transparent 1px), linear-gradient(90deg, #EEEEF0 1px, transparent 1px)",
                    backgroundSize: `${CELULA}px ${CELULA}px`,
                    backgroundPosition: "50% 0px",
                    maskImage: "radial-gradient(120% 100% at 50% 50%, #000 55%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(120% 100% at 50% 50%, #000 55%, transparent 100%)",
                  }}
                />
                <span
                  className="absolute"
                  style={{
                    left: `calc(50% + ${CELULA / 2}px + 1px)`,
                    top: CELULA + 1,
                    width: CELULA - 1,
                    height: CELULA * 2 - 1,
                    backgroundImage: "repeating-linear-gradient(135deg, #E6E6EA 0 1px, transparent 1px 6px)",
                  }}
                />
                {card.icones.map((icone, i) => {
                  const pos = POSICOES[i];
                  return (
                    <span
                      key={i}
                      className="velo-card-icone absolute"
                      style={{
                        left: `calc(50% + ${pos.col * CELULA}px)`,
                        top: ALTURA_DESENHO / 2 + pos.lin * CELULA,
                        width: pos.tamanho,
                        height: pos.tamanho,
                        transform: "translate(-50%, -50%)",
                        animationDelay: `${pos.atraso}s`,
                      }}
                    >
                      <Quadradinho icone={icone} tamanho={pos.tamanho} destaque={i === 1} />
                    </span>
                  );
                })}
              </span>

              <span className="block border-t border-[#EFEFF1] px-3.5 pb-3.5 pt-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold leading-5 tracking-[-0.01em] text-[#18181B]">{card.titulo}</span>
                  <ArrowUpRight aria-hidden="true" className="velo-card-seta h-4 w-4 shrink-0 text-[#A1A1AA]" strokeWidth={2} />
                </span>
                <span className="mt-1 block text-[13px] leading-[19px] text-[#71717A]">{card.texto}</span>
              </span>
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          type="button"
          onClick={() => setFechado(true)}
          aria-label="Esconder os cards"
          className="velo-card-fechar absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[#A1A1AA]"
          style={{ background: "transparent", boxShadow: "none" }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {modal}
    </section>
  );
};

export default CardsDaSidebar;
