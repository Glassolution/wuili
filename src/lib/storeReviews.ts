import { supabase } from "@/integrations/supabase/client";

// Avaliações reais da loja publicada (tabela store_reviews). Substituem os
// depoimentos e as notas que antes eram fixos no código dos templates.

const reviewsTable = () => supabase.from("store_reviews");

type ReviewRow = {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type StoreReview = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type StoreReviewSummary = {
  reviews: StoreReview[];
  count: number;
  /** Média das notas, ou null quando ainda não há avaliação. */
  average: number | null;
  /** Quantas avaliações por nota, de 5 a 1 — alimenta as barras do template. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export const EMPTY_REVIEW_SUMMARY: StoreReviewSummary = {
  reviews: [],
  count: 0,
  average: null,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export const summarizeReviews = (reviews: StoreReview[]): StoreReviewSummary => {
  if (reviews.length === 0) return { ...EMPTY_REVIEW_SUMMARY, reviews: [] };
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of reviews) {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[rating] += 1;
    total += rating;
  }
  return {
    reviews,
    count: reviews.length,
    average: total / reviews.length,
    distribution,
  };
};

const toReview = (row: ReviewRow): StoreReview => ({
  id: row.id,
  authorName: row.author_name,
  rating: Number(row.rating),
  comment: row.comment,
  createdAt: row.created_at,
});

export async function fetchStoreReviews(projectId: string): Promise<StoreReview[]> {
  const { data, error } = await reviewsTable()
    .select("id,author_name,rating,comment,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as ReviewRow[]).map(toReview);
}

export async function createStoreReview(input: {
  projectId: string;
  productId?: string | null;
  authorName: string;
  rating: number;
  comment: string;
}): Promise<StoreReview> {
  const { data, error } = await reviewsTable()
    .insert({
      project_id: input.projectId,
      product_id: input.productId ?? null,
      author_name: input.authorName.trim(),
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      comment: input.comment.trim(),
    })
    .select("id,author_name,rating,comment,created_at")
    .single();

  if (error) throw error;
  return toReview(data as ReviewRow);
}

/** "há 2 dias", "há 3 meses" — evita depender de lib de data. */
export const formatReviewDate = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
};
