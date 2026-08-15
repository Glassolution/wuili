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
 * Teto de preço sugerido pelo estágio da pessoa.
 *
 * Quem ainda não vendeu nada tende a travar em produto caro: ticket baixo
 * encurta o caminho até a primeira venda. Quem já tem operação não precisa
 * dessa muleta.
 */
const tetoDePreco = (respostas: RespostasDoQuiz): number | null => {
  if (respostas.produtos === "nenhum") return 80;
  if (respostas.produtos === "1-10" || respostas.dificuldade === "testar") return 150;
  return null;
};

export const pontuarProdutoParaPerfil = (produto: ProdutoPontuavel, respostas: RespostasDoQuiz) => {
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

  // Quem sofre com anúncio ou com aparência da loja se beneficia de produto
  // que já chega com prova social pronta.
  const provaSocial = respostas.dificuldade === "anuncios" || respostas.dificuldade === "profissional";
  pontos += (produto.rating ?? 0) * (provaSocial ? 5 : 3);
  pontos += Math.min(produto.ordersCount ?? 0, 3000) / (provaSocial ? 120 : 200);

  return pontos;
};

/** Motivo curto, em primeira pessoa, do porquê o produto foi escolhido. */
export const motivoDaRecomendacao = (produto: ProdutoPontuavel, respostas: RespostasDoQuiz): string => {
  const categorias = categoriasDoPerfil(respostas);
  const bateNoNicho = categorias.some(
    (categoria) => categoria.toLowerCase() === (produto.categoria ?? "").toLowerCase(),
  );

  if (bateNoNicho) return `Combina com o nicho que você escolheu no cadastro`;

  const teto = tetoDePreco(respostas);
  if (teto !== null && produto.preco > 0 && produto.preco <= teto) {
    return "Preço baixo, bom para a sua primeira venda";
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
