/*
  Linha do tempo da montagem da loja na tela do editor (AtlasEditorAoVivo):
  1) o modelo (src/lib/modelosDeLoja.ts) aparece puro, seção por seção;
  2) a personalização troca cada ponto pelas escolhas e produtos da pessoa.

  Dois modelos: "Vitrine moda" para loja de roupa/calçado/acessório
  (`dados.moda`) e "Vitrine editorial" para o resto.

  Tudo é função do tempo `t` (ms desde `palco.comecouEm` no motor de
  construção): reabrir o editor mostra o mesmo instante e quem pede menos
  movimento vê direto o fim.
*/

import type { DadosDoPalco } from "@/lib/palcoDoSite";
import { dadosDaPersonalidade } from "@/lib/personalidadeDaMarca";
import { categoriasDosItens, dadosDaCapa, escolher, variacoesDaVitrine } from "@/lib/variacoesDaVitrine";

/** A folha do editor leva ~0,7 s para cobrir a tela; a montagem começa depois. */
export const ESPERA_DA_TRANSICAO = 900;
/** Pausa depois de cada troca, para o cursor ir com calma até o próximo ponto. */
const PAUSA = 320;

export type IdDoModelo = "vitrine-editorial" | "vitrine-moda";
/** Id da seção (`data-secao` no componente do modelo). */
export type SecaoDaVitrine = string;

export type EtapaDaMontagem = {
  t0: number;
  t1: number;
  fase: "modelo" | "personalizacao";
  rotulo: string;
  secao: SecaoDaVitrine;
};

export type Montagem = {
  modelo: IdDoModelo;
  duracao: number;
  /** Quando cada seção do modelo aparece. */
  secoes: Record<SecaoDaVitrine, number>;
  /** Nome de cada seção (aparece na caixa que o Atlas desenha). */
  nomesDasSecoes: Record<SecaoDaVitrine, string>;
  etapas: EtapaDaMontagem[];
  /** Quando cada ponto muda: `t0` e quanto dura a troca (texto digitado ou foto entrando). */
  trocas: Record<string, { t0: number; dur: number }>;
  fimDoModelo: number;
};

/** Monta a linha do tempo: o modelo seção por seção e as ferramentas da personalização. */
function linhaDoTempo(modelo: IdDoModelo, nomeDoModelo: string, secoes: [SecaoDaVitrine, string][], intervalo: number, respiroPadrao: number) {
  const m: Montagem = { modelo, duracao: 0, secoes: {}, nomesDasSecoes: {}, etapas: [], trocas: {}, fimDoModelo: 0 };
  let t = ESPERA_DA_TRANSICAO;
  const inicio = t;
  secoes.forEach(([id, nome], i) => {
    m.secoes[id] = inicio + i * intervalo;
    m.nomesDasSecoes[id] = nome;
  });
  t = inicio + secoes.length * intervalo + 700;
  m.etapas.push({ t0: inicio, t1: t, fase: "modelo", rotulo: `Criando o modelo ${nomeDoModelo}`, secao: secoes[0][0] });
  m.fimDoModelo = t;
  t += 600;

  const etapa = (rotulo: string, secao: SecaoDaVitrine, trabalho: () => void, respiro = respiroPadrao) => {
    const t0 = t;
    trabalho();
    t = Math.max(t, t0 + 900) + respiro;
    m.etapas.push({ t0, t1: t, fase: "personalizacao", rotulo, secao });
  };
  const troca = (campo: string, dur: number, depois = dur + PAUSA) => {
    m.trocas[campo] = { t0: t, dur };
    t += depois;
  };
  const digitar = (campo: string, texto: string, msPorLetra = 70, teto = 1600) => {
    const dur = Math.min(teto, Math.max(320, texto.length * msPorLetra));
    troca(campo, dur);
  };
  const fechar = () => {
    m.duracao = t + 900;
    return m;
  };
  return { m, etapa, troca, digitar, fechar };
}

/* ----- Vitrine editorial ----- */

function montarEditorial(dados: DadosDoPalco): Montagem {
  const { etapa, troca, digitar, fechar } = linhaDoTempo(
    "vitrine-editorial",
    "Vitrine editorial",
    [
      ["topo", "Topo"],
      ["capa", "Capa"],
      ["novidades", "Novidades"],
      ["destaques", "Destaques"],
    ],
    1100,
    550,
  );

  etapa(dados.logo ? "Colocando a sua logo e o nome" : "Colocando o nome da loja", "topo", () => {
    if (dados.logo) troca("marca.logo", 900);
    digitar("marca.nome", dados.nome, 120, 1400);
  });
  etapa("Ajustando o menu", "topo", () => {
    dados.menu.forEach((item, i) => digitar(`menu.${i}`, item, 65, 560));
  });
  // Moda usa o modelo de moda; aqui fonte e cores sempre seguem a escolha da pessoa.
  etapa(`Trocando a fonte para ${dados.fonte}`, "capa", () => troca("fonte", 1100));
  etapa("Aplicando as suas cores", "capa", () => troca("cores", 1300));
  etapa(dados.capa ? "Colocando a imagem de capa" : "Preparando a capa", "capa", () => troca("capa.imagem", 1500));
  etapa("Escrevendo a chamada", "capa", () => {
    digitar("capa.etiqueta", dados.etiqueta, 60, 800);
    digitar("capa.titulo", dados.subtitulo, 55, 2200);
    digitar("capa.botao", dados.botao, 70, 800);
  });

  const itens = dados.itens.slice(0, 8);
  if (itens.length > 0) {
    etapa(`Adicionando ${itens.length} ${itens.length === 1 ? "item" : "itens"}`, "novidades", () => {
      digitar("secao.titulo", dados.tituloDaSecao, 80, 900);
      troca("secao.abas", 700);
      itens.forEach((_, i) => troca(`produto.${i}`, 750, 560));
    });
    if (itens.some((i) => i.preco !== null))
      etapa("Colocando os preços", "novidades", () => itens.forEach((_, i) => troca(`preco.${i}`, 380, 240)));
  } else {
    etapa(`Preparando ${dados.tituloDaSecao.toLowerCase()}`, "novidades", () => digitar("secao.titulo", dados.tituloDaSecao, 80, 900));
  }
  etapa("Montando os destaques", "destaques", () => [0, 1, 2, 3].forEach((i) => troca(`destaque.${i}`, 1000, 800)));
  return fechar();
}

/* ----- Vitrine moda ----- */

/** Textos que a Vitrine moda escreve na personalização (o componente lê daqui também). */
/*
  Textos da Vitrine moda. Cada loja sorteia (pela semente do nome) uma versão de
  cada frase, para as lojas não saírem iguais. Nenhuma frase promete frete,
  desconto, prazo ou número: só convida a ver a loja.
*/
const TITULOS_DA_CAPA: [string, string][] = [
  ["Seu estilo", "começa aqui"],
  ["Vista o", "seu melhor"],
  ["Peças que", "acompanham você"],
  ["Novos looks", "para todo dia"],
  ["Estilo com", "a sua cara"],
  ["Feito para", "ser usado"],
];
const BOTOES = ["Ver novidades", "Comprar agora", "Ver coleção", "Conhecer a loja"];
const BOTOES_SECUNDARIOS = ["Ver categorias", "Explorar a loja"];

export function textosDaVitrineModa(dados: DadosDoPalco) {
  const v = variacoesDaVitrine(dados);
  const s = v.semente;
  const nome = dados.nome;
  const ano = new Date().getFullYear();
  const etq = dados.etiqueta.toLowerCase();
  const categorias = categoriasDosItens(dados.itens, 6);
  // Personalidade da marca: a voz dela troca os textos que mais aparecem (capa, botões, chamada, frase).
  const voz = dados.personalidade ? dadosDaPersonalidade(dados.personalidade).voz : null;
  const comNome = (t: string) => t.replace(/\{nome\}/g, nome);
  const [linha1, linha2] = escolher(voz?.titulosDaCapa ?? TITULOS_DA_CAPA, s, 0x11);
  const [novidades, novidadesSub] = escolher(
    [
      ["Novidades", "Chegou na loja"],
      ["Lançamentos", "Confira as peças novas"],
      ["Acabou de chegar", "As últimas peças da loja"],
    ],
    s,
    0x22,
  );
  const [essenciais, essenciaisSub] = escolher(
    [
      ["Essenciais", "Para usar todo dia"],
      ["Básicos", "Peças que combinam com tudo"],
      ["Do dia a dia", "Conforto para a rotina"],
    ],
    s,
    0x33,
  );
  /*
    Faixa escura da chamada: título curto com energia, frase concreta e botão de
    uma palavra, como as lojas de moda fazem ("Garanta seu desconto! / Quero!").
    Sem oferta inventada (desconto, parcela, frete, prazo): a frase concreta vem
    das categorias reais da loja.
  */
  const chamadaTitulo = comNome(escolher(voz?.chamadaTitulos ?? ["Monte o seu look!", "Escolha o seu favorito!", "Vista {nome}!", "Ache o seu estilo!"], s, 0x44));
  const listaDeCategorias = (() => {
    const c = categorias.slice(0, 3).map((x, i) => (i === 0 ? x : x.toLowerCase()));
    return c.length < 2 ? null : `${c.slice(0, -1).join(", ")} e ${c[c.length - 1]}`;
  })();
  const chamadaTexto = listaDeCategorias
    ? `${listaDeCategorias} em um só lugar. ${escolher(["Escolha as suas peças e combine do seu jeito.", "Monte o look do seu jeito.", "Combine como quiser."], s, 0x45)}`
    : escolher(
        [`Veja as peças da ${nome} e monte o seu look.`, "Escolha as suas peças favoritas e combine do seu jeito.", `Na ${nome} você encontra peças para combinar do seu jeito.`],
        s,
        0x45,
      );
  const chamadaBotao = escolher(voz?.chamadaBotoes ?? ["Quero!", "Eu quero!", "Quero ver!", "Ver agora"], s, 0x46);
  return {
    variacoes: v,
    aviso: escolher([`Bem-vindo à ${nome}`, `${nome} · ${dados.etiqueta}`, `Conheça as novidades da ${nome}`], s, 0x55),
    capaEtiqueta: escolher([dados.etiqueta, "Novidades", `Coleção ${ano}`], s, 0x66),
    capaTitulo: `${linha1} ${linha2}`,
    capaLinhas: [linha1, linha2] as const,
    /** A frase da pessoa (ou a do nicho) fica como texto de apoio. */
    capaTexto: dados.subtitulo,
    botao: escolher(voz?.botoes ?? BOTOES, s, 0x77),
    botao2: escolher(BOTOES_SECUNDARIOS, s, 0x88),
    categorias,
    chamadaTitulo,
    chamadaTexto,
    chamadaBotao,
    novidades,
    novidadesSub,
    essenciais,
    essenciaisSub,
    // Com 3+ categorias os atalhos são categorias (todos levam às peças); sem elas, o último é o contato.
    atalhos: (categorias.length >= 3 ? categorias.slice(0, 3) : ["Novidades", dados.tituloDaSecao, "Contato"]).map((titulo, i) => ({
      titulo,
      legenda: (categorias.length >= 3 ? ["Ver tudo", "Ver peças", "Ver peças"] : ["Ver tudo", "Ver peças", "Fale com a gente"])[i],
    })),
    // O diferencial que a pessoa contou vira a frase da marca, com as palavras dela.
    frase:
      dados.diferencial ??
      comNome(
        escolher(
          voz?.frases ?? [
            `Feita para quem gosta de ${etq}. Qual é o seu estilo?`,
            "Estilo não é regra: é o jeito de cada um. Qual é o seu?",
            "Roupa boa é a que combina com você. Encontre a sua na {nome}.",
          ],
          s,
          0x99,
        ),
      ),
    newsletter: `Receba as novidades da ${nome}`,
    rodape: `© ${ano} ${nome}. Todos os direitos reservados.`,
  };
}

function montarModa(dados: DadosDoPalco): Montagem {
  const textos = textosDaVitrineModa(dados);
  const { etapa, troca, digitar, fechar } = linhaDoTempo(
    "vitrine-moda",
    "Vitrine moda",
    [
      ["topo", `Topo · ${textos.variacoes.nomeDoTopo}`],
      ["capa", `Capa · ${textos.variacoes.nomeDaCapa}`],
      ["categorias", "Categorias"],
      ["chamada", "Chamada"],
      ["novidades", "Novidades"],
      ["essenciais", "Essenciais"],
      ["atalhos", "Atalhos"],
      ["avaliacoes", "Avaliações"],
      ["frase", "Frase da marca"],
      ["newsletter", "Newsletter"],
      ["rodape", "Rodapé"],
    ],
    560,
    380,
  );

  etapa(dados.logo ? "Colocando a sua logo e o nome" : "Colocando o nome da loja", "topo", () => {
    if (dados.logo) troca("marca.logo", 900);
    digitar("marca.nome", dados.nome, 120, 1200);
    digitar("aviso", textos.aviso, 40, 1000);
  });
  etapa("Ajustando o menu", "topo", () => {
    dados.menu.forEach((item, i) => digitar(`menu.${i}`, item, 40, dados.menu.length > 5 ? 300 : 380));
  });
  etapa("Aplicando as suas cores", "topo", () => troca("cores", 1200));
  // Quem já tem marca: os títulos passam para a fonte dela.
  if (dados.fonteDaMarca) etapa(`Aplicando a fonte da marca (${dados.fonteDaMarca})`, "capa", () => troca("fonte", 1000));
  etapa(dados.capa ? "Colocando a imagem de capa" : "Preparando a capa", "capa", () => troca("capa.imagem", 1500));
  etapa("Escrevendo a chamada da capa", "capa", () => {
    const capa = dadosDaCapa(textos.variacoes.capa);
    digitar("capa.etiqueta", textos.capaEtiqueta, 55, 700);
    digitar("capa.titulo", textos.capaTitulo, 55, 1400);
    if (capa.comTexto) digitar("capa.texto", textos.capaTexto, 28, 1500);
    digitar("capa.botao", textos.botao, 60, 700);
    if (capa.doisBotoes) digitar("capa.botao2", textos.botao2, 60, 700);
  });
  if (textos.categorias.length > 0)
    etapa("Organizando as categorias", "categorias", () => textos.categorias.forEach((_, i) => troca(`categoria.${i}`, 450, 520)));
  etapa("Escrevendo a chamada da loja", "chamada", () => {
    digitar("chamada.titulo", textos.chamadaTitulo, 45, 900);
    digitar("chamada.texto", textos.chamadaTexto, 30, 1200);
    digitar("chamada.botao", textos.chamadaBotao, 60, 600);
  });

  // Novidades: os 4 primeiros itens; Essenciais: os próximos 4. Foto e preço entram juntos.
  const itens = dados.itens.slice(0, 8);
  const grade = (secao: "novidades" | "essenciais", titulo: string, de: number) => {
    const daVez = itens.slice(de, de + 4);
    etapa(daVez.length > 0 ? `Adicionando ${secao === "novidades" ? "as novidades" : "os essenciais"}` : `Preparando ${titulo.toLowerCase()}`, secao, () => {
      digitar(secao === "novidades" ? "secao.titulo" : "secao2.titulo", titulo, 80, 800);
      daVez.forEach((item, j) => {
        const i = de + j;
        troca(`produto.${i}`, 750, item.preco !== null ? 420 : 680);
        if (item.preco !== null) troca(`preco.${i}`, 320, 380);
      });
    });
  };
  grade("novidades", textos.novidades, 0);
  grade("essenciais", textos.essenciais, 4);

  etapa("Montando os atalhos", "atalhos", () => [0, 1, 2].forEach((i) => troca(`destaque.${i}`, 900, 700)));
  etapa("Preparando as avaliações", "avaliacoes", () => troca("avaliacoes", 700));
  etapa("Escrevendo a frase da marca", "frase", () => {
    digitar("frase", textos.frase, 28, 1600);
    digitar("frase.botao", dados.botao, 60, 600);
  });
  etapa("Fechando a página", "rodape", () => {
    digitar("newsletter", textos.newsletter, 30, 900);
    digitar("rodape", textos.rodape, 22, 1000);
  });
  return fechar();
}

export function montarMontagem(dados: DadosDoPalco): Montagem {
  return dados.moda ? montarModa(dados) : montarEditorial(dados);
}

/* ----- Perguntas à montagem ----- */

/** 0 → 1 durante a troca do campo; 0 antes; 1 depois (ou se o campo não muda). */
export function progressoDaTroca(m: Montagem, campo: string, t: number): number {
  const troca = m.trocas[campo];
  if (!troca) return 0;
  if (t <= troca.t0) return 0;
  return Math.min(1, (t - troca.t0) / troca.dur);
}

export const etapaAtual = (m: Montagem, t: number) =>
  m.etapas.find((e) => t >= e.t0 && t < e.t1) ?? (t >= m.duracao - 600 ? null : m.etapas[0]);

/** Texto digitado até o instante t (antes de começar, o texto do modelo). */
export function textoDaTroca(m: Montagem, campo: string, t: number, doModelo: string, final: string) {
  const p = progressoDaTroca(m, campo, t);
  if (p <= 0) return { texto: doModelo, digitando: false };
  const letras = Math.round(final.length * p);
  return { texto: final.slice(0, letras), digitando: p < 1 };
}
