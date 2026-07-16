// Hook compartilhado pelas 3 telas do fluxo público de venda (produto → carrinho → checkout).
// Resolve o slug tanto para generated_sales_pages (páginas legadas) quanto para
// user_projects publicados, e devolve os dados essenciais para render + checkout.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectAccent,
  getProjectProductIds,
  getProjectStoreName,
  type UserProject,
} from "@/lib/userProjects";

export type SalesPageData = {
  slug: string;
  ownerUserId: string;
  productId?: string;
  productTitle: string;
  productImage: string | null;
  price: number;
  accent: string;
  brand: string;
};

export function useSalesPageData(slug: string | undefined) {
  const [data, setData] = useState<SalesPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("slug ausente");
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) Tenta generated_sales_pages
        const { data: gsp } = await supabase
          .from("generated_sales_pages")
          .select("id,user_id,catalog_product_id,product_title,hero_image_url,price_brl")
          .eq("slug", slug)
          .maybeSingle();

        if (gsp) {
          if (!active) return;
          setData({
            slug,
            ownerUserId: gsp.user_id,
            productId: gsp.catalog_product_id ?? undefined,
            productTitle: gsp.product_title || "Produto",
            productImage: gsp.hero_image_url ?? null,
            price: Number(gsp.price_brl ?? 0),
            accent: "#0A0A0A",
            brand: gsp.product_title || "Loja",
          });
          return;
        }

        // 2) Tenta user_projects publicado
        const project: UserProject | null = await fetchPublicProject(slug);
        if (!project) {
          if (active) setError("página não encontrada");
          return;
        }
        const productIds = getProjectProductIds(project);
        const products = await fetchPublicStoreProducts(productIds);
        const first = products[0];
        if (!active) return;
        setData({
          slug,
          ownerUserId: project.user_id,
          productId: first?.id,
          productTitle: first?.title || project.nome,
          productImage: first?.imageUrl ?? null,
          price: first?.price ?? 149.9,
          accent: getProjectAccent(project),
          brand: getProjectStoreName(project) || project.nome,
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "erro");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return { data, loading, error };
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
