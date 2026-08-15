import ProductPageTemplate from "@/components/store-templates/ProductPageTemplate";
import ProductTemplateBlue from "@/components/store-templates/ProductTemplateBlue";
import ProductTemplateBlack from "@/components/store-templates/ProductTemplateBlack";

/**
 * Registro dos templates de página de produto.
 *
 * Hoje existe um só. O registro continua aqui porque editor e página publicada
 * precisam ler a MESMA tabela: quando cada tela tinha a própria lista, template
 * novo entrava só no editor e a loja publicada caía em outro layout.
 *
 * O id de projetos antigos (produto-1 … produto-7, dos templates removidos)
 * não é mais reconhecido — todos caem no template atual, então nenhuma página
 * já salva ou publicada quebra.
 */

/** Id do template padrão — o que projetos novos e ids desconhecidos recebem. */
export const CURRENT_PRODUCT_TEMPLATE_ID = "produto-velo";

/** Segundo template da galeria. */
export const BLUE_PRODUCT_TEMPLATE_ID = "produto-blue";

/** Terceiro template da galeria. */
export const BLACK_PRODUCT_TEMPLATE_ID = "produto-black";

/** Texto curto exibido enquanto a IA não gerou a descrição do produto. Existe
 *  para o bloco de compra nunca cair no texto bruto do fornecedor. */
export const AI_DESCRIPTION_PLACEHOLDER =
  "A descrição de venda deste produto está sendo gerada pela IA.";

/** Descrição usada quando o projeto ainda não tem ângulo de venda escrito. */
export const PRODUCT_TEMPLATE_DESC_FALLBACK =
  "Qualidade conferida antes do envio, entrega para todo o Brasil e garantia de 7 dias para trocar ou devolver.";

export const PRODUCT_TEMPLATES = {
  [CURRENT_PRODUCT_TEMPLATE_ID]: {
    Component: ProductPageTemplate,
    descFallback: PRODUCT_TEMPLATE_DESC_FALLBACK,
  },
  [BLUE_PRODUCT_TEMPLATE_ID]: {
    Component: ProductTemplateBlue,
    descFallback: PRODUCT_TEMPLATE_DESC_FALLBACK,
  },
  [BLACK_PRODUCT_TEMPLATE_ID]: {
    Component: ProductTemplateBlack,
    descFallback: PRODUCT_TEMPLATE_DESC_FALLBACK,
  },
} as const;

/** Resolve pelo id gravado no projeto. Id desconhecido (inclusive os templates
 *  removidos, produto-1 … produto-7) cai no padrão, então nenhuma página já
 *  salva ou publicada quebra. */
export const resolveProductTemplate = (templateId?: string) =>
  PRODUCT_TEMPLATES[templateId as keyof typeof PRODUCT_TEMPLATES] ?? PRODUCT_TEMPLATES[CURRENT_PRODUCT_TEMPLATE_ID];
