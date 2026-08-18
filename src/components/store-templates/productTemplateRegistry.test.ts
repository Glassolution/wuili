import { describe, expect, it } from "vitest";

import {
  BLACK_PRODUCT_TEMPLATE_ID,
  BLUE_PRODUCT_TEMPLATE_ID,
  CURRENT_PRODUCT_TEMPLATE_ID,
  LEGACY_VELO_PRODUCT_TEMPLATE_ID,
  PRODUCT_TEMPLATES,
  resolveProductTemplate,
} from "@/components/store-templates/productTemplateRegistry";
import { salesPageTemplates } from "@/lib/salesPageTemplates";

describe("registro de templates de produto", () => {
  it("resolve cada template ativo pelo id gravado no projeto", () => {
    expect(resolveProductTemplate(BLUE_PRODUCT_TEMPLATE_ID).Component).toBe(
      PRODUCT_TEMPLATES[BLUE_PRODUCT_TEMPLATE_ID].Component,
    );
    expect(resolveProductTemplate(BLACK_PRODUCT_TEMPLATE_ID).Component).toBe(
      PRODUCT_TEMPLATES[BLACK_PRODUCT_TEMPLATE_ID].Component,
    );
  });

  it("mantem os templates ativos diferentes", () => {
    expect(resolveProductTemplate(BLUE_PRODUCT_TEMPLATE_ID).Component).not.toBe(
      resolveProductTemplate(BLACK_PRODUCT_TEMPLATE_ID).Component,
    );
  });

  it("id legado ou ausente cai no padrao atual, sem renderizar template removido", () => {
    for (const legado of [LEGACY_VELO_PRODUCT_TEMPLATE_ID, "produto-1", "produto-7", "produto-greens", "", undefined]) {
      expect(resolveProductTemplate(legado).Component).toBe(
        PRODUCT_TEMPLATES[CURRENT_PRODUCT_TEMPLATE_ID].Component,
      );
    }
  });

  it("a galeria oferece exatamente os templates ativos registrados", () => {
    const daGaleria = salesPageTemplates.map((template) => template.editorTemplateId).sort();
    expect(daGaleria).toEqual(Object.keys(PRODUCT_TEMPLATES).sort());
  });
});
