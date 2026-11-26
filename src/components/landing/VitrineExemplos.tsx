import type { CSSProperties, ReactNode } from "react";
import { ImagemResponsiva } from "@/components/landing/ImagemResponsiva";
import agenteEstrela from "@/assets/agentes/grandes/estrela.webp";
import agenteConcha from "@/assets/agentes/grandes/concha.webp";
import agenteSino from "@/assets/agentes/grandes/sino.webp";
import agenteLua from "@/assets/agentes/grandes/lua.webp";
import agenteCubo from "@/assets/agentes/grandes/cubo.webp";
import agenteFolha from "@/assets/agentes/grandes/folha.webp";

/*
  Faixa de exemplos logo abaixo do hero, no modelo da base44.com: cartões soltos,
  cada um uma miniatura desenhada de algo que dá para fazer na Velo (loja, margem
  do produto, anúncio do Mercado Livre, página de vendas, Atlas, pedido). Alturas
  diferentes, alinhados pelo topo, 10px entre eles e os quadradinhos pretos de
  "seleção" nos cantos de cima, rolando devagar para a esquerda.

  Os exemplos são desenhados em JSX/SVG. Nenhum cartão mostra
  número de venda, faturamento ou resultado: só produto e preço de exemplo, que é
  o que a loja de qualquer pessoa teria.

  Com "reduzir movimento" ligado a faixa para e vira rolagem com o dedo.
*/

const MONO = "[font-family:ui-monospace,'SF_Mono',Menlo,monospace]";
const VAO = 10; // px entre cartões (o quadradinho fica centrado no vão)

/* A logo de verdade (cesta azul com a seta branca), no lugar de uma cestinha desenhada.
   Em fundo azul ela some, por isso os quadrados com logo usam o lilás claro. */
export function LogoVelo({ tamanho, sizes, className = "" }: { tamanho: string; sizes?: string; className?: string }) {
  return (
    <ImagemResponsiva
      base="logo"
      larguras={[96, 320]}
      original="/logo.png"
      alt=""
      sizes={sizes ?? tamanho}
      className={`object-contain ${className}`}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

function Quadradinho({ lado }: { lado: "esq" | "dir" }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-[-10px] z-10 h-[8px] w-[8px] bg-[#16181D] ${lado === "esq" ? "left-[-9px]" : "right-[-9px]"}`}
    />
  );
}

/*
  Agente da Velo espiando por cima do cartão: só a parte de cima aparece, o resto
  fica atrás do cartão (que vem por cima, z-[1]). Um por cartão, pequeno e longe
  dos quadradinhos dos cantos; sobe um pouco quando o mouse passa no cartão.
  Imagens: os mesmos recortes da tela de login (src/assets/agentes/grandes).
*/
type AgenteEspiando = { src: string; x: string; h?: number };

function Espiando({ agente }: { agente: AgenteEspiando }) {
  const altura = agente.h ?? 62;
  return (
    <img
      src={agente.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className="pointer-events-none absolute z-0 w-auto select-none drop-shadow-[0_6px_8px_rgba(21,30,60,0.14)] transition-transform duration-300 ease-out group-hover:-translate-y-2"
      style={{ left: agente.x, height: altura, bottom: `calc(100% - ${Math.round(altura * 0.3)}px)` }}
    />
  );
}

function Cartao({
  w,
  h,
  children,
  className = "",
  style,
  agente,
}: {
  w: number;
  h: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  agente?: AgenteEspiando;
}) {
  return (
    <div className="group relative shrink-0" style={{ width: w, marginRight: VAO }}>
      {agente && <Espiando agente={agente} />}
      <Quadradinho lado="esq" />
      <Quadradinho lado="dir" />
      <div className={`relative z-[1] overflow-hidden ${className}`} style={{ height: h, ...style }}>
        {children}
      </div>
    </div>
  );
}

/* ── 1. Loja online ─────────────────────────────────────────── */
function CartaoLoja() {
  return (
    <Cartao w={375} h={188} agente={{ src: agenteFolha, x: "16%" }} className="flex gap-3 bg-[#1E5A33] p-3.5 text-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[10px] text-white/70">Minha loja</p>
        <div className="mt-0.5 flex items-center gap-2.5">
          <p className="text-[17px] font-medium tracking-[-0.02em]">Loja da Ana</p>
          <span className="flex h-[16px] w-[28px] items-center rounded-full bg-white/90 p-[2px]">
            <span className="ml-auto h-3 w-3 rounded-full bg-[#1E5A33]" />
          </span>
        </div>
        <p className={`${MONO} mt-1 text-[8px] text-white/60`}>Início &nbsp;/&nbsp; Fitness &nbsp;/&nbsp; Contato</p>

        <p className="mt-auto text-[9px] text-white/80">Cor do tema</p>
        <div className="mt-1.5 flex gap-1.5">
          {["#FFFFFF", "#9FD3A9", "#F4C98B", "#16181D"].map((cor, i) => (
            <span key={cor} className={`h-3.5 w-3.5 rounded-full ${i === 1 ? "ring-2 ring-white ring-offset-1 ring-offset-[#1E5A33]" : ""}`} style={{ background: cor }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="h-[3px] flex-1 rounded-full bg-white/25">
            <span className="block h-full w-[70%] rounded-full bg-white/90" />
          </span>
          <span className={`${MONO} text-[8px] text-white/70`}>pronta</span>
        </div>
      </div>
      <div className="flex w-[150px] flex-col items-center rounded-[4px] bg-[#5F9A6C] p-3">
        <svg viewBox="0 0 60 90" className="mt-2 h-[86px] w-auto" aria-hidden="true">
          <rect x="22" y="2" width="16" height="9" rx="2" fill="#E9F4EA" />
          <path d="M18 14h24l3 8v58a8 8 0 0 1-8 8H23a8 8 0 0 1-8-8V22l3-8Z" fill="#E9F4EA" />
          <rect x="15" y="40" width="30" height="20" fill="#CFE6D2" />
        </svg>
        <p className="mt-auto text-[10px] text-white/90">Garrafa térmica</p>
        <p className={`${MONO} text-[11px]`}>R$ 49,90</p>
      </div>
    </Cartao>
  );
}

/* ── 2. Selo da marca (logo da Velo no lilás com retícula) ──── */
function CartaoMarca() {
  return (
    <Cartao
      w={148}
      h={148}
      className="grid place-items-center"
      style={{
        backgroundColor: "#C3CEFA",
        backgroundImage: "radial-gradient(rgba(43,84,238,0.18) 0.8px, transparent 1px)",
        backgroundSize: "3px 3px",
      }}
    >
      <LogoVelo tamanho="84px" />
    </Cartao>
  );
}

/* ── 3. Margem do produto ───────────────────────────────────── */
function CartaoMargem() {
  return (
    <Cartao w={190} h={192} agente={{ src: agenteCubo, x: "36%", h: 58 }} className="flex flex-col gap-[5px] bg-[#E8E1D2] p-[6px]">
      <div className="relative rounded-[3px] bg-white px-2.5 py-2">
        <p className="text-[8.5px] font-medium text-[#3A3D44]">Custo no fornecedor</p>
        <p className="mt-1 text-[15px] text-[#16181D]">
          22,00 <span className="text-[9px] text-[#6B6F78]">BRL</span>
        </p>
        <span className="absolute -bottom-[13px] left-1/2 z-10 grid h-[22px] w-[22px] -translate-x-1/2 place-items-center rounded-full bg-[#E8E1D2] text-[#3A3D44]">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M4 1.5v9M4 10.5 2 8.5M4 10.5l2-2M8 10.5v-9M8 1.5 6 3.5M8 1.5l2 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className="rounded-[3px] bg-white px-2.5 py-2">
        <p className="text-[8.5px] font-medium text-[#3A3D44]">Você vende por</p>
        <p className="mt-1 text-[15px] text-[#16181D]">
          44,00 <span className="text-[9px] text-[#6B6F78]">BRL</span>
        </p>
      </div>
      <div className="space-y-1 rounded-[3px] bg-white px-2.5 py-1.5 text-[8.5px] text-[#3A3D44]">
        <p className="flex justify-between"><span>Margem</span><span className={MONO}>100%</span></p>
        <p className="flex justify-between"><span>Estoque</span><span className={MONO}>no fornecedor</span></p>
      </div>
      <div className="mt-auto grid h-[22px] place-items-center rounded-[3px] bg-[#3A3530] text-[9px] font-medium text-white underline underline-offset-2">
        Publicar produto
      </div>
    </Cartao>
  );
}

/* ── 4. Anúncio no Mercado Livre ────────────────────────────── */
function CartaoAnuncio() {
  return (
    <Cartao w={452} h={250} agente={{ src: agenteEstrela, x: "70%" }} className="flex bg-[#E9EFFA]">
      <div
        className="relative flex-1"
        style={{
          backgroundColor: "#D3E2FB",
          backgroundImage: "radial-gradient(#BCD1F6 1.2px, transparent 1.4px)",
          backgroundSize: "5px 5px",
        }}
      >
        <span className={`${MONO} absolute left-2.5 top-2.5 rounded-[3px] border border-[#16181D]/15 bg-white/70 px-1.5 py-0.5 text-[8px] text-[#3A3D44]`}>
          ▦ catálogo
        </span>
        <svg viewBox="0 0 80 80" className="absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-[56%]" aria-hidden="true">
          <path d="M16 46V38a24 24 0 0 1 48 0v8" fill="none" stroke="#1F2430" strokeWidth="5" strokeLinecap="round" />
          <rect x="9" y="42" width="15" height="24" rx="6" fill="#1F2430" />
          <rect x="56" y="42" width="15" height="24" rx="6" fill="#1F2430" />
          <rect x="13" y="46" width="5" height="16" rx="2.5" fill="#3B4252" />
          <rect x="62" y="46" width="5" height="16" rx="2.5" fill="#3B4252" />
        </svg>
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-[3px] bg-[#2A2D34] px-2 py-1 text-center text-[7.5px] leading-tight text-white">
          Fone Bluetooth
          <br />
          <span className="text-white/70">R$ 299,00 · Novo</span>
        </div>
      </div>
      <div className="flex w-[124px] flex-col gap-1.5 p-1.5">
        <div className="rounded-[3px] bg-[#FFE600] p-2 text-[#2D3277]">
          <p className="text-[12px] font-semibold leading-tight">Mercado
            <br />Livre</p>
          <p className="mt-1 text-[7px] leading-snug text-[#2D3277]/75">Anúncio montado pela Velo</p>
          <div className="mt-2 flex justify-end gap-1">
            <span className="h-3 w-3 rounded-[2px] bg-[#2D3277]" />
            <span className="h-3 w-3 rounded-[2px] bg-[#2D3277]/40" />
          </div>
        </div>
        <div className="flex-1 rounded-[3px] bg-[#F4F6FA] p-2">
          <p className="text-[8.5px] font-medium text-[#2A2D34]">Antes de publicar</p>
          {[
            ["Título", 92],
            ["Descrição", 80],
            ["Fotos", 100],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="mt-2">
              <p className="text-[7px] text-[#6B6F78]">{rotulo}</p>
              <span className="relative mt-1 block h-[2px] rounded-full bg-[#D6DCE6]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#2563EB]" style={{ width: `${valor}%` }} />
                <span className="absolute top-1/2 h-[7px] w-[3px] -translate-y-1/2 rounded-[1px] bg-[#2563EB]" style={{ left: `calc(${valor}% - 2px)` }} />
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <span className="grid h-[20px] flex-1 place-items-center rounded-[2px] bg-[#E4E8EF] text-[7px] text-[#3A3D44]">Revisar</span>
          <span className="grid h-[20px] flex-1 place-items-center rounded-[2px] bg-[#2A2D34] text-[7px] text-white">Publicar</span>
        </div>
      </div>
    </Cartao>
  );
}

/* ── 5. Página de vendas ────────────────────────────────────── */
function CartaoPagina() {
  const tons = ["#DDE6FE", "#BCCDFC", "#94AEFA", "#6C8CF6", "#4570F0", "#2554E6"];
  return (
    <Cartao w={146} h={230} agente={{ src: agenteConcha, x: "28%", h: 56 }} className="flex flex-col bg-white px-2.5 pb-2.5 pt-3">
      <p className="text-center text-[11px] font-medium text-[#16181D]">Página de vendas</p>
      <p className="mt-0.5 text-center text-[7.5px] text-[#6B6F78]">gerada com IA</p>
      <div className="mx-auto mt-3 flex gap-[3px]">
        {Array.from({ length: 13 }, (_, i) => (
          <span key={i} className={`w-px bg-[#16181D] ${i === 6 ? "h-[12px]" : i % 3 === 0 ? "h-[8px]" : "h-[5px]"}`} />
        ))}
      </div>
      <p className="mt-2.5 text-[8px] text-[#3A3D44]">Escolha a cor</p>
      <div className="mt-1 grid flex-1 grid-cols-3">
        {tons.map((tom) => (
          <span key={tom} style={{ background: tom }} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {["P", "M", "G"].map((t, i) => (
          <span key={t} className={`grid h-[16px] flex-1 place-items-center rounded-[2px] border text-[7px] ${i === 1 ? "border-[#16181D] text-[#16181D]" : "border-[#16181D]/15 text-[#6B6F78]"}`}>{t}</span>
        ))}
      </div>
      <span className="mt-1.5 grid h-[20px] place-items-center rounded-[2px] bg-[#16181D] text-[7.5px] text-white">comprar agora</span>
    </Cartao>
  );
}

/* ── 6. Atlas ───────────────────────────────────────────────── */
// Pontos decorativos (não é gráfico de dados): posições fixas para não mudar a cada render.
const PONTOS_ATLAS = Array.from({ length: 64 }, (_, i) => {
  const x = 12 + ((i * 37) % 250);
  const onda = Math.sin(x / 26) * 18 + Math.sin(i * 1.7) * 9;
  return { x, y: 78 + onda };
});

function CartaoAtlas() {
  return (
    <Cartao w={460} h={250} agente={{ src: agenteSino, x: "58%", h: 66 }} className="flex bg-[#1E1E1E] p-1.5">
      <div className="relative flex flex-1 flex-col p-4 text-white">
        <p className="text-[17px] font-medium leading-[1.05] tracking-[-0.02em]">
          Pergunte
          <br />
          ao Atlas
        </p>
        <svg viewBox="0 0 270 150" className="mt-1 w-full flex-1" aria-hidden="true">
          {PONTOS_ATLAS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.1" fill={i % 5 === 0 ? "#9DB5FF" : "#4F7BFF"} />
          ))}
        </svg>
        <div className={`${MONO} flex gap-4 text-[7.5px] leading-tight text-white/80`}>
          <p>Nicho<br /><span className="text-white">beleza</span></p>
          <p className="border-l border-white/30 pl-3">Produto<br /><span className="text-white">kit de pincéis</span></p>
          <p className="border-l border-white/30 pl-3">Próximo passo<br /><span className="text-white">publicar</span></p>
        </div>
      </div>
      <div className="flex w-[170px] flex-col rounded-[2px] bg-white p-2.5">
        <p className={`${MONO} flex items-center gap-1 text-[7.5px] text-[#16181D]`}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> Atlas
        </p>
        <p className={`${MONO} text-[6.5px] text-[#6B6F78]`}>seu agente de vendas</p>
        <p className="ml-auto mt-3 max-w-[120px] rounded-[6px] bg-[#16181D] px-2 py-1.5 text-[7.5px] leading-snug text-white">
          Quero vender no nicho de beleza. O que você indica?
        </p>
        <p className="mt-2.5 text-[7.5px] leading-[1.5] text-[#2A2D34]">
          Que tal um <b>kit de pincéis de maquiagem</b>? Tem bom valor percebido e é fácil de mostrar nas fotos.
        </p>
        <div className="mt-auto flex flex-wrap gap-1">
          {["Abrir catálogo", "Ver outras opções"].map((chip) => (
            <span key={chip} className="rounded-full border border-[#16181D]/15 px-1.5 py-[3px] text-[6.5px] text-[#2A2D34]">{chip}</span>
          ))}
        </div>
      </div>
    </Cartao>
  );
}

/* ── 7. Pedido ──────────────────────────────────────────────── */
function CartaoPedido() {
  const etapas = [
    { rotulo: "Pagamento aprovado", feito: true },
    { rotulo: "Confirmado com o fornecedor", feito: true },
    { rotulo: "Enviado pelo fornecedor", feito: true, atual: true },
    { rotulo: "Entregue", feito: false },
  ];
  return (
    <Cartao w={226} h={204} agente={{ src: agenteLua, x: "40%", h: 60 }} className="bg-[#EDEBE6] p-[6px]">
      <div className="flex h-full flex-col rounded-[3px] bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-[#16181D]">Pedido de exemplo</p>
          <span className="rounded-full bg-[#EEF4FF] px-1.5 py-0.5 text-[7px] font-medium text-[#2563EB]">Mercado Livre</span>
        </div>
        <p className={`${MONO} mt-0.5 text-[7.5px] text-[#6B6F78]`}>1 × Garrafa térmica</p>
        <ol className="mt-3 space-y-2.5">
          {etapas.map((etapa) => (
            <li key={etapa.rotulo} className="flex items-center gap-2 text-[8.5px]">
              <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${etapa.feito ? "bg-[#2563EB] text-white" : "border border-[#16181D]/20"}`}>
                {etapa.feito && (
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path d="m1.5 4.2 1.6 1.6L6.5 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={etapa.atual ? "font-medium text-[#16181D]" : etapa.feito ? "text-[#3A3D44]" : "text-[#9A9EA6]"}>{etapa.rotulo}</span>
            </li>
          ))}
        </ol>
        <p className={`${MONO} mt-auto text-[7px] text-[#6B6F78]`}>você acompanha tudo pelo painel</p>
      </div>
    </Cartao>
  );
}

function Faixa({ copia = false }: { copia?: boolean }) {
  return (
    <div className="flex shrink-0 items-start" aria-hidden={copia || undefined}>
      <CartaoLoja />
      <CartaoMarca />
      <CartaoMargem />
      <CartaoAnuncio />
      <CartaoPagina />
      <CartaoAtlas />
      <CartaoPedido />
    </div>
  );
}

export function VitrineExemplos() {
  return (
    <div
      role="img"
      aria-label="Exemplos do que dá para fazer na Velo: loja online, margem do produto, anúncio no Mercado Livre, página de vendas, Atlas e acompanhamento de pedido"
      className="relative isolate w-full overflow-hidden pt-[60px] motion-reduce:overflow-x-auto max-sm:[zoom:0.72]"
    >
      <style>{`
        @keyframes velo-vitrine { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .velo-vitrine { animation: velo-vitrine 90s linear infinite; }
        .velo-vitrine:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .velo-vitrine { animation: none; } }
      `}</style>
      <div className="velo-vitrine relative z-10 flex w-max items-start">
        <Faixa />
        <Faixa copia />
      </div>
    </div>
  );
}

/* ── Chamada final (modelo "Go ahead. Build it yourself." da Base44) ──────────
   Fileira parada e centrada no azul, nas medidas da referência: painel laranja
   largo, selo claro, foto em pé, cartão verde estreito e outra foto em pé.
   As fotos (pessoa-04 e pessoa-05) só carregam quando a pessoa chega ao fim da
   página, na versão de 640px. Nenhum cartão mostra venda ou faturamento: o
   painel compara custo e preço de um produto de exemplo. No celular sai o painel
   largo, para caber sem rolar para o lado. */

/* Painel laranja: custo x preço sugerido de um produto do catálogo. */
function CartaoPainelPreco() {
  const custo = "M0 40 L22 36 L44 41 L66 33 L88 38 L110 30 L132 35 L154 31 L176 36 L198 29 L222 33";
  const preco = "M0 22 L22 17 L44 23 L66 12 L88 19 L110 9 L132 16 L154 11 L176 18 L198 8 L222 13";
  return (
    <Cartao w={266} h={190} className="flex flex-col bg-[#FF5B14] px-2.5 py-2 text-[#1B0E06]">
      <div className="flex items-center justify-between text-[5.5px]">
        <span className="flex items-center gap-1 font-semibold">
          <span className="grid h-[8px] w-[8px] place-items-center border border-current text-[4px]">V</span>
          Painel Velo
        </span>
        <span className="flex gap-3 opacity-80">
          <span>Catálogo</span>
          <span>Loja</span>
          <span>Pedidos</span>
          <span>Atlas</span>
        </span>
      </div>
      <div className="mt-3.5 flex gap-6">
        <div>
          <p className="text-[5.5px] opacity-80">Margem</p>
          <p className="mt-0.5 flex items-center gap-1 text-[17px] leading-none tracking-[-0.02em]">
            100%
            <span className="grid h-[9px] w-[9px] place-items-center rounded-full bg-[#1B0E06] text-[6px] text-[#FF5B14]">↑</span>
          </p>
        </div>
        <div>
          <p className="text-[5.5px] opacity-80">Custo</p>
          <p className="mt-0.5 text-[17px] leading-none tracking-[-0.02em]">22,00</p>
        </div>
        <div className="ml-auto w-[78px] space-y-1.5 pt-1 text-[5px]">
          <p className="flex items-center gap-1"><span className="w-[24px] opacity-80">Custo</span><span className="h-[2px] flex-1 bg-[#1B0E06]/35" /></p>
          <p className="flex items-center gap-1"><span className="w-[24px] opacity-80">Preço</span><span className="h-[2px] flex-1 bg-[#1B0E06]" /></p>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-[13px] tracking-[-0.02em]">Custo x preço sugerido</p>
        <p className="text-[5.5px] opacity-80">Garrafa térmica ⌄</p>
      </div>
      <svg viewBox="0 0 222 50" className="mt-auto h-[78px] w-full" preserveAspectRatio="none" aria-hidden="true">
        {[0, 12.5, 25, 37.5, 50].map((y) => (
          <line key={y} x1="0" x2="222" y1={y} y2={y} stroke="#1B0E06" strokeOpacity="0.18" strokeWidth="0.5" />
        ))}
        <path d={custo} fill="none" stroke="#FFD2BC" strokeWidth="1.1" />
        <path d={preco} fill="none" stroke="#1B0E06" strokeWidth="1.1" />
      </svg>
    </Cartao>
  );
}

/* Selo claro com a logo da Velo (na referência, a forma azul num quadrado lilás). */
function CartaoSeloClaro() {
  return (
    <Cartao w={106} h={104} className="grid place-items-center bg-[#D6DDFB] p-[7px]">
      <div
        className="grid h-full w-full place-items-center"
        style={{
          backgroundColor: "#C3CEFA",
          backgroundImage: "radial-gradient(rgba(43,84,238,0.18) 0.8px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      >
        <LogoVelo tamanho="70px" />
      </div>
    </Cartao>
  );
}

/* Cartão verde estreito: o tema da loja (grade de pontos + 4 cores). */
const PONTOS_TEMA = Array.from({ length: 11 * 9 }, (_, i) => {
  const col = i % 11;
  const lin = Math.floor(i / 11);
  // desenho de uma cestinha em pontos: some fora do contorno
  const dentro = lin >= 3 && col >= 1 + Math.max(0, lin - 6) && col <= 9 - Math.max(0, lin - 6);
  const alca = lin < 3 && (col === 3 + lin || col === 7 - lin);
  return { col, lin, cheio: dentro || alca };
});

function CartaoTema() {
  return (
    <Cartao w={90} h={192} className="flex flex-col bg-[#A6C29A] p-[5px] text-[#16211A]">
      <div className="flex items-center justify-between px-0.5 text-[6.5px] font-semibold">
        <span>Tema da loja</span>
        <span className="text-[7px] leading-none">≡</span>
      </div>
      <svg viewBox="0 0 66 54" className="mt-1.5 w-full" aria-hidden="true">
        {PONTOS_TEMA.map((p) => (
          <circle key={`${p.col}-${p.lin}`} cx={3 + p.col * 6} cy={3 + p.lin * 6} r="2" fill="#16211A" fillOpacity={p.cheio ? 0.9 : 0.12} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-0.5 text-[4.5px] opacity-70">
        <span>Fitness</span>
        <span>pronta</span>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-[3px]">
        {["#16211A", "#F3F2EF", "#2B54EE", "#E9B872"].map((cor) => (
          <div key={cor} className="grid aspect-square place-items-center rounded-[2px] bg-[#C3D6B9]">
            <span className="h-[22px] w-[22px] rounded-full border border-[#16211A]/40" style={{ backgroundColor: cor }} />
          </div>
        ))}
      </div>
    </Cartao>
  );
}

function CartaoFoto({ base, original, w, h, posicao }: { base: string; original: string; w: number; h: number; posicao: string }) {
  return (
    <Cartao w={w} h={h} className="relative bg-[#1E2A5A]">
      <ImagemResponsiva
        base={base}
        larguras={[640]}
        original={original}
        alt=""
        sizes="220px"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: posicao }}
      />
    </Cartao>
  );
}

export function VitrineChamada() {
  return (
    <div
      role="img"
      aria-label="Exemplos do que dá para fazer na Velo: painel de custo e preço, selo da marca, tema da loja e pessoas que vendem com a Velo"
      className="flex items-start justify-center [zoom:0.56] sm:[zoom:0.9] xl:[zoom:1]"
    >
      <div className="relative isolate flex items-start pt-[14px]" style={{ marginRight: -VAO }}>
        <div className="max-sm:hidden"><CartaoPainelPreco /></div>
        <CartaoSeloClaro />
        <CartaoFoto base="pessoa-04" original="/pessoa%2004.webp" w={200} h={228} posicao="50% 30%" />
        <CartaoTema />
        <CartaoFoto base="pessoa-05" original="/pessoa%2005.webp" w={170} h={228} posicao="50% 30%" />
      </div>
    </div>
  );
}
