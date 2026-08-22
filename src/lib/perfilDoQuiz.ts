import type { User } from "@supabase/supabase-js";

/**
 * Leitura do quiz de cadastro para recomendar produtos.
 *
 * As respostas ficam no metadata do Supabase Auth (`velo_onboarding_answers`),
 * gravadas ao concluir o onboarding. Metadata e não tabela nova porque o dado é
 * pequeno, é do próprio usuário e já viaja com a sessão — não precisa de
 * consulta extra para montar a vitrine.
 *
 * Quem criou a conta antes disso existir não tem respostas gravadas. Nesse caso
 * a recomendação cai no critério geral (mais vendidos), em vez de ficar vazia.
 */

export const CHAVE_RESPOSTAS_DO_QUIZ = "velo_onboarding_answers";

export type RespostasDoQuiz = {
  /** "sim" | "nao" */
  mercadoLivre?: string;
  /** "dropshipper" | "marca" | "agencia" | "explorando" */
  perfil?: string;
  /** "nenhum" | "1-10" | "10-50" | "50+" */
  produtos?: string;
  /** "anuncios" | "testar" | "trafego" | "profissional" */
  dificuldade?: string;
  /** "manual" | "outra-ferramenta" | "sem-anuncios" | "desenvolvedor" */
  metodoAtual?: string;
  /** "geral" | "beleza" | "moda" | "tech" | "casa" | "saude" | "outro" */
  nicho?: string;
  origem?: string;
};

export const lerRespostasDoQuiz = (user: User | null): RespostasDoQuiz => {
  const bruto = user?.user_metadata?.[CHAVE_RESPOSTAS_DO_QUIZ];
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};

  // Só strings entram: o metadata é gravável pelo próprio usuário, então nada
  // aqui pode assumir formato.
  const limpo: RespostasDoQuiz = {};
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof valor === "string" && valor.length <= 40) {
      limpo[chave as keyof RespostasDoQuiz] = valor;
    }
  }
  return limpo;
};

/**
 * Nicho do quiz -> categorias reais do catálogo.
 *
 * Os rótulos são os que existem em `catalog_products.category`. "moda" e
 * "saude" não têm categoria equivalente no catálogo hoje: em vez de forçar uma
 * correspondência ruim, ficam com o que mais se aproxima e o resto do peso vem
 * da avaliação e do volume de vendas.
 */
export const CATEGORIAS_POR_NICHO: Record<string, string[]> = {
  beleza: ["Beleza e Cuidado Pessoal", "Maquiagem", "Salão & Barbearia"],
  moda: ["Relogios e Smartwatchs", "Garrafas, Copos e Canecas", "Beleza e Cuidado Pessoal"],
  tech: [
    "Informática",
    "Celulares e Smartphones",
    "Fones de Ouvido",
    "Carregadores & Power Banks",
    "Caixas de Som",
    "Câmeras",
    "Media Streaming",
    "Games",
    "Relogios e Smartwatchs",
  ],
  casa: [
    "Casa e Utensílios Domésticos",
    "Iluminação",
    "Umidificadores & Ventiladores",
    "Garrafas, Copos e Canecas",
  ],
  saude: ["Beleza e Cuidado Pessoal", "Salão & Barbearia", "Umidificadores & Ventiladores"],
};

/** Categorias que nunca entram na vitrine, independentemente do perfil. */
export const CATEGORIAS_EXCLUIDAS = ["Fora de Estoque", "Anúncios em Massa", "Embalagens e Etiquetas"];

export const categoriasDoPerfil = (respostas: RespostasDoQuiz): string[] =>
  CATEGORIAS_POR_NICHO[respostas.nicho ?? ""] ?? [];

type ProdutoPontuavel = {
  categoria: string;
  preco: number;
  rating?: number | null;
  ordersCount?: number | null;
};

/**
 * Hash estável (FNV-1a) de uma string.
 *
 * Serve para variar a seleção entre pessoas sem usar aleatório de verdade: a
 * mesma dupla usuário/produto sempre devolve o mesmo número, então a vitrine
 * não embaralha sozinha a cada render — só é diferente de conta para conta.
 */
const hashEstavel = (texto: string) => {
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * Desempate por usuário, de 0 a 1.
 *
 * Duas pessoas que responderam exatamente o mesmo quiz teriam a mesma fila de
 * produtos — a vitrine pareceria uma lista fixa, não uma recomendação. Este
 * ruído reordena o que está tecnicamente empatado sem passar por cima dos
 * sinais fortes (nicho, preço, prova social), que valem dezenas de pontos.
 */
export const variacaoDoUsuario = (produtoId: string, userId?: string | null) =>
  userId ? (hashEstavel(`${userId}:${produtoId}`) % 1000) / 1000 : 0;

/** Peso máximo do desempate. Menor que qualquer sinal real do perfil. */
const PESO_DA_VARIACAO = 14;

/**
 * Teto de preço sugerido pelo estágio da pessoa.
 *
 * Quem ainda não vendeu nada tende a travar em produto caro: ticket baixo
 * encurta o caminho até a primeira venda. Quem já tem operação não precisa
 * dessa muleta.
 */
export const tetoDePreco = (respostas: RespostasDoQuiz): number | null => {
  // Quem ainda não vende nada em lugar nenhum é o caso mais extremo: nem conta
  // no marketplace, nem anúncio no ar.
  if (respostas.produtos === "nenhum") {
    return respostas.mercadoLivre === "nao" || respostas.metodoAtual === "sem-anuncios" ? 60 : 80;
  }
  if (respostas.produtos === "1-10" || respostas.dificuldade === "testar") return 150;
  if (respostas.perfil === "explorando") return 120;
  return null;
};

/**
 * Faixa de ticket que combina com quem a pessoa disse que é.
 *
 * Dropshipper iniciante ganha dinheiro com giro; marca própria e agência
 * precisam de produto que aguente margem e não morra no frete. Não é regra
 * rígida — é um empurrão de alguns pontos dentro do que já passou nos outros
 * filtros.
 */
const faixaDoPerfil = (respostas: RespostasDoQuiz): [number, number] | null => {
  if (respostas.perfil === "dropshipper") return [20, 120];
  if (respostas.perfil === "marca") return [60, 400];
  if (respostas.perfil === "agencia") return [40, 300];
  if (respostas.perfil === "explorando") return [15, 100];
  return null;
};

export const pontuarProdutoParaPerfil = (
  produto: ProdutoPontuavel,
  respostas: RespostasDoQuiz,
  /**
   * Id do produto e do usuário, usados só para o desempate estável. Ficam
   * opcionais porque a pontuação também é usada em teste e em pré-visualização,
   * onde não existe usuário logado.
   */
  variacao?: { produtoId?: string; userId?: string | null },
) => {
  let pontos = 0;

  const categorias = categoriasDoPerfil(respostas);
  const posicao = categorias.findIndex(
    (categoria) => categoria.toLowerCase() === (produto.categoria ?? "").toLowerCase(),
  );
  // Categoria do nicho declarado é o sinal mais forte, e a ordem da lista
  // importa: a primeira é a mais representativa do nicho.
  if (posicao === 0) pontos += 60;
  else if (posicao > 0) pontos += 45 - posicao * 3;

  const teto = tetoDePreco(respostas);
  if (teto !== null && produto.preco > 0 && produto.preco <= teto) pontos += 18;

  const faixa = faixaDoPerfil(respostas);
  if (faixa && produto.preco >= faixa[0] && produto.preco <= faixa[1]) pontos += 12;

  // Quem sofre com anúncio ou com aparência da loja se beneficia de produto
  // que já chega com prova social pronta.
  const provaSocial = respostas.dificuldade === "anuncios" || respostas.dificuldade === "profissional";
  pontos += (produto.rating ?? 0) * (provaSocial ? 5 : 3);
  pontos += Math.min(produto.ordersCount ?? 0, 3000) / (provaSocial ? 120 : 200);

  // Operação grande já sabe escolher: o que falta é volume comprovado, não
  // produto barato de teste.
  if (respostas.produtos === "50+" || respostas.produtos === "10-50") {
    pontos += Math.min(produto.ordersCount ?? 0, 5000) / 150;
  }
  // Quem quer testar rápido precisa de coisa que já tem tração — produto sem
  // histórico vira teste dentro do teste.
  if (respostas.dificuldade === "testar" && (produto.ordersCount ?? 0) > 300) pontos += 10;
  // Sem tráfego próprio, o produto tem que se vender pela avaliação.
  if (respostas.dificuldade === "trafego") pontos += (produto.rating ?? 0) * 2;

  if (variacao?.produtoId) {
    pontos += variacaoDoUsuario(variacao.produtoId, variacao.userId) * PESO_DA_VARIACAO;
  }

  return pontos;
};

/** Motivo curto, em primeira pessoa, do porquê o produto foi escolhido. */
export const motivoDaRecomendacao = (produto: ProdutoPontuavel, respostas: RespostasDoQuiz): string => {
  const categorias = categoriasDoPerfil(respostas);
  const bateNoNicho = categorias.some(
    (categoria) => categoria.toLowerCase() === (produto.categoria ?? "").toLowerCase(),
  );

  if (bateNoNicho) return "Combina com o nicho que você escolheu no cadastro";

  const teto = tetoDePreco(respostas);
  if (teto !== null && produto.preco > 0 && produto.preco <= teto) {
    return respostas.mercadoLivre === "nao"
      ? "Ticket baixo, ideal para o seu primeiro anúncio"
      : "Preço baixo, bom para a sua primeira venda";
  }
  if (respostas.dificuldade === "testar" && (produto.ordersCount ?? 0) > 300) {
    return "Já tem tração, dá pra validar rápido";
  }
  if (respostas.dificuldade === "trafego" && (produto.rating ?? 0) >= 4.5) {
    return "Avaliação alta, vende sem depender de anúncio pago";
  }
  if (respostas.perfil === "marca" && produto.preco >= 60) {
    return "Ticket que aguenta margem para a sua marca";
  }
  if ((produto.ordersCount ?? 0) > 800) return "Já vende bastante e tem avaliação alta";
  return "Boa avaliação e estoque disponível no catálogo";
};

/** Frase que explica, na vitrine, em que a seleção se baseou. */
export const resumoDoPerfil = (respostas: RespostasDoQuiz): string => {
  const partes: string[] = [];

  const rotulosDeNicho: Record<string, string> = {
    geral: "multi-nicho",
    beleza: "beleza e skincare",
    moda: "moda e vestuário",
    tech: "tech e gadgets",
    casa: "casa e cozinha",
    saude: "saúde e fitness",
    outro: "o nicho que você indicou",
  };
  if (respostas.nicho && rotulosDeNicho[respostas.nicho]) {
    partes.push(`seu nicho de ${rotulosDeNicho[respostas.nicho]}`);
  }
  if (respostas.produtos === "nenhum") partes.push("você estar começando agora");
  else if (respostas.produtos === "50+") partes.push("o volume que você já vende");

  const rotulosDeDificuldade: Record<string, string> = {
    anuncios: "sua dificuldade em criar anúncios",
    testar: "sua vontade de testar produtos rápido",
    trafego: "sua dificuldade com tráfego",
    profissional: "sua busca por uma loja mais profissional",
  };
  if (respostas.dificuldade && rotulosDeDificuldade[respostas.dificuldade]) {
    partes.push(rotulosDeDificuldade[respostas.dificuldade]);
  }

  if (partes.length === 0) return "Separei o que está vendendo melhor no catálogo agora.";
  if (partes.length === 1) return `Escolhi olhando ${partes[0]}.`;
  return `Escolhi olhando ${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}.`;
};
