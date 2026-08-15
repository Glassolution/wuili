import {
  BLACK_PRODUCT_TEMPLATE_ID,
  BLUE_PRODUCT_TEMPLATE_ID,
  CURRENT_PRODUCT_TEMPLATE_ID,
} from "@/components/store-templates/productTemplateRegistry";

export type SalesPageTemplate = {
  id: string;
  name: string;
  preview: string;
  editorTemplateId: string;
  description: string;
};

/** Modelos oferecidos na galeria. Hoje é um só; entra aqui todo template novo
 *  que for registrado em productTemplateRegistry. */
export const salesPageTemplates: SalesPageTemplate[] = [
  {
    id: "velo",
    name: "Velo",
    preview: "/template-produto-preview.png",
    editorTemplateId: CURRENT_PRODUCT_TEMPLATE_ID,
    description: "Página de venda completa: prova social, comparativo, depoimentos e CTA fixo.",
  },
  {
    id: "blue",
    name: "Blue",
    preview: "/template-produto-blue-preview.png",
    editorTemplateId: BLUE_PRODUCT_TEMPLATE_ID,
    description: "Azul e direto ao ponto: urgência, benefícios numerados, estatísticas e garantia.",
  },
  {
    id: "black",
    name: "Black",
    preview: "/template-produto-black-preview.png",
    editorTemplateId: BLACK_PRODUCT_TEMPLATE_ID,
    description: "Visual preto premium: galeria grande, prova social, mídia, FAQ e CTA fixo.",
  },
];

/** Nome exibido para o id salvo no projeto. Projetos criados nos templates
 *  antigos (produto-1 … produto-7) abrem no template atual. */
export const editorTemplateName: Record<string, string> = {
  [CURRENT_PRODUCT_TEMPLATE_ID]: "Velo",
  [BLUE_PRODUCT_TEMPLATE_ID]: "Blue",
  [BLACK_PRODUCT_TEMPLATE_ID]: "Black",
  "loja-1": "Loja",
  "loja-2": "Loja 2",
};
