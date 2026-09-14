import ProductTemplateBlue from "@/components/store-templates/ProductTemplateBlue";
import ProductTemplateBlack from "@/components/store-templates/ProductTemplateBlack";

/**
 * Registro unico dos templates de pagina de produto.
 *
 * Editor, galeria e pagina publicada leem esta mesma tabela. IDs removidos ou
 * desconhecidos sempre caem no template atual, para nenhuma pagina publicada
 * voltar a renderizar um layout antigo.
 */

export const BLUE_PRODUCT_TEMPLATE_ID = "produto-blue";
export const BLACK_PRODUCT_TEMPLATE_ID = "produto-black";
export const LEGACY_VELO_PRODUCT_TEMPLATE_ID = "produto-velo";

/** Template padrao usado por projetos novos e por qualquer id legado. */
export const CURRENT_PRODUCT_TEMPLATE_ID = BLACK_PRODUCT_TEMPLATE_ID;

export const AI_DESCRIPTION_PLACEHOLDER =
  "A descricao de venda deste produto esta sendo gerada pela IA.";

export const PRODUCT_TEMPLATE_DESC_FALLBACK =
  "Qualidade conferida antes do envio, entrega para todo o Brasil e garantia de 7 dias para trocar ou devolver.";

export const PRODUCT_TEMPLATES = {
  [BLUE_PRODUCT_TEMPLATE_ID]: {
    Component: ProductTemplateBlue,
    descFallback: PRODUCT_TEMPLATE_DESC_FALLBACK,
  },
  [BLACK_PRODUCT_TEMPLATE_ID]: {
    Component: ProductTemplateBlack,
    descFallback: PRODUCT_TEMPLATE_DESC_FALLBACK,
  },
} as const;

export const resolveProductTemplate = (templateId?: string) => {
  if (templateId === LEGACY_VELO_PRODUCT_TEMPLATE_ID) return PRODUCT_TEMPLATES[CURRENT_PRODUCT_TEMPLATE_ID];
  return PRODUCT_TEMPLATES[templateId as keyof typeof PRODUCT_TEMPLATES] ?? PRODUCT_TEMPLATES[CURRENT_PRODUCT_TEMPLATE_ID];
};
