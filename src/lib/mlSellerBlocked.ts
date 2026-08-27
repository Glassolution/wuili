/**
 * Traduz os códigos de bloqueio que o Mercado Livre devolve em /users/me e no
 * POST /items (ex.: "address_pending", "phone_pending") para uma explicação
 * acionável: o que falta na conta e onde preencher.
 *
 * Vive num módulo próprio porque o mesmo mapeamento alimenta o modal exibido
 * em todos os fluxos de publicação (catálogo, Atlas e produtos próprios).
 */

export type InfoFaltanteMl = {
  /** Título curto do modal, ex.: "Falta o endereço de cadastro". */
  titulo: string;
  /** Frase de contexto logo abaixo do título. */
  explicacao: string;
  /** Passos numerados para resolver no Mercado Livre. */
  passos: string[];
  /** URL aberta pelo botão principal. */
  url: string;
  /** Texto do botão principal. */
  botao: string;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();




const ML_CONTA_URL = "https://www.mercadolivre.com.br/minha-conta/dados-pessoais";
const ML_VENDER_URL = "https://www.mercadolivre.com.br/vender";

const GENERICO: InfoFaltanteMl = {
  titulo: "Sua conta do Mercado Livre está incompleta",
  explicacao:
    "O Mercado Livre bloqueou a publicação porque faltam informações no seu cadastro de vendedor. Confirmar o e-mail não basta — o cadastro de vendedor é separado.",
  passos: [
    "Acesse mercadolivre.com.br e entre na sua conta.",
    "Clique no seu nome (canto superior direito) e abra “Minha conta”.",
    "Complete os dados pessoais, endereço e telefone que estiverem pendentes.",
    "Volte aqui e publique novamente.",
  ],
  url: ML_VENDER_URL,
  botao: "Abrir o Mercado Livre",
};

/**
 * Recebe os códigos crus do ML e devolve o conteúdo do modal. O primeiro
 * motivo encontrado vence — a conta raramente tem mais de um bloqueio e o
 * usuário resolve um de cada vez.
 */
export function infoFaltanteDoVendedor(codes: string[] | undefined | null): InfoFaltanteMl {
  const normalized = (codes ?? []).map(normalize);

  const has = (...needles: string[]) => normalized.some((code) => needles.some((n) => code.includes(n)));

  if (has("address", "endereco")) {
    return {
      titulo: "Falta o endereço de cadastro",
      explicacao:
        "O Mercado Livre exige um endereço completo no seu cadastro para liberar a publicação de anúncios. Ter o e-mail verificado não é suficiente.",
      passos: [
        "Acesse mercadolivre.com.br e entre na sua conta.",
        "Clique no seu nome no canto superior direito e vá em “Minha conta”.",
        "Abra “Dados pessoais” e depois “Endereços”.",
        "Cadastre o endereço completo: CEP, rua, número e complemento.",
        "Volte aqui e publique o produto novamente.",
      ],
      url: ML_CONTA_URL,
      botao: "Preencher endereço no Mercado Livre",
    };
  }

  if (has("phone", "telefone")) {
    return {
      titulo: "Falta confirmar seu telefone",
      explicacao:
        "O Mercado Livre exige um telefone confirmado no cadastro para liberar a publicação de anúncios.",
      passos: [
        "Acesse mercadolivre.com.br e entre na sua conta.",
        "Clique no seu nome no canto superior direito e vá em “Minha conta”.",
        "Abra “Dados pessoais” e confirme seu número de telefone.",
        "Digite o código enviado por SMS.",
        "Volte aqui e publique o produto novamente.",
      ],
      url: ML_CONTA_URL,
      botao: "Confirmar telefone no Mercado Livre",
    };
  }

  if (has("identity", "identification", "identidade", "kyc", "regulation", "regul")) {
    return {
      titulo: "Falta validar sua identidade",
      explicacao:
        "O Mercado Livre exige a validação de identidade (documento com foto) para liberar a publicação de anúncios.",
      passos: [
        "Acesse mercadolivre.com.br e entre na sua conta.",
        "Clique no seu nome no canto superior direito e vá em “Minha conta”.",
        "Abra “Dados pessoais” e siga a validação de identidade.",
        "Envie a foto do documento e aguarde a confirmação.",
        "Volte aqui e publique o produto novamente.",
      ],
      url: ML_CONTA_URL,
      botao: "Validar identidade no Mercado Livre",
    };
  }

  if (has("billing", "fiscal", "tax", "faturamento")) {
    return {
      titulo: "Faltam os dados de faturamento",
      explicacao:
        "O Mercado Livre exige os dados fiscais/de faturamento (CPF ou CNPJ e endereço de cobrança) para liberar a publicação de anúncios.",
      passos: [
        "Acesse mercadolivre.com.br e entre na sua conta.",
        "Clique no seu nome no canto superior direito e vá em “Minha conta”.",
        "Abra “Dados de faturamento” e informe CPF/CNPJ e endereço de cobrança.",
        "Volte aqui e publique o produto novamente.",
      ],
      url: ML_CONTA_URL,
      botao: "Preencher faturamento no Mercado Livre",
    };
  }

  return GENERICO;
}
