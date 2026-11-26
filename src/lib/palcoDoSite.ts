/*
  "Palco": o site da loja sendo montado ao vivo por vários cursores, no fim da
  construção pedida no chat do Atlas (ver src/lib/construcaoDaLoja.ts).

  Tudo aqui é função do tempo: `montarRoteiro` gera o roteiro uma vez e o
  componente AtlasPalcoDoSite só pergunta "o que aparece no instante t?".
  Por isso a mesma cena pode ser desenhada no chat e em tela cheia ao mesmo
  tempo, rever do começo é só zerar o relógio, e quem pede menos movimento vê
  direto o site pronto.

  Coordenadas no "papel" de PAPEL.largura × PAPEL.altura; o componente escala.
*/

export const PAPEL = { largura: 1040, altura: 660 } as const;

export type AgenteDoPalco = "atlas" | "texto" | "estilo" | "imagens";

export const AGENTES: Record<AgenteDoPalco, { nome: string; cor: string }> = {
  atlas: { nome: "Atlas", cor: "#111111" },
  texto: { nome: "Texto", cor: "#2563EB" },
  estilo: { nome: "Estilo", cor: "#8B5CF6" },
  imagens: { nome: "Imagens", cor: "#E8590C" },
};

export type ItemDoPalco = { titulo: string; imagem: string | null; preco: number | null; categoria?: string | null };

export type DadosDoPalco = {
  nome: string;
  logo: string | null;
  capa: string | null;
  /** Cor de destaque (botões, preço). */
  destaque: string;
  /** Fundo da página; null = branco. */
  fundo: string | null;
  fonte: string;
  /** Linha pequena acima do título ("Agro"). */
  etiqueta: string;
  subtitulo: string;
  menu: string[];
  botao: string;
  tituloDaSecao: string;
  /** Até 8 cartões; vazio = cartões em branco para preencher no editor. */
  itens: ItemDoPalco[];
  /** Loja de roupa/moda: o modelo fica igual ao original; muda só imagem, texto e produtos. */
  moda?: boolean;
};

/* ----- Onde cada coisa fica no papel ----- */

export const LAYOUT = {
  topo: { x: 0, y: 0, w: 1040, h: 64 },
  logo: { x: 36, y: 18, w: 28, h: 28 },
  nome: { x: 76, y: 21 },
  menu: (i: number) => ({ x: 560 + i * 96, y: 24 }),
  sacola: { x: 976, y: 20 },
  hero: { x: 0, y: 64, w: 1040, h: 332 },
  etiqueta: { x: 58, y: 120 },
  titulo: { x: 56, y: 146, w: 450 },
  subtitulo: { x: 58, y: 250, w: 420 },
  botao: { x: 56, y: 312, w: 168, h: 46 },
  botao2: { x: 236, y: 312, w: 128, h: 46 },
  capa: { x: 552, y: 92, w: 444, h: 276 },
  secao: { x: 0, y: 396, w: 1040, h: 264 },
  tituloDaSecao: { x: 56, y: 420 },
  cartao: (i: number) => ({ x: 56 + i * 236, y: 462, w: 220, h: 176 }),
} as const;

/* ----- Roteiro ----- */

type Movimento = { agente: AgenteDoPalco; t0: number; t1: number; x: number; y: number };
type Fala = { agente: AgenteDoPalco; t0: number; t1: number; texto: string };
export type CaixaDoPalco = { agente: AgenteDoPalco; t0: number; t1: number; x: number; y: number; w: number; h: number };
export type Digitacao = { agente: AgenteDoPalco; campo: string; texto: string; t0: number; msPorLetra: number };
export type Arrasto = { agente: AgenteDoPalco; t0: number; t1: number; imagem: string | null; rotulo: string };

export type Roteiro = {
  duracao: number;
  movimentos: Movimento[];
  falas: Fala[];
  caixas: CaixaDoPalco[];
  digitacoes: Digitacao[];
  arrastos: Arrasto[];
  /** Instante em que cada coisa aparece/muda ("esqueleto.topo", "cor.botao", "img.capa", "img.item.0"...). */
  marcos: Record<string, number>;
  paleta: { t0: number; t1: number };
};

const ENTRADA: Record<AgenteDoPalco, { x: number; y: number }> = {
  atlas: { x: -40, y: 220 },
  texto: { x: -40, y: 560 },
  estilo: { x: PAPEL.largura + 40, y: 140 },
  imagens: { x: PAPEL.largura + 40, y: 560 },
};

/** Tempo de digitação: rápido, mas sem passar de `teto` ms no total. */
const ritmo = (texto: string, base: number, teto: number) => Math.max(12, Math.min(base, teto / Math.max(1, texto.length)));

export function montarRoteiro(dados: DadosDoPalco): Roteiro {
  const r: Roteiro = {
    duracao: 0,
    movimentos: [],
    falas: [],
    caixas: [],
    digitacoes: [],
    arrastos: [],
    marcos: {},
    paleta: { t0: 0, t1: 0 },
  };

  /** Cada agente tem o próprio relógio; os quatro trabalham ao mesmo tempo. */
  const agente = (quem: AgenteDoPalco, comeco: number) => {
    let t = comeco;
    r.movimentos.push({ agente: quem, t0: 0, t1: 0, ...ENTRADA[quem] });
    const a = {
      get t() {
        return t;
      },
      esperar(ms: number) {
        t += ms;
        return a;
      },
      ate(instante: number) {
        t = Math.max(t, instante);
        return a;
      },
      ir(x: number, y: number, ms = 520) {
        r.movimentos.push({ agente: quem, t0: t, t1: t + ms, x, y });
        t += ms;
        return a;
      },
      falar(texto: string, ms: number) {
        r.falas.push({ agente: quem, t0: t, t1: t + ms, texto });
        return a;
      },
      caixa(c: { x: number; y: number; w: number; h: number }, ms = 700) {
        // O cursor arrasta do canto de cima ao de baixo, desenhando a caixa.
        r.movimentos.push({ agente: quem, t0: t, t1: t + ms * 0.6, x: c.x + c.w, y: c.y + c.h });
        r.caixas.push({ agente: quem, t0: t, t1: t + ms, ...c });
        t += ms;
        return a;
      },
      digitar(campo: string, texto: string, base = 45, teto = 1400) {
        const ms = ritmo(texto, base, teto);
        r.digitacoes.push({ agente: quem, campo, texto, t0: t, msPorLetra: ms });
        t += ms * texto.length + 120;
        return a;
      },
      marco(nome: string) {
        r.marcos[nome] = t;
        return a;
      },
      arrastar(imagem: string | null, rotulo: string, x: number, y: number, ms = 760) {
        r.arrastos.push({ agente: quem, t0: t, t1: t + ms, imagem, rotulo });
        return a.ir(x, y, ms);
      },
    };
    return a;
  };

  const L = LAYOUT;

  // Atlas: planeja a página desenhando as três partes.
  const atlas = agente("atlas", 150);
  atlas.ir(L.topo.x + 6, L.topo.y + 4, 600).falar("Planejando o topo", 1300).caixa(L.topo).marco("esqueleto.topo");
  atlas.ir(L.hero.x + 24, L.hero.y + 12, 420).falar("Planejando a capa", 1100).caixa({ x: 24, y: 76, w: 992, h: 308 }).marco("esqueleto.hero");
  atlas.ir(24, L.secao.y + 12, 420).falar(`Planejando ${dados.tituloDaSecao.toLowerCase()}`, 1100).caixa({ x: 24, y: 404, w: 992, h: 244 }).marco("esqueleto.secao");
  atlas.ir(760, 420, 900).esperar(200);

  // Texto: nome e menu primeiro, depois o título e o resto.
  const texto = agente("texto", 900);
  texto.ate(r.marcos["esqueleto.topo"] - 150).ir(L.nome.x + 4, L.nome.y + 18, 520).falar("Escrevendo o nome", 1200).digitar("nome", dados.nome, 55, 900);
  dados.menu.forEach((item, i) => {
    const p = L.menu(i);
    texto.ir(p.x + 2, p.y + 16, 200).digitar(`menu.${i}`, item, 26, 260);
  });
  texto.ate(r.marcos["esqueleto.hero"]).ir(L.etiqueta.x + 2, L.etiqueta.y + 14, 460).falar("Escrevendo o título", 2000).digitar("etiqueta", dados.etiqueta, 30, 360);
  texto.ir(L.titulo.x + 4, L.titulo.y + 48, 300).digitar("titulo", dados.nome, 70, 1300);
  texto.ir(L.subtitulo.x + 4, L.subtitulo.y + 16, 380).falar("Escrevendo a chamada", 1400).digitar("subtitulo", dados.subtitulo, 24, 1300);
  texto.ir(L.botao.x + 30, L.botao.y + 28, 380).digitar("botao", dados.botao, 34, 420);
  texto.ir(L.botao2.x + 26, L.botao2.y + 28, 260).digitar("botao2", "Saiba mais", 30, 320);
  texto.ate(r.marcos["esqueleto.secao"]).ir(L.tituloDaSecao.x + 4, L.tituloDaSecao.y + 20, 520).digitar("secao", dados.tituloDaSecao, 40, 520);
  const itens = dados.itens.slice(0, 4);
  itens.forEach((item, i) => {
    const c = L.cartao(i);
    texto.ir(c.x + 12, c.y + 140, 300).digitar(`item.${i}`, item.titulo, 18, 520);
  });
  texto.esperar(150).ir(150, 560, 700);

  // Imagens: logo, capa e as fotos dos itens.
  const imagens = agente("imagens", 900);
  if (dados.logo) {
    imagens.ate(r.marcos["esqueleto.topo"]).ir(L.logo.x + 14, L.logo.y + 14, 640).falar("Colocando a logo", 900).esperar(160).marco("img.logo").esperar(260);
  }
  imagens
    .ate(r.marcos["esqueleto.hero"] + 300)
    .ir(PAPEL.largura - 40, 40, 360)
    .falar("Colocando a capa", 1800)
    .arrastar(dados.capa, "capa_da_loja.png", L.capa.x + L.capa.w / 2, L.capa.y + L.capa.h / 2)
    .marco("img.capa")
    .esperar(700);
  itens.forEach((item, i) => {
    const c = L.cartao(i);
    imagens.ate(r.marcos["esqueleto.secao"] + 200).ir(c.x + c.w / 2, c.y + 56, 340).esperar(80).marco(`img.item.${i}`).esperar(160);
  });
  imagens.ir(760, 560, 700);

  // Estilo: paleta, fundo, fonte, botão e preços.
  const estilo = agente("estilo", 1800);
  estilo.ate(r.marcos["esqueleto.hero"] + 600).ir(760, 116, 620).falar("Aplicando a paleta", 2400);
  r.paleta.t0 = estilo.t;
  estilo.esperar(500).marco("cor.fundo").esperar(450).ir(L.titulo.x + 220, L.titulo.y + 30, 520).marco("fonte").esperar(500);
  r.paleta.t1 = estilo.t;
  estilo.ate(r.marcos["esqueleto.hero"] + 3600).ir(L.botao.x + L.botao.w - 18, L.botao.y + 20, 520).falar("Cor dos botões", 1100).esperar(140).marco("cor.botao").esperar(300);
  if (!dados.logo) estilo.ir(L.logo.x + 14, L.logo.y + 14, 460).esperar(80).marco("cor.logo").esperar(200);
  if (itens.some((i) => i.preco !== null)) {
    estilo.ate(r.marcos[`img.item.${itens.length - 1}`] ?? 0).ir(L.cartao(0).x + 40, L.cartao(0).y + 166, 480).falar("Destacando os preços", 900).esperar(100).marco("cor.preco").esperar(300);
  }
  estilo.ir(840, 380, 700);

  // Atlas confere tudo no fim.
  const fimDoTrabalho = Math.max(texto.t, imagens.t, estilo.t);
  atlas.ate(fimDoTrabalho - 900).ir(20, 18, 520).falar("Conferindo a página", 1500).caixa({ x: 12, y: 8, w: 1016, h: 644 }, 900).esperar(200);
  r.marcos.pronto = Math.max(atlas.t, fimDoTrabalho) + 250;
  r.duracao = r.marcos.pronto + 900;
  return r;
}

/* ----- Perguntas ao roteiro ----- */

const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const entre = (t: number, t0: number, t1: number) => (t1 <= t0 ? (t >= t0 ? 1 : 0) : Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));

export function posicaoDoCursor(r: Roteiro, quem: AgenteDoPalco, t: number): { x: number; y: number } {
  let x = ENTRADA[quem].x;
  let y = ENTRADA[quem].y;
  for (const m of r.movimentos) {
    if (m.agente !== quem || m.t0 > t) continue;
    const p = suave(entre(t, m.t0, m.t1));
    x += (m.x - x) * p;
    y += (m.y - y) * p;
  }
  return { x, y };
}

export const falaDoAgente = (r: Roteiro, quem: AgenteDoPalco, t: number) =>
  r.falas.filter((f) => f.agente === quem && t >= f.t0 && t < f.t1).at(-1)?.texto ?? null;

export const caixasNoTempo = (r: Roteiro, t: number) =>
  r.caixas
    .filter((c) => t >= c.t0 && t < c.t1 + 450)
    .map((c) => ({ ...c, desenho: suave(entre(t, c.t0, c.t0 + (c.t1 - c.t0) * 0.6)), saindo: t > c.t1 }));

/** Texto do campo no instante t; `digitando` liga o cursor de texto piscando. */
export function textoNoTempo(r: Roteiro, campo: string, t: number): { texto: string; digitando: boolean; agente: AgenteDoPalco | null } {
  const d = r.digitacoes.find((x) => x.campo === campo);
  if (!d || t < d.t0) return { texto: "", digitando: false, agente: null };
  const letras = Math.min(d.texto.length, Math.floor((t - d.t0) / d.msPorLetra));
  return { texto: d.texto.slice(0, letras), digitando: t < d.t0 + d.msPorLetra * d.texto.length + 250, agente: d.agente };
}

/** 0 → 1 a partir do marco, em `ms`. */
export const progressoDoMarco = (r: Roteiro, nome: string, t: number, ms = 450) => {
  const m = r.marcos[nome];
  return m === undefined ? 0 : entre(t, m, m + ms);
};

export const arrastoNoTempo = (r: Roteiro, t: number) => r.arrastos.find((a) => t >= a.t0 && t < a.t1) ?? null;
