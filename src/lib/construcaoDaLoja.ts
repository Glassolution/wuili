/*
  Construção da loja pedida no chat ("Criar meu site").

  Roda fora do React (um Map por id), para que fechar e reabrir o chat não
  interrompa nem repita a construção; o cartão AtlasConstrucaoDaLoja só lê o
  estado com useSyncExternalStore.

  Passos: entender → modelo/cores/fonte → imagem do tema (IA, função
  `generate-store-banner`) → produtos (catálogo e/ou os da pessoa) → criar o
  rascunho em `user_projects`. No modo demonstração (src/lib/atlasDemo.ts) o
  último passo não grava nada.

  Imagem do tema: gerada por IA, não copiada do Pinterest ou do Google — foto
  de lá tem dono e não pode ir para a loja de alguém sem licença.
*/

import { categoriaDoProduto, categoriasDosItens, dadosDaCapa, menuDaLojaDeModa, modelosDaFoto, variacoesDaVitrine } from "@/lib/variacoesDaVitrine";
import { limparCapa } from "@/lib/imagemDaCapa";
import { supabase } from "@/integrations/supabase/client";
import { atlasEmModoDemo } from "@/lib/atlasDemo";
import {
  NICHO_GERAL,
  ROTULO_DO_TIPO,
  produtosParaALoja,
  corDeApoio,
  corPrincipal,
  fonteDoEstilo,
  modeloDaLoja,
  tipoUsaCatalogo,
  type PedidoDeLoja,
  type ProdutoDoCatalogo,
  type TipoDeLoja,
} from "@/lib/briefingDaLoja";
import { montarMontagem } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";
import { createUserProject, updateProjectMetadata } from "@/lib/userProjects";


export type StatusDoPasso = "esperando" | "fazendo" | "feito" | "aviso";

/** O que a IA "abre" num passo: aparece como arquivo na linha do tempo. */
export type FonteDoPasso = {
  tipo: "dados" | "documento" | "imagem" | "catalogo" | "modelo" | "cor";
  nome: string;
  /** Miniatura (tipo imagem). */
  imagem?: string;
  /** Bolinha de cor (tipo cor). */
  cor?: string;
};

export type PassoDaConstrucao = {
  id: "entender" | "visual" | "imagens" | "produtos" | "criar";
  titulo: string;
  status: StatusDoPasso;
  /** Frase do que está fazendo agora ("Lendo a conversa"). */
  leitura?: string;
  fontes: FonteDoPasso[];
  detalhe?: string;
};

export type EstadoDaConstrucao = {
  passos: PassoDaConstrucao[];
  terminou: boolean;
  demo: boolean;
  projetoId: string | null;
  erro: string | null;
  iniciouEm: number;
  terminouEm: number | null;
  /** Site sendo montado ao vivo (último passo); o relógio da cena é `Date.now() - comecouEm`. */
  palco: { dados: DadosDoPalco; comecouEm: number; duracao: number } | null;
};

const estados = new Map<string, EstadoDaConstrucao>();
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((ouvinte) => ouvinte());

export const assinarConstrucoes = (ouvinte: () => void) => {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
};

export const lerConstrucao = (id: string) => estados.get(id) ?? null;

/* A tela do editor (AtlasEditorAoVivo) abre sozinha uma vez por construção; depois, só pelo botão. */
const editoresVistos = new Set<string>();
export const editorJaVisto = (id: string) => editoresVistos.has(id);
export const marcarEditorVisto = (id: string) => {
  editoresVistos.add(id);
};

const atualizar = (id: string, mudar: (estado: EstadoDaConstrucao) => EstadoDaConstrucao) => {
  const atual = estados.get(id);
  if (!atual) return;
  estados.set(id, mudar(atual));
  avisar();
};

const mudarPasso = (id: string, passo: PassoDaConstrucao["id"], dados: Partial<PassoDaConstrucao>) =>
  atualizar(id, (e) => ({ ...e, passos: e.passos.map((p) => (p.id === passo ? { ...p, ...dados } : p)) }));

const esperar = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Mostra uma fonte sendo aberta, com um respiro entre uma e outra. */
async function abrir(id: string, passo: PassoDaConstrucao["id"], fonte: FonteDoPasso, pausa = 420) {
  atualizar(id, (e) => ({
    ...e,
    passos: e.passos.map((p) => (p.id === passo ? { ...p, fontes: [...p.fontes, fonte] } : p)),
  }));
  await esperar(pausa);
}

/** Roda o trabalho do passo com um tempo mínimo, para dar para acompanhar na tela. */
async function passo<T>(
  id: string,
  qual: PassoDaConstrucao["id"],
  leitura: string,
  trabalho: () => Promise<T>,
  minimo = 900,
): Promise<T> {
  mudarPasso(id, qual, { status: "fazendo", leitura });
  const [resultado] = await Promise.all([trabalho(), esperar(minimo)]);
  return resultado;
}

const lista = (itens: string[], maximo = 3) =>
  itens.length <= maximo ? itens.join(", ") : `${itens.slice(0, maximo).join(", ")} e mais ${itens.length - maximo}`;

const arquivo = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

/** Começa a construção (uma vez por id). */
export function iniciarConstrucao(id: string, pedido: PedidoDeLoja) {
  if (estados.has(id)) return;
  const { briefing } = pedido;
  const ehServico = briefing.tipo === "servico";
  const novo = (pid: PassoDaConstrucao["id"], titulo: string): PassoDaConstrucao => ({
    id: pid,
    titulo,
    status: "esperando",
    fontes: [],
  });
  estados.set(id, {
    demo: atlasEmModoDemo(),
    terminou: false,
    projetoId: null,
    erro: null,
    iniciouEm: Date.now(),
    terminouEm: null,
    palco: null,
    passos: [
      novo("entender", "Entendendo a sua loja"),
      novo("visual", "Escolhendo modelo, cores e fonte"),
      novo("imagens", `Criando imagens no clima de ${briefing.nicho}`),
      novo("produtos", ehServico ? "Organizando os serviços" : "Organizando os produtos"),
      novo("criar", `Montando a ${pedido.nome} ao vivo`),
    ],
  });
  avisar();
  void construir(id, pedido);
}

async function construir(id: string, pedido: PedidoDeLoja) {
  const { briefing } = pedido;
  const demo = estados.get(id)?.demo ?? false;
  const r = {
    capa: null as string | null,
    produtos: [] as ProdutoDoCatalogo[],
    avisoCatalogo: false,
    projetoId: null as string | null,
    erro: null as string | null,
  };

  // 1. Recapitula o que a conversa decidiu.
  await passo(id, "entender", "Lendo a conversa", async () => {
    await abrir(id, "entender", { tipo: "dados", nome: "conversa_com_o_atlas.json" });
    await abrir(id, "entender", { tipo: "documento", nome: `briefing_${arquivo(briefing.nicho)}.json` });
    if (pedido.logo) await abrir(id, "entender", { tipo: "imagem", nome: "logo.png", imagem: pedido.logo });
    if (pedido.produtosPlanejados.length > 0) await abrir(id, "entender", { tipo: "documento", nome: "produtos_da_loja.txt" });
  });
  mudarPasso(id, "entender", {
    status: "feito",
    detalhe: `Loja de ${briefing.nicho} (${ROTULO_DO_TIPO[briefing.tipo]}), estilo ${briefing.estilo?.toLowerCase() ?? "moderno"}.`,
  });

  // 2. Visual.
  const modelo = modeloDaLoja(briefing);
  const cor = corPrincipal(briefing.cores);
  const fonte = fonteDoEstilo(briefing.estilo);
  await passo(id, "visual", "Comparando os modelos da Velo", async () => {
    await abrir(id, "visual", { tipo: "modelo", nome: "modelo_vitrine_classica" });
    await abrir(id, "visual", { tipo: "modelo", nome: "modelo_marketly" });
    await abrir(id, "visual", { tipo: "cor", nome: `paleta_${arquivo(briefing.cores ?? "neutra")}`, cor: cor.hex });
    await abrir(id, "visual", { tipo: "documento", nome: `fonte_${arquivo(fonte)}` });
  });
  mudarPasso(id, "visual", {
    status: "feito",
    detalhe: `Modelo ${modelo.nome}, destaque em ${cor.nome} e fonte ${fonte}.`,
  });

  const lojaDeModa = briefing.tipo === "fisico" && ehModa(briefing.nicho, pedido.descricao);
  // 3. Imagem do tema (gerada por IA; ver a nota no topo).
  await passo(
    id,
    "imagens",
    "Montando a cena",
    async () => {
      await abrir(id, "imagens", { tipo: "documento", nome: `cena_${arquivo(briefing.nicho)}_${arquivo(briefing.estilo ?? "")}.txt` });
      try {
        const { data, error } = await supabase.functions.invoke("generate-store-banner", {
          body: {
            brandName: pedido.nome,
            persona: `pessoas interessadas em ${briefing.nicho}`,
            salesAngle: `${briefing.estilo ?? "moderno"}; cores ${briefing.cores ?? "neutras"}; loja de ${briefing.nicho}`,
            // Capa de ponta a ponta, nas cores da pessoa (suaves); ver generate-store-banner.
            palette: paletaDaCapa(briefing.cores),
            layout: "tela-cheia",
            // Moda: a cena combina com a capa que a loja sorteou (variacoesDaVitrine).
            ...(lojaDeModa
              ? {
                  scene: dadosDaCapa(variacoesDaVitrine({ nome: pedido.nome, etiqueta: etiquetaDaLoja(briefing.nicho) }).capa).cena,
                  people: modelosDaFoto(briefing.nicho),
                }
              : {}),
          },
        });
        const url = (data as { imageUrl?: string } | null)?.imageUrl;
        // A IA às vezes devolve a foto com tarjas lisas em cima e embaixo: corta antes de usar.
        if (!error && typeof url === "string" && url) r.capa = await limparCapa(url);
      } catch {
        /* segue sem capa */
      }
      if (r.capa) await abrir(id, "imagens", { tipo: "imagem", nome: "capa_da_loja.png", imagem: r.capa }, 300);
    },
    1600,
  );
  mudarPasso(
    id,
    "imagens",
    r.capa
      ? { status: "feito", detalhe: `Fiz uma imagem de capa no clima de ${briefing.nicho}.` }
      : { status: "aviso", detalhe: "Não consegui criar a imagem agora. Você gera depois no editor, em Banner." },
  );

  // 4. Produtos.
  const usaCatalogo = tipoUsaCatalogo(briefing.tipo) && briefing.produtos !== "proprios";
  await passo(id, "produtos", usaCatalogo ? "Consultando o catálogo" : "Lendo a sua lista", async () => {
    if (usaCatalogo) {
      await abrir(id, "produtos", { tipo: "catalogo", nome: `catalogo_velo?busca=${briefing.termos.join("+") || "geral"}` });
      try {
        r.produtos = await produtosParaALoja(briefing, 8);
      } catch {
        r.avisoCatalogo = true;
      }
      for (const p of r.produtos.slice(0, 3)) await abrir(id, "produtos", { tipo: "catalogo", nome: p.title }, 320);
    }
    if (pedido.produtosPlanejados.length > 0)
      await abrir(id, "produtos", { tipo: "documento", nome: "produtos_da_loja.txt" });
  });
  const partes: string[] = [];
  if (r.produtos.length > 0) partes.push(`Separei ${r.produtos.length} produtos de ${briefing.nicho} do catálogo da Velo.`);
  else if (usaCatalogo)
    partes.push(r.avisoCatalogo ? "Não consegui olhar o catálogo agora." : `O catálogo não tem produtos de ${briefing.nicho} hoje.`);
  if (pedido.produtosPlanejados.length > 0) partes.push(`Deixei espaço para: ${lista(pedido.produtosPlanejados)}.`);
  if (partes.length === 0)
    partes.push(`Você cadastra ${briefing.tipo === "servico" ? "os seus serviços" : "os seus produtos"} no editor.`);
  mudarPasso(id, "produtos", { status: r.avisoCatalogo ? "aviso" : "feito", detalhe: partes.join(" ") });

  // 5. Monta a loja na tela do editor (AtlasEditorAoVivo + montagemDaVitrine) enquanto grava o rascunho.
  const dados = dadosDoPalco(pedido, { capa: r.capa, produtos: r.produtos, destaque: cor.hex, fonte });
  const duracao = montarMontagem(dados).duracao;
  atualizar(id, (e) => ({ ...e, palco: { dados, comecouEm: Date.now(), duracao } }));
  await passo(id, "criar", "Montando o site", async () => {
    await abrir(id, "criar", { tipo: "dados", nome: `${arquivo(pedido.nome)}/config.json` }, 0);
    if (demo) return;
    try {
      const projeto = await createUserProject({
        nome: pedido.nome,
        descricao: pedido.descricao || `Loja de ${briefing.nicho}`,
        tipo: "loja_completa",
        productIds: r.produtos.map((p) => p.id),
        template: modelo.id,
        logoImage: pedido.logo,
      });
      await updateProjectMetadata(projeto, {
        accent: cor.hex,
        font: fonte,
        ...(r.capa ? { heroImage: r.capa } : {}),
        tipoDeLoja: briefing.tipo,
        briefingDoAtlas: briefing,
        produtosPlanejados: pedido.produtosPlanejados,
      });
      r.projetoId = projeto.id;
    } catch (e) {
      r.erro = e instanceof Error ? e.message : "Não consegui criar a loja agora.";
    }
  }, duracao);
  mudarPasso(
    id,
    "criar",
    demo
      ? { status: "feito", detalhe: "Demonstração: nada foi gravado. Com o Atlas de verdade, a loja vira um rascunho em Projetos." }
      : r.erro
        ? { status: "aviso", detalhe: `Não consegui criar a loja: ${r.erro}` }
        : { status: "feito", detalhe: "Rascunho salvo em Projetos. Só você vê até publicar." },
  );

  atualizar(id, (e) => ({ ...e, terminou: true, terminouEm: Date.now(), projetoId: r.projetoId, erro: r.erro }));
}

/* ----- O que o palco mostra ----- */

const MENU: Record<TipoDeLoja, string[]> = {
  fisico: ["Início", "Produtos", "Sobre", "Contato"],
  servico: ["Início", "Serviços", "Agenda", "Contato"],
  curso: ["Início", "Cursos", "Sobre", "Contato"],
  infoproduto: ["Início", "Materiais", "Sobre", "Contato"],
  jogo: ["Início", "Jogos", "Pacotes", "Ajuda"],
};
const BOTAO: Record<TipoDeLoja, string> = {
  fisico: "Ver produtos",
  servico: "Agendar horário",
  curso: "Ver cursos",
  infoproduto: "Quero o meu",
  jogo: "Ver pacotes",
};

/** Cores da pessoa para a foto de capa: nomes e códigos ("azul (#2563EB) e branco"). */
export function paletaDaCapa(cores: string | null | undefined): string {
  const texto = (cores ?? "").replace(/^minhas cores:\s*/i, "").trim();
  if (!texto) return "";
  const principal = corPrincipal(texto);
  const apoio = corDeApoio(texto);
  return /#[0-9a-f]{6}/i.test(texto) ? texto : `${texto} (main ${principal.hex}${apoio ? `, support ${apoio}` : ""})`;
}

/** Linha pequena da capa: o nicho com maiúscula ("Roupas masculinas"), ou "Novidades" sem nicho. */
export const etiquetaDaLoja = (nicho: string) => (nicho === NICHO_GERAL ? "Novidades" : nicho.charAt(0).toUpperCase() + nicho.slice(1));

/** Loja de roupa, calçado ou acessório de moda: usa o modelo exatamente como ele é. */
export const ehModa = (...textos: (string | null | undefined)[]) =>
  /\b(roupas?|moda|vestu[aá]rio|camis[ae]t?a?s?|cal[cç]ados?|vestidos?|t[eê]nis|sapatos?|bolsas?|acess[oó]rios?|lingerie|jeans|streetwear|boutique|fitness)\b/i.test(
    textos.filter(Boolean).join(" "),
  );

export function dadosDoPalco(
  pedido: PedidoDeLoja,
  achado: { capa: string | null; produtos: ProdutoDoCatalogo[]; destaque: string; fonte: string },
): DadosDoPalco {
  const { briefing } = pedido;
  const geral = briefing.nicho === NICHO_GERAL;
  const moda = briefing.tipo === "fisico" && ehModa(briefing.nicho, pedido.descricao);
  // Itens de verdade: os do catálogo (com foto e preço) ou os que a pessoa listou. Nada inventado.
  const itens =
    achado.produtos.length > 0
      ? achado.produtos.slice(0, 8).map((p) => ({ titulo: p.title, imagem: p.imagem, preco: p.preco, categoria: p.categoria }))
      : pedido.produtosPlanejados.slice(0, 8).map((titulo) => ({
          titulo,
          imagem: null,
          preco: null,
          // Moda: "Camisa de linho" entra na categoria "Camisas" (do texto da pessoa, nada inventado).
          categoria: moda ? categoriaDoProduto(titulo) : null,
        }));
  const categorias = moda ? categoriasDosItens(itens) : [];
  return {
    nome: pedido.nome,
    logo: pedido.logo,
    capa: achado.capa,
    destaque: achado.destaque,
    fundo: corDeApoio(briefing.cores ?? ""),
    fonte: achado.fonte,
    etiqueta: etiquetaDaLoja(briefing.nicho),
    subtitulo: pedido.descricao.trim() || (geral ? `Bem-vindo à ${pedido.nome}.` : `Tudo de ${briefing.nicho} em um só lugar.`),
    menu: moda ? menuDaLojaDeModa(categorias, MENU[briefing.tipo]) : MENU[briefing.tipo],
    botao: BOTAO[briefing.tipo],
    tituloDaSecao: MENU[briefing.tipo][1],
    itens,
    moda,
  };
}
