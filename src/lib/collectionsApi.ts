import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

export type VeloCollection = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type VeloCollectionProduct = {
  id: string;
  collection_id: string;
  product_id: string;
  created_at?: string | null;
  added_at?: string | null;
};

export type CollectionSummary = VeloCollection & {
  productCount: number;
  thumbnails: string[];
};

// Types generated before Lovable-created collection tables are available locally.
// Keep untyped table access isolated here instead of spreading `any` through UI code.
const collectionsDb = supabase as any;

const COLLECTIONS_UPDATED_EVENT = "velo:collections-updated";

const getAuthenticatedUserId = async (expectedUserId?: string) => {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  const authenticatedUserId = data.user?.id;
  if (!authenticatedUserId) {
    const authError = new Error("Usuário não autenticado para carregar coleções.") as Error & {
      code?: string;
      details?: string;
    };
    authError.code = "NO_AUTH_USER";
    authError.details = "supabase.auth.getUser() não retornou um usuário válido.";
    throw authError;
  }

  if (expectedUserId && expectedUserId !== authenticatedUserId) {
    const mismatchError = new Error("Sessão autenticada não corresponde ao usuário atual.") as Error & {
      code?: string;
      details?: string;
    };
    mismatchError.code = "AUTH_USER_MISMATCH";
    mismatchError.details = `Context user_id=${expectedUserId}; auth user_id=${authenticatedUserId}`;
    throw mismatchError;
  }

  return authenticatedUserId;
};

export const notifyCollectionsUpdated = () => {
  window.dispatchEvent(new CustomEvent(COLLECTIONS_UPDATED_EVENT));
};

export const onCollectionsUpdated = (callback: () => void) => {
  window.addEventListener(COLLECTIONS_UPDATED_EVENT, callback);
  return () => window.removeEventListener(COLLECTIONS_UPDATED_EVENT, callback);
};

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];

  if (Array.isArray(images)) {
    return images.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
  }

  if (typeof images === "string") {
    try {
      const parsed: unknown = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
        : [images];
    } catch {
      return [images];
    }
  }

  return [];
};

export const listCollections = async (userId: string, limit?: number): Promise<VeloCollection[]> => {
  const authenticatedUserId = await getAuthenticatedUserId(userId);

  let query = collectionsDb
    .from("collections")
    .select("id,user_id,name,category,created_at,updated_at")
    .eq("user_id", authenticatedUserId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VeloCollection[];
};

export const listCollectionCategories = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("catalog_products")
    .select("category")
    .eq("source", "c7drop")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .limit(300);

  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((item) => item.category)
        .filter((category): category is string => Boolean(category?.trim())),
    ),
  ).slice(0, 8);
};

export const createCollection = async ({
  name,
  category,
  userId,
}: {
  name: string;
  category: string | null;
  userId: string;
}): Promise<VeloCollection> => {
  const { data, error } = await collectionsDb
    .from("collections")
    .insert({ name, category, user_id: userId })
    .select("id,user_id,name,category,created_at,updated_at")
    .single();

  if (error) throw error;
  notifyCollectionsUpdated();
  return data as VeloCollection;
};

export const deleteCollection = async (collectionId: string) => {
  const { error: productsError } = await collectionsDb
    .from("collection_products")
    .delete()
    .eq("collection_id", collectionId);

  if (productsError) throw productsError;

  const { error: collectionError } = await collectionsDb
    .from("collections")
    .delete()
    .eq("id", collectionId);

  if (collectionError) throw collectionError;
  notifyCollectionsUpdated();
};

export const getCollectionProductIds = async (collectionId: string): Promise<string[]> => {
  const { data, error } = await collectionsDb
    .from("collection_products")
    .select("product_id")
    .eq("collection_id", collectionId);

  if (error) throw error;
  return ((data ?? []) as Array<{ product_id: string }>).map((item) => item.product_id);
};

export const addProductToCollection = async (collectionId: string, productId: string) => {
  const { error } = await collectionsDb
    .from("collection_products")
    .insert({ collection_id: collectionId, product_id: productId });

  if (error) throw error;
  notifyCollectionsUpdated();
};

export const removeProductFromCollection = async (collectionId: string, productId: string) => {
  const { error } = await collectionsDb
    .from("collection_products")
    .delete()
    .eq("collection_id", collectionId)
    .eq("product_id", productId);

  if (error) throw error;
  notifyCollectionsUpdated();
};

export const listCollectionsWithSummaries = async (userId: string): Promise<CollectionSummary[]> => {
  const collections = await listCollections(userId);
  if (collections.length === 0) return [];

  const collectionIds = collections.map((collection) => collection.id);
  const { data: rows, error: rowsError } = await collectionsDb
    .from("collection_products")
    .select("collection_id,product_id,added_at")
    .in("collection_id", collectionIds)
    .order("added_at", { ascending: false, nullsFirst: false });

  if (rowsError) throw rowsError;

  const collectionProducts = (rows ?? []) as VeloCollectionProduct[];
  const productIds = Array.from(new Set(collectionProducts.map((item) => item.product_id)));
  const productImages = new Map<string, string>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("catalog_products")
      .select("id,images")
      .in("id", productIds);

    if (productsError) throw productsError;

    ((products ?? []) as Pick<CatalogProductRow, "id" | "images">[]).forEach((product) => {
      const [image] = getProductImages(product.images);
      if (image) productImages.set(product.id, image);
    });
  }

  return collections.map((collection) => {
    const productsForCollection = collectionProducts.filter((item) => item.collection_id === collection.id);

    return {
      ...collection,
      productCount: productsForCollection.length,
      thumbnails: productsForCollection
        .map((item) => productImages.get(item.product_id))
        .filter((image): image is string => Boolean(image))
        .slice(0, 3),
    };
  });
};
