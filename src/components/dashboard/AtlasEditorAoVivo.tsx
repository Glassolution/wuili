import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Mic, Plus, Send } from "lucide-react";

import CursoresDaMontagem from "@/components/dashboard/CursoresDaMontagem";
import VitrineEditorial, { LARGURA_DA_VITRINE } from "@/components/modelos-de-loja/VitrineEditorial";
import VitrineModa from "@/components/modelos-de-loja/VitrineModa";
import { etapaAtual, montarMontagem, type Montagem } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";

/**
 * Tela do editor onde a loja vai ser montada ao vivo (parte 1: só a tela).
 *
 * Quando a construção chega em "Montando a loja", o chat "vira" o editor: uma
 * folha em branco cresce a partir do painel do Atlas até ocupar a tela toda e
 * a caixa de mensagem desliza do lugar dela no chat para o rodapé, no centro.
 * Na página em branco, primeiro aparece o modelo "Vitrine editorial" puro e
 * depois a personalização troca logo, nome, fonte, cores, capa, chamada,
 * produtos, preços e destaques (linha do tempo em src/lib/montagemDaVitrine.ts).
 */

const SUAVE = [0.22, 1, 0.36, 1] as const;
const LARGURA_DO_CHAT = 460;
const MARGEM_DE_BAIXO = 20;
/** Espaço no fim da página para o chat flutuante não cobrir o rodapé da loja. */
const FOLGA_DO_CHAT = 112;

export type OrigemDoEditor = {
  /** Painel do chat (`[data-atlas-chat]`), de onde a folha cresce. */
  painel: DOMRect | null;
  /** Caixa de mensagem do chat (`[data-atlas-composer]`), de onde o chat desliza. */
  composer: DOMRect | null;
};

/** Mede o chat na tela no instante de abrir. */
export const medirOrigemDoEditor = (): OrigemDoEditor => ({
  painel: document.querySelector("[data-atlas-chat]")?.getBoundingClientRect() ?? null,
  composer: document.querySelector("[data-atlas-composer]")?.getBoundingClientRect() ?? null,
});

const alvoDoChat = () => {
  const largura = Math.min(LARGURA_DO_CHAT, window.innerWidth - 32);
  return { left: (window.innerWidth - largura) / 2, width: largura, bottom: MARGEM_DE_BAIXO };
};

const BotaoDaBarra = ({ rotulo, children }: { rotulo: string; children: ReactNode }) => (
  <button
    type="button"
    title={rotulo}
    aria-label={rotulo}
    className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#5C5C5C] transition-colors hover:bg-black/[0.05] hover:text-[#1F1F1F]"
  >
    {children}
  </button>
);

/** Relógio da montagem: anda enquanto o editor está aberto e a montagem não acabou. */
function useTempoDaMontagem(ligado: boolean, comecouEm: number, duracao: number, parado: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ligado || parado) return;
    let quadro = 0;
    const tique = () => {
      const n = Date.now();
      setAgora(n);
      if (n - comecouEm < duracao) quadro = requestAnimationFrame(tique);
    };
    quadro = requestAnimationFrame(tique);
    return () => cancelAnimationFrame(quadro);
  }, [ligado, comecouEm, duracao, parado]);
  return parado ? duracao : Math.max(0, agora - comecouEm);
}

/** A loja na página do editor: o modelo escalado para a largura da folha, rolando até a seção da vez. */
const PaginaEmMontagem = ({ dados, montagem, t, reduzir }: { dados: DadosDoPalco; montagem: Montagem; t: number; reduzir: boolean }) => {
  const folha = useRef<HTMLDivElement>(null);
  const loja = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState({ largura: 0, altura: 0 });
  const etapa = etapaAtual(montagem, t);
  // Seção da vez: no modelo, a última que o Atlas desenhou; na personalização, a da etapa.
  const secaoDoModelo = Object.entries(montagem.secoes)
    .filter(([, t0]) => t >= t0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const secao = etapa?.fase === "personalizacao" ? etapa.secao : etapa?.fase === "modelo" ? secaoDoModelo ?? null : null;

  useEffect(() => {
    const f = folha.current;
    const l = loja.current;
    if (!f || !l) return;
    const medir = () => setMedidas({ largura: f.clientWidth, altura: l.offsetHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(f);
    obs.observe(l);
    return () => obs.disconnect();
  }, []);

  // A cada etapa, rola a folha até a seção que está mudando.
  useEffect(() => {
    const f = folha.current;
    const l = loja.current;
    if (!f || !l || !secao) return;
    const alvo = l.querySelector(`[data-secao="${secao}"]`);
    if (!alvo) return;
    const topo = alvo.getBoundingClientRect().top - l.getBoundingClientRect().top;
    f.scrollTo({ top: Math.max(0, topo - 16), behavior: reduzir ? "auto" : "smooth" });
  }, [secao, reduzir]);

  // Pronta: volta ao topo para mostrar a loja do começo.
  const pronta = t >= montagem.duracao - 600;
  useEffect(() => {
    if (pronta) folha.current?.scrollTo({ top: 0, behavior: reduzir ? "auto" : "smooth" });
  }, [pronta, reduzir]);

  // Tela larga: a loja estica até a borda. Tela estreita: desenha a 1200px e encolhe.
  const largura = Math.max(LARGURA_DA_VITRINE, medidas.largura);
  const escala = medidas.largura > 0 ? medidas.largura / largura : 0;
  return (
    <div ref={folha} data-folha className="h-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
      <div style={{ height: medidas.altura * escala + FOLGA_DO_CHAT, opacity: escala > 0 ? 1 : 0 }} className="relative">
        <div ref={loja} style={{ width: largura, transform: `scale(${escala})`, transformOrigin: "top left" }} className="absolute left-0 top-0">
          {montagem.modelo === "vitrine-moda" ? (
            <VitrineModa dados={dados} montagem={montagem} t={t} largura={largura} />
          ) : (
            <VitrineEditorial dados={dados} montagem={montagem} t={t} largura={largura} />
          )}
          {!reduzir && !pronta && <CursoresDaMontagem montagem={montagem} dados={dados} t={t} escala={escala} />}
        </div>
      </div>
    </div>
  );
};

const AtlasEditorAoVivo = ({
  aberto,
  origem,
  nome,
  palco,
  onFechar,
}: {
  aberto: boolean;
  origem: OrigemDoEditor;
  nome: string;
  palco: { dados: DadosDoPalco; comecouEm: number } | null;
  onFechar: () => void;
}) => {
  const reduzir = useReducedMotion() ?? false;
  const montagem = useMemo(() => (palco ? montarMontagem(palco.dados) : null), [palco]);
  const t = useTempoDaMontagem(aberto && !!montagem, palco?.comecouEm ?? 0, montagem?.duracao ?? 0, reduzir && !!montagem);
  const etapa = montagem ? etapaAtual(montagem, t) : null;
  const terminou = !!montagem && t >= montagem.duracao - 600;
  const [alvo, setAlvo] = useState(alvoDoChat);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (!aberto) return;
    const medir = () => setAlvo(alvoDoChat());
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberto]);

  // A folha começa exatamente onde está o painel do chat, com o mesmo canto arredondado.
  const p = origem.painel;
  const folhaInicial =
    !reduzir && p
      ? `inset(${p.top}px ${window.innerWidth - p.right}px ${window.innerHeight - p.bottom}px ${p.left}px round 14px)`
      : "inset(0px 0px 0px 0px round 0px)";
  const c = origem.composer;
  const chatInicial =
    !reduzir && c
      ? { left: c.left, width: c.width, bottom: window.innerHeight - c.bottom, opacity: 1 }
      : { ...alvo, opacity: 0 };

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <AnimatePresence>
        {aberto && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content
              forceMount
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="fixed inset-0 z-[75] focus:outline-none"
            >
              <DialogPrimitive.Title className="sr-only">Editor da {nome}</DialogPrimitive.Title>

              {/* Folha em branco: cresce do painel do chat até a tela toda. */}
              <motion.div
                aria-hidden
                className="absolute inset-0 bg-[#FCFCFB]"
                initial={{ clipPath: folhaInicial, opacity: reduzir ? 0 : 1 }}
                animate={{ clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduzir ? 0.2 : 0.72, ease: SUAVE, opacity: { duration: 0.22 } }}
              />

              {/* A loja sendo montada, na tela inteira. */}
              {palco && montagem && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: SUAVE, delay: reduzir ? 0 : 0.62 }}
                  className="absolute inset-0 bg-white"
                >
                  <PaginaEmMontagem dados={palco.dados} montagem={montagem} t={t} reduzir={reduzir} />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: reduzir ? 0 : 0.55 }}
                className="absolute bottom-5 left-4"
              >
                <DialogPrimitive.Close className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/90 px-3.5 text-[12.5px] font-medium text-[#4A4A4A] shadow-[0_6px_20px_-8px_rgba(16,24,40,0.25)] backdrop-blur transition-colors hover:bg-white hover:text-[#1F1F1F]">
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  Voltar ao chat
                </DialogPrimitive.Close>
              </motion.div>

              {/* O chat desliza do lugar dele no painel para o rodapé, no centro. */}
              <motion.form
                onSubmit={(e) => e.preventDefault()}
                initial={chatInicial}
                animate={{ ...alvo, opacity: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: reduzir ? 0.2 : 0.7, ease: SUAVE, delay: reduzir ? 0 : 0.06 }}
                className="absolute rounded-[26px] border border-black/[0.09] bg-white/95 shadow-[0_2px_4px_rgba(16,24,40,0.05),0_16px_40px_-12px_rgba(16,24,40,0.28)] backdrop-blur transition-[border-color] focus-within:border-black/[0.18]"
              >
                {/* O que o Atlas está fazendo agora, logo acima do chat. */}
                {montagem && (etapa || terminou) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: reduzir ? 0 : 0.7 }}
                    aria-live="polite"
                    className="absolute bottom-full left-1/2 mb-2.5 flex max-w-full -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-black/[0.07] bg-white py-1.5 pl-2 pr-3.5 text-[12.5px] shadow-[0_4px_14px_-6px_rgba(16,24,40,0.14)]"
                  >
                    {terminou ? (
                      <>
                        <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#16A34A] text-white">
                          <Check className="h-[11px] w-[11px]" strokeWidth={3} />
                        </span>
                        <span className="truncate text-[#1F1F1F]">A {nome} está pronta</span>
                      </>
                    ) : (
                      <>
                        <svg aria-hidden viewBox="0 0 20 20" className="h-[16px] w-[16px] animate-spin text-[#2563EB]">
                          <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.4" />
                          <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                        </svg>
                        <span className="font-medium text-[#2563EB]">{etapa?.fase === "modelo" ? "Modelo" : "Personalizando"}</span>
                        <span className="truncate text-[#4A4A4A]">{etapa?.rotulo}</span>
                      </>
                    )}
                  </motion.div>
                )}
                {/* Chat compacto: uma linha só. */}
                <div className="flex h-[50px] items-center gap-1 pl-1.5 pr-1.5">
                  <BotaoDaBarra rotulo="Adicionar">
                    <Plus className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </BotaoDaBarra>
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Pergunte qualquer coisa..."
                    aria-label="Mensagem para o Atlas"
                    autoComplete="off"
                    className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[14px] text-[#1F1F1F] outline-none placeholder:text-[#9A9A9A]"
                  />
                  <BotaoDaBarra rotulo="Falar em vez de digitar">
                    <Mic className="h-[17px] w-[17px]" strokeWidth={1.7} />
                  </BotaoDaBarra>
                  {/* Pedir mudanças na loja por aqui ainda não está ligado. */}
                  <button
                    type="submit"
                    disabled
                    title="Logo você vai poder pedir mudanças na loja por aqui"
                    aria-label="Enviar"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDEDEB] text-black/30"
                  >
                    <Send className="h-[15px] w-[15px] -translate-x-px translate-y-px" strokeWidth={1.8} />
                  </button>
                </div>
              </motion.form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
};

export default AtlasEditorAoVivo;
