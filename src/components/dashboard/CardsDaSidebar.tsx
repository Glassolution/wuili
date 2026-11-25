import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  Link2,
  Mail,
  Package,
  Percent,
  Rocket,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Trophy,
  Truck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteSino from "@/assets/agentes/sino.png";

/*
  Cards no pé da sidebar (25/11/2026), no modelo da referência "Próximo passo":
  em cima os ícones em arco ao redor de um ícone principal (com linhas finas
  ligando ao centro e um deles em destaque com anel), um filete, e embaixo o
  rótulo ("INTEGRAÇÃO · 1 DE 4"), título e texto em até 2 linhas. Em azul da
  Velo e todos do mesmo tamanho (texto com altura fixa). Embaixo do card: seta
  anterior, bolinhas e seta próxima. O botão redondo do canto recolhe o desenho.
  Passa sozinho a cada 7 s (para no hover e com "reduzir movimento"). Cada card
  leva a uma função real da Velo.
*/

type Icone = { tipo: "imagem"; src: string; ajuste?: number } | { tipo: "icone"; Icone: LucideIcon };

export type CardDaSidebar = {
  id: string;
  rotulo: string;
  titulo: string;
  texto: string;
  acao: () => void;
  /** Ícone principal, embaixo no centro do arco. */
  centro: Icone;
  /** Quatro ícones no arco de dentro, da esquerda para a direita; o primeiro fica em destaque. */
  arco: [Icone, Icone, Icone, Icone];
};

const DURACAO_MS = 7000;
const ALTURA_DESENHO = 120;
// Centro do arco (embaixo, no meio do desenho) e os raios dos dois arcos.
const CENTRO_Y = 98;
const RAIO_DENTRO = 58;
const RAIO_FORA = 92;
const graus = (g: number) => (g * Math.PI) / 180;
const noArco = (raio: number, angulo: number) => ({
  x: Math.round(raio * Math.cos(graus(angulo))),
  y: Math.round(CENTRO_Y - raio * Math.sin(graus(angulo))),
});
const ARCO_DENTRO = [160, 115, 65, 20].map((a) => noArco(RAIO_DENTRO, a));
const ARCO_FORA = [168, 132, 90, 48, 12].map((a) => noArco(RAIO_FORA, a));
// Rótulo (16) + título (20) + 2 linhas de texto (38) + espaços + respiros + filete.
const ALTURA_TEXTO = 112;

const CSS = `
@keyframes velo-card-flutua { 0%, 100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, calc(-50% - 2px)); } }
@keyframes velo-card-pulso { 0%, 100% { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 5px rgba(255,255,255,0.18); } 50% { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 8px rgba(255,255,255,0.06); } }
.velo-card-icone { animation: velo-card-flutua 4.6s ease-in-out infinite; }
.velo-card-anel { animation: velo-card-pulso 2.8s ease-in-out infinite; }
.velo-card-pausado .velo-card-icone, .velo-card-pausado .velo-card-anel { animation-play-state: paused; }
.velo-card-corpo .velo-card-brilho { transition: opacity 200ms ease-out; }
.velo-card-corpo:hover .velo-card-brilho { opacity: 1; }
.velo-card-recolher { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-card-recolher:hover { background-color: rgba(255,255,255,0.22) !important; color: #FFFFFF !important; }
.velo-card-nav { transition: background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out; }
.velo-card-nav:hover { background-color: #F4F4F5 !important; color: #18181B !important; border-color: #D4D4D8 !important; }
.velo-card-ponto { transition: width 250ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease-out; }
.velo-card-corpo:focus-visible, .velo-card-recolher:focus-visible, .velo-card-nav:focus-visible, .velo-card-ponto-alvo:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.45) !important; }
@media (prefers-reduced-motion: reduce) {
  .velo-card-icone, .velo-card-anel { animation: none; }
}
`;

const Quadradinho = ({ icone, tamanho, principal, destaque }: { icone: Icone; tamanho: number; principal?: boolean; destaque?: boolean }) => {
  // Sobre o azul: o principal é branco com o ícone azul; os do arco são de "vidro"
  // com o ícone branco. Logos e imagens dos agentes sempre em fundo branco.
  const branco = principal || icone.tipo === "imagem";
  const estilo: CSSProperties = branco
    ? {
        background: "#FFFFFF",
        color: "#2563EB",
        boxShadow: principal ? "0 10px 22px -6px rgba(15,23,42,0.5), 0 0 0 4px rgba(255,255,255,0.14)" : "0 6px 14px -4px rgba(15,23,42,0.35)",
      }
    : {
        background: "linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.1))",
        color: "#FFFFFF",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28), 0 6px 14px -6px rgba(15,23,42,0.35)",
        backdropFilter: "blur(6px)",
      };
  return (
    <span
      className={`grid h-full w-full place-items-center overflow-hidden ${destaque ? "velo-card-anel" : ""}`}
      style={{ ...estilo, borderRadius: principal ? Math.round(tamanho * 0.3) : "50%" }}
    >
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
  const [recolhido, setRecolhido] = useState(false);
  const [convidarAberto, setConvidarAberto] = useState(false);

  const cards: CardDaSidebar[] = [
    ...(cardDoPlano
      ? [
          {
            id: "plano",
            rotulo: "Seu plano",
            titulo: cardDoPlano.titulo,
            texto: cardDoPlano.texto,
            acao: cardDoPlano.acao,
            centro: { tipo: "icone", Icone: Trophy },
            arco: [
              { tipo: "icone", Icone: Star },
              { tipo: "icone", Icone: Rocket },
              { tipo: "icone", Icone: Sparkles },
              { tipo: "icone", Icone: TrendingUp },
            ],
          } satisfies CardDaSidebar,
        ]
      : []),
    {
      id: "integracoes",
      rotulo: "Integração",
      titulo: "Conecte o Mercado Livre",
      texto: "Publique produtos e receba seus pedidos direto na Velo.",
      acao: () => navigate("/dashboard/configuracoes?tab=Integrações"),
      centro: { tipo: "imagem", src: "/logo.png", ajuste: 66 },
      arco: [
        { tipo: "imagem", src: "/brand/mercado-livre.png", ajuste: 118 },
        { tipo: "icone", Icone: Link2 },
        { tipo: "icone", Icone: Package },
        { tipo: "icone", Icone: ShoppingCart },
      ],
    },
    {
      id: "agentes",
      rotulo: "Agentes",
      titulo: "Conheça os agentes",
      texto: "Eles criam, editam e publicam o site da sua loja.",
      acao: () => navigate("/dashboard/projetos"),
      centro: { tipo: "icone", Icone: Sparkles },
      arco: [
        { tipo: "imagem", src: agenteLua, ajuste: 80 },
        { tipo: "imagem", src: agenteCubo, ajuste: 80 },
        { tipo: "imagem", src: agenteSino, ajuste: 80 },
        { tipo: "imagem", src: agenteFolha, ajuste: 80 },
      ],
    },
    {
      id: "catalogo",
      rotulo: "Catálogo",
      titulo: "Explore o catálogo",
      texto: "Produtos de fornecedores brasileiros, prontos para importar e publicar.",
      acao: () => navigate("/dashboard/catalogo"),
      centro: { tipo: "icone", Icone: ShoppingBag },
      arco: [
        { tipo: "icone", Icone: Tag },
        { tipo: "icone", Icone: Search },
        { tipo: "icone", Icone: TrendingUp },
        { tipo: "icone", Icone: Truck },
      ],
    },
    {
      id: "indique",
      rotulo: "Indique e ganhe",
      titulo: "Convide um amigo",
      texto: "Quando ele assinar um plano, vocês dois ganham 15% de desconto.",
      acao: () => setConvidarAberto(true),
      centro: { tipo: "icone", Icone: Gift },
      arco: [
        { tipo: "icone", Icone: UserPlus },
        { tipo: "icone", Icone: Mail },
        { tipo: "icone", Icone: Users },
        { tipo: "icone", Icone: Percent },
      ],
    },
  ];

  const total = cards.length;
  const indice = atual % total;
  const card = cards[indice];
  const parado = mouseEmCima || reduzir;
  const irPara = (n: number) => setAtual(((n % total) + total) % total);

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
      className={parado ? "velo-card-pausado" : undefined}
      onMouseEnter={() => setMouseEmCima(true)}
      onMouseLeave={() => setMouseEmCima(false)}
    >
      <style>{CSS}</style>

      <div
        className="relative overflow-hidden rounded-[14px]"
        style={{
          background: "linear-gradient(165deg, #3B82F6 0%, #2563EB 42%, #1D4ED8 75%, #1E3A8A 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.22), 0 12px 26px -12px rgba(30,58,138,0.55)",
        }}
      >
        <button
          type="button"
          onClick={card.acao}
          className="velo-card-corpo relative block w-full p-0 text-left"
          style={{ background: "transparent", boxShadow: "none" }}
        >
          <span
            aria-hidden="true"
            className="velo-card-brilho pointer-events-none absolute inset-0 opacity-0"
            style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(255,255,255,0.14), transparent 70%)" }}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={card.id}
              className="block"
              initial={reduzir ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduzir ? { opacity: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: reduzir ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Desenho: dois arcos finos, linhas ligando o centro aos ícones de dentro, pontinhos no arco de fora. */}
              <motion.span
                aria-hidden="true"
                className="relative block overflow-hidden"
                initial={false}
                animate={{ height: recolhido ? 0 : ALTURA_DESENHO, opacity: recolhido ? 0 : 1 }}
                transition={{ duration: reduzir ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <svg
                  className="absolute left-1/2 top-0 -translate-x-1/2"
                  width={232}
                  height={ALTURA_DESENHO}
                  viewBox={`-116 0 232 ${ALTURA_DESENHO}`}
                  fill="none"
                >
                  <circle cx={0} cy={CENTRO_Y} r={RAIO_DENTRO} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                  <circle cx={0} cy={CENTRO_Y} r={RAIO_FORA} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="2 4" />
                  {ARCO_DENTRO.map((p, i) => (
                    <line key={i} x1={0} y1={CENTRO_Y} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
                  ))}
                  {ARCO_FORA.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgba(255,255,255,0.35)" />
                  ))}
                </svg>
                {card.arco.map((icone, i) => {
                  const p = ARCO_DENTRO[i];
                  const tamanho = 28;
                  return (
                    <span
                      key={i}
                      className="velo-card-icone absolute"
                      style={{
                        left: `calc(50% + ${p.x}px)`,
                        top: p.y,
                        width: tamanho,
                        height: tamanho,
                        transform: "translate(-50%, -50%)",
                        animationDelay: `${i * 0.5}s`,
                      }}
                    >
                      <Quadradinho icone={icone} tamanho={tamanho} destaque={i === 0} />
                    </span>
                  );
                })}
                <span className="absolute" style={{ left: "50%", top: CENTRO_Y, width: 38, height: 38, transform: "translate(-50%, -50%)" }}>
                  <Quadradinho icone={card.centro} tamanho={38} principal />
                </span>
              </motion.span>

              {/* Texto com altura fixa (título em 1 linha, texto em até 2): todos os cards ficam do mesmo tamanho. */}
              <span
                className="block border-t px-3.5 pb-3.5 pt-3"
                style={{ height: ALTURA_TEXTO, borderTopColor: recolhido ? "transparent" : "rgba(255,255,255,0.14)" }}
              >
                <span className="block truncate text-[10.5px] font-semibold uppercase leading-4 tracking-[0.08em] text-white/60">
                  {card.rotulo} · {indice + 1} de {total}
                </span>
                <span className="mt-1 block truncate text-[14px] font-semibold leading-5 tracking-[-0.01em] text-white">{card.titulo}</span>
                <span className="mt-1 line-clamp-2 text-[13px] leading-[19px] text-white/[0.78]">{card.texto}</span>
              </span>
            </motion.span>
          </AnimatePresence>
        </button>

        {/* Recolhe/mostra o desenho (como a setinha da referência). */}
        <button
          type="button"
          onClick={() => setRecolhido((r) => !r)}
          aria-label={recolhido ? "Mostrar o desenho do card" : "Recolher o desenho do card"}
          aria-expanded={!recolhido}
          className="velo-card-recolher absolute right-2 top-2 z-[3] grid h-7 w-7 place-items-center rounded-full text-white/80"
          style={{ background: "rgba(255,255,255,0.12)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)" }}
        >
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: recolhido ? "rotate(180deg)" : undefined }}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Navegação: anterior, bolinhas e próximo. */}
      <div className="mt-2.5 flex items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => irPara(indice - 1)}
          aria-label="Card anterior"
          className="velo-card-nav grid h-7 w-7 place-items-center rounded-full border border-[#E4E4E7] text-[#52525B]"
          style={{ background: "#FFFFFF", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <div className="flex items-center">
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => irPara(i)}
              aria-label={`Ver ${c.titulo}`}
              aria-current={i === indice}
              className="velo-card-ponto-alvo grid h-6 place-items-center rounded-full px-[3px]"
              style={{ background: "transparent", boxShadow: "none" }}
            >
              <span
                className="velo-card-ponto block h-1.5 rounded-full"
                style={{ width: i === indice ? 16 : 6, background: i === indice ? "#2563EB" : "#D4D4D8" }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => irPara(indice + 1)}
          aria-label="Próximo card"
          className="velo-card-nav grid h-7 w-7 place-items-center rounded-full border border-[#E4E4E7] text-[#52525B]"
          style={{ background: "#FFFFFF", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>

      {/* No body: dentro da sidebar (que anima com transform) o modal fixo ficaria preso. */}
      {createPortal(<InviteFriendModal open={convidarAberto} onClose={() => setConvidarAberto(false)} />, document.body)}
    </section>
  );
};

export default CardsDaSidebar;
