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
  src/lib/briefingDaLoja.ts): que loja e do quê → já tem marca? → (com marca:
  cores → fonte) → pra quem é → personalidade → (sem marca: cores) →
  diferencial → produtos próprios ou do catálogo → resumo com "Criar meu site".
*/

import type { AtlasAction } from "@/contexts/AtlasChatContext";
import { PERSONALIDADES, dadosDaPersonalidade, fraseDoDiferencial, personalidadeDe } from "@/lib/personalidadeDaMarca";
import {
  ESTILOS,
  ESTILO_PADRAO,
  NICHO_GERAL,
  PALETAS,
  ROTULO_DO_TIPO,
  produtosParaALoja,
  descreverProdutos,
  nomeDaFonte,
  novoBriefing,
  temMarca,
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

const perguntarMarca = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message:
    `${abertura}Antes do visual: **você já tem uma marca ou uma loja?** ` +
    "Se já tiver logo, cores e fonte, eu uso as suas na loja. Se ainda não tiver, a gente cria juntos agora.",
  actions: respostas(["Já tenho uma marca", "Ainda não tenho"]),
  briefing: { ...b, etapa: "marca" },
});

const perguntarPublico = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message:
    `${abertura}**Pra quem é a sua loja?** Me descreve quem compra de você em uma frase: idade, rotina, o que valoriza. ` +
    "Quanto mais específico, mais a loja fala com essa pessoa (e menos parece com todas as outras).\n\n" +
    'Ex.: "mulheres de 25 a 40 que treinam cedo e querem conforto sem perder o estilo".',
  actions: respostas(["Ainda não sei"]),
  briefing: { ...b, etapa: "publico" },
});

/** A pergunta do "estilo" virou a personalidade da marca: é ela que faz a loja não sair igual às outras. */
const perguntarEstilo = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message:
    `${abertura}Agora a parte que faz a sua loja não ser igual às outras de ${b.nicho}: ` +
    `**se a sua marca fosse uma pessoa, como ela seria?**\n\n` +
    PERSONALIDADES.map((p) => `- **${p.rotulo}:** ${p.descricao}`).join("\n") +
    "\n\nIsso muda o jeito de escrever da loja, as letras dos títulos e o clima das fotos.",
  actions: respostas([...ESTILOS, "Escolhe por mim"]),
  briefing: { ...b, etapa: "estilo" },
});

const perguntarDiferencial = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message:
    `${abertura}Última sobre a marca, e a mais importante: **por que alguém compraria de você e não de outra loja de ${b.nicho}?** ` +
    "Pode ser a modelagem, o tecido, o preço, o atendimento, a história… Eu coloco na loja com as suas palavras.",
  actions: respostas(["Pular"]),
  briefing: { ...b, etapa: "diferencial" },
});

const perguntarCores = (b: BriefingDaLoja, abertura = ""): RespostaDemo =>
  b.marca?.tem
    ? {
        message:
          `${abertura}**Quais são as cores da sua marca?** Em "Escolher minha cor" você coloca o código exato (ex.: #1E3A8A), ` +
          'ou escreva do seu jeito (ex.: "azul-marinho e creme").',
        actions: respostas(["Não sei as cores", "Escolhe por mim"]),
        briefing: { ...b, etapa: "cores" },
      }
    : {
        message: `${abertura}E as **cores** de uma marca ${(() => {
          const id = personalidadeDe(b.estilo);
          return id ? dadosDaPersonalidade(id).rotulo.toLowerCase() : "como a sua";
        })()}? Escolha uma combinação ou escreva as suas (ex.: "verde-escuro e creme").`,
        actions: respostas([...PALETAS, "Escolhe por mim"]),
        briefing: { ...b, etapa: "cores" },
      };

const perguntarFonte = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message:
    `${abertura}E a **fonte da marca**? Escreva o nome (ex.: Montserrat, Poppins, Playfair Display). ` +
    "Se não souber, eu escolho uma que combine com o estilo.",
  actions: respostas(["Não sei a fonte"]),
  briefing: { ...b, etapa: "fonte" },
});

const perguntarProdutos = (b: BriefingDaLoja, abertura = ""): RespostaDemo => ({
  message:
    `${abertura}Última pergunta: **você vai vender produtos seus ou quer usar o catálogo da Velo?** ` +
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
        `- **Marca:** ${b.marca?.tem ? `a sua (logo, cores${b.marca.fonte ? ` e fonte ${b.marca.fonte}` : ""})` : "criada agora"}`,
        b.publico ? `- **Pra quem:** ${b.publico}` : "",
        `- **Personalidade:** ${b.estilo}${(() => {
          const p = personalidadeDe(b.estilo);
          return p ? ` (${dadosDaPersonalidade(p).descricao})` : "";
        })()}`,
        `- **Cores:** ${b.cores}`,
        b.diferencial ? `- **Diferencial:** ${b.diferencial}` : "",
        `- **Produtos:** ${descreverProdutos(b)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      aviso ? `> ${aviso}` : "",
      b.marca?.tem
        ? "Quando quiser, clique em **Criar meu site**: eu peço o nome e **a logo da sua marca** e monto tudo aqui, passo a passo."
        : "Quando quiser, clique em **Criar meu site**: eu peço o nome e a logo e monto tudo aqui, passo a passo.",
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

/**
 * Depois de cada resposta: a próxima pergunta que falta (ou o resumo, se
 * estava revisando). Marca → (com marca: cores → fonte) → pra quem →
 * personalidade → (sem marca: cores) → diferencial → produtos.
 */
const depoisDe = async (b: BriefingDaLoja, abertura = ""): Promise<RespostaDemo> => {
  if (b.revisando) return resumo(b, "Mudei.");
  if (!b.marca) return perguntarMarca(b, abertura);
  if (b.marca.tem && !b.cores) return perguntarCores(b, abertura);
  if (b.marca.tem && b.marca.fonte === undefined) return perguntarFonte(b, abertura);
  if (b.publico === undefined) return perguntarPublico(b, abertura);
  if (!b.estilo) return perguntarEstilo(b, abertura);
  if (!b.cores) return perguntarCores(b, abertura);
  if (b.diferencial === undefined) return perguntarDiferencial(b, abertura);
  if (!b.produtos) {
    if (tipoUsaCatalogo(b.tipo)) return perguntarProdutos(b, abertura);
    return resumo(
      { ...b, produtos: "proprios" },
      `${abertura}Como é uma loja de ${ROTULO_DO_TIPO[b.tipo]}, o que você vende é seu: o catálogo da Velo tem só produtos físicos.\n\nFechado!`,
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
    return perguntarMarca(
      novo,
      `Boa! Vou montar uma loja de **${ROTULO_DO_TIPO[novo.tipo]}**: ${novo.nicho}. Ela já vem com:\n\n${pronto}\n\n`,
    );
  }

  if (/^quero mudar algo/i.test(texto) || b.etapa === "mudar") {
    if (/marca/i.test(texto)) return perguntarMarca({ ...b, marca: undefined, cores: undefined, estilo: undefined }, "Tudo bem. ");
    if (/estilo|personalidade/i.test(texto)) return perguntarEstilo({ ...b, revisando: true }, "Tudo bem. ");
    if (/p[úu]blico|cliente|pra quem/i.test(texto)) return perguntarPublico({ ...b, revisando: true }, "Tudo bem. ");
    if (/diferencial/i.test(texto)) return perguntarDiferencial({ ...b, revisando: true }, "Tudo bem. ");
    if (/fonte/i.test(texto) && b.marca?.tem) return perguntarFonte({ ...b, revisando: true }, "Tudo bem. ");
    if (/cor/i.test(texto)) return perguntarCores({ ...b, revisando: true }, "Tudo bem. ");
    if (/produto/i.test(texto) && tipoUsaCatalogo(b.tipo)) return perguntarProdutos({ ...b, revisando: true });
    return {
      message: "O que você quer mudar?",
      actions: respostas([
        "Mudar a marca",
        "Mudar a personalidade",
        "Mudar o público",
        "Mudar as cores",
        "Mudar o diferencial",
        ...(b.marca?.tem ? ["Mudar a fonte"] : []),
        ...(tipoUsaCatalogo(b.tipo) ? ["Mudar os produtos"] : []),
        "Começar outra loja",
      ]),
      briefing: { ...b, etapa: "mudar" },
    };
  }

  if (b.etapa === "marca") {
    const tem = temMarca(texto);
    if (tem === null)
      return { ...perguntarMarca(b), message: "Só para eu acertar o visual: **você já tem uma marca** (logo, cores, fonte) **ou vamos criar uma agora?**" };
    // Recomeça o visual: as perguntas mudam conforme a resposta.
    const base: BriefingDaLoja = { ...b, marca: { tem }, cores: undefined, revisando: false };
    return depoisDe(base, tem ? "Ótimo, então a loja vai ter a **cara da sua marca**.\n\n" : "Sem problema: a gente cria a sua marca agora.\n\n");
  }

  if (b.etapa === "publico") {
    const publico = /n[ãa]o sei|pular|tanto faz|qualquer|todo mundo/i.test(texto) ? null : texto.replace(/\s+/g, " ").slice(0, 160);
    return depoisDe(
      { ...b, publico },
      publico ? "Anotado. Vou escrever a loja pensando nessa pessoa.\n\n" : "Sem problema: a loja fala com quem gosta de " + b.nicho + ".\n\n",
    );
  }

  if (b.etapa === "estilo") {
    if (escolheuPorMim(texto)) {
      const estilo = ESTILO_PADRAO[b.tipo].estilo;
      return depoisDe({ ...b, estilo }, `Escolhi **${estilo}** para você.\n\n`);
    }
    const id = personalidadeDe(texto);
    // Texto livre sem pista: pergunta qual chega mais perto, para a loja não sair genérica.
    if (!id) return { ...perguntarEstilo(b), message: `Entendi. Pra eu acertar o tom: **qual dessas chega mais perto da sua marca?**\n\n${PERSONALIDADES.map((p) => `- **${p.rotulo}:** ${p.descricao}`).join("\n")}` };
    const p = dadosDaPersonalidade(id);
    const estilo = PERSONALIDADES.some((x) => x.rotulo === texto.trim()) ? p.rotulo : `${p.rotulo} (${texto.slice(0, 60)})`;
    return depoisDe({ ...b, estilo }, `Boa: uma marca **${p.rotulo.toLowerCase()}**, que ${p.descricao}.\n\n`);
  }

  if (b.etapa === "diferencial") {
    const diferencial = /^(pular|n[ãa]o sei|n[ãa]o tenho|nenhum)/i.test(texto) ? null : fraseDoDiferencial(texto);
    return depoisDe({ ...b, diferencial }, diferencial ? "Isso vai para a loja do jeito que você falou.\n\n" : "");
  }

  if (b.etapa === "fonte") {
    const fonte = nomeDaFonte(texto);
    return depoisDe(
      { ...b, marca: { tem: true, fonte } },
      fonte ? `Anotado: fonte **${fonte}**.\n\n` : "Sem problema: escolho uma fonte que combine com o estilo.\n\n",
    );
  }

  if (b.etapa === "cores") {
    // Do seletor de cor vem "Minhas cores: azul-marinho (#1E3A8A) e creme (#F5F0E6)".
    const naoSabe = escolheuPorMim(texto) || /n[ãa]o sei/i.test(texto);
    const cores = naoSabe ? ESTILO_PADRAO[b.tipo].cores : texto.replace(/^minhas cores:\s*/i, "").slice(0, 120);
    return depoisDe({ ...b, cores }, `Anotado: **${cores}**.\n\n`);
  }

  if (b.etapa === "produtos") {
    const querCatalogo = /cat[áa]logo|velo|os dois|ambos|tamb[ée]m/i.test(texto);
    if (!querCatalogo) return depoisDe({ ...b, produtos: "proprios", noCatalogo: null });

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
