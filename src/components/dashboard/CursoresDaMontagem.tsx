import { useLayoutEffect, useMemo, useRef } from "react";

import {
  acoesDosCursores,
  AGENTES_DA_MONTAGEM,
  estadoDoAgente,
  suave,
  type AcaoDoCursor,
  type AgenteDaMontagem,
  type EstadoDoAgente,
} from "@/lib/cursoresDaMontagem";
import type { Montagem } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";

/**
 * Cursores com nome que montam a loja por cima da VitrineEditorial: andam até
 * cada ponto, clicam, arrastam a foto para o lugar e digitam (roteiro em
 * src/lib/cursoresDaMontagem.ts). Fica dentro do contêiner escalado da loja;
 * os cursores se desfazem da escala para manter o tamanho de tela.
 */

type Ponto = { x: number; y: number };
type Caixa = Ponto & { w: number; h: number };

const AGENTES = Object.keys(AGENTES_DA_MONTAGEM) as AgenteDaMontagem[];

const SetaDoCursor = ({ cor }: { cor: string }) => (
  <svg viewBox="0 0 20 22" className="h-[22px] w-[20px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" aria-hidden>
    <path d="M2.2 1.6 18 9.4c.9.4.8 1.7-.2 2l-6.3 1.8-2.6 6.1c-.4.9-1.7.9-2-.1L1 3c-.3-1 .5-1.8 1.2-1.4Z" fill={cor} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const seletor = (alvo: string) => (alvo.startsWith("secao:") ? `[data-secao="${alvo.slice(6)}"]` : `[data-alvo="${alvo}"]`);

const CursoresDaMontagem = ({ montagem, dados, t, escala }: { montagem: Montagem; dados: DadosDoPalco; t: number; escala: number }) => {
  const raiz = useRef<HTMLDivElement>(null);
  const cursores = useRef<Partial<Record<AgenteDaMontagem, HTMLDivElement | null>>>({});
  const caixa = useRef<HTMLDivElement>(null);
  const medida = useRef<HTMLSpanElement>(null);

  const porAgente = useMemo(() => {
    const acoes = acoesDosCursores(montagem, dados);
    return Object.fromEntries(AGENTES.map((a) => [a, acoes.filter((x) => x.agente === a)])) as Record<AgenteDaMontagem, AcaoDoCursor[]>;
  }, [montagem, dados]);

  const estados = Object.fromEntries(AGENTES.map((a) => [a, estadoDoAgente(porAgente[a], t)])) as Record<AgenteDaMontagem, EstadoDoAgente | null>;
  const atlas = estados.atlas;
  const desenhando = atlas && atlas.para.tipo === "caixa" && atlas.viagem >= 1 ? atlas : null;
  const caixaVisivel = desenhando ? 1 - Math.max(0, (t - desenhando.para.t0 - desenhando.para.dur - 200) / 300) : 0;

  // Posições: medidas na loja a cada quadro (o texto cresce enquanto é digitado).
  useLayoutEffect(() => {
    const r = raiz.current;
    if (!r || escala <= 0) return;
    const base = r.getBoundingClientRect();
    // Parte da loja que está na tela (sem o chat flutuante embaixo), em px do desenho.
    const folha = r.closest("[data-folha]")?.getBoundingClientRect();
    const fundoVisivel = folha ? (folha.bottom - 150 - base.top) / escala : Infinity;
    const rel = (x: DOMRect): Caixa => ({ x: (x.left - base.left) / escala, y: (x.top - base.top) / escala, w: x.width / escala, h: x.height / escala });
    const caixaDe = (alvo: string) => {
      const el = r.parentElement?.querySelector(seletor(alvo));
      return el ? { el, c: rel(el.getBoundingClientRect()) } : null;
    };
    const fimDoTexto = (el: Element, c: Caixa): Ponto => {
      const faixa = document.createRange();
      faixa.selectNodeContents(el);
      const linhas = faixa.getClientRects();
      const ultima = linhas[linhas.length - 1];
      if (!ultima) return { x: c.x + 8, y: c.y + c.h * 0.6 };
      const u = rel(ultima);
      return { x: u.x + u.w + 3, y: u.y + u.h * 0.55 };
    };
    const ponto = (acao: AcaoDoCursor, onde: "inicio" | "fim"): Ponto | null => {
      const achado = caixaDe(acao.alvo);
      if (!achado) return null;
      const { el, c } = achado;
      if (acao.tipo === "caixa")
        return onde === "inicio" ? { x: c.x + 2, y: c.y + 2 } : { x: c.x + c.w - 2, y: Math.max(c.y + 60, Math.min(c.y + c.h - 2, fundoVisivel)) };
      if (acao.tipo === "digitar") return fimDoTexto(el, c);
      return { x: c.x + c.w * 0.5, y: c.y + c.h * 0.5 };
    };

    for (const agente of AGENTES) {
      const no = cursores.current[agente];
      const e = estados[agente];
      if (!no) continue;
      if (!e || e.visivel <= 0) {
        no.style.opacity = "0";
        continue;
      }
      const destino = ponto(e.para, "inicio");
      if (!destino) {
        no.style.opacity = "0";
        continue;
      }
      let p = destino;
      if (e.viagem < 1) {
        const origem = (e.de && ponto(e.de, "fim")) ?? { x: destino.x - 140, y: destino.y + 170 };
        const k = suave(e.viagem);
        // Leve curva no caminho, como uma mão de verdade.
        const curva = Math.sin(Math.PI * k) * 26;
        p = { x: origem.x + (destino.x - origem.x) * k + curva, y: origem.y + (destino.y - origem.y) * k - curva * 0.6 };
      } else if (e.para.tipo === "caixa") {
        const fim = ponto(e.para, "fim") ?? destino;
        const k = suave(e.progresso);
        p = { x: destino.x + (fim.x - destino.x) * k, y: destino.y + (fim.y - destino.y) * k };
      }
      no.style.opacity = String(e.visivel);
      no.style.transform = `translate(${p.x}px, ${p.y}px) scale(${1 / escala})`;
      // Perto da borda direita, o nome vai para o outro lado da seta.
      const pilula = no.querySelector<HTMLElement>("[data-pilula]");
      if (pilula) {
        const virar = p.x > base.width / escala - 260 / escala;
        pilula.style.left = virar ? "auto" : "14px";
        pilula.style.right = virar ? "4px" : "auto";
      }
    }

    // A caixa que o Atlas arrasta sobre a seção, com a medida.
    const cx = caixa.current;
    if (cx) {
      const achado = desenhando ? caixaDe(desenhando.para.alvo) : null;
      if (!desenhando || !achado || caixaVisivel <= 0) {
        cx.style.opacity = "0";
      } else {
        const k = suave(desenhando.progresso);
        const c = achado.c;
        const w = Math.max(4, c.w * k);
        const h = Math.max(4, c.h * k);
        cx.style.opacity = String(caixaVisivel);
        cx.style.transform = `translate(${c.x}px, ${c.y}px)`;
        cx.style.width = `${w}px`;
        cx.style.height = `${h}px`;
        if (medida.current) medida.current.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      }
    }
  });

  if (escala <= 0) return null;
  const traco = 1.5 / escala;

  return (
    <div ref={raiz} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Caixa do Atlas */}
      <div
        ref={caixa}
        className="absolute left-0 top-0 rounded-[2px] bg-[#2563EB]/[0.035]"
        style={{ opacity: 0, outline: `${traco}px solid #2563EB`, willChange: "transform, width, height" }}
      >
        <span className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${1 / escala})` }}>
          <span className="m-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] bg-[#2563EB] px-1.5 py-[2px] text-[10.5px] font-semibold text-white">
            {desenhando?.para.rotulo}
            <span ref={medida} className="font-normal tabular-nums text-white/80" />
          </span>
        </span>
        {/* Alças nos cantos */}
        {["left-0 top-0", "right-0 top-0", "left-0 bottom-0", "right-0 bottom-0"].map((canto) => (
          <span
            key={canto}
            className={`absolute ${canto} border-[#2563EB] bg-white`}
            style={{ width: 7 / escala, height: 7 / escala, borderWidth: traco, margin: -3.5 / escala }}
          />
        ))}
      </div>

      {AGENTES.map((agente) => {
        const e = estados[agente];
        const { nome, cor } = AGENTES_DA_MONTAGEM[agente];
        const acao = e?.para;
        // Parado esperando a próxima tarefa: mostra a que acabou de fazer.
        const rotulo = e && e.viagem <= 0 ? e.de?.rotulo : acao?.rotulo;
        const noAlvo = !!e && e.viagem >= 1;
        const clique = acao && noAlvo ? (t - acao.t0) / 420 : -1;
        const levando = acao?.tipo === "imagem" && acao.imagem && (!noAlvo || e.progresso < 0.35);
        const soltando = noAlvo && e ? Math.min(1, e.progresso / 0.35) : 0;
        return (
          <div
            key={agente}
            ref={(no) => {
              cursores.current[agente] = no;
            }}
            className="absolute left-0 top-0 origin-top-left"
            style={{ opacity: 0, willChange: "transform, opacity" }}
          >
            {clique >= 0 && clique < 1 && (
              <span
                className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-2"
                style={{ borderColor: cor, opacity: 1 - clique, transform: `scale(${0.3 + clique * 1.2})` }}
              />
            )}
            {levando && (
              <img
                src={acao.imagem ?? ""}
                alt=""
                className="absolute left-[18px] top-[-52px] h-[52px] w-[52px] rounded-[8px] bg-white object-cover shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)] ring-2 ring-white"
                style={{ opacity: 1 - soltando, transform: `rotate(-6deg) scale(${1 - soltando * 0.4})` }}
              />
            )}
            <div style={{ transform: `scale(${clique >= 0 && clique < 0.25 ? 0.86 : 1})` }} className="transition-transform duration-100">
              <SetaDoCursor cor={cor} />
            </div>
            <span
              data-pilula
              className="absolute left-[14px] top-[21px] flex items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-2 pr-2.5 text-[11.5px] font-semibold text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]"
              style={{ background: cor }}
            >
              {nome}
              {rotulo && <span className="font-normal text-white/80">{rotulo}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default CursoresDaMontagem;
