// Hook compartilhado pelas 3 telas do fluxo público de venda (produto → carrinho → checkout).
// Resolve o slug tanto para generated_sales_pages (páginas legadas) quanto para
// user_projects publicados, e devolve os dados essenciais para render + checkout.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectAccent,
  getProjectOverrides,
  getProjectProductIds,
  getProjectStoreName,
  type UserProject,
} from "@/lib/userProjects";

/**
 * Extrai o preço editado pelo dono no editor visual. O editor guarda a edição
 * do preço como um textContent override em `metadata.elementOverrides` (path
 * estrutural → { textContent: "R$ 30,00" }). Aqui varremos todos os overrides
 * e pegamos o menor valor em BRL — normalmente é o preço promocional exibido
 * na página; o riscado (original) sempre é maior. Se nenhum override de preço
 * for encontrado, retorna null e o fallback é o preço vindo do catálogo.
 */
function extractEditedPrice(project: UserProject): number | null {
  const overrides = getProjectOverrides(project);
  const priceRe = /R\$\s*([\d.]+(?:,\d{1,2})?)/i;
  const found: number[] = [];
  for (const override of Object.values(overrides)) {
    const text = override?.textContent;
    if (typeof text !== "string") continue;
    const match = text.match(priceRe);
    if (!match) continue;
    const parsed = Number(match[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) found.push(parsed);
  }
  if (found.length === 0) return null;
  return Math.min(...found);
}

export type SalesPageData = {
  slug: string;
  ownerUserId: string;
  productId?: string;
  productTitle: string;
  productImage: string | null;
  price: number;
  accent: string;
  brand: string;
  storeLogoUrl?: string | null;
  storeDescription?: string | null;
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
          .select("id,user_id,catalog_product_id,product_title,hero_image_url,price_brl,store_name,store_logo_url,store_description")
          .eq("slug", slug)
          .maybeSingle();

        if (gsp) {
          if (!active) return;
          const g = gsp as typeof gsp & { store_name?: string | null; store_logo_url?: string | null; store_description?: string | null };
          setData({
            slug,
            ownerUserId: gsp.user_id,
            productId: gsp.catalog_product_id ?? undefined,
            productTitle: gsp.product_title || "Produto",
            productImage: gsp.hero_image_url ?? null,
            price: Number(gsp.price_brl ?? 0),
            accent: "#0A0A0A",
            brand: g.store_name || gsp.product_title || "Loja",
            storeLogoUrl: g.store_logo_url ?? null,
            storeDescription: g.store_description ?? null,
          });
          return;
        }

        // 2) Tenta user_projects publicado
        let project: UserProject | null = await fetchPublicProject(slug);

        // 3) Preview do editor: se o projeto ainda está em rascunho,
        //    fetchPublicProject devolve null (RPC só expõe publicados). Como o
        //    dono está autenticado, buscamos direto em user_projects pelo slug
        //    no metadata — assim o carrinho/checkout preview reflete o produto
        //    real que ele selecionou, sem cair no demo hardcoded.
        if (!project) {
          const { data: draft } = await supabase
            .from("user_projects")
            .select("*")
            .filter("metadata->>slug", "eq", slug)
            .maybeSingle();
          if (draft) project = draft as UserProject;
        }

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
        if (!active) return;
        const editedPrice = extractEditedPrice(project);
        const basePrice = first?.price ?? 149.9;
        setData({
          slug,
          ownerUserId: project.user_id,
          productId: first?.id,
          productTitle: first?.title || project.nome,
          productImage: first?.imageUrl ?? null,
          price: editedPrice ?? basePrice,
          accent: getProjectAccent(project),
          brand: getProjectStoreName(project) || project.nome,
        });

        // Realtime: sincroniza preço/marca em tempo real quando o dono edita
        // no editor. Escuta updates da linha do projeto e re-extrai o preço.
        const channel = supabase
          .channel(`sales-page-${project.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "user_projects", filter: `id=eq.${project.id}` },
            (payload) => {
              if (!active) return;
              const updated = payload.new as UserProject;
              const newEdited = extractEditedPrice(updated);
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      price: newEdited ?? basePrice,
                      brand: getProjectStoreName(updated) || prev.brand,
                      accent: getProjectAccent(updated) || prev.accent,
                    }
                  : prev,
              );
            },
          )
          .subscribe();
        cleanupChannel = () => {
          supabase.removeChannel(channel);
        };
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
      cleanupChannel?.();
    };
  }, [slug]);


  return { data, loading, error };
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
