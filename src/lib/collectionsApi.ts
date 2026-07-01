import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Product } from "@/components/dashboard/ProductCard";

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

export const mapCatalogProductToProduct = (product: CatalogProductRow): Product => {
  const images = getProductImages(product.images);
  const fallbackImage = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";

  return {
    id: product.id,
    nome: product.title || "Produto sem nome",
    categoria: product.category || "Produto",
    preco: product.cost_price || 0,
    image_url: images[0] || fallbackImage,
    images: images.length > 0 ? images : [fallbackImage],
    product_url: product.product_url,
  };
};

export const listCollections = async (limit?: number): Promise<VeloCollection[]> => {
  let query = collectionsDb
    .from("collections")
    .select("id,user_id,name,category,created_at,updated_at")
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

export const getCollection = async (id: string): Promise<VeloCollection> => {
  const { data, error } = await collectionsDb
    .from("collections")
    .select("id,user_id,name,category,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as VeloCollection;
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

export const fetchCollectionProducts = async (collectionId: string): Promise<Product[]> => {
  const { data: rows, error: rowsError } = await collectionsDb
    .from("collection_products")
    .select("product_id,created_at,added_at")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (rowsError) throw rowsError;

  const productIds = ((rows ?? []) as VeloCollectionProduct[]).map((row) => row.product_id);
  if (productIds.length === 0) return [];

  const { data: products, error: productsError } = await supabase
    .from("catalog_products")
    .select("*")
    .in("id", productIds);

  if (productsError) throw productsError;

  const byId = new Map(((products ?? []) as CatalogProductRow[]).map((product) => [product.id, product]));
  return productIds
    .map((id) => byId.get(id))
    .filter((product): product is CatalogProductRow => Boolean(product))
    .map(mapCatalogProductToProduct);
};

export const listCollectionsWithSummaries = async (): Promise<CollectionSummary[]> => {
  const collections = await listCollections();
  if (collections.length === 0) return [];

  const collectionIds = collections.map((collection) => collection.id);
  const { data: rows, error: rowsError } = await collectionsDb
    .from("collection_products")
    .select("collection_id,product_id,created_at,added_at")
    .in("collection_id", collectionIds)
    .order("created_at", { ascending: false, nullsFirst: false });

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
