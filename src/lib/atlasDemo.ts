/*
  Modo demonstração do Atlas — SÓ para ver a conversa na máquina de quem
  desenvolve, enquanto o Supabase de verdade fica com a Lovable.

  Liga com `VITE_ATLAS_DEMO=1` no `.env.local` (arquivo que não vai para o git)
  e só em `npm run dev`. No build de produção `import.meta.env.DEV` é false,
  então a regra "nunca dados mockados na interface" continua valendo no ar.
  O preview da Lovable não tem essa variável, então também fica de fora.

  A conversa vive só na memória da aba. A única coisa real é a consulta ao
  catálogo, para avisar quando o nicho não tem produto.

  Roteiro (o mesmo que o `atlas-chat` de verdade deve seguir, ver
  src/lib/briefingDaLoja.ts): que loja e do quê → estilo → cores → produtos
  próprios ou do catálogo → resumo com o botão "Criar meu site".
*/

import type { AtlasAction } from "@/contexts/AtlasChatContext";
import {
  ESTILOS,
  ESTILO_PADRAO,
  NICHO_GERAL,
  PALETAS,
  ROTULO_DO_TIPO,
  produtosParaALoja,
  descreverProdutos,
  novoBriefing,
  tipoUsaCatalogo,
  type BriefingDaLoja,
  type TipoDeLoja,
} from "@/lib/briefingDaLoja";

export { detectarTipoDeLoja } from "@/lib/briefingDaLoja";

export const atlasEmModoDemo = () =>
  import.meta.env.DEV && String(import.meta.env.VITE_ATLAS_DEMO ?? "").trim() === "1";

export type RespostaDemo = { message: string; actions: AtlasAction[]; briefing: BriefingDaLoja | null };
type Historico = { role: string; content: string; product_data?: { briefing?: BriefingDaLoja | null } | null }[];

/** O que a loja de cada tipo já traz pronto (aparece na 1ª resposta). */
const PRONTO_NO_TIPO: Record<TipoDeLoja, string[]> = {
  fisico: ["Vitrine com categorias, fotos grandes e preço em destaque", "Frete calculado pelo CEP", "Checkout com Pix e cartão"],
  infoproduto: ["Página de vendas com o que a pessoa recebe", "Entrega digital: pagou, recebe o link no e-mail", "Checkout só com nome e e-mail"],
  curso: ["Página do curso com módulos e uma aula de amostra", "Área do aluno liberada depois do pagamento", "Pagamento único ou assinatura"],
  jogo: ["Vitrine por jogo e pacotes por quantidade", "Campos de nick, ID e servidor no checkout", "Pix e cartão, sem frete"],
  servico: ["Catálogo de serviços com preço e duração", "Fotos de trabalhos feitos", "Agendamento de horário no checkout"],
};

const AVISO_DO_TIPO: Partial<Record<TipoDeLoja, string>> = {
  jogo: "Antes de publicar, confira as regras de cada jogo: alguns proíbem a venda de contas ou itens fora da loja oficial.",
};

const RODAPE = "\n\n_Resposta de demonstração: o Atlas de verdade ainda não está ligado nesta máquina._";

const respostas = (itens: string[]): AtlasAction[] =>
  itens.map((label) => ({ type: "quick_reply", label, message: label }));

const ultimoBriefing = (historico: Historico): BriefingDaLoja | null => {
  for (let i = historico.length - 1; i >= 0; i -= 1) {
    const m = historico[i];
    if (m.role !== "assistant") continue;
    return m.product_data?.briefing ?? null;
  }
  return null;
};

const escolheuPorMim = (texto: string) => /escolhe|tanto faz|voc[êe] decide|pode escolher|sei l[áa]/i.test(texto);

/* ----- Perguntas ----- */

const perguntarEstilo = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message: `${abertura}Agora o visual: **qual estilo combina com a sua marca?** Pode escolher um abaixo ou descrever do seu jeito.`,
  actions: respostas([...ESTILOS, "Escolhe por mim"]),
  briefing: { ...b, etapa: "estilo" },
});

const perguntarCores = (b: BriefingDaLoja): RespostaDemo => ({
  message: `Boa escolha: **${b.estilo}**.\n\nE as **cores**? Escolha uma combinação ou escreva as suas (ex.: "verde-escuro e creme").`,
  actions: respostas([...PALETAS, "Escolhe por mim"]),
  briefing: { ...b, etapa: "cores" },
});

const perguntarProdutos = (b: BriefingDaLoja): RespostaDemo => ({
  message:
    `Anotado: **${b.cores}**.\n\nÚltima pergunta: **você vai vender produtos seus ou quer usar o catálogo da Velo?** ` +
    "No catálogo, os produtos vêm de fornecedores brasileiros e você não precisa ter estoque.",
  actions: respostas(["Meus próprios produtos", "Usar o catálogo da Velo", "Os dois"]),
  briefing: { ...b, etapa: "produtos" },
});

const resumo = (b: BriefingDaLoja, abertura = "Fechado!"): RespostaDemo => {
  const final: BriefingDaLoja = { ...b, etapa: "resumo", revisando: false };
  const aviso = AVISO_DO_TIPO[b.tipo];
  return {
    message: [
      `${abertura} Olha o resumo da sua loja:`,
      [
        `- **Loja de:** ${b.nicho}`,
        `- **Tipo:** ${ROTULO_DO_TIPO[b.tipo]}`,
        `- **Estilo:** ${b.estilo}`,
        `- **Cores:** ${b.cores}`,
        `- **Produtos:** ${descreverProdutos(b)}`,
      ].join("\n"),
      aviso ? `> ${aviso}` : "",
      "Quando quiser, clique em **Criar meu site**: eu peço o nome e a logo e monto tudo aqui, passo a passo.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    actions: [
      { type: "create_store", label: "Criar meu site", briefing: final },
      { type: "quick_reply", label: "Quero mudar algo", message: "Quero mudar algo" },
    ],
    briefing: final,
  };
};

/** Depois de responder uma etapa: segue para a próxima, ou volta ao resumo se estava revisando. */
const depoisDe = async (b: BriefingDaLoja, etapa: "estilo" | "cores" | "produtos"): Promise<RespostaDemo> => {
  if (b.revisando) return resumo(b, "Mudei.");
  if (etapa === "estilo") return perguntarCores(b);
  if (etapa === "cores") {
    if (tipoUsaCatalogo(b.tipo)) return perguntarProdutos(b);
    return resumo(
      { ...b, produtos: "proprios" },
      `Anotado: **${b.cores}**. Como é uma loja de ${ROTULO_DO_TIPO[b.tipo]}, o que você vende é seu: o catálogo da Velo tem só produtos físicos.\n\nFechado!`,
    );
  }
  return resumo(b);
};

const lojaNova = (): RespostaDemo => ({
  message: "Claro. **Que loja você quer criar, e do quê?** Pode escrever do seu jeito, por exemplo: \"um catálogo dos serviços do meu consultório\".",
  actions: [
    { type: "quick_reply", label: "Produtos físicos", message: "Quero uma loja de produtos para casa" },
    { type: "quick_reply", label: "Cursos", message: "Quero vender meus cursos online" },
    { type: "quick_reply", label: "Serviços", message: "Quero um catálogo dos serviços do meu consultório" },
    { type: "quick_reply", label: "Itens de jogos", message: "Quero uma loja de itens de jogos online" },
    { type: "quick_reply", label: "Infoprodutos", message: "Quero vender e-books e planilhas" },
  ],
  briefing: null,
});

/**
 * Resposta simulada. `historico` é a conversa até aqui (sem a mensagem nova);
 * a etapa vem do briefing da última resposta do Atlas.
 */
export async function respostaDemoDoAtlas(mensagem: string, historico: Historico): Promise<RespostaDemo> {
  const r = await responder(mensagem, historico);
  return { ...r, message: r.message + RODAPE };
}

async function responder(mensagem: string, historico: Historico): Promise<RespostaDemo> {
  const texto = mensagem.trim();
  const b = ultimoBriefing(historico);

  if (/come[çc]ar outra loja|trocar o tipo de loja|outra loja/i.test(texto)) return lojaNova();

  // Sem briefing: esta mensagem diz que loja a pessoa quer.
  if (!b) {
    const novo = novoBriefing(texto);
    const pronto = PRONTO_NO_TIPO[novo.tipo].map((i) => `- ${i}`).join("\n");
    return perguntarEstilo(
      novo,
      `Boa! Vou montar uma loja de **${ROTULO_DO_TIPO[novo.tipo]}**: ${novo.nicho}. Ela já vem com:\n\n${pronto}\n\n`,
    );
  }

  if (/^quero mudar algo/i.test(texto) || b.etapa === "mudar") {
    if (/estilo/i.test(texto)) return perguntarEstilo({ ...b, revisando: true }, "Tudo bem. ");
    if (/cor/i.test(texto)) return { ...perguntarCores({ ...b, revisando: true }), message: "Tudo bem. Quais **cores** você quer?" };
    if (/produto/i.test(texto) && tipoUsaCatalogo(b.tipo)) return perguntarProdutos({ ...b, revisando: true });
    return {
      message: "O que você quer mudar?",
      actions: respostas([
        "Mudar o estilo",
        "Mudar as cores",
        ...(tipoUsaCatalogo(b.tipo) ? ["Mudar os produtos"] : []),
        "Começar outra loja",
      ]),
      briefing: { ...b, etapa: "mudar" },
    };
  }

  if (b.etapa === "estilo") {
    const estilo = escolheuPorMim(texto) ? ESTILO_PADRAO[b.tipo].estilo : texto.slice(0, 80);
    return depoisDe({ ...b, estilo }, "estilo");
  }

  if (b.etapa === "cores") {
    // Do seletor de cor vem "Minhas cores: azul-marinho (#1E3A8A) e creme (#F5F0E6)".
    const cores = escolheuPorMim(texto)
      ? ESTILO_PADRAO[b.tipo].cores
      : texto.replace(/^minhas cores:\s*/i, "").slice(0, 120);
    return depoisDe({ ...b, cores }, "cores");
  }

  if (b.etapa === "produtos") {
    const querCatalogo = /cat[áa]logo|velo|os dois|ambos|tamb[ée]m/i.test(texto);
    if (!querCatalogo) return depoisDe({ ...b, produtos: "proprios", noCatalogo: null }, "produtos");

    let achados = 0;
    try {
      achados = (await produtosParaALoja(b, 8)).length;
    } catch {
      achados = -1;
    }
    const origem = /os dois|ambos|tamb[ée]m/i.test(texto) ? "ambos" : "catalogo";
    if (achados === 0) {
      return resumo(
        { ...b, produtos: "proprios", noCatalogo: 0 },
        `Hoje o catálogo da Velo **não tem produtos de ${b.nicho}**. Você cadastra os seus na loja e eu deixo tudo pronto para isso.\n\nFechado!`,
      );
    }
    const abertura =
      achados > 0
        ? b.nicho === NICHO_GERAL
          ? "Separo os mais vendidos do catálogo da Velo na hora de criar.\n\nFechado!"
          : `Achei produtos de **${b.nicho}** no catálogo: separo os melhores na hora de criar.\n\nFechado!`
        : "Fechado!";
    return resumo({ ...b, produtos: origem, noCatalogo: achados > 0 ? achados : null }, abertura);
  }

  // Resumo já mostrado e a pessoa escreveu outra coisa.
  return resumo(b, "Anotado.");
}
