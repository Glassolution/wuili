// Hook compartilhado pelas 3 telas do fluxo público de venda (produto → carrinho → checkout).
// Resolve o slug tanto para generated_sales_pages (páginas legadas) quanto para
// user_projects publicados, e devolve os dados essenciais para render + checkout.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectAccent,
  getProjectCheckout,
  getProjectProductIds,
  getProjectStoreName,
  getProjectLogoImage,
  type CheckoutCustomization,
  type UserProject,
} from "@/lib/userProjects";

export type SalesPageData = {
  slug: string;
  projectId?: string;
  ownerUserId: string;
  productId?: string;
  productTitle: string;
  productImage: string | null;
  price: number;              // preço final aplicado ao cliente (com override, se houver)
  accent: string;
  brand: string;
  logoImage: string | null;
  checkout: CheckoutCustomization;
  // Dados exibidos apenas para o dono da loja (preview): custo unitário e lucro.
  ownerCostPrice: number | null;
  isOwnerPreview: boolean;
};

export function useSalesPageData(slug: string | undefined) {
  const [data, setData] = useState<SalesPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";
    const demoData: SalesPageData = {
      slug: slug ?? "preview",
      ownerUserId: "",
      productTitle: "Kit Manicure E Pedicure Portátil Com 18 Peças",
      productImage: null,
      price: 25,
      accent: "#0A0A0A",
      brand: "Sua loja",
      logoImage: null,
      checkout: {},
      ownerCostPrice: null,
      isOwnerPreview: false,
    };
    if (!slug) {
      if (isPreview) {
        setData(demoData);
        setLoading(false);
        setError(null);
        return;
      }
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
            logoImage: null,
            checkout: {},
            ownerCostPrice: null,
            isOwnerPreview: false,
          });
          return;
        }

        // 2) Tenta user_projects publicado
        const project: UserProject | null = await fetchPublicProject(slug);
        if (!project) {
          if (!active) return;
          if (isPreview) {
            setData(demoData);
          } else {
            setError("página não encontrada");
          }
          return;
        }
        const productIds = getProjectProductIds(project);
        const products = await fetchPublicStoreProducts(productIds);
        const first = products[0];
        const checkout = getProjectCheckout(project);
        const priceOverride = typeof checkout.priceOverride === "number" && checkout.priceOverride > 0 ? checkout.priceOverride : null;
        const finalPrice = priceOverride ?? (first?.price ?? 149.9);

        // Owner-only: custo real do produto para calcular lucro (apenas em preview e se dono logado).
        let ownerCostPrice: number | null = null;
        let isOwnerPreview = false;
        if (isPreview && first?.id) {
          const { data: sessionRes } = await supabase.auth.getUser();
          if (sessionRes?.user?.id === project.user_id) {
            isOwnerPreview = true;
            const { data: cp } = await supabase
              .from("catalog_products")
              .select("cost_price")
              .eq("id", first.id)
              .maybeSingle();
            ownerCostPrice = cp?.cost_price != null ? Number(cp.cost_price) : null;
          }
        }

        if (!active) return;
        setData({
          slug,
          projectId: project.id,
          ownerUserId: project.user_id,
          productId: first?.id,
          productTitle: first?.title || project.nome,
          productImage: first?.imageUrl ?? null,
          price: finalPrice,
          accent: checkout.accent || getProjectAccent(project),
          brand: checkout.brandName || getProjectStoreName(project) || project.nome,
          logoImage: checkout.logoImage ?? getProjectLogoImage(project),
          checkout,
          ownerCostPrice,
          isOwnerPreview,
        });
      } catch (err) {
        if (!active) return;
        if (isPreview) {
          setData(demoData);
        } else {
          setError(err instanceof Error ? err.message : "erro");
        }
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

/** Pill de lucro visível apenas para o dono no preview. */
export function computeProfit(price: number, cost: number | null | undefined) {
  if (!cost || cost <= 0) return null;
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  return { profit, margin };
}
