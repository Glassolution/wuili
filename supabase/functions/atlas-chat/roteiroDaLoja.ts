/*
  Roteiro de criar loja do Atlas, resolvido em código (sem modelo).
  Espelha exatamente src/lib/atlasDemo.ts + src/lib/briefingDaLoja.ts +
  src/lib/personalidadeDaMarca.ts (o front não deploya junto, por isso a cópia).
  Mudou lá? Mude aqui também. Nada aqui inventa número, oferta ou promessa.
*/

export type TipoDeLoja = "fisico" | "infoproduto" | "curso" | "jogo" | "servico";
export type OrigemDosProdutos = "proprios" | "catalogo" | "ambos";
export type EtapaDoBriefing = "marca" | "publico" | "estilo" | "cores" | "fonte" | "diferencial" | "produtos" | "resumo" | "mudar";
export type BriefingDaLoja = {
  tipo: TipoDeLoja;
  ideia: string;
  nicho: string;
  termos: string[];
  marca?: { tem: boolean; fonte?: string | null };
  publico?: string | null;
  estilo?: string;
  diferencial?: string | null;
  cores?: string;
  produtos?: OrigemDosProdutos;
  noCatalogo?: number | null;
  etapa: EtapaDoBriefing;
  revisando?: boolean;
};
type Acao =
  | { type: "quick_reply"; label: string; message: string }
  | { type: "create_store"; label: string; briefing: BriefingDaLoja };
export type RespostaDaLoja = { message: string; actions: Acao[]; briefing: BriefingDaLoja | null };
/** Conta produtos do nicho no catálogo (ativos, sem bloqueio, com estoque). -1 = erro. */
export type ContarNoCatalogo = (b: BriefingDaLoja) => Promise<number>;

const ROTULO_DO_TIPO: Record<TipoDeLoja, string> = {
  fisico: "produtos físicos", infoproduto: "infoprodutos", curso: "cursos", jogo: "itens de jogos online", servico: "serviços",
};
const tipoUsaCatalogo = (t: TipoDeLoja) => t === "fisico";
const TIPOS = Object.keys(ROTULO_DO_TIPO);
const ETAPAS = ["marca", "publico", "estilo", "cores", "fonte", "diferencial", "produtos", "resumo", "mudar"];

const PALAVRAS_DO_TIPO: [TipoDeLoja, RegExp][] = [
  ["jogo", /\b(jogos?|games?|gamer|free ?fire|roblox|robux|minecraft|valorant|fortnite|lol|league of legends|cs ?2|csgo|gta|skins?|diamantes|gold|moedas? do jogo|itens? (de|do|em) jogos?|contas? de jogo|gift ?card)\b/i],
  ["curso", /\b(cursos?|aulas?|mentorias?|treinamentos?|ensinar|alunos?|membros|professora?)\b/i],
  ["infoproduto", /\b(infoprodutos?|e-?books?|ebooks?|pdfs?|planilhas?|templates?|modelos? prontos?|guias? digitais?|material digital|produtos? digita(l|is))\b/i],
  ["servico", /\b(servi[çc]os?|agendamentos?|consultorias?|consult[óo]rio|atendimentos?|freela|dentista|odonto|cl[íi]nica|psic[óo]log[oa]|nutricionista|advogad[oa]|manicure|barbearia|sal[ãa]o|est[ée]tica|fot[óo]graf[oa]|personal)\b/i],
];
const detectarTipoDeLoja = (t: string): TipoDeLoja => PALAVRAS_DO_TIPO.find(([, r]) => r.test(t))?.[0] ?? "fisico";

const SEM_SENTIDO = new Set([
  "quero", "queria", "gostaria", "criar", "montar", "fazer", "abrir", "vender", "venda", "vendas", "loja",
  "lojas", "site", "online", "uma", "um", "para", "pra", "meu", "minha", "meus", "minhas", "com", "sem",
  "produtos", "produto", "coisas", "tipo", "como", "começar", "comecar", "catalogo", "catálogo", "itens",
  "item", "todo", "toda", "todos", "mais", "muito", "bem", "isso", "esse", "essa", "sobre", "pelo", "pela",
]);
export const NICHO_GERAL = "produtos variados";
const limparNicho = (t: string) =>
  t.replace(/[.!?;].*$/, "").replace(/^(?:os\s+|as\s+)?(?:produtos?|itens?|coisas?|artigos?)\s+(?:de|do|da|dos|das|para|pra)\s+/i, "").trim().slice(0, 60);
export function extrairNicho(ideia: string): string {
  const linha = ideia.split("\n")[0].trim();
  for (const p of [
    /\b(?:loja|site|cat[áa]logo|p[áa]gina)\s+(?:online\s+)?(?:de|da|do|das|dos|para|pra)\s+(.+)/i,
    /\b(?:vender|vendo|ofere[çc]o|oferecer)\s+(?:meus?\s+|minhas?\s+)?(.+)/i,
  ]) {
    const a = linha.match(p)?.[1];
    if (a) return limparNicho(a) || NICHO_GERAL;
  }
  const resto = limparNicho(linha.replace(/^(?:eu\s+)?(?:quero|queria|gostaria\s+de|preciso\s+de|vou)?\s*(?:criar|montar|abrir|fazer|ter)?\s*(?:uma|um|a|o|minha|meu)?\s*(?:loja|site|neg[óo]cio|e-?commerce)?\s*(?:online|virtual|na\s+internet)?\s*/i, ""));
  return resto || NICHO_GERAL;
}
export function termosDoNicho(nicho: string): string[] {
  const p = nicho.toLowerCase().replace(/[^a-z0-9à-ÿ\s]/g, " ").split(/\s+/)
    .filter((x) => x.length >= 4 && !SEM_SENTIDO.has(x))
    .map((x) => (x.length > 4 && x.endsWith("s") && !x.endsWith("ss") ? x.slice(0, -1) : x));
  return Array.from(new Set(p)).slice(0, 3);
}
export function novoBriefing(ideia: string): BriefingDaLoja {
  const nicho = extrairNicho(ideia);
  return { tipo: detectarTipoDeLoja(ideia), ideia: ideia.slice(0, 500), nicho, termos: nicho === NICHO_GERAL ? [] : termosDoNicho(nicho), etapa: "marca" };
}

const PERSONALIDADES = [
  { id: "ousada", rotulo: "Ousada", descricao: "fala alto, frases curtas, chama atenção" },
  { id: "elegante", rotulo: "Elegante", descricao: "discreta, sofisticada, poucas palavras" },
  { id: "acolhedora", rotulo: "Acolhedora", descricao: "próxima, conversa como uma amiga que indica" },
  { id: "energia", rotulo: "Cheia de energia", descricao: "vibrante, movimento, ritmo" },
  { id: "minimalista", rotulo: "Minimalista", descricao: "limpa, direta, sem excesso" },
];
const PALAVRAS_PERSONALIDADE: [string, RegExp][] = [
  ["ousada", /ousad|atrevid|chama aten|forte|marcante|rebeld|provocant|intens/i],
  ["elegante", /elegan|sofistic|luxo|cl[áa]ssic|refinad|discret|chique/i],
  ["acolhedora", /acolhed|pr[óo]xim|amig|carinh|aconcheg|calor|leve|natural|r[úu]stic/i],
  ["energia", /energ|vibrant|alegr|divertid|colorid|moviment|esport|animad|jovem/i],
  ["minimalista", /minimal|limp|simples|clean|b[áa]sic|modern|diret/i],
];
export function personalidadeDe(t = "") {
  const exato = PERSONALIDADES.find((p) => t.trim().toLowerCase().startsWith(p.rotulo.toLowerCase()));
  if (exato) return exato;
  const id = PALAVRAS_PERSONALIDADE.find(([, r]) => r.test(t))?.[0];
  return id ? PERSONALIDADES.find((p) => p.id === id)! : null;
}
export function fraseDoDiferencial(t = ""): string | null {
  const l = t.replace(/\s+/g, " ").trim().replace(/^(?:o\s+)?(?:diferencial|meu diferencial)\s*(?:[ée]|:)\s*/i, "").slice(0, 140).trim();
  if (l.length < 8) return null;
  const m = l[0].toUpperCase() + l.slice(1);
  return /[.!?]$/.test(m) ? m : `${m}.`;
}
export function temMarca(t: string): boolean | null {
  if (/\b(n[ãa]o|ainda|nenhuma|criar|cria|come[çc]ando|sem marca)\b/i.test(t)) return false;
  if (/\b(sim|j[áa]|tenho|temos|possuo|claro|minha marca|uma marca)\b/i.test(t)) return true;
  return null;
}
export function nomeDaFonte(t: string): string | null {
  if (/n[ãa]o sei|escolhe|tanto faz|qualquer|n[ãa]o tenho|nenhuma/i.test(t)) return null;
  const l = t.replace(/^(?:a\s+)?(?:fonte|letra)(?:\s+(?:[ée]|da marca [ée]|que uso [ée]))?\s*:?\s*/i, "")
    .replace(/[^a-z0-9à-ÿ\s]/gi, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  if (l.length < 2) return null;
  return l.replace(/\b([a-zà-ÿ])/g, (x) => x.toUpperCase());
}
const ESTILOS = PERSONALIDADES.map((p) => p.rotulo);
const PALETAS = ["Azul e branco", "Verde e bege", "Preto e dourado", "Rosa e lilás", "Laranja e creme"];
const ESTILO_PADRAO: Record<TipoDeLoja, { estilo: string; cores: string }> = {
  fisico: { estilo: "Minimalista", cores: "Azul e branco" },
  infoproduto: { estilo: "Minimalista", cores: "Verde e bege" },
  curso: { estilo: "Acolhedora", cores: "Azul e branco" },
  jogo: { estilo: "Cheia de energia", cores: "Roxo e preto" },
  servico: { estilo: "Elegante", cores: "Preto e dourado" },
};
function descreverProdutos(b: BriefingDaLoja) {
  if (!tipoUsaCatalogo(b.tipo)) return "Seus próprios (o catálogo da Velo só tem produtos físicos)";
  if (b.produtos === "catalogo") return "Do catálogo da Velo, sem estoque";
  if (b.produtos === "ambos") return "Seus produtos e também do catálogo da Velo";
  return "Seus próprios produtos";
}

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
const respostas = (itens: string[]): Acao[] => itens.map((label) => ({ type: "quick_reply", label, message: label }));
const escolheuPorMim = (t: string) => /escolhe|tanto faz|voc[êe] decide|pode escolher|sei l[áa]/i.test(t);
const listaPersonalidades = () => PERSONALIDADES.map((p) => `- **${p.rotulo}:** ${p.descricao}`).join("\n");

export const PERGUNTA_LOJA_NOVA = "Que loja você quer criar, e do quê?";

/** Briefing vindo do histórico (cliente): aceita só o formato esperado. */
export function lerBriefing(v: unknown): BriefingDaLoja | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  if (!TIPOS.includes(String(b.tipo)) || !ETAPAS.includes(String(b.etapa)) || typeof b.nicho !== "string") return null;
  return {
    ...(b as unknown as BriefingDaLoja),
    nicho: b.nicho.slice(0, 60),
    ideia: String(b.ideia ?? "").slice(0, 500),
    termos: Array.isArray(b.termos) ? b.termos.filter((t): t is string => typeof t === "string").slice(0, 3) : [],
  };
}

/** Pedido de criar loja/site (sem ser pergunta sobre loja do Mercado Livre). */
export const pedeLoja = (t: string) =>
  /\b(criar|montar|abrir|fazer|quero|ter)\b[^.?!]{0,30}\b(loja|site|e-?commerce)\b/i.test(t) && !/mercado ?livre|shopee|\bml\b/i.test(t);

const perguntarMarca = (b: BriefingDaLoja, a = ""): RespostaDaLoja => ({
  message: `${a}Antes do visual: **você já tem uma marca ou uma loja?** Se já tiver logo, cores e fonte, eu uso as suas na loja. Se ainda não tiver, a gente cria juntos agora.`,
  actions: respostas(["Já tenho uma marca", "Ainda não tenho"]),
  briefing: { ...b, etapa: "marca" },
});
const perguntarPublico = (b: BriefingDaLoja, a = ""): RespostaDaLoja => ({
  message:
    `${a}**Pra quem é a sua loja?** Me descreve quem compra de você em uma frase: idade, rotina, o que valoriza. ` +
    "Quanto mais específico, mais a loja fala com essa pessoa (e menos parece com todas as outras).\n\n" +
    'Ex.: "mulheres de 25 a 40 que treinam cedo e querem conforto sem perder o estilo".',
  actions: respostas(["Ainda não sei"]),
  briefing: { ...b, etapa: "publico" },
});
const perguntarEstilo = (b: BriefingDaLoja, a = ""): RespostaDaLoja => ({
  message:
    `${a}Agora a parte que faz a sua loja não ser igual às outras de ${b.nicho}: **se a sua marca fosse uma pessoa, como ela seria?**\n\n` +
    listaPersonalidades() + "\n\nIsso muda o jeito de escrever da loja, as letras dos títulos e o clima das fotos.",
  actions: respostas([...ESTILOS, "Escolhe por mim"]),
  briefing: { ...b, etapa: "estilo" },
});
const perguntarDiferencial = (b: BriefingDaLoja, a = ""): RespostaDaLoja => ({
  message:
    `${a}Última sobre a marca, e a mais importante: **por que alguém compraria de você e não de outra loja de ${b.nicho}?** ` +
    "Pode ser a modelagem, o tecido, o preço, o atendimento, a história… Eu coloco na loja com as suas palavras.",
  actions: respostas(["Pular"]),
  briefing: { ...b, etapa: "diferencial" },
});
const perguntarCores = (b: BriefingDaLoja, a = ""): RespostaDaLoja =>
  b.marca?.tem
    ? {
        message: `${a}**Quais são as cores da sua marca?** Em "Escolher minha cor" você coloca o código exato (ex.: #1E3A8A), ou escreva do seu jeito (ex.: "azul-marinho e creme").`,
        actions: respostas(["Não sei as cores", "Escolhe por mim"]),
        briefing: { ...b, etapa: "cores" },
      }
    : {
        message: `${a}E as **cores** de uma marca ${personalidadeDe(b.estilo)?.rotulo.toLowerCase() ?? "como a sua"}? Escolha uma combinação ou escreva as suas (ex.: "verde-escuro e creme").`,
        actions: respostas([...PALETAS, "Escolhe por mim"]),
        briefing: { ...b, etapa: "cores" },
      };
const perguntarFonte = (b: BriefingDaLoja, a = ""): RespostaDaLoja => ({
  message: `${a}E a **fonte da marca**? Escreva o nome (ex.: Montserrat, Poppins, Playfair Display). Se não souber, eu escolho uma que combine com o estilo.`,
  actions: respostas(["Não sei a fonte"]),
  briefing: { ...b, etapa: "fonte" },
});
const perguntarProdutos = (b: BriefingDaLoja, a = ""): RespostaDaLoja => ({
  message: `${a}Última pergunta: **você vai vender produtos seus ou quer usar o catálogo da Velo?** No catálogo, os produtos vêm de fornecedores brasileiros e você não precisa ter estoque.`,
  actions: respostas(["Meus próprios produtos", "Usar o catálogo da Velo", "Os dois"]),
  briefing: { ...b, etapa: "produtos" },
});

export function resumo(b: BriefingDaLoja, abertura = "Fechado!"): RespostaDaLoja {
  const final: BriefingDaLoja = { ...b, etapa: "resumo", revisando: false };
  const aviso = AVISO_DO_TIPO[b.tipo];
  const p = personalidadeDe(b.estilo);
  return {
    message: [
      `${abertura} Olha o resumo da sua loja:`,
      [
        `- **Loja de:** ${b.nicho}`,
        `- **Tipo:** ${ROTULO_DO_TIPO[b.tipo]}`,
        `- **Marca:** ${b.marca?.tem ? `a sua (logo, cores${b.marca.fonte ? ` e fonte ${b.marca.fonte}` : ""})` : "criada agora"}`,
        b.publico ? `- **Pra quem:** ${b.publico}` : "",
        `- **Personalidade:** ${b.estilo}${p ? ` (${p.descricao})` : ""}`,
        `- **Cores:** ${b.cores}`,
        b.diferencial ? `- **Diferencial:** ${b.diferencial}` : "",
        `- **Produtos:** ${descreverProdutos(b)}`,
      ].filter(Boolean).join("\n"),
      aviso ? `> ${aviso}` : "",
      b.marca?.tem
        ? "Quando quiser, clique em **Criar meu site**: eu peço o nome e **a logo da sua marca** e monto tudo aqui, passo a passo."
        : "Quando quiser, clique em **Criar meu site**: eu peço o nome e a logo e monto tudo aqui, passo a passo.",
    ].filter(Boolean).join("\n\n"),
    actions: [
      { type: "create_store", label: "Criar meu site", briefing: final },
      { type: "quick_reply", label: "Quero mudar algo", message: "Quero mudar algo" },
    ],
    briefing: final,
  };
}

function depoisDe(b: BriefingDaLoja, a = ""): RespostaDaLoja {
  if (b.revisando) return resumo(b, "Mudei.");
  if (!b.marca) return perguntarMarca(b, a);
  if (b.marca.tem && !b.cores) return perguntarCores(b, a);
  if (b.marca.tem && b.marca.fonte === undefined) return perguntarFonte(b, a);
  if (b.publico === undefined) return perguntarPublico(b, a);
  if (!b.estilo) return perguntarEstilo(b, a);
  if (!b.cores) return perguntarCores(b, a);
  if (b.diferencial === undefined) return perguntarDiferencial(b, a);
  if (!b.produtos) {
    if (tipoUsaCatalogo(b.tipo)) return perguntarProdutos(b, a);
    return resumo({ ...b, produtos: "proprios" }, `${a}Como é uma loja de ${ROTULO_DO_TIPO[b.tipo]}, o que você vende é seu: o catálogo da Velo tem só produtos físicos.\n\nFechado!`);
  }
  return resumo(b);
}

export const lojaNova = (): RespostaDaLoja => ({
  message: `Claro. **${PERGUNTA_LOJA_NOVA}** Pode escrever do seu jeito, por exemplo: "um catálogo dos serviços do meu consultório".`,
  actions: [
    { type: "quick_reply", label: "Produtos físicos", message: "Quero uma loja de produtos para casa" },
    { type: "quick_reply", label: "Cursos", message: "Quero vender meus cursos online" },
    { type: "quick_reply", label: "Serviços", message: "Quero um catálogo dos serviços do meu consultório" },
    { type: "quick_reply", label: "Itens de jogos", message: "Quero uma loja de itens de jogos online" },
    { type: "quick_reply", label: "Infoprodutos", message: "Quero vender e-books e planilhas" },
  ],
  briefing: null,
});

/** Começa a loja a partir da descrição ("loja de roupas fitness"). */
export function comecarLoja(texto: string): RespostaDaLoja {
  const novo = novoBriefing(texto);
  const pronto = PRONTO_NO_TIPO[novo.tipo].map((i) => `- ${i}`).join("\n");
  return perguntarMarca(novo, `Boa! Vou montar uma loja de **${ROTULO_DO_TIPO[novo.tipo]}**: ${novo.nicho}. Ela já vem com:\n\n${pronto}\n\n`);
}

/**
 * Próxima resposta com briefing em andamento. Retorna null quando o briefing
 * já está no resumo e a pessoa falou de outra coisa (vai para o modelo).
 */
export async function continuarLoja(texto0: string, b: BriefingDaLoja, contar: ContarNoCatalogo): Promise<RespostaDaLoja | null> {
  const texto = texto0.trim();
  if (/come[çc]ar outra loja|trocar o tipo de loja|outra loja/i.test(texto)) return lojaNova();

  if (/^quero mudar algo/i.test(texto) || b.etapa === "mudar") {
    const tudoBem = "Tudo bem. ";
    if (/marca/i.test(texto)) return perguntarMarca({ ...b, marca: undefined, cores: undefined, estilo: undefined }, tudoBem);
    if (/estilo|personalidade/i.test(texto)) return perguntarEstilo({ ...b, revisando: true }, tudoBem);
    if (/p[úu]blico|cliente|pra quem/i.test(texto)) return perguntarPublico({ ...b, revisando: true }, tudoBem);
    if (/diferencial/i.test(texto)) return perguntarDiferencial({ ...b, revisando: true }, tudoBem);
    if (/fonte/i.test(texto) && b.marca?.tem) return perguntarFonte({ ...b, revisando: true }, tudoBem);
    if (/cor/i.test(texto)) return perguntarCores({ ...b, revisando: true }, tudoBem);
    if (/produto/i.test(texto) && tipoUsaCatalogo(b.tipo)) return perguntarProdutos({ ...b, revisando: true });
    return {
      message: "O que você quer mudar?",
      actions: respostas([
        "Mudar a marca", "Mudar a personalidade", "Mudar o público", "Mudar as cores", "Mudar o diferencial",
        ...(b.marca?.tem ? ["Mudar a fonte"] : []),
        ...(tipoUsaCatalogo(b.tipo) ? ["Mudar os produtos"] : []),
        "Começar outra loja",
      ]),
      briefing: { ...b, etapa: "mudar" },
    };
  }

  if (b.etapa === "marca") {
    const tem = temMarca(texto);
    if (tem === null) return { ...perguntarMarca(b), message: "Só para eu acertar o visual: **você já tem uma marca** (logo, cores, fonte) **ou vamos criar uma agora?**" };
    return depoisDe({ ...b, marca: { tem }, cores: undefined, revisando: false },
      tem ? "Ótimo, então a loja vai ter a **cara da sua marca**.\n\n" : "Sem problema: a gente cria a sua marca agora.\n\n");
  }
  if (b.etapa === "publico") {
    const publico = /n[ãa]o sei|pular|tanto faz|qualquer|todo mundo/i.test(texto) ? null : texto.replace(/\s+/g, " ").slice(0, 160);
    return depoisDe({ ...b, publico }, publico ? "Anotado. Vou escrever a loja pensando nessa pessoa.\n\n" : `Sem problema: a loja fala com quem gosta de ${b.nicho}.\n\n`);
  }
  if (b.etapa === "estilo") {
    if (escolheuPorMim(texto)) {
      const estilo = ESTILO_PADRAO[b.tipo].estilo;
      return depoisDe({ ...b, estilo }, `Escolhi **${estilo}** para você.\n\n`);
    }
    const p = personalidadeDe(texto);
    if (!p) return { ...perguntarEstilo(b), message: `Entendi. Pra eu acertar o tom: **qual dessas chega mais perto da sua marca?**\n\n${listaPersonalidades()}` };
    const estilo = PERSONALIDADES.some((x) => x.rotulo === texto) ? p.rotulo : `${p.rotulo} (${texto.slice(0, 60)})`;
    return depoisDe({ ...b, estilo }, `Boa: uma marca **${p.rotulo.toLowerCase()}**, que ${p.descricao}.\n\n`);
  }
  if (b.etapa === "diferencial") {
    const diferencial = /^(pular|n[ãa]o sei|n[ãa]o tenho|nenhum)/i.test(texto) ? null : fraseDoDiferencial(texto);
    return depoisDe({ ...b, diferencial }, diferencial ? "Isso vai para a loja do jeito que você falou.\n\n" : "");
  }
  if (b.etapa === "fonte") {
    const fonte = nomeDaFonte(texto);
    return depoisDe({ ...b, marca: { tem: true, fonte } }, fonte ? `Anotado: fonte **${fonte}**.\n\n` : "Sem problema: escolho uma fonte que combine com o estilo.\n\n");
  }
  if (b.etapa === "cores") {
    const naoSabe = escolheuPorMim(texto) || /n[ãa]o sei/i.test(texto);
    const cores = naoSabe ? ESTILO_PADRAO[b.tipo].cores : texto.replace(/^minhas cores:\s*/i, "").slice(0, 120);
    return depoisDe({ ...b, cores }, `Anotado: **${cores}**.\n\n`);
  }
  if (b.etapa === "produtos") {
    if (!/cat[áa]logo|velo|os dois|ambos|tamb[ée]m/i.test(texto)) return depoisDe({ ...b, produtos: "proprios", noCatalogo: null });
    let achados = -1;
    try { achados = await contar(b); } catch { achados = -1; }
    const origem: OrigemDosProdutos = /os dois|ambos|tamb[ée]m/i.test(texto) ? "ambos" : "catalogo";
    if (achados === 0)
      return resumo({ ...b, produtos: "proprios", noCatalogo: 0 }, `Hoje o catálogo da Velo **não tem produtos de ${b.nicho}**. Você cadastra os seus na loja e eu deixo tudo pronto para isso.\n\nFechado!`);
    const abertura = achados > 0
      ? b.nicho === NICHO_GERAL
        ? "Separo os mais vendidos do catálogo da Velo na hora de criar.\n\nFechado!"
        : `Achei produtos de **${b.nicho}** no catálogo: separo os melhores na hora de criar.\n\nFechado!`
      : "Fechado!";
    return resumo({ ...b, produtos: origem, noCatalogo: achados > 0 ? achados : null }, abertura);
  }
  // Resumo já mostrado e a pessoa falou de outra coisa: deixa o Atlas responder normalmente.
  return null;
}
