export type AiProductPageStatus = "rascunho" | "gerando" | "publicada";

export type AiProductPageSummary = {
  id: string;
  productName: string;
  productImage: string | null;
  source: string;
  status: AiProductPageStatus;
  updatedAt: string;
};

const storageKey = (userId: string) => `velo:ai-product-pages:${userId}`;

const isAiProductPageSummary = (value: unknown): value is AiProductPageSummary => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.productName === "string" &&
    (typeof candidate.productImage === "string" || candidate.productImage === null) &&
    typeof candidate.source === "string" &&
    (candidate.status === "rascunho" || candidate.status === "gerando" || candidate.status === "publicada") &&
    typeof candidate.updatedAt === "string"
  );
};

export const readAiProductPages = (userId: string): AiProductPageSummary[] => {
  if (typeof window === "undefined") return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isAiProductPageSummary) : [];
  } catch {
    return [];
  }
};

export const saveAiProductPages = (userId: string, pages: AiProductPageSummary[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(pages));
};

export const upsertAiProductPage = (userId: string, page: AiProductPageSummary) => {
  const pages = readAiProductPages(userId);
  const nextPages = [page, ...pages.filter((current) => current.id !== page.id)];
  saveAiProductPages(userId, nextPages);
};
