export type ProductImportDraft = {
  productId: string;
  step: number;
  title: string;
  sellPrice: number;
  description: string;
  brand: string;
  model: string;
  albumName: string;
  saleFormat: "unit" | "kit";
  updatedAt: number;
};

const draftKey = (userId: string, productId: string) =>
  `velo:product-import-draft:${userId}:${productId}`;

export const saveProductImportDraft = (
  userId: string,
  draft: Omit<ProductImportDraft, "updatedAt">,
) => {
  try {
    window.localStorage.setItem(draftKey(userId, draft.productId), JSON.stringify({ ...draft, updatedAt: Date.now() }));
  } catch {
    // O fluxo continua sem restauração em modo privado ou com armazenamento cheio.
  }
};

export const readProductImportDraft = (userId: string, productId: string): ProductImportDraft | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(userId, productId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as ProductImportDraft;
    if (draft.productId !== productId || Date.now() - draft.updatedAt > 7 * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(draftKey(userId, productId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

export const clearProductImportDraft = (userId: string, productId: string) => {
  try {
    window.localStorage.removeItem(draftKey(userId, productId));
  } catch {
    // Nada a limpar quando o armazenamento não está disponível.
  }
};