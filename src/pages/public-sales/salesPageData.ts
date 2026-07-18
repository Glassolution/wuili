// Hook compartilhado pelas 3 telas do fluxo público de venda (produto → carrinho → checkout).
// Fase 1 da unificação: fonte de verdade é user_projects. Páginas legadas
// (generated_sales_pages) foram migradas para user_projects com
// source_kind='generated_sales_page' e não são mais consultadas aqui.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectAccent,
  getProjectProductIds,
  getProjectStoreName,
  resolveProjectPrice,
  type UserProject,
} from "@/lib/userProjects";
import { formatPriceBRL, parsePriceBRL } from "@/lib/priceFormat";

/**
 * Preço definido pelo dono no editor, ou null para usar o do catálogo.
 * A resolução (metadata.price, com fallback na varredura de overrides dos
 * projetos antigos) mora em resolveProjectPrice — a mesma que a página de
 * produto usa, para carrinho e vitrine nunca divergirem.
 */
function extractEditedPrice(project: UserProject): number | null {
  const SENTINEL = -1;
  const resolved = resolveProjectPrice(project, SENTINEL);
  return resolved === SENTINEL ? null : resolved;
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
    let cleanupChannel: (() => void) | null = null;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) user_projects publicado (fonte de verdade unificada).
        let project: UserProject | null = await fetchPublicProject(slug);

        // 2) Preview do editor: se o projeto ainda está em rascunho,
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

        // BroadcastChannel: reflete as edições do dono em tempo real, ANTES
        // do autosave chegar ao banco. O editor emite overrides a cada mudança
        // e aqui re-extraímos o preço/marca localmente.
        let bc: BroadcastChannel | null = null;
        if (typeof BroadcastChannel !== "undefined") {
          try {
            bc = new BroadcastChannel(`sales-page:${slug}`);
            bc.onmessage = (ev) => {
              if (!active) return;
              const msg = ev.data as { type?: string; storeName?: string; accent?: string; price?: number | null; elementOverrides?: Record<string, { textContent?: string }> } | null;
              if (!msg || msg.type !== "overrides") return;
              // Preço numérico enviado pelo editor; só cai na varredura de texto
              // para projetos antigos, sem metadata.price.
              let newEdited: number | null =
                typeof msg.price === "number" && Number.isFinite(msg.price) && msg.price > 0 ? msg.price : null;
              if (newEdited === null) {
                const found: number[] = [];
                for (const ov of Object.values(msg.elementOverrides ?? {})) {
                  const t = ov?.textContent;
                  if (typeof t !== "string" || !/R\$/i.test(t)) continue;
                  const n = parsePriceBRL(t);
                  if (n !== null) found.push(n);
                }
                newEdited = found.length ? Math.min(...found) : null;
              }
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      price: newEdited ?? basePrice,
                      brand: msg.storeName || prev.brand,
                      accent: msg.accent || prev.accent,
                    }
                  : prev,
              );
            };
          } catch { /* sem suporte */ }
        }

        cleanupChannel = () => {
          supabase.removeChannel(channel);
          bc?.close();
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

// Centavos sempre visíveis (R$ 30,00), igual ao canvas do editor.
export const formatBRL = (value: number) => formatPriceBRL(Number(value ?? 0));
