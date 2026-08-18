import {
  BLACK_PRODUCT_TEMPLATE_ID,
  BLUE_PRODUCT_TEMPLATE_ID,
  CURRENT_PRODUCT_TEMPLATE_ID,
  LEGACY_VELO_PRODUCT_TEMPLATE_ID,
} from "@/components/store-templates/productTemplateRegistry";

export type SalesPageTemplate = {
  id: string;
  name: string;
  preview: string;
  editorTemplateId: string;
  description: string;
};

/** Modelos ativos oferecidos na galeria. */
export const salesPageTemplates: SalesPageTemplate[] = [
  {
    id: "blue",
    name: "Blue",
    preview: "/template-produto-blue-preview.png",
    editorTemplateId: BLUE_PRODUCT_TEMPLATE_ID,
    description: "Azul e direto ao ponto: urgencia, beneficios numerados, estatisticas e garantia.",
  },
  {
    id: "black",
    name: "Black",
    preview: "/template-produto-black-preview.png",
    editorTemplateId: BLACK_PRODUCT_TEMPLATE_ID,
    description: "Visual preto premium: galeria grande, prova social, midia, FAQ e CTA fixo.",
  },
];

/** Nome exibido para o id salvo no projeto. IDs antigos abrem no template atual. */
export const editorTemplateName: Record<string, string> = {
  [CURRENT_PRODUCT_TEMPLATE_ID]: "Black",
  [LEGACY_VELO_PRODUCT_TEMPLATE_ID]: "Black",
  [BLUE_PRODUCT_TEMPLATE_ID]: "Blue",
  "loja-1": "Loja",
  "loja-2": "Loja 2",
};
