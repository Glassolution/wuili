import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useReducedMotion } from "framer-motion";
import { Check, ImageIcon, Maximize2, RotateCcw, ShoppingBag, X } from "lucide-react";

import {
  AGENTES,
  LAYOUT,
  PAPEL,
  arrastoNoTempo,
  caixasNoTempo,
  falaDoAgente,
  montarRoteiro,
  posicaoDoCursor,
  progressoDoMarco,
  textoNoTempo,
  type AgenteDoPalco,
  type DadosDoPalco,
  type Roteiro,
} from "@/lib/palcoDoSite";

/**
 * O site da loja sendo montado ao vivo, no fim da construção pedida no chat:
 * quatro cursores com nome (Atlas planeja, Texto escreve, Estilo pinta,
 * Imagens coloca as fotos) trabalhando ao mesmo tempo sobre a página, que
 * começa como esqueleto cinza. Inspirado nas landings de "agentes construindo"
 * (caixas de seleção com a medida, cursor de texto piscando, paleta flutuante).
 *
 * Tudo é função do relógio (`Date.now() - inicio`), então o chat e a tela
 * cheia mostram o mesmo instante, e "Ver de novo" só troca o `inicio`.
 */

const FONTES: Record<string, string> = {
  Geist: "Geist, Inter, system-ui, sans-serif",
  Inter: "Inter, system-ui, sans-serif",
  "Plus Jakarta Sans": '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
  "Helvetica Neue": '"Helvetica Neue", Helvetica, Arial, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
};
const FONTE_NEUTRA = "Inter, system-ui, sans-serif";

const preco = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const textoSobre = (hex: string) => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "#FFFFFF";
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.62 ? "#111111" : "#FFFFFF";
};

/** Relógio da cena: anda até `duracao` e para. */
function useRelogio(inicio: number, duracao: number, parado: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (parado) return;
    let quadro = 0;
    const tique = () => {
      const n = Date.now();
      setAgora(n);
      if (n - inicio < duracao) quadro = requestAnimationFrame(tique);
    };
    quadro = requestAnimationFrame(tique);
    return () => cancelAnimationFrame(quadro);
  }, [inicio, duracao, parado]);
  return parado ? inicio + duracao : agora;
}

const abs = (x: number, y: number, extra: CSSProperties = {}): CSSProperties => ({ position: "absolute", left: x, top: y, ...extra });

/** Barra cinza do esqueleto. */
const Osso = ({ w, h = 12, style }: { w: number; h?: number; style?: CSSProperties }) => (
  <span className="block rounded-full bg-[#E9E9E6]" style={{ width: w, height: h, ...style }} />
);

const Caret = ({ cor }: { cor: string }) => (
  <span className="ml-[2px] inline-block w-[3px] animate-pulse rounded-full align-[-0.12em]" style={{ height: "1em", background: cor }} />
);

/** Texto que vai sendo digitado; antes de começar, mostra o osso do esqueleto. */
const Campo = ({
  r,
  t,
  campo,
  osso,
  children,
}: {
  r: Roteiro;
  t: number;
  campo: string;
  osso: ReactNode;
  children?: (texto: string) => ReactNode;
}) => {
  const { texto, digitando, agente } = textoNoTempo(r, campo, t);
  if (!texto && !digitando) return <>{osso}</>;
  return (
    <>
      {children ? children(texto) : texto}
      {digitando && agente && <Caret cor={AGENTES[agente].cor} />}
    </>
  );
};

const SetaDoCursor = ({ cor }: { cor: string }) => (
  <svg viewBox="0 0 20 22" className="h-[22px] w-[20px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.22)]" aria-hidden>
    <path d="M2.2 1.6 18 9.4c.9.4.8 1.7-.2 2l-6.3 1.8-2.6 6.1c-.4.9-1.7.9-2-.1L1 3c-.3-1 .5-1.8 1.2-1.4Z" fill={cor} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/* ----- A página ----- */

const Pagina = ({ dados, r, t }: { dados: DadosDoPalco; r: Roteiro; t: number }) => {
  const L = LAYOUT;
  const vis = (marco: string, ms = 380) => progressoDoMarco(r, marco, t, ms);
  const fundo = vis("cor.fundo", 600);
  const fonte = t >= (r.marcos.fonte ?? Infinity) ? FONTES[dados.fonte] ?? FONTE_NEUTRA : FONTE_NEUTRA;
  const botaoPintado = vis("cor.botao", 500);
  const corDoTextoDoBotao = botaoPintado > 0.5 ? textoSobre(dados.destaque) : "#8A8A8A";
  const precoPintado = vis("cor.preco", 400) > 0.5;
  const pronto = t >= (r.marcos.pronto ?? Infinity);
  const capa = vis("img.capa", 800);
  const tamanhoDoTitulo = dados.nome.length > 22 ? 40 : dados.nome.length > 14 ? 48 : 56;

  return (
    <div className="absolute inset-0 overflow-hidden bg-white" style={{ fontFamily: FONTE_NEUTRA }}>
      {/* Fundo escolhido, entrando por cima do branco. */}
      {dados.fundo && <div className="absolute inset-0" style={{ background: dados.fundo, opacity: fundo }} />}

      {/* Topo */}
      <div style={abs(0, 0, { width: PAPEL.largura, height: L.topo.h, opacity: vis("esqueleto.topo") })}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-black/[0.07]" />
        <div style={abs(L.logo.x, L.logo.y, { width: L.logo.w, height: L.logo.h })} className="overflow-hidden rounded-[8px]">
          {dados.logo ? (
            <>
              <span className="absolute inset-0 rounded-[8px] bg-[#E9E9E6]" />
              <img
                src={dados.logo}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                style={{ opacity: vis("img.logo", 300), transform: `scale(${0.6 + 0.4 * vis("img.logo", 300)})` }}
              />
            </>
          ) : (
            <span
              className="grid h-full w-full place-items-center text-[15px] font-bold transition-colors duration-500"
              style={{
                background: t >= (r.marcos["cor.logo"] ?? Infinity) ? dados.destaque : "#E9E9E6",
                color: t >= (r.marcos["cor.logo"] ?? Infinity) ? textoSobre(dados.destaque) : "transparent",
              }}
            >
              {dados.nome.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div style={abs(L.nome.x, L.nome.y, { fontFamily: fonte })} className="whitespace-nowrap text-[19px] font-semibold tracking-[-0.02em] text-[#141414]">
          <Campo r={r} t={t} campo="nome" osso={<Osso w={140} h={14} style={{ marginTop: 5 }} />} />
        </div>
        {dados.menu.map((item, i) => {
          const p = L.menu(i);
          return (
            <div key={item} style={abs(p.x, p.y)} className="whitespace-nowrap text-[14px] text-[#4A4A4A]">
              <Campo r={r} t={t} campo={`menu.${i}`} osso={<Osso w={56} h={10} style={{ marginTop: 5 }} />} />
            </div>
          );
        })}
        <div style={abs(L.sacola.x, L.sacola.y)} className="grid h-7 w-7 place-items-center text-[#2A2A2A]">
          <ShoppingBag className="h-[19px] w-[19px]" strokeWidth={1.8} />
        </div>
      </div>

      {/* Capa */}
      <div style={abs(0, L.hero.y, { width: PAPEL.largura, height: L.hero.h, opacity: vis("esqueleto.hero") })}>
        <div
          style={abs(L.etiqueta.x, L.etiqueta.y - L.hero.y, { color: t >= (r.marcos["cor.botao"] ?? Infinity) ? dados.destaque : "#6B6B6B" })}
          className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors duration-500"
        >
          <Campo r={r} t={t} campo="etiqueta" osso={<Osso w={90} h={9} style={{ marginTop: 4 }} />} />
        </div>
        <div
          style={abs(L.titulo.x, L.titulo.y - L.hero.y, { width: L.titulo.w, fontFamily: fonte, fontSize: tamanhoDoTitulo })}
          className="font-bold leading-[1.02] tracking-[-0.035em] text-[#111]"
        >
          <Campo
            r={r}
            t={t}
            campo="titulo"
            osso={
              <span className="flex flex-col gap-3 pt-2">
                <Osso w={380} h={34} />
                <Osso w={260} h={34} />
              </span>
            }
          />
        </div>
        <div style={abs(L.subtitulo.x, L.subtitulo.y - L.hero.y, { width: L.subtitulo.w })} className="line-clamp-2 text-[17px] leading-[1.5] text-[#5E5E5E]">
          <Campo
            r={r}
            t={t}
            campo="subtitulo"
            osso={
              <span className="flex flex-col gap-2.5 pt-1.5">
                <Osso w={400} h={11} />
                <Osso w={300} h={11} />
              </span>
            }
          />
        </div>
        <div
          style={abs(L.botao.x, L.botao.y - L.hero.y, {
            width: L.botao.w,
            height: L.botao.h,
            background: botaoPintado > 0 ? dados.destaque : "#E9E9E6",
            color: corDoTextoDoBotao,
          })}
          className="grid place-items-center overflow-hidden whitespace-nowrap rounded-[12px] text-[15px] font-semibold"
        >
          {/* A tinta da cor espalha a partir do canto onde o cursor clicou. */}
          {botaoPintado > 0 && botaoPintado < 1 && (
            <span
              className="absolute rounded-full"
              style={{
                right: 18 - 120 * botaoPintado,
                top: 20 - 120 * botaoPintado,
                width: 240 * botaoPintado,
                height: 240 * botaoPintado,
                background: "rgba(255,255,255,0.28)",
              }}
            />
          )}
          <span className="relative">
            <Campo r={r} t={t} campo="botao" osso={null} />
          </span>
        </div>
        <div
          style={abs(L.botao2.x, L.botao2.y - L.hero.y, { width: L.botao2.w, height: L.botao2.h })}
          className="grid place-items-center whitespace-nowrap rounded-[12px] border border-black/[0.12] text-[15px] font-medium text-[#2A2A2A]"
        >
          <Campo r={r} t={t} campo="botao2" osso={null} />
        </div>
        <div style={abs(L.capa.x, L.capa.y - L.hero.y, { width: L.capa.w, height: L.capa.h })} className="overflow-hidden rounded-[20px] bg-[#EFEFEC]">
          <span className="absolute inset-0 grid place-items-center text-[#C9C9C4]">
            <ImageIcon className="h-9 w-9" strokeWidth={1.4} />
          </span>
          {capa > 0 &&
            (dados.capa ? (
              <img
                src={dados.capa}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ clipPath: `inset(0 0 ${100 - capa * 100}% 0)`, transform: `scale(${1.06 - 0.06 * capa})` }}
              />
            ) : (
              <span
                className="absolute inset-0"
                style={{ opacity: capa, background: `linear-gradient(135deg, ${dados.destaque}, ${dados.fundo ?? "#F5F5F4"})` }}
              />
            ))}
        </div>
      </div>

      {/* Produtos / serviços */}
      <div style={abs(0, L.secao.y, { width: PAPEL.largura, height: L.secao.h, opacity: vis("esqueleto.secao") })}>
        <div style={abs(L.tituloDaSecao.x, L.tituloDaSecao.y - L.secao.y, { fontFamily: fonte })} className="text-[24px] font-semibold tracking-[-0.02em] text-[#141414]">
          <Campo r={r} t={t} campo="secao" osso={<Osso w={150} h={18} style={{ marginTop: 6 }} />} />
        </div>
        {[0, 1, 2, 3].map((i) => {
          const c = L.cartao(i);
          const item = dados.itens[i];
          const foto = item ? vis(`img.item.${i}`, 420) : 0;
          // Vaga sem item: no fim vira um cartão tracejado para completar no editor.
          if (!item && pronto)
            return (
              <div
                key={i}
                style={abs(c.x, c.y - L.secao.y, { width: c.w, height: 124 })}
                className="grid place-items-center rounded-[14px] border-[1.5px] border-dashed border-black/[0.14] text-center text-[12.5px] text-[#8A8A8A]"
              >
                <span>
                  <span className="mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full bg-black/[0.05] text-[18px] leading-none text-[#6B6B6B]">+</span>
                  Adicionar no editor
                </span>
              </div>
            );
          return (
            <div key={i} style={abs(c.x, c.y - L.secao.y, { width: c.w, height: c.h })}>
              <div className="relative h-[124px] overflow-hidden rounded-[14px] bg-[#EFEFEC]">
                {item?.imagem ? (
                  <img src={item.imagem} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: foto, transform: `scale(${1.08 - 0.08 * foto})` }} />
                ) : item ? (
                  <span className="absolute inset-0 grid place-items-center" style={{ opacity: foto, background: `${dados.destaque}14`, color: dados.destaque }}>
                    <ShoppingBag className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 line-clamp-1 text-[13.5px] font-medium text-[#1F1F1F]">
                {item ? (
                  <Campo r={r} t={t} campo={`item.${i}`} osso={<Osso w={150} h={10} style={{ marginTop: 4 }} />} />
                ) : (
                  <Osso w={150} h={10} style={{ marginTop: 4 }} />
                )}
              </div>
              <div className="mt-1 text-[14px] font-semibold transition-colors duration-500" style={{ color: precoPintado ? dados.destaque : "#1F1F1F" }}>
                {item?.preco != null && foto > 0 ? preco.format(item.preco) : item && foto > 0 ? null : !pronto && <Osso w={70} h={10} style={{ marginTop: 5 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ----- Por cima da página: caixas, paleta, arrasto e cursores ----- */

const Camada = ({ dados, r, t, escala }: { dados: DadosDoPalco; r: Roteiro; t: number; escala: number }) => {
  const pronto = t >= (r.marcos.pronto ?? Infinity);
  const inv = 1 / Math.max(escala, 0.01);
  const arrasto = arrastoNoTempo(r, t);
  const paleta = t >= r.paleta.t0 && t < r.paleta.t1 + 500;
  const entradaPaleta = Math.min(1, Math.max(0, (t - r.paleta.t0) / 260));
  const saidaPaleta = t > r.paleta.t1 ? Math.max(0, 1 - (t - r.paleta.t1) / 500) : 1;

  return (
    <div className="pointer-events-none absolute inset-0">
      {caixasNoTempo(r, t).map((c, i) => {
        const cor = AGENTES[c.agente].cor;
        return (
          <div
            key={i}
            style={abs(c.x, c.y, {
              width: c.w * c.desenho,
              height: c.h * c.desenho,
              border: `${1.5 * inv}px solid ${cor}`,
              background: `${cor}0D`,
              opacity: c.saindo ? 0 : 1,
              transition: "opacity 400ms ease",
            })}
          >
            {c.desenho > 0.98 && (
              <>
                {[
                  [0, 0],
                  [1, 0],
                  [0, 1],
                  [1, 1],
                ].map(([px, py]) => (
                  <span
                    key={`${px}${py}`}
                    className="absolute rounded-[1px] bg-white"
                    style={{
                      left: `${px * 100}%`,
                      top: `${py * 100}%`,
                      width: 7 * inv,
                      height: 7 * inv,
                      transform: "translate(-50%, -50%)",
                      border: `${1.5 * inv}px solid ${cor}`,
                    }}
                  />
                ))}
                <span
                  className="absolute left-1/2 whitespace-nowrap rounded-full bg-[#2B2B2B]/85 font-medium text-white"
                  style={{
                    top: 0,
                    transform: `translate(-50%, calc(-100% - ${8 * inv}px)) scale(${inv})`,
                    transformOrigin: "bottom center",
                    padding: "2px 8px",
                    fontSize: 11,
                  }}
                >
                  {Math.round(c.w)} × {Math.round(c.h)}
                </span>
              </>
            )}
          </div>
        );
      })}

      {/* Paleta flutuante do Estilo (cores + fonte). */}
      {paleta && (
        <div
          style={abs(700, 150, {
            opacity: entradaPaleta * saidaPaleta,
            transform: `scale(${(0.94 + 0.06 * entradaPaleta) * inv})`,
            transformOrigin: "top left",
          })}
          className="w-[200px] rounded-[12px] border border-black/[0.08] bg-white/95 p-3 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.35)] backdrop-blur"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B6B6B]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: AGENTES.estilo.cor }} />
            Identidade da loja
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {[dados.destaque, dados.fundo ?? "#FFFFFF", "#141414"].map((cor, i) => (
              <span key={i} className="h-7 flex-1 rounded-[7px] ring-1 ring-black/[0.08]" style={{ background: cor }} />
            ))}
          </div>
          <div className="mt-2 flex items-baseline gap-2 rounded-[7px] bg-[#F5F5F3] px-2 py-1.5">
            <span className="text-[18px] font-semibold text-[#141414]" style={{ fontFamily: FONTES[dados.fonte] ?? FONTE_NEUTRA }}>
              Aa
            </span>
            <span className="truncate text-[11.5px] text-[#6B6B6B]">{dados.fonte}</span>
          </div>
        </div>
      )}

      {/* Cursores (e a foto sendo arrastada pelo Imagens). */}
      {(Object.keys(AGENTES) as AgenteDoPalco[]).map((quem) => {
        const p = posicaoDoCursor(r, quem, t);
        const fala = falaDoAgente(r, quem, t);
        const agente = AGENTES[quem];
        const arrastando = arrasto?.agente === quem ? arrasto : null;
        return (
          <div
            key={quem}
            style={abs(p.x, p.y, {
              transform: `scale(${inv})`,
              transformOrigin: "top left",
              opacity: pronto ? 0 : 1,
              transition: "opacity 500ms ease",
              zIndex: 5,
            })}
          >
            {arrastando && (
              <div className="absolute left-3 top-4 w-[124px] -rotate-3 overflow-hidden rounded-[10px] border border-black/[0.08] bg-white shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)]">
                <div className="h-[72px] bg-[#EFEFEC]">
                  {arrastando.imagem ? (
                    <img src={arrastando.imagem} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full" style={{ background: `linear-gradient(135deg, ${dados.destaque}, #F5F5F4)` }} />
                  )}
                </div>
                <p className="truncate px-2 py-1 text-[10.5px] text-[#4A4A4A]">{arrastando.rotulo}</p>
              </div>
            )}
            <SetaDoCursor cor={agente.cor} />
            <span
              className="absolute left-[14px] top-[20px] flex items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-2 pr-2.5 text-[11.5px] font-semibold text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]"
              style={{ background: agente.cor }}
            >
              {agente.nome}
              {fala && <span className="font-normal text-white/80">{fala}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** A cena escalada para a largura de quem a contém. */
const Cena = ({ dados, r, t }: { dados: DadosDoPalco; r: Roteiro; t: number }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const escala = largura > 0 ? largura / PAPEL.largura : 0;
  return (
    <div ref={caixa} className="relative w-full overflow-hidden" style={{ height: PAPEL.altura * escala }}>
      {escala > 0 && (
        <div style={{ width: PAPEL.largura, height: PAPEL.altura, transform: `scale(${escala})`, transformOrigin: "top left" }} className="relative">
          <Pagina dados={dados} r={r} t={t} />
          <Camada dados={dados} r={r} t={t} escala={escala} />
        </div>
      )}
    </div>
  );
};

/** Janela do navegador em volta da cena, com "Ao vivo", "Ver de novo" e "Tela cheia". */
const Janela = ({
  dados,
  r,
  inicio,
  onRever,
  onAmpliar,
  ampliada,
}: {
  dados: DadosDoPalco;
  r: Roteiro;
  inicio: number;
  onRever: () => void;
  onAmpliar?: () => void;
  ampliada?: boolean;
}) => {
  const reduzir = useReducedMotion() ?? false;
  const agora = useRelogio(inicio, r.duracao, reduzir);
  const t = Math.max(0, agora - inicio);
  const pronto = t >= (r.marcos.pronto ?? r.duracao);
  return (
    <div className={`overflow-hidden rounded-[14px] border border-black/[0.09] bg-white ${ampliada ? "shadow-2xl" : "shadow-[0_1px_2px_rgba(16,24,40,0.05),0_12px_32px_-16px_rgba(16,24,40,0.22)]"}`}>
      <div className="flex h-9 items-center gap-3 border-b border-black/[0.06] bg-[#FAFAF9] px-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-[6px] bg-black/[0.04] px-2.5 py-[3px] text-center text-[11.5px] text-[#6B6B6B]">
          Prévia da {dados.nome}
        </span>
        {pronto ? (
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-[#16A34A]">
            <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
            Pronto
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#DC2626]">
            <span className="relative grid h-2 w-2 place-items-center">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-[#DC2626]/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
            </span>
            Ao vivo
          </span>
        )}
        {pronto && !reduzir && (
          <button
            type="button"
            onClick={onRever}
            className="grid h-6 w-6 place-items-center rounded-[6px] text-[#6B6B6B] transition-colors hover:bg-black/[0.06] hover:text-[#1F1F1F]"
            aria-label="Ver a montagem de novo"
            title="Ver de novo"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
        {onAmpliar && (
          <button
            type="button"
            onClick={onAmpliar}
            className="grid h-6 w-6 place-items-center rounded-[6px] text-[#6B6B6B] transition-colors hover:bg-black/[0.06] hover:text-[#1F1F1F]"
            aria-label="Ver em tela cheia"
            title="Tela cheia"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      <Cena dados={dados} r={r} t={t} />
    </div>
  );
};

const AtlasPalcoDoSite = ({ dados, comecouEm }: { dados: DadosDoPalco; comecouEm: number }) => {
  const r = useMemo(() => montarRoteiro(dados), [dados]);
  const [inicio, setInicio] = useState(comecouEm);
  const [ampliado, setAmpliado] = useState(false);
  const rever = () => setInicio(Date.now());

  return (
    <>
      <Janela dados={dados} r={r} inicio={inicio} onRever={rever} onAmpliar={() => setAmpliado(true)} />

      <DialogPrimitive.Root open={ampliado} onOpenChange={setAmpliado}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] w-[min(1180px,calc(100vw-32px),calc((100svh-96px)*1040/696))] -translate-x-1/2 -translate-y-1/2 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
            <DialogPrimitive.Title className="sr-only">Montagem da {dados.nome}</DialogPrimitive.Title>
            <Janela dados={dados} r={r} inicio={inicio} onRever={rever} ampliada />
            <DialogPrimitive.Close
              className="absolute -top-11 right-0 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#1F1F1F] transition-colors hover:bg-white"
              aria-label="Fechar tela cheia"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

export default AtlasPalcoDoSite;
