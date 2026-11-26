/*
  Roteiro dos cursores que "montam" a loja na tela do editor (AtlasEditorAoVivo).

  Cada troca da montagem (src/lib/montagemDaVitrine.ts) vira uma ação de um
  agente com nome e cor: o Atlas desenha as seções do modelo; Texto digita;
  Imagens arrasta fotos para o lugar; Estilo troca fonte e cores. O cursor
  chega ao alvo um pouco antes da troca começar, clica e trabalha.

  Tudo é função do tempo `t`, como o resto da montagem. Onde fica cada alvo na
  tela é medido pelo componente (atributos `data-alvo` e `data-secao` na
  VitrineEditorial); aqui só se decide quem vai aonde e quando.
*/

import type { Montagem } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";
import { categoriaDoProduto, categoriasDosItens } from "@/lib/variacoesDaVitrine";

export type AgenteDaMontagem = "atlas" | "texto" | "estilo" | "imagens";

export const AGENTES_DA_MONTAGEM: Record<AgenteDaMontagem, { nome: string; cor: string }> = {
  atlas: { nome: "Atlas", cor: "#111111" },
  texto: { nome: "Texto", cor: "#2563EB" },
  estilo: { nome: "Estilo", cor: "#8B5CF6" },
  imagens: { nome: "Imagens", cor: "#E8590C" },
};

export type AcaoDoCursor = {
  agente: AgenteDaMontagem;
  /** `secao:<id>` (caixa da seção) ou o valor de `data-alvo`. */
  alvo: string;
  t0: number;
  dur: number;
  /** caixa: arrasta da ponta de cima à de baixo; digitar: segue o fim do texto; imagem: solta a foto no centro. */
  tipo: "caixa" | "digitar" | "imagem" | "clique";
  rotulo: string;
  imagem?: string | null;
};

/** Quanto o cursor leva, no máximo, para ir de um alvo ao próximo. */
export const VIAGEM = 700;
/** O Atlas leva este tempo para desenhar a caixa de cada seção do modelo. */
export const DESENHO_DA_SECAO = 750;

const ROTULO_DO_TEXTO: Record<string, string> = {
  aviso: "Escrevendo o aviso",
  capa: "Escrevendo a capa",
  chamada: "Escrevendo a chamada",
  secao2: "Escrevendo o título",
  frase: "Escrevendo a frase",
  newsletter: "Escrevendo a newsletter",
  rodape: "Fechando o rodapé",
};

export function acoesDosCursores(m: Montagem, dados: DadosDoPalco): AcaoDoCursor[] {
  const acoes: AcaoDoCursor[] = [];

  // Modelo: o Atlas desenha cada seção logo depois que ela aparece.
  for (const [secao, t0] of Object.entries(m.secoes)) {
    acoes.push({ agente: "atlas", alvo: `secao:${secao}`, t0: t0 + 60, dur: DESENHO_DA_SECAO, tipo: "caixa", rotulo: m.nomesDasSecoes[secao] ?? secao });
  }

  const itens = dados.itens.slice(0, 8);
  const moda = m.modelo === "vitrine-moda";
  const categorias = categoriasDosItens(itens, 6);
  for (const [campo, { t0, dur }] of Object.entries(m.trocas)) {
    const [grupo, parte] = campo.split(".");
    const i = Number(parte);
    const add = (agente: AgenteDaMontagem, alvo: string, tipo: AcaoDoCursor["tipo"], rotulo: string, imagem?: string | null) =>
      acoes.push({ agente, alvo, t0, dur, tipo, rotulo, imagem });

    if (campo === "marca.logo") add("imagens", "marca", "imagem", "Colocando a logo", dados.logo);
    else if (campo === "marca.nome") add("texto", "marca", "digitar", "Escrevendo o nome");
    else if (grupo === "menu") add("texto", `menu-${i}`, "digitar", "Ajustando o menu");
    else if (campo === "fonte") add("estilo", "capa-titulo", "clique", `Fonte ${dados.fonte}`);
    else if (campo === "cores") add("estilo", moda ? "topo" : "capa-botao", "clique", "Aplicando as cores");
    else if (campo === "capa.imagem") add("imagens", "capa-foto", "imagem", dados.capa ? "Colocando a capa" : "Preparando a capa", dados.capa);
    else if (campo === "capa.etiqueta") add("texto", "capa-etiqueta", "digitar", "Escrevendo a chamada");
    else if (campo === "capa.titulo") add("texto", "capa-titulo", "digitar", "Escrevendo o título");
    else if (campo === "capa.botao") add("texto", "capa-botao", "digitar", "Escrevendo o botão");
    else if (campo === "secao.titulo") add("texto", "secao-titulo", "digitar", "Escrevendo o título");
    else if (campo === "secao.abas") add("texto", "abas", "clique", "Criando as categorias");
    else if (grupo === "produto") add("imagens", `produto-${i}`, "imagem", "Adicionando produto", itens[i]?.imagem ?? null);
    else if (grupo === "preco") add("texto", `preco-${i}`, "digitar", "Colocando o preço");
    else if (grupo === "categoria") {
      const foto = itens.find((x) => (x.categoria || categoriaDoProduto(x.titulo)) === categorias[i] && x.imagem)?.imagem ?? null;
      add("imagens", `categoria-${i}`, foto ? "imagem" : "clique", "Criando as categorias", foto);
    } else if (grupo === "destaque") {
      const foto = [dados.capa, itens[0]?.imagem ?? (moda ? null : dados.capa), itens[1]?.imagem ?? null, null][i] ?? null;
      add("imagens", `destaque-${i}`, foto ? "imagem" : "clique", moda ? "Montando os atalhos" : "Montando os destaques", foto);
    } else if (campo === "avaliacoes") add("texto", "avaliacoes", "clique", "Preparando as avaliações");
    // Os demais textos: o alvo é o próprio campo ("chamada.titulo" → data-alvo="chamada-titulo").
    else add("texto", campo.replace(/\./g, "-"), "digitar", ROTULO_DO_TEXTO[grupo] ?? "Escrevendo");
  }
  return acoes.sort((a, b) => a.t0 - b.t0);
}

export type EstadoDoAgente = {
  /** Ação anterior (de onde o cursor sai) e a da vez (para onde vai ou onde está). */
  de: AcaoDoCursor | null;
  para: AcaoDoCursor;
  /** 0 → 1 no caminho até o alvo; 1 = chegou. */
  viagem: number;
  /** 0 → 1 durante o trabalho no alvo. */
  progresso: number;
  /** Opacidade do cursor (entra, some no fim). */
  visivel: number;
};

const limitar = (n: number) => Math.min(1, Math.max(0, n));

/** Onde está um agente no instante t (ações dele, em ordem). */
export function estadoDoAgente(acoes: AcaoDoCursor[], t: number): EstadoDoAgente | null {
  if (acoes.length === 0) return null;
  const idx = acoes.findIndex((a) => t < a.t0 + a.dur);
  if (idx === -1) {
    const ultima = acoes[acoes.length - 1];
    const fim = ultima.t0 + ultima.dur;
    return { de: acoes[acoes.length - 2] ?? null, para: ultima, viagem: 1, progresso: 1, visivel: 1 - limitar((t - fim - 500) / 400) };
  }
  const para = acoes[idx];
  const de = acoes[idx - 1] ?? null;
  const livre = de ? de.t0 + de.dur : -Infinity;
  const partida = Math.max(livre, para.t0 - VIAGEM);
  const viagem = para.t0 <= partida ? 1 : limitar((t - partida) / (para.t0 - partida));
  const progresso = limitar((t - para.t0) / para.dur);
  const visivel = de ? 1 : limitar((t - partida) / 200);
  return { de, para, viagem, progresso, visivel };
}

export const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
