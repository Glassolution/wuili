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
  coverImage: string | null;
  thumbnails: string[];
};

export type CollectionProductItem = {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  category: string | null;
  added_at: string | null;
};

type CollectionProductJoinRow = {
  product_id: string;
  added_at?: string | null;
  catalog_products:
    | {
        id: string;
        title: string | null;
        category?: string | null;
        image_url?: string | null;
        images?: Json | null;
        cost_price?: number | null;
      }
    | Array<{
        id: string;
        title: string | null;
        category?: string | null;
        image_url?: string | null;
        images?: Json | null;
        cost_price?: number | null;
      }>
    | null;
};

// Types generated before Lovable-created collection tables are available locally.
// Keep untyped table access isolated here instead of spreading `any` through UI code.
const collectionsDb = supabase as any;

const COLLECTIONS_UPDATED_EVENT = "velo:collections-updated";
const EXAMPLE_COLLECTION_NAME = "Produtos de exemplo";
const EXAMPLE_PRODUCTS_LIMIT = 8;

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

import { proxyImageList } from "@/lib/imageProxy";

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];

  const rawList: string[] = (() => {
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
  })();

  return proxyImageList(rawList);
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

  const categories: string[] = [];
  for (const item of data ?? []) {
    const cat = (item as { category?: string | null }).category;
    if (typeof cat === "string" && cat.trim().length > 0) categories.push(cat);
  }
  return Array.from(new Set(categories)).slice(0, 8);
};

export const listUserCollectionCategories = async (userId: string): Promise<string[]> => {
  const authenticatedUserId = await getAuthenticatedUserId(userId);

  const { data, error } = await collectionsDb
    .from("collections")
    .select("category")
    .eq("user_id", authenticatedUserId)
    .not("category", "is", null)
    .order("category", { ascending: true });

  if (error) throw error;

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ category: string | null }>)
        .map((item) => item.category)
        .filter((category): category is string => Boolean(category?.trim())),
    ),
  );
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

export const renameCollection = async (collectionId: string, name: string): Promise<VeloCollection> => {
  const { data, error } = await collectionsDb
    .from("collections")
    .update({ name })
    .eq("id", collectionId)
    .select("id,user_id,name,category,created_at,updated_at")
    .single();

  if (error) throw error;
  notifyCollectionsUpdated();
  return data as VeloCollection;
};

/** Coleção especial alimentada pelo coração do card, não pelo seletor manual. */
export const FAVORITES_COLLECTION_NAME = "Favoritos";

/**
 * Ids das coleções do usuário que já contêm um produto.
 *
 * Usado pelo seletor de coleções para marcar as caixas já ativas sem precisar
 * de uma consulta por coleção.
 */
export const getCollectionIdsForProduct = async (userId: string, productId: string): Promise<string[]> => {
  const { data: minhas, error: erroColecoes } = await collectionsDb
    .from("collections")
    .select("id")
    .eq("user_id", userId);
  if (erroColecoes) throw erroColecoes;

  const ids = ((minhas ?? []) as Array<{ id: string }>).map((item) => item.id);
  if (ids.length === 0) return [];

  const { data, error } = await collectionsDb
    .from("collection_products")
    .select("collection_id")
    .eq("product_id", productId)
    .in("collection_id", ids);
  if (error) throw error;

  return ((data ?? []) as Array<{ collection_id: string }>).map((item) => item.collection_id);
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

type EnsureExampleCollectionProductsResult = {
  collectionId: string | null;
  productIds: string[];
  inserted: boolean;
};

const fetchExampleCatalogProductIds = async (preferredProductId?: string | null, limit = EXAMPLE_PRODUCTS_LIMIT) => {
  const preferredId = preferredProductId?.trim();
  const productIds: string[] = [];

  if (preferredId) {
    const { data, error } = await supabase
      .from("catalog_products")
      .select("id")
      .eq("id", preferredId)
      .eq("source", "c7drop")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .gt("stock_quantity", 0)
      .limit(1);

    if (error) throw error;
    const [preferredProduct] = (data ?? []) as Array<{ id: string }>;
    if (preferredProduct?.id) productIds.push(preferredProduct.id);
  }

  const remaining = Math.max(limit - productIds.length, 0);
  if (remaining === 0) return productIds;

  let query = supabase
    .from("catalog_products")
    .select("id")
    .eq("source", "c7drop")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0);

  if (preferredId) query = query.neq("id", preferredId);

  const { data, error } = await query
    .order("orders_count", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(remaining);
  if (error) throw error;

  for (const product of (data ?? []) as Array<{ id: string }>) {
    if (product.id && !productIds.includes(product.id)) productIds.push(product.id);
  }

  return productIds;
};

export const ensureExampleCollectionProducts = async ({
  userId,
  preferredProductId,
  limit = EXAMPLE_PRODUCTS_LIMIT,
}: {
  userId: string;
  preferredProductId?: string | null;
  limit?: number;
}): Promise<EnsureExampleCollectionProductsResult> => {
  const authenticatedUserId = await getAuthenticatedUserId(userId);

  const { data: existingProducts, error: existingProductsError } = await collectionsDb
    .from("collection_products")
    .select("product_id,collections!inner(user_id),catalog_products!inner(is_active,is_blocked,stock_quantity)")
    .eq("collections.user_id", authenticatedUserId)
    .eq("catalog_products.is_active", true)
    .eq("catalog_products.is_blocked", false)
    .gt("catalog_products.stock_quantity", 0)
    .limit(1);

  if (existingProductsError) throw existingProductsError;
  if ((existingProducts ?? []).length > 0) {
    return { collectionId: null, productIds: [], inserted: false };
  }

  const productIds = await fetchExampleCatalogProductIds(preferredProductId, limit);
  if (productIds.length === 0) {
    return { collectionId: null, productIds: [], inserted: false };
  }

  const { data: existingCollections, error: existingCollectionsError } = await collectionsDb
    .from("collections")
    .select("id")
    .eq("user_id", authenticatedUserId)
    .eq("name", EXAMPLE_COLLECTION_NAME)
    .limit(1);

  if (existingCollectionsError) throw existingCollectionsError;

  let collectionId = ((existingCollections ?? []) as Array<{ id: string }>)[0]?.id ?? null;

  if (!collectionId) {
    const { data: createdCollection, error: createCollectionError } = await collectionsDb
      .from("collections")
      .insert({
        user_id: authenticatedUserId,
        name: EXAMPLE_COLLECTION_NAME,
        category: null,
      })
      .select("id")
      .single();

    if (createCollectionError) throw createCollectionError;
    collectionId = (createdCollection as { id: string } | null)?.id ?? null;
  }

  if (!collectionId) {
    return { collectionId: null, productIds: [], inserted: false };
  }

  const { error: productsError } = await collectionsDb
    .from("collection_products")
    .upsert(
      productIds.map((productId) => ({ collection_id: collectionId, product_id: productId })),
      { onConflict: "collection_id,product_id", ignoreDuplicates: true },
    );

  if (productsError) throw productsError;
  notifyCollectionsUpdated();

  return { collectionId, productIds, inserted: true };
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

export const listCollectionProducts = async (collectionId: string): Promise<CollectionProductItem[]> => {
  const { data, error } = await collectionsDb
    .from("collection_products")
    .select(`
      product_id,
      added_at,
      catalog_products (
        id,
        title,
        category,
        images,
        cost_price
      )
    `)
    .eq("collection_id", collectionId)
    .order("added_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as CollectionProductJoinRow[]).map((item) => {
    const product = Array.isArray(item.catalog_products) ? item.catalog_products[0] : item.catalog_products;
    const [imageFromImages] = getProductImages(product?.images ?? null);

    return {
      id: item.product_id,
      title: product?.title ?? "Produto sem nome",
      image_url: imageFromImages ?? product?.image_url ?? null,
      price: product?.cost_price ?? null,
      category: product?.category ?? null,
      added_at: item.added_at ?? null,
    };
  });
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
    const firstProduct = productsForCollection[productsForCollection.length - 1];

    return {
      ...collection,
      productCount: productsForCollection.length,
      coverImage: firstProduct ? productImages.get(firstProduct.product_id) ?? null : null,
      thumbnails: productsForCollection
        .map((item) => productImages.get(item.product_id))
        .filter((image): image is string => Boolean(image))
        .slice(0, 3),
    };
  });
};
