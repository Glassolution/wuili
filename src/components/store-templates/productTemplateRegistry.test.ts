import { describe, expect, it } from "vitest";

import {
  BLACK_PRODUCT_TEMPLATE_ID,
  BLUE_PRODUCT_TEMPLATE_ID,
  CURRENT_PRODUCT_TEMPLATE_ID,
  PRODUCT_TEMPLATES,
  resolveProductTemplate,
} from "@/components/store-templates/productTemplateRegistry";
import { salesPageTemplates } from "@/lib/salesPageTemplates";

/**
 * Editor, galeria e página publicada leem este mesmo registro. Quando cada tela
 * tinha a própria lista, template novo entrava só no editor e a loja publicada
 * caía em outro layout — daí estes testes.
 */
describe("registro de templates de produto", () => {
  it("resolve cada template pelo id gravado no projeto", () => {
    expect(resolveProductTemplate(CURRENT_PRODUCT_TEMPLATE_ID).Component).toBe(
      PRODUCT_TEMPLATES[CURRENT_PRODUCT_TEMPLATE_ID].Component,
    );
    expect(resolveProductTemplate(BLUE_PRODUCT_TEMPLATE_ID).Component).toBe(
      PRODUCT_TEMPLATES[BLUE_PRODUCT_TEMPLATE_ID].Component,
    );
    expect(resolveProductTemplate(BLACK_PRODUCT_TEMPLATE_ID).Component).toBe(
      PRODUCT_TEMPLATES[BLACK_PRODUCT_TEMPLATE_ID].Component,
    );
  });

  it("são templates diferentes", () => {
    expect(resolveProductTemplate(BLUE_PRODUCT_TEMPLATE_ID).Component).not.toBe(
      resolveProductTemplate(CURRENT_PRODUCT_TEMPLATE_ID).Component,
    );
    expect(resolveProductTemplate(BLACK_PRODUCT_TEMPLATE_ID).Component).not.toBe(
      resolveProductTemplate(CURRENT_PRODUCT_TEMPLATE_ID).Component,
    );
    expect(resolveProductTemplate(BLACK_PRODUCT_TEMPLATE_ID).Component).not.toBe(
      resolveProductTemplate(BLUE_PRODUCT_TEMPLATE_ID).Component,
    );
  });

  it("id legado ou ausente cai no padrão, sem quebrar página já publicada", () => {
    for (const legado of ["produto-1", "produto-7", "produto-greens", "", undefined]) {
      expect(resolveProductTemplate(legado).Component).toBe(
        PRODUCT_TEMPLATES[CURRENT_PRODUCT_TEMPLATE_ID].Component,
      );
    }
  });

  it("a galeria oferece exatamente os templates registrados", () => {
    const daGaleria = salesPageTemplates.map((template) => template.editorTemplateId).sort();
    expect(daGaleria).toEqual(Object.keys(PRODUCT_TEMPLATES).sort());
  });
});
