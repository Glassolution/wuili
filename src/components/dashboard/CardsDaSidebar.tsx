import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Gift,
  Link2,
  Mail,
  Pause,
  Percent,
  Play,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  TrendingUp,
  Trophy,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteSino from "@/assets/agentes/sino.png";

/*
  Cards em carrossel no pé da sidebar (25/11/2026), no modelo da referência
  "Integrations": barras de progresso em cima, ícones flutuando sobre um brilho,
  título, texto e botão em pílula. Passa sozinho a cada 6 s (pausa no botão, no
  hover e com "reduzir movimento"). Cada card leva a uma função real da Velo.
*/

type Icone =
  | { tipo: "imagem"; src: string; fundo?: string; ajuste?: number }
  | { tipo: "solto"; src: string }
  | { tipo: "icone"; Icone: LucideIcon; fundo: string; cor: string };

export type CardDaSidebar = {
  id: string;
  titulo: string;
  texto: string;
  botao: string;
  acao: () => void;
  icones: [Icone, Icone, Icone, Icone];
};

// Quatro posições fixas (como na referência): esquerda grande, baixo pequeno,
// topo pequeno e direita grande.
const POSICOES: { left: string; top: number; tamanho: number; giro: number; atraso: number }[] = [
  { left: "6%", top: 22, tamanho: 38, giro: -9, atraso: 0 },
  { left: "33%", top: 50, tamanho: 26, giro: 7, atraso: 0.8 },
  { left: "55%", top: 12, tamanho: 26, giro: 5, atraso: 1.6 },
  { left: "74%", top: 14, tamanho: 38, giro: -5, atraso: 0.4 },
];

const PONTOS = [
  { left: "26%", top: 16 },
  { left: "48%", top: 44 },
  { left: "67%", top: 58 },
  { left: "88%", top: 66 },
  { left: "18%", top: 72 },
  { left: "62%", top: 30 },
];

const DURACAO_MS = 6000;

const CSS = `
@keyframes velo-card-flutua { 0%, 100% { transform: translateY(0) rotate(var(--giro)); } 50% { transform: translateY(-4px) rotate(var(--giro)); } }
@keyframes velo-card-barra { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.velo-card-icone { animation: velo-card-flutua 4.2s ease-in-out infinite; }
.velo-card-barra-ativa { transform-origin: left center; animation: velo-card-barra ${DURACAO_MS}ms linear forwards; }
.velo-card-pausado .velo-card-barra-ativa, .velo-card-pausado .velo-card-icone { animation-play-state: paused; }
.velo-card-botao { transition: background-color 150ms ease-out, border-color 150ms ease-out; }
.velo-card-botao:hover { background: #F4F4F5 !important; border-color: #D4D4D8 !important; }
.velo-card-botao:focus-visible, .velo-card-pausa:focus-visible, .velo-card-segmento:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.45) !important; }
.velo-card-pausa { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-card-pausa:hover { background: #F4F4F5 !important; color: #18181B !important; }
@media (prefers-reduced-motion: reduce) {
  .velo-card-icone { animation: none; transform: rotate(var(--giro)); }
  .velo-card-barra-ativa { animation: none; transform: scaleX(1); }
}
`;

const DesenhoDoIcone = ({ icone, tamanho }: { icone: Icone; tamanho: number }) => {
  if (icone.tipo === "solto") {
    return <img src={icone.src} alt="" draggable={false} className="h-full w-full select-none object-contain drop-shadow-[0_6px_10px_rgba(17,17,20,0.18)]" />;
  }
  const raio = Math.round(tamanho * 0.28);
  const moldura: CSSProperties = {
    borderRadius: raio,
    boxShadow: "0 6px 14px rgba(17,17,20,0.14), 0 1px 2px rgba(17,17,20,0.10), inset 0 0 0 1px rgba(255,255,255,0.35)",
  };
  if (icone.tipo === "imagem") {
    return (
      <span className="grid h-full w-full place-items-center overflow-hidden" style={{ ...moldura, background: icone.fundo ?? "#FFFFFF" }}>
        <img
          src={icone.src}
          alt=""
          draggable={false}
          className="select-none object-contain"
          style={{ width: `${icone.ajuste ?? 100}%`, height: `${icone.ajuste ?? 100}%` }}
        />
      </span>
    );
  }
  const { Icone: Desenho } = icone;
  return (
    <span className="grid h-full w-full place-items-center" style={{ ...moldura, background: icone.fundo, color: icone.cor }}>
      <Desenho aria-hidden="true" style={{ width: tamanho * 0.48, height: tamanho * 0.48 }} strokeWidth={2.1} />
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
  const [pausado, setPausado] = useState(false);
  const [mouseEmCima, setMouseEmCima] = useState(false);
  const [convidarAberto, setConvidarAberto] = useState(false);

  const cards: CardDaSidebar[] = [
    ...(cardDoPlano
      ? [
          {
            id: "plano",
            titulo: cardDoPlano.titulo,
            texto: cardDoPlano.texto,
            botao: "Fazer upgrade",
            acao: cardDoPlano.acao,
            icones: [
              { tipo: "icone", Icone: Trophy, fundo: "#2563EB", cor: "#FFFFFF" },
              { tipo: "icone", Icone: Sparkles, fundo: "#EEF2FF", cor: "#4F46E5" },
              { tipo: "icone", Icone: Star, fundo: "#FEF3C7", cor: "#D97706" },
              { tipo: "icone", Icone: TrendingUp, fundo: "#18181B", cor: "#FFFFFF" },
            ],
          } satisfies CardDaSidebar,
        ]
      : []),
    {
      id: "integracoes",
      titulo: "Integrações",
      texto: "Conecte o Mercado Livre para publicar produtos e receber seus pedidos na Velo.",
      botao: "Conectar integrações",
      acao: () => navigate("/dashboard/configuracoes?tab=Integrações"),
      icones: [
        { tipo: "imagem", src: "/logo.png", fundo: "#FFFFFF", ajuste: 70 },
        { tipo: "icone", Icone: Link2, fundo: "#18181B", cor: "#FFFFFF" },
        { tipo: "icone", Icone: Store, fundo: "#ECFDF5", cor: "#059669" },
        { tipo: "imagem", src: "/mercado-livre-logo.svg", fundo: "#FFE600" },
      ],
    },
    {
      id: "agentes",
      titulo: "Agentes",
      texto: "Os agentes da Velo criam, editam e publicam o site da sua loja.",
      botao: "Ver agentes",
      acao: () => navigate("/dashboard/projetos"),
      icones: [
        { tipo: "solto", src: agenteLua },
        { tipo: "solto", src: agenteCubo },
        { tipo: "solto", src: agenteSino },
        { tipo: "solto", src: agenteFolha },
      ],
    },
    {
      id: "catalogo",
      titulo: "Catálogo",
      texto: "Produtos de fornecedores brasileiros, prontos para importar e publicar.",
      botao: "Explorar catálogo",
      acao: () => navigate("/dashboard/catalogo"),
      icones: [
        { tipo: "icone", Icone: ShoppingBag, fundo: "#2563EB", cor: "#FFFFFF" },
        { tipo: "icone", Icone: Tag, fundo: "#FEF3C7", cor: "#D97706" },
        { tipo: "icone", Icone: Truck, fundo: "#ECFDF5", cor: "#059669" },
        { tipo: "icone", Icone: TrendingUp, fundo: "#F5F3FF", cor: "#7C3AED" },
      ],
    },
    {
      id: "indique",
      titulo: "Indique e ganhe",
      texto: "Quando seu amigo assinar um plano, vocês dois ganham 15% de desconto.",
      botao: "Convidar amigo",
      acao: () => setConvidarAberto(true),
      icones: [
        { tipo: "icone", Icone: Gift, fundo: "#FCE7F3", cor: "#DB2777" },
        { tipo: "icone", Icone: Percent, fundo: "#ECFDF5", cor: "#059669" },
        { tipo: "icone", Icone: Mail, fundo: "#FEF3C7", cor: "#D97706" },
        { tipo: "icone", Icone: Users, fundo: "#2563EB", cor: "#FFFFFF" },
      ],
    },
  ];

  const total = cards.length;
  const indice = atual % total;
  const card = cards[indice];
  const parado = pausado || mouseEmCima || reduzir;

  // Passa para o próximo card; o tempo recomeça a cada troca (manual ou automática).
  useEffect(() => {
    if (parado) return;
    const id = window.setTimeout(() => setAtual((n) => (n + 1) % total), DURACAO_MS);
    return () => window.clearTimeout(id);
  }, [indice, parado, total]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Novidades da Velo"
      className={`relative overflow-hidden rounded-[16px] border border-[#E4E4E7] bg-white px-3.5 pb-3.5 pt-3 ${parado ? "velo-card-pausado" : ""}`}
      style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.05)" }}
      onMouseEnter={() => setMouseEmCima(true)}
      onMouseLeave={() => setMouseEmCima(false)}
    >
      <style>{CSS}</style>

      {/* Barras de progresso (clicáveis) e o botão de pausa. */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5">
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Ver ${c.titulo}`}
              aria-current={i === indice}
              onClick={() => setAtual(i)}
              className="velo-card-segmento relative h-3 flex-1 rounded-full"
              style={{ background: "transparent", boxShadow: "none" }}
            >
              <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-[#E4E4E7]">
                {i < indice ? <span className="absolute inset-0 bg-[#18181B]" /> : null}
                {i === indice ? (
                  <span key={`${c.id}-${atual}`} className="velo-card-barra-ativa absolute inset-0 bg-[#18181B]" />
                ) : null}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={pausado ? "Continuar a passar os cards" : "Pausar os cards"}
          onClick={() => setPausado((p) => !p)}
          className="velo-card-pausa grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#71717A]"
          style={{ background: "transparent", boxShadow: "none" }}
        >
          {pausado ? <Play className="h-2.5 w-2.5" fill="currentColor" /> : <Pause className="h-2.5 w-2.5" fill="currentColor" />}
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={card.id}
          initial={reduzir ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduzir ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduzir ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Ilustração: ícones flutuando, pontinhos, filetes e o brilho embaixo. */}
          <div aria-hidden="true" className="relative mt-2 h-[92px]">
            {["22%", "50%", "76%"].map((left) => (
              <span key={left} className="absolute top-[34px] h-[40px] w-px bg-gradient-to-b from-transparent via-[#E4E4E7] to-transparent" style={{ left }} />
            ))}
            {PONTOS.map((p, i) => (
              <span key={i} className="absolute h-[2px] w-[2px] rounded-full bg-[#A1A1AA]" style={{ left: p.left, top: p.top }} />
            ))}
            <span
              className="absolute inset-x-2 bottom-0 h-8"
              style={{ background: "radial-gradient(60% 100% at 50% 100%, rgba(124,58,237,0.16), rgba(37,99,235,0.08) 45%, transparent 75%)" }}
            />
            <span
              className="absolute inset-x-5 bottom-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.55) 30%, rgba(37,99,235,0.7) 55%, transparent)" }}
            />
            {card.icones.map((icone, i) => {
              const pos = POSICOES[i];
              return (
                <span
                  key={i}
                  className="velo-card-icone absolute"
                  style={
                    {
                      left: pos.left,
                      top: pos.top,
                      width: pos.tamanho,
                      height: pos.tamanho,
                      "--giro": `${pos.giro}deg`,
                      animationDelay: `${pos.atraso}s`,
                    } as CSSProperties
                  }
                >
                  <DesenhoDoIcone icone={icone} tamanho={pos.tamanho} />
                </span>
              );
            })}
          </div>

          <p className="m-0 mt-3 text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[#18181B]">{card.titulo}</p>
          <p className="m-0 mt-1 text-[13px] leading-[19px] text-[#71717A]">{card.texto}</p>
          <button
            type="button"
            onClick={card.acao}
            className="velo-card-botao mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-[#E4E4E7] text-[13px] font-medium text-[#18181B]"
            style={{ background: "#FAFAFA", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}
          >
            {card.botao}
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </motion.div>
      </AnimatePresence>

      {/* No body: dentro da sidebar (que anima com transform) o modal fixo ficaria preso. */}
      {createPortal(<InviteFriendModal open={convidarAberto} onClose={() => setConvidarAberto(false)} />, document.body)}
    </section>
  );
};

export default CardsDaSidebar;
